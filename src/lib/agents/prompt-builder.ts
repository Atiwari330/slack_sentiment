import { getAllCompanyInfo } from "@/lib/db/company-info";

export interface UserContext {
  userName: string;
  userEmail?: string;
  userRole?: string;
  writingStyle?: string;
  emailSignature?: string;
  bannedPhrases?: string[];
}

/**
 * Fetch user context from company_info table
 * Returns default values if not found in database
 */
export async function getUserContext(): Promise<UserContext> {
  const allInfo = await getAllCompanyInfo();

  const infoMap: Record<string, string> = {};
  for (const item of allInfo) {
    infoMap[item.key] = item.value;
  }

  return {
    userName: infoMap["user_name"] || "Adi",
    userEmail: infoMap["user_email"],
    userRole: infoMap["user_role"],
    writingStyle: infoMap["writing_style"],
    emailSignature: infoMap["email_signature"] || "Best,\nAdi",
    bannedPhrases: infoMap["banned_phrases"]?.split(",").map((p) => p.trim()) || [
      "I hope this finds you well",
      "Per my last email",
      "I wanted to reach out",
      "I am writing to",
      "I hope this email finds you well",
    ],
  };
}

/**
 * Build dynamic system prompt section with user context
 */
export function buildUserContextPrompt(context: UserContext): string {
  const lines: string[] = [];

  lines.push("## Your Identity");
  lines.push(`- You are writing emails on behalf of ${context.userName}`);
  if (context.userRole) {
    lines.push(`- Role: ${context.userRole}`);
  }
  if (context.userEmail) {
    lines.push(`- Email: ${context.userEmail}`);
  }

  lines.push("");
  lines.push("## Writing Style");
  if (context.writingStyle) {
    lines.push(context.writingStyle);
  } else {
    lines.push("Professional but warm. Direct and helpful. Avoid corporate jargon.");
  }

  lines.push("");
  lines.push("## Sign-off");
  lines.push("ALWAYS end emails with:");
  lines.push("```");
  lines.push(context.emailSignature || "Best,\nAdi");
  lines.push("```");
  lines.push("NEVER use any other sign-off variation.");

  if (context.bannedPhrases && context.bannedPhrases.length > 0) {
    lines.push("");
    lines.push("## BANNED Phrases (never use these - they sound like AI)");
    for (const phrase of context.bannedPhrases) {
      lines.push(`- "${phrase}"`);
    }
    lines.push("Get straight to the point after the greeting.");
  }

  return lines.join("\n");
}
