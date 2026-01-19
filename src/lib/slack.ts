import { WebClient } from "@slack/web-api";

// Initialize Slack client
const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

export interface SlackChannel {
  id: string;
  name: string;
  topic?: string;
  purpose?: string;
  memberCount?: number;
  isPrivate: boolean;
}

export interface SlackMessage {
  user?: string;
  text: string;
  timestamp: string;
  date: Date;
  username?: string;
}

/**
 * Fetch all channels the bot has access to
 */
export async function getChannels(): Promise<SlackChannel[]> {
  const channels: SlackChannel[] = [];
  let cursor: string | undefined;

  do {
    const response = await slack.conversations.list({
      types: "public_channel,private_channel",
      exclude_archived: true,
      limit: 200,
      cursor,
    });

    if (response.channels) {
      for (const channel of response.channels) {
        if (channel.id && channel.name) {
          channels.push({
            id: channel.id,
            name: channel.name,
            topic: channel.topic?.value,
            purpose: channel.purpose?.value,
            memberCount: channel.num_members,
            isPrivate: channel.is_private ?? false,
          });
        }
      }
    }

    cursor = response.response_metadata?.next_cursor;
  } while (cursor);

  // Sort alphabetically by name
  return channels.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Fetch message history from a channel for the last N days
 */
export async function getChannelHistory(
  channelId: string,
  daysBack: number = 10
): Promise<SlackMessage[]> {
  const messages: SlackMessage[] = [];
  const oldestTimestamp = Math.floor(
    (Date.now() - daysBack * 24 * 60 * 60 * 1000) / 1000
  ).toString();

  let cursor: string | undefined;

  do {
    const response = await slack.conversations.history({
      channel: channelId,
      oldest: oldestTimestamp,
      limit: 200,
      cursor,
    });

    if (response.messages) {
      for (const msg of response.messages) {
        // Skip bot messages and system messages
        if (msg.subtype && msg.subtype !== "file_share") continue;
        if (!msg.text || !msg.ts) continue;

        messages.push({
          user: msg.user,
          text: msg.text,
          timestamp: msg.ts,
          date: new Date(parseFloat(msg.ts) * 1000),
          username: msg.username,
        });
      }
    }

    cursor = response.response_metadata?.next_cursor;
  } while (cursor);

  // Sort by timestamp (oldest first)
  return messages.sort(
    (a, b) => parseFloat(a.timestamp) - parseFloat(b.timestamp)
  );
}

/**
 * Get user info by ID (for displaying names)
 */
export async function getUserInfo(
  userId: string
): Promise<{ name: string; realName?: string } | null> {
  try {
    const response = await slack.users.info({ user: userId });
    if (response.user) {
      return {
        name: response.user.name ?? "unknown",
        realName: response.user.real_name,
      };
    }
  } catch {
    // User not found or no permission
  }
  return null;
}

/**
 * Format messages for LLM context
 */
export function formatMessagesForContext(messages: SlackMessage[]): string {
  if (messages.length === 0) {
    return "No messages found in the specified time period.";
  }

  const formatted = messages.map((msg) => {
    const date = msg.date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    const sender = msg.username || msg.user || "Unknown";
    return `[${date}] ${sender}: ${msg.text}`;
  });

  return formatted.join("\n");
}

/**
 * Post a message to a Slack channel
 * Returns the message timestamp (ts) which serves as the message ID
 */
export async function postMessage(channelId: string, text: string): Promise<string> {
  const response = await slack.chat.postMessage({
    channel: channelId,
    text: text,
  });

  if (!response.ok || !response.ts) {
    throw new Error(response.error || "Failed to post message to Slack");
  }

  return response.ts;
}

export interface SlackUser {
  id: string;
  name: string;
  realName?: string;
  email?: string;
}

/**
 * Look up a Slack user by their email address
 * Requires the users:read.email scope on the Slack bot
 */
export async function getSlackUserByEmail(email: string): Promise<SlackUser | null> {
  try {
    const response = await slack.users.lookupByEmail({ email });
    if (response.ok && response.user) {
      return {
        id: response.user.id!,
        name: response.user.name ?? "unknown",
        realName: response.user.real_name,
        email: response.user.profile?.email,
      };
    }
  } catch {
    // User not found or no permission (users:read.email scope required)
  }
  return null;
}
