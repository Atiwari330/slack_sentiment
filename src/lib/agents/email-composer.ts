import { tool } from "ai";
import { z } from "zod";
import { searchContacts, getContactById } from "@/lib/db/contacts";
import { getAllCompanyInfo, getCompanyInfoMap } from "@/lib/db/company-info";

// Tool definitions for the email composer agent
export const emailComposerTools = {
  search_contacts: tool({
    description: "Search for contacts by name, email, or company. Use this to find the recipient when the user mentions a name or company.",
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
            context: c.context,
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

  get_contact: tool({
    description: "Get full details of a specific contact by their ID. Use after searching to get complete information.",
    inputSchema: z.object({
      contactId: z.string().describe("The UUID of the contact"),
    }),
    execute: async ({ contactId }) => {
      try {
        const contact = await getContactById(contactId);
        if (!contact) {
          return {
            success: false,
            error: "Contact not found",
          };
        }
        return {
          success: true,
          contact: {
            id: contact.id,
            name: contact.name,
            email: contact.email,
            company: contact.company,
            role: contact.role,
            context: contact.context,
            tags: contact.tags,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to get contact",
        };
      }
    },
  }),

  get_company_info: tool({
    description: "Get company information to personalize the email. This includes company name, product info, and other context.",
    inputSchema: z.object({
      keys: z.array(z.string()).default([]).describe("Specific info keys to retrieve. Leave empty for all."),
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
          error: error instanceof Error ? error.message : "Failed to get company info",
        };
      }
    },
  }),

  create_draft: tool({
    description: "Create the final email draft. Call this after gathering all necessary information.",
    inputSchema: z.object({
      recipientEmail: z.string().describe("The recipient's email address"),
      recipientName: z.string().describe("The recipient's name for the greeting"),
      subject: z.string().describe("The email subject line"),
      body: z.string().describe("The full email body"),
      contactId: z.string().default("").describe("The contact ID if a known contact, empty string if unknown"),
    }),
    execute: async ({ recipientEmail, recipientName, subject, body, contactId }) => {
      // This tool just returns the draft data - actual storage happens in the API route
      return {
        success: true,
        draft: {
          recipientEmail,
          recipientName,
          subject,
          body,
          contactId: contactId || undefined,
        },
      };
    },
  }),
};

// System prompt for the email composer agent
export const EMAIL_COMPOSER_SYSTEM_PROMPT = `You are an expert email composition assistant. Your role is to help compose professional, clear, and effective emails based on voice dictation.

When the user dictates an email request, you should:

1. **Identify the recipient**: Use the search_contacts tool to find the recipient. Look for:
   - Names mentioned ("Send an email to John")
   - Companies mentioned ("email someone at Acme Corp")
   - If multiple matches, pick the most likely one based on context

2. **Gather context**: Use get_company_info to personalize the email with your company details if relevant.

3. **Compose the email**: Based on the dictation and any contact context (like "prefers formal tone"), create:
   - A clear, concise subject line
   - An appropriate greeting
   - The email body with the intended message
   - A professional sign-off

4. **Create the draft**: Use create_draft with the final email.

Guidelines for email composition:
- Be professional but natural
- Keep it concise unless the request indicates otherwise
- Match the tone to the context (formal for business, friendly for acquaintances)
- Use the contact's context notes if available (e.g., "prefers formal tone")
- Include all information the user mentioned
- Don't add unnecessary fluff or overly formal language unless appropriate

If you cannot find a contact:
- Still compose the email
- Ask the AI to extract the email address from the dictation if mentioned
- Use reasonable defaults for the greeting

Always call create_draft at the end with the complete email.`;

// System prompt for revising emails based on feedback
export const EMAIL_REVISER_SYSTEM_PROMPT = `You are an expert email editor. Your role is to revise email drafts based on user feedback.

You will receive:
1. The current email draft (recipient, subject, body)
2. User feedback about what to change

Common revision requests:
- "Make it shorter" → Condense while keeping key points
- "Make it more formal" → Use professional language, proper titles
- "Make it friendlier" → Add warmth, use casual language
- "Add [specific detail]" → Include the requested information
- "Change the subject" → Create a new subject line
- "Fix the tone" → Adjust based on context

After revising, use the create_draft tool with the updated email.

Important:
- Keep the recipient the same unless explicitly asked to change
- Preserve important information from the original
- Make only the requested changes, don't over-edit
- Maintain consistency in formatting`;
