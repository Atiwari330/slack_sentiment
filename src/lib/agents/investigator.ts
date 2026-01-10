import { tool } from "ai";
import { z } from "zod";
import { getChannelHistory, formatMessagesForContext } from "@/lib/slack";
import { getSentimentHistory } from "@/lib/db/sentiment";

// Tool definitions for the investigator agent
export const investigatorTools = {
  fetch_messages: tool({
    description: "Fetch Slack messages from a channel for a given time period. Use this to get the raw conversation history.",
    parameters: z.object({
      channelId: z.string().describe("The Slack channel ID"),
      daysBack: z.number().min(1).max(90).describe("Number of days to look back (1-90)"),
    }),
    execute: async ({ channelId, daysBack }) => {
      try {
        const messages = await getChannelHistory(channelId, daysBack);
        if (messages.length === 0) {
          return { success: true, messageCount: 0, content: "No messages found in this time period." };
        }
        const formatted = formatMessagesForContext(messages);
        return {
          success: true,
          messageCount: messages.length,
          content: formatted,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to fetch messages",
        };
      }
    },
  }),

  search_messages: tool({
    description: "Search for specific keywords or phrases within channel messages. Returns matching messages only.",
    parameters: z.object({
      channelId: z.string().describe("The Slack channel ID"),
      query: z.string().describe("Search term or phrase to find"),
      daysBack: z.number().min(1).max(90).default(30).describe("Number of days to search (default 30)"),
    }),
    execute: async ({ channelId, query, daysBack }) => {
      try {
        const messages = await getChannelHistory(channelId, daysBack);
        const queryLower = query.toLowerCase();
        const filtered = messages.filter((m) =>
          m.text.toLowerCase().includes(queryLower)
        );

        if (filtered.length === 0) {
          return {
            success: true,
            matchCount: 0,
            content: `No messages found containing "${query}" in the last ${daysBack} days.`,
          };
        }

        const formatted = formatMessagesForContext(filtered);
        return {
          success: true,
          matchCount: filtered.length,
          totalMessages: messages.length,
          content: formatted,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to search messages",
        };
      }
    },
  }),

  get_sentiment_history: tool({
    description: "Get historical sentiment analysis results for an account. Shows how sentiment has changed over time.",
    parameters: z.object({
      accountId: z.string().describe("The account UUID"),
      limit: z.number().min(1).max(100).default(30).describe("Number of historical records to fetch"),
    }),
    execute: async ({ accountId, limit }) => {
      try {
        const history = await getSentimentHistory(accountId, limit);
        if (history.length === 0) {
          return { success: true, records: 0, content: "No sentiment history found for this account." };
        }

        const summary = history.map((h) => ({
          date: new Date(h.analyzed_at).toLocaleDateString(),
          sentiment: h.sentiment,
          summary: h.summary,
          urgency: h.urgency,
        }));

        return {
          success: true,
          records: history.length,
          history: summary,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to fetch sentiment history",
        };
      }
    },
  }),

  analyze_response_times: tool({
    description: "Analyze response time patterns between customer and vendor in the channel. Identifies who spoke last and waiting times.",
    parameters: z.object({
      channelId: z.string().describe("The Slack channel ID"),
      daysBack: z.number().min(1).max(30).default(7).describe("Number of days to analyze"),
    }),
    execute: async ({ channelId, daysBack }) => {
      try {
        const messages = await getChannelHistory(channelId, daysBack);

        if (messages.length === 0) {
          return {
            success: true,
            content: "No messages found in this time period.",
          };
        }

        // Sort by timestamp (newest first already from API)
        const sorted = [...messages].sort(
          (a, b) => parseFloat(b.ts) - parseFloat(a.ts)
        );

        // Find last message from each party
        // In a real implementation, you'd need to distinguish customer vs vendor users
        // For now, we'll provide basic message analysis
        const lastMessage = sorted[0];
        const lastMessageTime = new Date(parseFloat(lastMessage.ts) * 1000);
        const now = new Date();
        const hoursSinceLastMessage = Math.round(
          (now.getTime() - lastMessageTime.getTime()) / (1000 * 60 * 60)
        );

        // Calculate average time between messages
        let totalGaps = 0;
        let gapCount = 0;
        for (let i = 1; i < sorted.length; i++) {
          const gap =
            parseFloat(sorted[i - 1].ts) - parseFloat(sorted[i].ts);
          totalGaps += gap;
          gapCount++;
        }
        const avgGapHours =
          gapCount > 0 ? Math.round((totalGaps / gapCount) / 3600) : 0;

        return {
          success: true,
          totalMessages: messages.length,
          lastMessageTime: lastMessageTime.toISOString(),
          hoursSinceLastMessage,
          averageResponseTimeHours: avgGapHours,
          lastMessagePreview:
            lastMessage.text.substring(0, 100) +
            (lastMessage.text.length > 100 ? "..." : ""),
          lastMessageUser: lastMessage.username || "Unknown",
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to analyze response times",
        };
      }
    },
  }),
};

// System prompt for the investigator agent
export const INVESTIGATOR_SYSTEM_PROMPT = `You are an expert customer success analyst helping to investigate a customer account. You have access to tools that let you fetch and analyze Slack conversation history.

Your role is to:
1. Answer questions about the customer relationship
2. Find specific information in conversation history
3. Identify patterns and trends
4. Provide actionable insights

When answering questions:
- Use the available tools to gather information first
- Be specific and cite timestamps/dates when relevant
- If you can't find something, say so clearly
- Provide context around your findings

Available tools:
- fetch_messages: Get all messages from a time period
- search_messages: Find specific keywords/phrases
- get_sentiment_history: See how sentiment has changed over time
- analyze_response_times: Understand response patterns

Be concise but thorough in your responses.`;
