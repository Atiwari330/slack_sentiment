/**
 * Intelligent Model Routing for Inbox Assistant
 *
 * Automatically classifies incoming emails and routes them to the appropriate LLM:
 * - Light model (Gemini 3 Flash): For analysis, categorization, and routine replies
 * - Frontier model (GPT-5.2): For high-stakes situations with enhanced CRO prompting
 */

// Categories and types
export {
  type ModelTier,
  type EmailCategory,
  type Classification,
  type ClassificationInput,
  CATEGORY_METADATA,
  getTierForCategory,
  isHighStakes,
} from "./categories";

// Configuration
export {
  type ModelRoutingConfig,
  getModelRoutingConfig,
  getDefaultModel,
  isGatewayConfigured,
  getModelForTier,
} from "./config";

// Classifier
export {
  classifyEmail,
  quickHighStakesCheck,
} from "./classifier";

// Enhanced prompts
export {
  getEnhancedPrompt,
  applyEnhancedPrompt,
} from "./enhanced-prompts";

// Router
export {
  type RoutingResult,
  type RouteEmailOptions,
  routeEmail,
  getModelForExistingClassification,
  getDefaultModelInstance,
} from "./router";

// Telemetry
export {
  logClassification,
  logRouting,
  buildClassificationSummary,
  routingMetrics,
} from "./telemetry";
