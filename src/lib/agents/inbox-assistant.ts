import { tool } from "ai";
import { z } from "zod";
import { searchContacts, getContactById } from "@/lib/db/contacts";
import { getAllCompanyInfo, getCompanyInfoMap } from "@/lib/db/company-info";
import {
  buildSearchQuery,
  searchMessages,
  getMessage,
  getThread,
  formatThreadForContext,
  GmailSearchParams,
  GmailMessage,
  GmailThread,
} from "@/lib/gmail";
import { getUserContext, buildUserContextPrompt } from "./prompt-builder";

// Tool definitions for the inbox assistant agent
export const inboxAssistantTools = {
  search_inbox: tool({
    description:
      "Search Gmail inbox for emails matching the criteria. Use this to find emails from specific senders, with certain subjects, or within date ranges.",
    inputSchema: z.object({
      from: z
        .string()
        .optional()
        .describe("Sender name or email to search for"),
      to: z.string().optional().describe("Recipient email to filter by"),
      subject: z.string().optional().describe("Subject line keywords"),
      keywords: z
        .string()
        .optional()
        .describe("General search keywords in email body"),
      afterDate: z
        .string()
        .optional()
        .describe("Only emails after this date (YYYY/MM/DD format)"),
      beforeDate: z
        .string()
        .optional()
        .describe("Only emails before this date (YYYY/MM/DD format)"),
      isUnread: z
        .boolean()
        .optional()
        .describe("Filter to only unread emails"),
      maxResults: z
        .number()
        .default(5)
        .describe("Maximum number of results to return"),
    }),
    execute: async (params) => {
      try {
        const searchParams: GmailSearchParams = {
          from: params.from,
          to: params.to,
          subject: params.subject,
          keywords: params.keywords,
          afterDate: params.afterDate,
          beforeDate: params.beforeDate,
          isUnread: params.isUnread,
        };

        const query = buildSearchQuery(searchParams);
        if (!query.trim()) {
          return {
            success: false,
            error: "Please provide at least one search criterion",
          };
        }

        const results = await searchMessages(query, params.maxResults || 5);

        if (results.length === 0) {
          return {
            success: true,
            found: false,
            message: `No emails found matching your search: ${query}`,
            emails: [],
          };
        }

        // Get snippet/preview for each result
        const emails = await Promise.all(
          results.map(async (r) => {
            const msg = await getMessage(r.id);
            return {
              id: msg.id,
              threadId: msg.threadId,
              from: msg.headers.from,
              subject: msg.headers.subject,
              date: new Date(parseInt(msg.internalDate)).toLocaleString(),
              snippet: msg.snippet,
            };
          })
        );

        return {
          success: true,
          found: true,
          count: emails.length,
          emails,
        };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to search inbox",
        };
      }
    },
  }),

  get_email: tool({
    description:
      "Get the full content of a single email by its ID. Use this after search to read a specific email.",
    inputSchema: z.object({
      messageId: z.string().describe("The Gmail message ID"),
    }),
    execute: async ({ messageId }) => {
      try {
        const message = await getMessage(messageId);
        return {
          success: true,
          email: {
            id: message.id,
            threadId: message.threadId,
            from: message.headers.from,
            to: message.headers.to,
            cc: message.headers.cc,
            subject: message.headers.subject,
            date: new Date(parseInt(message.internalDate)).toLocaleString(),
            body: message.body.plain || message.body.html || message.snippet,
          },
        };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to get email",
        };
      }
    },
  }),

  get_thread: tool({
    description:
      "Get an entire email thread with all messages. Use this to understand the full context of a conversation before drafting a reply.",
    inputSchema: z.object({
      threadId: z.string().describe("The Gmail thread ID"),
    }),
    execute: async ({ threadId }) => {
      try {
        const thread = await getThread(threadId);
        const formattedContext = formatThreadForContext(thread);

        // Get the most recent message (to reply to)
        const latestMessage = thread.messages[thread.messages.length - 1];

        return {
          success: true,
          thread: {
            id: thread.id,
            messageCount: thread.messages.length,
            formattedContext,
            latestMessage: {
              id: latestMessage.id,
              from: latestMessage.headers.from,
              to: latestMessage.headers.to,
              subject: latestMessage.headers.subject,
              date: new Date(
                parseInt(latestMessage.internalDate)
              ).toLocaleString(),
              messageId: latestMessage.headers.messageId,
            },
          },
        };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to get thread",
        };
      }
    },
  }),

  search_contacts: tool({
    description:
      "Search for contacts by name, email, or company. Use this to find context about the sender.",
    inputSchema: z.object({
      query: z
        .string()
        .describe("Search term - could be a name, company, or email"),
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
            context: c.context,
          })),
        };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to search contacts",
        };
      }
    },
  }),

  get_company_info: tool({
    description:
      "Get company information to personalize the reply. This includes company name, product info, and other context.",
    inputSchema: z.object({
      keys: z
        .array(z.string())
        .default([])
        .describe("Specific info keys to retrieve. Leave empty for all."),
    }),
    execute: async ({ keys }) => {
      try {
        if (keys && keys.length > 0) {
          const info = await getCompanyInfoMap(keys);
          return { success: true, info };
        } else {
          const allInfo = await getAllCompanyInfo();
          const info: Record<string, string> = {};
          for (const item of allInfo) {
            info[item.key] = item.value;
          }
          return { success: true, info };
        }
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to get company info",
        };
      }
    },
  }),

  ask_clarification: tool({
    description:
      "Ask the user for clarification when there are multiple matches or ambiguous requests. Returns the question and options to the user.",
    inputSchema: z.object({
      question: z.string().describe("The clarification question to ask"),
      options: z
        .array(
          z.object({
            id: z.string().describe("Unique identifier for this option"),
            label: z.string().describe("Display text for the option"),
            description: z
              .string()
              .optional()
              .describe("Additional context about the option"),
          })
        )
        .describe("Available options for the user to choose from"),
      context: z
        .string()
        .optional()
        .describe("Additional context about why clarification is needed"),
    }),
    execute: async ({ question, options, context }) => {
      // This tool returns data that signals the API to request clarification
      return {
        success: true,
        needsClarification: true,
        question,
        options,
        context,
      };
    },
  }),

  create_reply_draft: tool({
    description:
      "Create the final reply draft. Call this after gathering thread context and understanding the request.",
    inputSchema: z.object({
      threadId: z.string().describe("The Gmail thread ID being replied to"),
      originalMessageId: z
        .string()
        .describe("The message ID being replied to"),
      recipientEmail: z.string().describe("The recipient's email address"),
      recipientName: z
        .string()
        .optional()
        .describe("The recipient's name for the greeting"),
      subject: z.string().describe("The email subject line"),
      body: z.string().describe("The full email body"),
      threadContext: z
        .string()
        .optional()
        .describe("Summary of thread context for reference"),
    }),
    execute: async ({
      threadId,
      originalMessageId,
      recipientEmail,
      recipientName,
      subject,
      body,
      threadContext,
    }) => {
      // This tool returns the draft data - actual storage happens in the API route
      return {
        success: true,
        draft: {
          threadId,
          originalMessageId,
          recipientEmail,
          recipientName,
          subject,
          body,
          threadContext,
        },
      };
    },
  }),
};

// Base system prompt for the inbox assistant agent
const BASE_SYSTEM_PROMPT = `You are an intelligent email assistant that helps read and respond to emails in Gmail.

## Your Workflow

When the user asks you to find and respond to an email:

1. **Search for the email**: Use search_inbox with appropriate filters:
   - from: sender name or email
   - afterDate: for recent emails (use YYYY/MM/DD format, e.g., today)
   - subject: if they mention specific topics
   - keywords: for body content

2. **Handle search results**:
   - 0 results: Suggest broadening the search (remove date filter, try partial name)
   - 1 result: Proceed to read the thread
   - 2+ results: Use ask_clarification to let user pick the right one

3. **Read the full thread**: Use get_thread to understand the complete conversation context

4. **Gather additional context**:
   - Use search_contacts if you need info about the sender
   - Use get_company_info for your company context

5. **Draft the reply**: Use create_reply_draft with:
   - The thread and message IDs (for proper threading)
   - A clear, contextual response based on the thread history
   - Follow the user's instructions for what to say

## Key Guidelines

- Always read the full thread before drafting - context matters
- When multiple emails match, present clear options to the user
- If no emails found, suggest alternative search strategies
- Make replies contextual - reference previous messages when appropriate
- Keep tone appropriate to the conversation history
`;

/**
 * Build the full system prompt with dynamic user context
 */
export async function buildInboxAssistantPrompt(): Promise<string> {
  const userContext = await getUserContext();
  const userContextSection = buildUserContextPrompt(userContext);

  return `${BASE_SYSTEM_PROMPT}

${userContextSection}

## Remember
- Search first, then read thread, then draft
- Handle ambiguity by asking for clarification
- Always maintain proper email threading with correct IDs
- The user will review and approve the draft before sending`;
}

// System prompt for revising inbox drafts based on feedback
export const INBOX_REVISER_SYSTEM_PROMPT = `You are an expert email editor. Your role is to revise email reply drafts based on user feedback.

You will receive:
1. The current draft (recipient, subject, body)
2. The thread context (previous messages in the conversation)
3. User feedback about what to change

Common revision requests:
- "Make it shorter" -> Condense while keeping key points
- "Make it more formal" -> Use professional language
- "Make it friendlier" -> Add warmth, use casual language
- "Add [specific detail]" -> Include the requested information
- "Change the tone" -> Adjust based on feedback

After revising, use the create_reply_draft tool with the updated email.

Important:
- Keep threading information (threadId, originalMessageId) unchanged
- Preserve the recipient unless explicitly asked to change
- Maintain consistency with the thread conversation
- Make only the requested changes, don't over-edit

CRITICAL sign-off rules:
- Sign-off must ALWAYS be "Best," followed by "Adi" on the next line
- NEVER use any other variation

BANNED phrases:
- "I hope this finds you well"
- "Per my last email"
- "I wanted to reach out"
Get straight to the point after the greeting.`;
