/**
 * Email classification categories and types for intelligent model routing
 */

export type ModelTier = "light" | "frontier";

export type EmailCategory =
  // Light tier - routine operations
  | "routine_reply"
  | "routine_update"
  | "needs_attention"
  // Frontier tier - high-stakes situations
  | "high_stakes_complaint"
  | "high_stakes_contract"
  | "high_stakes_escalation"
  | "high_stakes_sensitive"
  | "complex_negotiation";

export interface Classification {
  /** The detected category of the email */
  category: EmailCategory;
  /** Which model tier to use */
  tier: ModelTier;
  /** Confidence score from 0-1 */
  confidence: number;
  /** Human-readable reason for the classification */
  reason: string;
  /** Key signals detected in the email */
  signals: string[];
}

export interface ClassificationInput {
  /** The email thread content */
  threadContent: string;
  /** Email subject line */
  subject: string;
  /** Sender name */
  senderName?: string;
  /** Sender email */
  senderEmail?: string;
  /** Any contact/company context available */
  senderContext?: string;
}

/**
 * Category metadata for UI display and logging
 */
export const CATEGORY_METADATA: Record<
  EmailCategory,
  {
    tier: ModelTier;
    label: string;
    description: string;
    badgeVariant: "default" | "secondary" | "destructive" | "outline";
  }
> = {
  routine_reply: {
    tier: "light",
    label: "Routine",
    description: "Simple acknowledgment or scheduling",
    badgeVariant: "outline",
  },
  routine_update: {
    tier: "light",
    label: "Update",
    description: "FYI, status update, or newsletter",
    badgeVariant: "outline",
  },
  needs_attention: {
    tier: "light",
    label: "Attention",
    description: "Requires thoughtful response",
    badgeVariant: "secondary",
  },
  high_stakes_complaint: {
    tier: "frontier",
    label: "Customer Complaint",
    description: "Frustration or negative sentiment detected",
    badgeVariant: "destructive",
  },
  high_stakes_contract: {
    tier: "frontier",
    label: "Contract/Pricing",
    description: "Pricing, renewal, or legal terms",
    badgeVariant: "destructive",
  },
  high_stakes_escalation: {
    tier: "frontier",
    label: "Escalation",
    description: "Executive involvement or formal escalation",
    badgeVariant: "destructive",
  },
  high_stakes_sensitive: {
    tier: "frontier",
    label: "Sensitive",
    description: "Legal, HR, or confidential matters",
    badgeVariant: "destructive",
  },
  complex_negotiation: {
    tier: "frontier",
    label: "Negotiation",
    description: "Multi-party decisions or complex business",
    badgeVariant: "default",
  },
};

/**
 * Get the tier for a given category
 */
export function getTierForCategory(category: EmailCategory): ModelTier {
  return CATEGORY_METADATA[category].tier;
}

/**
 * Check if a category is high-stakes
 */
export function isHighStakes(category: EmailCategory): boolean {
  return CATEGORY_METADATA[category].tier === "frontier";
}
