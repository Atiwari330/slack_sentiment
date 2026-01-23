/**
 * Email classification using lightweight LLM
 */

import { generateText, createGateway } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import {
  Classification,
  ClassificationInput,
  EmailCategory,
  getTierForCategory,
} from "./categories";
import { getModelRoutingConfig, isGatewayConfigured } from "./config";
import { logClassification } from "./telemetry";

/**
 * System prompt for the classifier - designed to be fast and accurate
 */
const CLASSIFIER_PROMPT = `You are an email classification system. Analyze the email and classify it into ONE category.

## Categories

LIGHT TIER (routine - use efficient model):
- routine_reply: Simple acks, "sounds good", scheduling confirmations, thank you notes
- routine_update: FYIs, status updates, newsletters, automated notifications
- needs_attention: Questions needing thoughtful response, standard requests

FRONTIER TIER (high-stakes - use best reasoning):
- high_stakes_complaint: Frustration signals ("disappointed", "frustrated", "cancel", "unacceptable"), negative tone, service issues
- high_stakes_contract: Pricing discussions, renewal terms, contracts, legal language, procurement
- high_stakes_escalation: Executive involvement, formal escalation, CC'd leadership, "urgent" with authority
- high_stakes_sensitive: Legal matters, HR issues, confidential information, compliance
- complex_negotiation: Multi-party decisions, competing interests, complex business terms

## Signals to Detect

HIGH-STAKES SIGNALS (trigger frontier model):
- Words: cancel, disappointed, frustrated, urgent, escalate, legal, contract, renewal, pricing, confidential
- Patterns: CC'd executives, formal tone shift, threats, ultimatums
- Sentiment: Strong negative emotion, formal complaints, explicit dissatisfaction

ROUTINE SIGNALS (use light model):
- Words: thanks, sounds good, confirmed, FYI, update, newsletter
- Patterns: Auto-generated, simple acknowledgments, scheduling
- Sentiment: Neutral or positive, no tension

## Output Format

Respond with ONLY a JSON object (no markdown, no explanation):
{
  "category": "<category_name>",
  "confidence": <0.0-1.0>,
  "reason": "<one sentence explanation>",
  "signals": ["<signal1>", "<signal2>"]
}`;

/**
 * Build the classification prompt for a specific email
 */
function buildClassificationPrompt(input: ClassificationInput): string {
  let prompt = `Classify this email:

Subject: ${input.subject}
From: ${input.senderName || "Unknown"} <${input.senderEmail || "unknown"}>
`;

  if (input.senderContext) {
    prompt += `\nSender Context: ${input.senderContext}`;
  }

  prompt += `\n\nEmail Content:\n${input.threadContent}`;

  return prompt;
}

/**
 * Parse the classifier response into a Classification object
 */
function parseClassifierResponse(text: string): Classification {
  try {
    // Clean up the response - remove markdown code blocks if present
    let cleanText = text.trim();
    if (cleanText.startsWith("```json")) {
      cleanText = cleanText.slice(7);
    }
    if (cleanText.startsWith("```")) {
      cleanText = cleanText.slice(3);
    }
    if (cleanText.endsWith("```")) {
      cleanText = cleanText.slice(0, -3);
    }
    cleanText = cleanText.trim();

    const parsed = JSON.parse(cleanText);

    // Validate and construct the classification
    const category = parsed.category as EmailCategory;
    const tier = getTierForCategory(category);

    return {
      category,
      tier,
      confidence: Math.min(1, Math.max(0, parsed.confidence || 0.5)),
      reason: parsed.reason || "Classification completed",
      signals: Array.isArray(parsed.signals) ? parsed.signals : [],
    };
  } catch (error) {
    // Default to needs_attention if parsing fails
    console.error("Failed to parse classifier response:", error);
    return {
      category: "needs_attention",
      tier: "light",
      confidence: 0.3,
      reason: "Unable to parse classification, defaulting to needs_attention",
      signals: [],
    };
  }
}

/**
 * Classify an email to determine which model tier to use
 */
export async function classifyEmail(
  input: ClassificationInput
): Promise<Classification> {
  const config = getModelRoutingConfig();
  const startTime = Date.now();

  try {
    // Create the model for classification
    let model;
    if (isGatewayConfigured()) {
      const gateway = createGateway({
        apiKey: process.env.AI_GATEWAY_API_KEY!,
      });
      model = gateway(config.classifierModel);
    } else if (process.env.OPENAI_API_KEY) {
      const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
      // Extract model name if in provider/model format
      const modelName = config.classifierModel.includes("/")
        ? config.classifierModel.split("/")[1]
        : config.classifierModel;
      model = openai(modelName);
    } else {
      throw new Error("No AI provider configured for classification");
    }

    // Run classification
    const result = await generateText({
      model,
      system: CLASSIFIER_PROMPT,
      prompt: buildClassificationPrompt(input),
      maxOutputTokens: 200, // Keep it tight for speed
      temperature: 0, // Deterministic classification
    });

    const classification = parseClassifierResponse(result.text);
    const latencyMs = Date.now() - startTime;

    // Log the classification for monitoring
    logClassification({
      input,
      classification,
      latencyMs,
      model: config.classifierModel,
    });

    return classification;
  } catch (error) {
    console.error("Email classification failed:", error);

    // On error, default to frontier model for safety
    return {
      category: "needs_attention",
      tier: "frontier", // Use frontier on error to be safe
      confidence: 0,
      reason: "Classification failed, using frontier model for safety",
      signals: [],
    };
  }
}

/**
 * Quick heuristic check for obvious high-stakes signals
 * Can be used as a fast pre-filter before full classification
 */
export function quickHighStakesCheck(content: string): boolean {
  const highStakesPatterns = [
    /\bcancel\b/i,
    /\bdisappointed\b/i,
    /\bfrustrat/i,
    /\bescalat/i,
    /\blegal\b/i,
    /\bcontract\b/i,
    /\brenewal\b/i,
    /\bpricing\b/i,
    /\bconfidential\b/i,
    /\burgent\b/i,
    /\bunacceptable\b/i,
    /\bcomplaint\b/i,
    /\bterminate\b/i,
  ];

  return highStakesPatterns.some((pattern) => pattern.test(content));
}
