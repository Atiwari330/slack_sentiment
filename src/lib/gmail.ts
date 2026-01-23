import { supabase, GmailToken } from "@/lib/supabase";
import { encrypt, decrypt } from "@/lib/encryption";

// Gmail OAuth configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/gmail/callback";

// Gmail API endpoints
const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";
const GOOGLE_OAUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

// Scopes needed for sending and reading email
const SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
];

export function getOAuthUrl(state?: string): string {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error("GOOGLE_CLIENT_ID is not configured");
  }

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI!,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
  });

  if (state) {
    params.append("state", state);
  }

  return `${GOOGLE_OAUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  email: string;
}> {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error("Google OAuth credentials are not configured");
  }

  // Exchange code for tokens
  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: GOOGLE_REDIRECT_URI!,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    throw new Error(`Failed to exchange code for tokens: ${error}`);
  }

  const tokens = await tokenResponse.json();

  // Get user email
  const userInfoResponse = await fetch(
    "https://www.googleapis.com/oauth2/v2/userinfo",
    {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    }
  );

  if (!userInfoResponse.ok) {
    throw new Error("Failed to get user info");
  }

  const userInfo = await userInfoResponse.json();

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    email: userInfo.email,
  };
}

export async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  expiresAt: Date;
}> {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error("Google OAuth credentials are not configured");
  }

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to refresh access token");
  }

  const tokens = await response.json();

  return {
    accessToken: tokens.access_token,
    expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
  };
}

// Database operations for Gmail tokens
export async function saveGmailTokens(
  email: string,
  accessToken: string,
  refreshToken: string,
  expiresAt: Date
): Promise<void> {
  const encryptedAccessToken = encrypt(accessToken);
  const encryptedRefreshToken = encrypt(refreshToken);

  // Upsert tokens (update if email exists)
  const { error } = await supabase
    .from("gmail_tokens")
    .upsert(
      {
        email,
        access_token_encrypted: encryptedAccessToken,
        refresh_token_encrypted: encryptedRefreshToken,
        token_expiry: expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "email" }
    );

  if (error) throw error;
}

export async function getGmailTokens(): Promise<GmailToken | null> {
  const { data, error } = await supabase
    .from("gmail_tokens")
    .select("*")
    .limit(1)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }

  return data;
}

export async function deleteGmailTokens(): Promise<void> {
  const { error } = await supabase.from("gmail_tokens").delete().not("id", "is", null);

  if (error) throw error;
}

export async function getValidAccessToken(): Promise<{
  accessToken: string;
  email: string;
}> {
  const tokens = await getGmailTokens();
  if (!tokens) {
    throw new Error("Gmail not connected");
  }

  const accessToken = decrypt(tokens.access_token_encrypted);
  const refreshToken = decrypt(tokens.refresh_token_encrypted);
  const expiresAt = new Date(tokens.token_expiry);

  // Check if token is expired (with 5 minute buffer)
  const isExpired = expiresAt.getTime() - 5 * 60 * 1000 < Date.now();

  if (isExpired) {
    // Refresh the token
    const newTokens = await refreshAccessToken(refreshToken);

    // Save the new tokens
    await saveGmailTokens(
      tokens.email,
      newTokens.accessToken,
      refreshToken, // Keep the same refresh token
      newTokens.expiresAt
    );

    return {
      accessToken: newTokens.accessToken,
      email: tokens.email,
    };
  }

  return {
    accessToken,
    email: tokens.email,
  };
}

// Send email via Gmail API
export async function sendEmail(
  to: string,
  subject: string,
  body: string
): Promise<{ messageId: string }> {
  const { accessToken } = await getValidAccessToken();

  // Create the email in RFC 2822 format
  const email = [
    `To: ${to}`,
    `Subject: ${subject}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    body,
  ].join("\r\n");

  // Base64url encode the email
  const encodedEmail = Buffer.from(email)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const response = await fetch(`${GMAIL_API_BASE}/messages/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw: encodedEmail }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to send email: ${error}`);
  }

  const result = await response.json();
  return { messageId: result.id };
}

// ============================================================
// Types for Gmail search and read operations
// ============================================================

export interface GmailSearchParams {
  from?: string;
  to?: string;
  subject?: string;
  keywords?: string;
  afterDate?: string; // YYYY/MM/DD format
  beforeDate?: string; // YYYY/MM/DD format
  isUnread?: boolean;
}

export interface GmailSearchResult {
  id: string;
  threadId: string;
}

export interface GmailMessageHeaders {
  from: string;
  to: string;
  subject: string;
  date: string;
  cc?: string;
  messageId?: string;
  inReplyTo?: string;
  references?: string;
}

export interface GmailMessageBody {
  plain?: string;
  html?: string;
}

export interface GmailMessage {
  id: string;
  threadId: string;
  headers: GmailMessageHeaders;
  body: GmailMessageBody;
  snippet: string;
  internalDate: string;
}

export interface GmailThread {
  id: string;
  messages: GmailMessage[];
  snippet: string;
}

// ============================================================
// Gmail Search and Read Functions
// ============================================================

/**
 * Build a Gmail search query string from params
 */
export function buildSearchQuery(params: GmailSearchParams): string {
  const parts: string[] = [];

  if (params.from) {
    parts.push(`from:${params.from}`);
  }
  if (params.to) {
    parts.push(`to:${params.to}`);
  }
  if (params.subject) {
    parts.push(`subject:${params.subject}`);
  }
  if (params.keywords) {
    parts.push(params.keywords);
  }
  if (params.afterDate) {
    parts.push(`after:${params.afterDate}`);
  }
  if (params.beforeDate) {
    parts.push(`before:${params.beforeDate}`);
  }
  if (params.isUnread) {
    parts.push("is:unread");
  }

  return parts.join(" ");
}

/**
 * Search messages in Gmail
 */
export async function searchMessages(
  query: string,
  maxResults: number = 10
): Promise<GmailSearchResult[]> {
  const { accessToken } = await getValidAccessToken();

  const params = new URLSearchParams({
    q: query,
    maxResults: maxResults.toString(),
  });

  const response = await fetch(
    `${GMAIL_API_BASE}/messages?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to search messages: ${error}`);
  }

  const result = await response.json();
  return result.messages || [];
}

/**
 * Extract headers from Gmail API payload
 */
function extractHeaders(
  headers: Array<{ name: string; value: string }>
): GmailMessageHeaders {
  const headerMap: Record<string, string> = {};
  for (const header of headers) {
    headerMap[header.name.toLowerCase()] = header.value;
  }

  return {
    from: headerMap["from"] || "",
    to: headerMap["to"] || "",
    subject: headerMap["subject"] || "",
    date: headerMap["date"] || "",
    cc: headerMap["cc"],
    messageId: headerMap["message-id"],
    inReplyTo: headerMap["in-reply-to"],
    references: headerMap["references"],
  };
}

/**
 * Decode base64url encoded content
 */
function decodeBase64Url(data: string): string {
  // Replace URL-safe characters
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  // Decode
  return Buffer.from(base64, "base64").toString("utf-8");
}

/**
 * Extract message body from Gmail API payload (handles multipart)
 */
export function extractMessageBody(
  payload: {
    mimeType?: string;
    body?: { data?: string };
    parts?: Array<{
      mimeType?: string;
      body?: { data?: string };
      parts?: Array<{
        mimeType?: string;
        body?: { data?: string };
      }>;
    }>;
  }
): GmailMessageBody {
  const result: GmailMessageBody = {};

  // Simple single-part message
  if (payload.body?.data) {
    const content = decodeBase64Url(payload.body.data);
    if (payload.mimeType === "text/plain") {
      result.plain = content;
    } else if (payload.mimeType === "text/html") {
      result.html = content;
    } else {
      result.plain = content;
    }
    return result;
  }

  // Multipart message
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        result.plain = decodeBase64Url(part.body.data);
      } else if (part.mimeType === "text/html" && part.body?.data) {
        result.html = decodeBase64Url(part.body.data);
      } else if (
        part.mimeType?.startsWith("multipart/") &&
        part.parts
      ) {
        // Nested multipart
        for (const nestedPart of part.parts) {
          if (nestedPart.mimeType === "text/plain" && nestedPart.body?.data) {
            result.plain = decodeBase64Url(nestedPart.body.data);
          } else if (nestedPart.mimeType === "text/html" && nestedPart.body?.data) {
            result.html = decodeBase64Url(nestedPart.body.data);
          }
        }
      }
    }
  }

  return result;
}

/**
 * Parse raw Gmail API message response into GmailMessage
 */
export function parseGmailMessage(raw: {
  id: string;
  threadId: string;
  snippet: string;
  internalDate: string;
  payload: {
    headers: Array<{ name: string; value: string }>;
    mimeType?: string;
    body?: { data?: string };
    parts?: Array<{
      mimeType?: string;
      body?: { data?: string };
      parts?: Array<{
        mimeType?: string;
        body?: { data?: string };
      }>;
    }>;
  };
}): GmailMessage {
  return {
    id: raw.id,
    threadId: raw.threadId,
    headers: extractHeaders(raw.payload.headers),
    body: extractMessageBody(raw.payload),
    snippet: raw.snippet,
    internalDate: raw.internalDate,
  };
}

/**
 * Get a single message by ID
 */
export async function getMessage(messageId: string): Promise<GmailMessage> {
  const { accessToken } = await getValidAccessToken();

  const response = await fetch(
    `${GMAIL_API_BASE}/messages/${messageId}?format=full`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get message: ${error}`);
  }

  const raw = await response.json();
  return parseGmailMessage(raw);
}

/**
 * Get an entire thread by ID
 */
export async function getThread(threadId: string): Promise<GmailThread> {
  const { accessToken } = await getValidAccessToken();

  const response = await fetch(
    `${GMAIL_API_BASE}/threads/${threadId}?format=full`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get thread: ${error}`);
  }

  const raw = await response.json();

  return {
    id: raw.id,
    messages: raw.messages.map(parseGmailMessage),
    snippet: raw.snippet,
  };
}

/**
 * Format a thread for LLM context
 */
export function formatThreadForContext(thread: GmailThread): string {
  const lines: string[] = [];
  lines.push(`Email Thread (${thread.messages.length} messages)`);
  lines.push("=".repeat(50));

  for (const msg of thread.messages) {
    const date = new Date(parseInt(msg.internalDate)).toLocaleString();
    lines.push("");
    lines.push(`From: ${msg.headers.from}`);
    lines.push(`To: ${msg.headers.to}`);
    if (msg.headers.cc) {
      lines.push(`Cc: ${msg.headers.cc}`);
    }
    lines.push(`Date: ${date}`);
    lines.push(`Subject: ${msg.headers.subject}`);
    lines.push("-".repeat(40));
    lines.push(msg.body.plain || msg.body.html || msg.snippet);
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Send a reply to an existing message (maintains threading)
 */
export async function sendReply(
  originalMessage: GmailMessage,
  body: string
): Promise<{ messageId: string }> {
  const { accessToken, email } = await getValidAccessToken();

  // Build proper threading headers
  const messageId = originalMessage.headers.messageId || "";
  const references = originalMessage.headers.references
    ? `${originalMessage.headers.references} ${messageId}`
    : messageId;

  // Determine the reply-to address (use From of original)
  const replyTo = originalMessage.headers.from;

  // Build subject (add Re: if not already present)
  let subject = originalMessage.headers.subject;
  if (!subject.toLowerCase().startsWith("re:")) {
    subject = `Re: ${subject}`;
  }

  // Create the email in RFC 2822 format with threading headers
  const emailParts = [
    `From: ${email}`,
    `To: ${replyTo}`,
    `Subject: ${subject}`,
    `In-Reply-To: ${messageId}`,
    `References: ${references}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    body,
  ];

  const emailContent = emailParts.join("\r\n");

  // Base64url encode the email
  const encodedEmail = Buffer.from(emailContent)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const response = await fetch(`${GMAIL_API_BASE}/messages/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      raw: encodedEmail,
      threadId: originalMessage.threadId,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to send reply: ${error}`);
  }

  const result = await response.json();
  return { messageId: result.id };
}

/**
 * Check if the current Gmail token has the readonly scope
 * Returns false if user needs to re-authorize
 */
export async function hasReadScope(): Promise<boolean> {
  try {
    const { accessToken } = await getValidAccessToken();

    // Try a simple search to verify read access
    const response = await fetch(
      `${GMAIL_API_BASE}/messages?maxResults=1`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    return response.ok;
  } catch {
    return false;
  }
}
