import { tool } from "ai";
import { z } from "zod";
import { getChannelHistory, formatMessagesForContext } from "@/lib/slack";
import { getActionsForAccount } from "@/lib/db/account-actions";

// Tool definitions for the briefing generator agent
export const briefingGeneratorTools = {
  fetch_recent_messages: tool({
    description: "Fetch recent Slack messages from the account's channel to understand the current situation. Use this to get context about what's happening.",
    inputSchema: z.object({
      channelId: z.string().describe("The Slack channel ID"),
      daysBack: z.number().min(1).max(30).default(7).describe("Number of days to look back (default 7)"),
    }),
    execute: async ({ channelId, daysBack }) => {
      try {
        const messages = await getChannelHistory(channelId, daysBack);
        if (messages.length === 0) {
          return {
            success: true,
            messageCount: 0,
            content: "No messages found in this time period.",
          };
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

  get_past_actions: tool({
    description: "Get past actions that have been taken on this account. Helps avoid suggesting something that was already done recently.",
    inputSchema: z.object({
      accountId: z.string().describe("The account UUID"),
      limit: z.number().min(1).max(20).default(10).describe("Number of past actions to retrieve"),
    }),
    execute: async ({ accountId, limit }) => {
      try {
        const actions = await getActionsForAccount(accountId, limit);
        if (actions.length === 0) {
          return {
            success: true,
            actionCount: 0,
            content: "No past actions found for this account.",
          };
        }

        const summary = actions.map((a) => ({
          date: new Date(a.created_at).toLocaleDateString(),
          type: a.action_type,
          status: a.status,
          summary: a.issue_summary,
          message: a.executed_message || a.suggested_action,
        }));

        return {
          success: true,
          actionCount: actions.length,
          actions: summary,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to fetch past actions",
        };
      }
    },
  }),

  generate_suggestion: tool({
    description: "Generate the final suggestion for this account. Call this after gathering context from messages and past actions.",
    inputSchema: z.object({
      issueSummary: z.string().describe("A one-sentence summary of the key issue or situation"),
      suggestedSlackMessage: z.string().describe("The suggested Slack message to send. Should be direct, reference the specific issue, and offer a next step."),
      reasoning: z.string().describe("Brief explanation of why this action is recommended"),
    }),
    execute: async ({ issueSummary, suggestedSlackMessage, reasoning }) => {
      return {
        success: true,
        suggestion: {
          issueSummary,
          suggestedSlackMessage,
          reasoning,
        },
      };
    },
  }),
};

// System prompt for the briefing generator agent
export const BRIEFING_GENERATOR_SYSTEM_PROMPT = `You are an expert customer success manager assistant. Your job is to analyze an at-risk customer account and generate a specific, actionable suggestion for outreach.

## Your Process

1. **Fetch recent messages** from the account's Slack channel to understand what's happening
2. **Check past actions** to see what's already been done (avoid repeating recent outreach)
3. **Generate a suggestion** with:
   - A ONE SENTENCE issue summary (what's wrong or needs attention)
   - A suggested Slack message to send to the channel

## Guidelines for Issue Summary

- Keep it to ONE sentence
- Be specific about the issue (not "customer is unhappy" but "customer has been waiting 3 days for API documentation")
- Focus on what matters most right now

## Guidelines for Slack Messages

- Start with context about why you're reaching out
- Reference the specific issue or request
- Offer a concrete next step
- Keep it concise but warm - you're a helpful CSM, not a robot
- NO sign-offs (no "Thanks!", "Best,", etc.) - just end naturally
- Don't be overly apologetic - be helpful and proactive

### Good Examples:
- "Hey team, wanted to check in on the API integration - I saw there were some questions about authentication last week. Happy to jump on a call today or tomorrow to walk through it together."
- "Following up on the billing question from Tuesday - I've confirmed with our finance team that we can prorate the difference. Want me to process that adjustment?"
- "Noticed the dashboard load times have been slow this week. Our engineering team pushed a fix yesterday - are things looking better on your end?"

### Bad Examples (avoid):
- "Just checking in to see how things are going!" (too generic)
- "I hope this message finds you well. I wanted to reach out regarding..." (too formal/robotic)
- "Sorry for the delay! Thanks so much for your patience!" (overly apologetic)

## CRITICAL

You MUST call the generate_suggestion tool at the end with your recommendation. Do not stop until you have called generate_suggestion.

If there's not enough context to make a specific suggestion, still generate one based on what you can determine. A general check-in is better than no action.`;

// System prompt for revising suggestions
export const BRIEFING_REVISER_SYSTEM_PROMPT = `You are an expert customer success manager assistant. Your role is to revise a suggested Slack message based on user feedback.

You will receive:
1. The current suggested message
2. The issue summary
3. User feedback about what to change

Common revision requests:
- "Make it shorter" → Condense while keeping key points
- "Make it more casual/formal" → Adjust tone
- "Add [specific detail]" → Include the requested information
- "Focus on [topic]" → Emphasize different aspect

After revising, call generate_suggestion with the updated message.

Guidelines:
- Keep the same issue summary unless asked to change it
- Preserve important context from the original
- Make only the requested changes, don't over-edit
- NO sign-offs (no "Thanks!", "Best,", etc.)
- Maintain a helpful, warm tone

CRITICAL: You MUST call generate_suggestion at the end with your revised recommendation.`;
