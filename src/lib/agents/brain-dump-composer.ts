import { tool } from "ai";
import { z } from "zod";
import { searchContacts, getContactById } from "@/lib/db/contacts";
import { getAllCompanyInfo, getCompanyInfoMap } from "@/lib/db/company-info";
import { getSlackUserByEmail } from "@/lib/slack";

// Tool definitions for the brain dump composer agent
export const brainDumpComposerTools = {
  search_contacts: tool({
    description: "Search for contacts by name, email, or company. Use this to find the person mentioned in the brain dump.",
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
            default_asana_project_id: c.default_asana_project_id,
            default_asana_project_name: c.default_asana_project_name,
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
    description: "Get full details of a specific contact by their ID. Use after searching to get complete information including their Asana project.",
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
            default_asana_project_id: contact.default_asana_project_id,
            default_asana_project_name: contact.default_asana_project_name,
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
    description: "Get company information to provide context for the drafts. This includes company name, product info, and other context.",
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

  lookup_slack_user: tool({
    description: "Look up a Slack user by their email address to get their Slack user ID for @mentions. Call this after finding a contact to get their Slack ID.",
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

  create_drafts: tool({
    description: "Create the final Slack message draft and Asana task draft. Call this after gathering all necessary information.",
    inputSchema: z.object({
      contactId: z.string().describe("The contact ID from search results"),
      contactName: z.string().describe("The contact's EXACT name from the database - do not use nicknames or variations"),
      contactEmail: z.string().describe("The contact's email address"),
      slackUserId: z.string().optional().describe("The contact's Slack user ID for @mentions (format: U followed by alphanumeric). If provided, use <@SLACK_USER_ID> format in the message."),
      asanaProjectId: z.string().optional().describe("The Asana project ID from the contact's settings"),
      asanaProjectName: z.string().optional().describe("The Asana project name from the contact's settings"),
      slackMessage: z.string().describe("The Slack message directed TO the contact. Start with their @mention if slackUserId is available. This is asking THEM to do something."),
      asanaTaskTitle: z.string().describe("A clear, actionable title - this is the assignee's task, written from THEIR perspective"),
      asanaTaskDescription: z.string().describe("Description of what the ASSIGNEE needs to do - written from their perspective, not instructions TO them"),
      asanaSubtasks: z.array(z.string()).describe("Specific actions the ASSIGNEE will take - these are their to-do items"),
    }),
    execute: async ({
      contactId,
      contactName,
      contactEmail,
      slackUserId,
      asanaProjectId,
      asanaProjectName,
      slackMessage,
      asanaTaskTitle,
      asanaTaskDescription,
      asanaSubtasks,
    }) => {
      return {
        success: true,
        drafts: {
          contact: {
            id: contactId,
            name: contactName,
            email: contactEmail,
            slackUserId: slackUserId || null,
          },
          asana: {
            projectId: asanaProjectId || null,
            projectName: asanaProjectName || null,
          },
          slack: {
            message: slackMessage,
          },
          asanaTask: {
            taskTitle: asanaTaskTitle,
            taskDescription: asanaTaskDescription,
            subtasks: asanaSubtasks,
          },
        },
      };
    },
  }),
};

// System prompt for the brain dump composer agent
export const BRAIN_DUMP_COMPOSER_SYSTEM_PROMPT = `You are an expert assistant that transforms unstructured "brain dumps" into actionable outputs: a Slack message and an Asana task.

## CRITICAL ROLE UNDERSTANDING

The CONTACT you find is the ASSIGNEE - a team member who will EXECUTE the task.
- You are creating a task FOR them, not ABOUT them
- The Slack message is DIRECTED TO them (asking them to do something)
- The Asana task is THEIR to-do list (written from their perspective)
- Any external parties mentioned (clients, vendors, companies) are who the ASSIGNEE will interact with

Example:
- Brain dump: "Gabriel needs to follow up with Sunrise Behavioral about the MSA"
- Gabriel = ASSIGNEE (the team member who will do the work)
- Sunrise Behavioral = EXTERNAL PARTY (who Gabriel will contact)
- Slack: "<@SLACK_ID> Can you follow up with Sunrise Behavioral about the MSA signing status?"
- Asana Title: "Follow up with Sunrise Behavioral on MSA status"
- Asana Description: "Contact Sunrise Behavioral to check on MSA signing status and next steps."
- Subtasks: "Email Sunrise Behavioral contact", "Track response", "Update CRM with status"

NEVER write "reach out to [assignee name]" or "contact [assignee name]" - they ARE the one doing the reaching out!

## Process

1. **Identify the contact**: Use search_contacts to find the team member mentioned.
   - This person is the ASSIGNEE who will do the work
   - Use their EXACT name from the database - no nicknames or variations

2. **Look up Slack user**: Use lookup_slack_user with the contact's email to get their Slack user ID.
   - This allows you to @mention them in the Slack message
   - If found, use the format <@SLACK_USER_ID> at the start of the Slack message

3. **Create drafts** using create_drafts:

### Slack Message Guidelines:
- Start with @mention if slackUserId is provided: <@SLACK_USER_ID>
- This message is DIRECTED TO the contact, asking them to do something
- Get straight to the point - no "Hey team" or fluff
- NO sign-off (no "Thanks", "Best", "Cheers") - just end naturally
- Keep it concise but include necessary context

### Asana Task Guidelines:
- Task is FOR the assignee - written from THEIR perspective
- Title: Clear, actionable (e.g., "Follow up with [external party] on [topic]")
- Description: What the assignee needs to do, context they need
- Subtasks: Specific actions the assignee will take
- NEVER include the assignee's name in task descriptions as if they're the subject

### Name Consistency:
- Use the EXACT name from the contact record
- No nicknames, variations, or "Name1/Name2" combinations
- If the contact is "Gabriel Torres", always use "Gabriel Torres", not "Gabe" or "Gabriel/Gabe"

CRITICAL: You MUST call create_drafts at the end. Do not stop until create_drafts is called.

If you cannot find a contact:
- Still create the drafts
- Use "Unknown" as the contact name
- Leave Asana project fields empty`;

// System prompt for revising brain dump drafts
export const BRAIN_DUMP_REVISER_SYSTEM_PROMPT = `You are an expert editor for brain dump outputs. Your role is to revise Slack messages and Asana tasks based on user feedback.

## CRITICAL ROLE UNDERSTANDING

The contact is the ASSIGNEE - the team member who will EXECUTE the task.
- The Slack message is DIRECTED TO them
- The Asana task is THEIR to-do list (from their perspective)
- External parties mentioned are who they will interact with
- NEVER write "reach out to [assignee]" - they ARE the one reaching out

You will receive:
1. The current Slack message draft
2. The current Asana task draft (title, description, subtasks)
3. User feedback about what to change

Common revision requests:
- "Make it shorter" → Condense while keeping key points
- "Make it more formal/casual" → Adjust tone
- "Add [specific detail]" → Include the requested information
- "Change the title" → Create a new task title
- "Add/remove subtasks" → Modify the subtask list

After revising, use create_drafts with the updated content.

Important:
- Keep contact information the same unless explicitly asked to change
- Preserve important information from the original
- Make only the requested changes, don't over-edit
- Use the EXACT contact name - no nicknames or variations
- Maintain the @mention format in Slack if present

Slack Message Rules:
- Keep the @mention at the start if present
- NO sign-off (no "Thanks", "Best", "Cheers")
- End naturally when the point is made

Asana Task Rules:
- Task is FOR the assignee, from THEIR perspective
- Don't mention the assignee as if they're the subject
- Subtasks are actions THEY will take`;
