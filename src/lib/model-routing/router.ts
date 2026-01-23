/**
 * Core model routing logic
 */

import { createGateway, LanguageModel } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import {
  Classification,
  ClassificationInput,
  EmailCategory,
} from "./categories";
import {
  getModelRoutingConfig,
  getModelForTier,
  isGatewayConfigured,
  getDefaultModel,
} from "./config";
import { classifyEmail, quickHighStakesCheck } from "./classifier";
import { applyEnhancedPrompt } from "./enhanced-prompts";
import { logRouting, buildClassificationSummary, routingMetrics } from "./telemetry";

export interface RoutingResult {
  /** The AI model instance to use */
  model: LanguageModel;
  /** The model ID string */
  modelId: string;
  /** The system prompt (possibly enhanced) */
  systemPrompt: string;
  /** Classification result */
  classification: Classification;
  /** Summary for API response */
  classificationSummary: {
    category: string;
    tier: string;
    reason: string;
    isHighStakes: boolean;
  };
}

export interface RouteEmailOptions {
  /** Input for classification */
  input: ClassificationInput;
  /** Base system prompt to use */
  basePrompt: string;
  /** Session ID for logging */
  sessionId: string;
  /** Skip classification and use a specific tier */
  forceTier?: "light" | "frontier";
  /** Use quick heuristic check instead of full classification */
  useQuickCheck?: boolean;
}

/**
 * Create an AI model instance for the given model ID
 */
function createModel(modelId: string): LanguageModel {
  if (isGatewayConfigured()) {
    const gateway = createGateway({
      apiKey: process.env.AI_GATEWAY_API_KEY!,
    });
    return gateway(modelId);
  } else if (process.env.OPENAI_API_KEY) {
    const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
    // Extract model name if in provider/model format
    const modelName = modelId.includes("/") ? modelId.split("/")[1] : modelId;
    return openai(modelName);
  } else {
    throw new Error("No AI provider configured");
  }
}

/**
 * Route an email to the appropriate model with optional enhanced prompting
 */
export async function routeEmail(
  options: RouteEmailOptions
): Promise<RoutingResult> {
  const { input, basePrompt, sessionId, forceTier, useQuickCheck } = options;
  const config = getModelRoutingConfig();

  let classification: Classification;

  // Determine classification
  if (!config.enabled) {
    // Routing disabled - use frontier for everything
    classification = {
      category: "needs_attention",
      tier: "frontier",
      confidence: 1,
      reason: "Routing disabled, using frontier model",
      signals: [],
    };
  } else if (forceTier) {
    // Forced tier - skip classification
    classification = {
      category: forceTier === "frontier" ? "needs_attention" : "routine_reply",
      tier: forceTier,
      confidence: 1,
      reason: `Tier forced to ${forceTier}`,
      signals: [],
    };
  } else if (useQuickCheck) {
    // Quick heuristic check
    const isHighStakes = quickHighStakesCheck(input.threadContent);
    classification = {
      category: isHighStakes ? "high_stakes_complaint" : "routine_reply",
      tier: isHighStakes ? "frontier" : "light",
      confidence: 0.7,
      reason: isHighStakes
        ? "High-stakes signals detected in quick check"
        : "No high-stakes signals in quick check",
      signals: isHighStakes ? ["quick_check_positive"] : [],
    };
  } else {
    // Full classification
    classification = await classifyEmail(input);
  }

  // Get the appropriate model
  const modelId = getModelForTier(classification.tier);
  const model = createModel(modelId);

  // Apply enhanced prompting if high-stakes
  const systemPrompt = applyEnhancedPrompt(basePrompt, classification.category);
  const enhanced = systemPrompt !== basePrompt;

  // Log the routing decision
  logRouting({
    sessionId,
    classification,
    modelUsed: modelId,
    enhanced,
    timestamp: new Date(),
  });

  return {
    model,
    modelId,
    systemPrompt,
    classification,
    classificationSummary: buildClassificationSummary(classification),
  };
}

/**
 * Get a model for a specific tier without classification
 * Useful for revision endpoints that need to maintain consistency
 */
export function getModelForExistingClassification(
  category: EmailCategory,
  tier: "light" | "frontier"
): { model: LanguageModel; modelId: string } {
  const config = getModelRoutingConfig();

  let modelId: string;
  if (!config.enabled) {
    modelId = config.frontierModel;
  } else {
    modelId = tier === "frontier" ? config.frontierModel : config.lightModel;
  }

  const model = createModel(modelId);

  return { model, modelId };
}

/**
 * Simple model getter for non-routed operations
 * Falls back to default model when routing is not needed
 */
export function getDefaultModelInstance(): {
  model: LanguageModel;
  modelId: string;
} {
  const modelId = getDefaultModel();
  const model = createModel(modelId);
  return { model, modelId };
}
