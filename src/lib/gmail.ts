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

// Scopes needed for sending email
const SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
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
  const { error } = await supabase.from("gmail_tokens").delete().neq("id", "");

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
