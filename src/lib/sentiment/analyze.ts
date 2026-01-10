import { generateText, createGateway } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { getChannelHistory, formatMessagesForContext } from "@/lib/slack";
import { getAccountById } from "@/lib/db/accounts";
import { storeSentimentResult } from "@/lib/db/sentiment";
import {
  SENTIMENT_ANALYSIS_SYSTEM_PROMPT,
  buildAnalysisUserPrompt,
} from "./prompts";

// Timeline event types
export type TimelineEventType =
  | "issue_raised"
  | "response_given"
  | "escalation"
  | "resolution_offered"
  | "resolution_accepted"
  | "frustration_expressed"
  | "positive_feedback"
  | "question_asked";

export interface TimelineEvent {
  timestamp: string;
  eventType: TimelineEventType;
  actor: "customer" | "vendor";
  summary: string;
}

// Conversation state types
export type ConversationStatus =
  | "idle"
  | "active_discussion"
  | "waiting_on_vendor"
  | "waiting_on_customer"
  | "issue_in_progress"
  | "recently_resolved";

export type UrgencyLevel = "low" | "medium" | "high" | "critical";

export interface ConversationState {
  status: ConversationStatus;
  description: string;
  customerWaitingHours: number | null;
  lastVendorResponseHours: number | null;
  urgency: UrgencyLevel;
}

export interface AnalysisResult {
  id: string;
  accountId: string;
  sentiment: "green" | "yellow" | "red";
  confidence: number;
  summary: string;
  riskFactors: string[];
  positiveSignals: string[];
  recommendation: string;
  messageCount: number;
  daysAnalyzed: number;
  analyzedAt: string;
  timeline: TimelineEvent[];
  conversationState: ConversationState;
}

export async function analyzeAccount(
  accountId: string,
  daysBack: number = 1
): Promise<AnalysisResult> {
  // Get account details
  const account = await getAccountById(accountId);
  if (!account) {
    throw new Error("Account not found");
  }

  // Fetch Slack messages
  let messages;
  let messageContext: string;

  try {
    messages = await getChannelHistory(account.slack_channel_id, daysBack);
    messageContext = formatMessagesForContext(messages);
  } catch (error) {
    console.error("Error fetching channel history:", error);
    // If we can't fetch messages, still provide an analysis
    messages = [];
    messageContext = "";
  }

  // Build the prompt
  const userPrompt = buildAnalysisUserPrompt(
    account.name,
    account.slack_channel_name || account.slack_channel_id,
    messageContext,
    messages.length,
    daysBack
  );

  // Get AI provider configuration
  const gatewayKey = process.env.AI_GATEWAY_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!gatewayKey && !openaiKey) {
    throw new Error("AI API key is not configured");
  }

  const modelId = process.env.AI_MODEL || "openai/gpt-4o";

  // Create the model
  let model;
  if (gatewayKey) {
    const gateway = createGateway({ apiKey: gatewayKey });
    model = gateway(modelId);
  } else {
    const openai = createOpenAI({ apiKey: openaiKey });
    model = openai(modelId);
  }

  // Generate the analysis
  const { text } = await generateText({
    model,
    system: SENTIMENT_ANALYSIS_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  // Parse the response
  let analysis;
  try {
    // Clean up potential markdown code blocks
    let cleanedText = text.trim();
    if (cleanedText.startsWith("```json")) {
      cleanedText = cleanedText.slice(7);
    }
    if (cleanedText.startsWith("```")) {
      cleanedText = cleanedText.slice(3);
    }
    if (cleanedText.endsWith("```")) {
      cleanedText = cleanedText.slice(0, -3);
    }
    cleanedText = cleanedText.trim();

    analysis = JSON.parse(cleanedText);
  } catch (parseError) {
    console.error("Failed to parse AI response:", text);
    throw new Error("Failed to parse sentiment analysis response");
  }

  // Validate the response
  if (!["green", "yellow", "red"].includes(analysis.sentiment)) {
    throw new Error(`Invalid sentiment value: ${analysis.sentiment}`);
  }

  // Extract timeline and conversation state with defaults
  const timeline: TimelineEvent[] = analysis.timeline || [];
  const conversationState: ConversationState = analysis.conversationState || {
    status: "idle",
    description: "No recent activity",
    customerWaitingHours: null,
    lastVendorResponseHours: null,
    urgency: "low",
  };

  // Store the result in the database
  const result = await storeSentimentResult(
    accountId,
    analysis.sentiment,
    analysis.summary,
    {
      confidence: analysis.confidence,
      riskFactors: analysis.riskFactors || [],
      positiveSignals: analysis.positiveSignals || [],
      messageCount: messages.length,
      daysAnalyzed: daysBack,
      timeline,
      conversationState,
    }
  );

  return {
    id: result.id,
    accountId,
    sentiment: analysis.sentiment,
    confidence: analysis.confidence || 0.5,
    summary: analysis.summary,
    riskFactors: analysis.riskFactors || [],
    positiveSignals: analysis.positiveSignals || [],
    recommendation: analysis.recommendation || "",
    messageCount: messages.length,
    daysAnalyzed: daysBack,
    analyzedAt: result.analyzed_at,
    timeline,
    conversationState,
  };
}

export async function analyzeAllAccounts(
  daysBack: number = 1
): Promise<{ results: AnalysisResult[]; errors: { accountId: string; error: string }[] }> {
  const { getAllAccounts } = await import("@/lib/db/accounts");
  const accounts = await getAllAccounts();

  const results: AnalysisResult[] = [];
  const errors: { accountId: string; error: string }[] = [];

  // Process accounts sequentially to avoid rate limiting
  for (const account of accounts) {
    try {
      const result = await analyzeAccount(account.id, daysBack);
      results.push(result);
    } catch (error) {
      console.error(`Error analyzing account ${account.id}:`, error);
      errors.push({
        accountId: account.id,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }

    // Small delay between requests to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return { results, errors };
}
