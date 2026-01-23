/**
 * Configuration for intelligent model routing
 */

export interface ModelRoutingConfig {
  /** Whether routing is enabled (kill switch) */
  enabled: boolean;
  /** Model ID for light operations (fast, cheap) */
  lightModel: string;
  /** Model ID for frontier operations (best reasoning) */
  frontierModel: string;
  /** Model ID for classification (usually same as light) */
  classifierModel: string;
}

/**
 * Get the model routing configuration from environment variables
 */
export function getModelRoutingConfig(): ModelRoutingConfig {
  const enabled = process.env.AI_ROUTING_ENABLED !== "false";

  return {
    enabled,
    lightModel: process.env.AI_MODEL_LIGHT || "google/gemini-3-flash",
    frontierModel: process.env.AI_MODEL_FRONTIER || "openai/gpt-5.2",
    classifierModel:
      process.env.AI_MODEL_CLASSIFIER ||
      process.env.AI_MODEL_LIGHT ||
      "google/gemini-3-flash",
  };
}

/**
 * Get the default model (used when routing is disabled)
 */
export function getDefaultModel(): string {
  return process.env.AI_MODEL || "openai/gpt-4o";
}

/**
 * Check if the AI gateway is configured
 */
export function isGatewayConfigured(): boolean {
  return !!process.env.AI_GATEWAY_API_KEY;
}

/**
 * Get the appropriate model ID based on routing configuration
 */
export function getModelForTier(tier: "light" | "frontier"): string {
  const config = getModelRoutingConfig();

  if (!config.enabled) {
    // When routing is disabled, use frontier model for everything
    return config.frontierModel;
  }

  return tier === "light" ? config.lightModel : config.frontierModel;
}
