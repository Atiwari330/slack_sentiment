import { tool } from "ai";
import { z } from "zod";
import { searchContacts } from "@/lib/db/contacts";
import { getSlackUserByEmail, getChannelHistory, formatMessagesForContext } from "@/lib/slack";

// Tool definitions for the channel audit agent
export const channelAuditTools = {
  fetch_channel_context: tool({
    description: "Fetch recent messages from the Slack channel for analysis. Use this to get conversation context.",
    inputSchema: z.object({
      channelId: z.string().describe("The Slack channel ID"),
      daysBack: z.number().default(5).describe("Number of days of history to fetch (default: 5)"),
    }),
    execute: async ({ channelId, daysBack }) => {
      try {
        const messages = await getChannelHistory(channelId, daysBack);
        const formatted = formatMessagesForContext(messages);
        return {
          success: true,
          messageCount: messages.length,
          context: formatted,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to fetch channel messages",
        };
      }
    },
  }),

  search_contacts: tool({
    description: "Search for contacts by name, email, or company. Use this to find people mentioned in conversations.",
    inputSchema: z.object({
      query: z.string().describe("Search term - could be a name, company, or email"),
    }),
    execute: async ({ query }) => {
      try {
        const contacts = await searchContacts(query);
        if (contacts.length === 0) {
          return {
            success: true,
            found: false,
            message: `No contacts found matching "${query}"`,
            contacts: [],
          };
        }
        return {
          success: true,
          found: true,
          contacts: contacts.map((c) => ({
            id: c.id,
            name: c.name,
            email: c.email,
            company: c.company,
            role: c.role,
          })),
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to search contacts",
        };
      }
    },
  }),

  lookup_slack_user: tool({
    description: "Look up a Slack user by their email address to get their Slack user ID for @mentions.",
    inputSchema: z.object({
      email: z.string().describe("The email address to look up in Slack"),
    }),
    execute: async ({ email }) => {
      try {
        const slackUser = await getSlackUserByEmail(email);
        if (!slackUser) {
          return {
            success: true,
            found: false,
            message: `No Slack user found for email "${email}"`,
          };
        }
        return {
          success: true,
          found: true,
          slackUser: {
            id: slackUser.id,
            name: slackUser.name,
            realName: slackUser.realName,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to look up Slack user",
        };
      }
    },
  }),

  create_slack_draft: tool({
    description: "Create a draft Slack message for user approval. The user will review and can approve or revise before sending.",
    inputSchema: z.object({
      message: z.string().describe("The Slack message content. Use <@USER_ID> format for @mentions."),
      recipientName: z.string().optional().describe("The name of the person this message is directed to (for display)"),
      recipientSlackId: z.string().optional().describe("The Slack user ID if this is a DM or @mention"),
      context: z.string().optional().describe("Brief context about why this message is being sent"),
    }),
    execute: async ({ message, recipientName, recipientSlackId, context }) => {
      return {
        type: "slack_draft",
        draft: {
          message,
          recipientName: recipientName || null,
          recipientSlackId: recipientSlackId || null,
          context: context || null,
        },
      };
    },
  }),

  create_asana_draft: tool({
    description: "Create a draft Asana task for user approval. The user will review and can approve or revise before creating.",
    inputSchema: z.object({
      taskTitle: z.string().describe("Clear, actionable task title"),
      taskDescription: z.string().describe("Detailed description of what needs to be done"),
      subtasks: z.array(z.string()).optional().describe("List of subtask titles"),
      assigneeEmail: z.string().optional().describe("Email of the person to assign the task to"),
      context: z.string().optional().describe("Brief context about why this task is being created"),
    }),
    execute: async ({ taskTitle, taskDescription, subtasks, assigneeEmail, context }) => {
      return {
        type: "asana_draft",
        draft: {
          taskTitle,
          taskDescription,
          subtasks: subtasks || [],
          assigneeEmail: assigneeEmail || null,
          context: context || null,
        },
      };
    },
  }),
};

// System prompt for the channel audit agent
export const CHANNEL_AUDIT_SYSTEM_PROMPT = `You are an expert assistant that helps users analyze Slack channel conversations and take action.

## Your Capabilities

1. **Channel Analysis**: Analyze conversations to identify:
   - Key discussion topics and themes
   - Action items and commitments made
   - Risks, blockers, or concerns raised
   - Decisions that were made
   - Follow-ups needed
   - Sentiment and tone of discussions

2. **Draft Actions**: When the user requests, create drafts for:
   - Slack messages (follow-ups, clarifications, status updates)
   - Asana tasks (action items, follow-ups, project tasks)

## How to Respond

### For Analysis Requests
When analyzing a channel, provide:
- A concise summary of key discussions
- Notable action items or commitments
- Any risks or concerns mentioned
- Recommendations for follow-up

Be specific - mention names, dates, and details from the conversations.

### For Draft Requests
When the user asks you to draft a message or task:

1. **For Slack messages**: Use create_slack_draft with:
   - Clear, professional message content
   - @mentions using <@SLACK_USER_ID> format if you have the ID
   - Keep messages concise and actionable
   - NO sign-offs (no "Thanks", "Best", etc.)

2. **For Asana tasks**: Use create_asana_draft with:
   - Clear, actionable task title (verb + object format)
   - Detailed description with context
   - Relevant subtasks for complex tasks
   - Assignee email if known

### Important Guidelines

- Always reference specific details from the channel context
- If you need more information, ask clarifying questions
- When creating drafts, explain briefly what you're creating and why
- Drafts will be shown to the user for approval - they can revise before executing

## Conversation Flow

1. When a channel is selected, you'll automatically receive the last 5 days of messages
2. Provide an initial analysis highlighting key insights
3. Answer follow-up questions about the channel
4. Create drafts when requested
5. The user will approve, revise, or reject drafts

Remember: Your drafts are suggestions. The user has final say on what gets sent or created.`;

// System prompt for initial channel analysis (auto-triggered on channel select)
export const CHANNEL_AUDIT_INITIAL_ANALYSIS_PROMPT = `Analyze the following Slack channel conversation and provide:

1. **Summary** (2-3 sentences): What is this channel primarily about right now?

2. **Key Topics** (bullet points): Main subjects being discussed

3. **Action Items** (if any): Tasks or follow-ups mentioned
   - Who needs to do what
   - Any deadlines mentioned

4. **Risks/Concerns** (if any): Issues, blockers, or problems raised

5. **Recommendations**: What follow-up actions would you suggest?

Be concise but specific. Use names and dates from the conversations.`;
