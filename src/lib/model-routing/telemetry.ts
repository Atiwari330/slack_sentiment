/**
 * Telemetry and logging for model routing
 */

import { Classification, ClassificationInput } from "./categories";

interface ClassificationLog {
  input: ClassificationInput;
  classification: Classification;
  latencyMs: number;
  model: string;
}

interface RoutingLog {
  sessionId: string;
  classification: Classification;
  modelUsed: string;
  enhanced: boolean;
  timestamp: Date;
}

/**
 * Log a classification event for monitoring
 */
export function logClassification(log: ClassificationLog): void {
  const { input, classification, latencyMs, model } = log;

  console.log("=== Email Classification ===");
  console.log(`Subject: ${input.subject}`);
  console.log(`From: ${input.senderName || "Unknown"} <${input.senderEmail}>`);
  console.log(`Category: ${classification.category}`);
  console.log(`Tier: ${classification.tier}`);
  console.log(`Confidence: ${(classification.confidence * 100).toFixed(1)}%`);
  console.log(`Reason: ${classification.reason}`);
  console.log(`Signals: ${classification.signals.join(", ") || "none"}`);
  console.log(`Classifier Model: ${model}`);
  console.log(`Latency: ${latencyMs}ms`);
  console.log("============================");

  // In production, this could send to a logging service like DataDog, Sentry, etc.
  // await logToService({ type: 'email_classification', ...log });
}

/**
 * Log a model routing decision
 */
export function logRouting(log: RoutingLog): void {
  const { sessionId, classification, modelUsed, enhanced, timestamp } = log;

  console.log("=== Model Routing Decision ===");
  console.log(`Session: ${sessionId}`);
  console.log(`Category: ${classification.category}`);
  console.log(`Model: ${modelUsed}`);
  console.log(`Enhanced Prompting: ${enhanced ? "Yes" : "No"}`);
  console.log(`Timestamp: ${timestamp.toISOString()}`);
  console.log("==============================");
}

/**
 * Build a summary object for API responses
 */
export function buildClassificationSummary(classification: Classification): {
  category: string;
  tier: string;
  reason: string;
  isHighStakes: boolean;
} {
  return {
    category: classification.category,
    tier: classification.tier,
    reason: classification.reason,
    isHighStakes: classification.tier === "frontier",
  };
}

/**
 * Metrics tracking (in-memory for now, could be extended to persistent storage)
 */
class RoutingMetrics {
  private classificationCounts: Map<string, number> = new Map();
  private tierCounts: Map<string, number> = new Map();
  private totalClassifications = 0;
  private totalLatencyMs = 0;

  recordClassification(classification: Classification, latencyMs: number): void {
    this.totalClassifications++;
    this.totalLatencyMs += latencyMs;

    // Track category counts
    const categoryCount =
      this.classificationCounts.get(classification.category) || 0;
    this.classificationCounts.set(
      classification.category,
      categoryCount + 1
    );

    // Track tier counts
    const tierCount = this.tierCounts.get(classification.tier) || 0;
    this.tierCounts.set(classification.tier, tierCount + 1);
  }

  getStats(): {
    total: number;
    avgLatencyMs: number;
    byCategory: Record<string, number>;
    byTier: Record<string, number>;
    frontierPercentage: number;
  } {
    const byCategory: Record<string, number> = {};
    this.classificationCounts.forEach((count, category) => {
      byCategory[category] = count;
    });

    const byTier: Record<string, number> = {};
    this.tierCounts.forEach((count, tier) => {
      byTier[tier] = count;
    });

    const frontierCount = this.tierCounts.get("frontier") || 0;
    const frontierPercentage =
      this.totalClassifications > 0
        ? (frontierCount / this.totalClassifications) * 100
        : 0;

    return {
      total: this.totalClassifications,
      avgLatencyMs:
        this.totalClassifications > 0
          ? this.totalLatencyMs / this.totalClassifications
          : 0,
      byCategory,
      byTier,
      frontierPercentage,
    };
  }
}

// Global metrics instance
export const routingMetrics = new RoutingMetrics();
