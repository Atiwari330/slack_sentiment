"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface AccountRowProps {
  account: {
    id: string;
    name: string;
    slack_channel_name: string | null;
    latest_sentiment: "green" | "yellow" | "red" | null;
    latest_summary: string | null;
    last_analyzed: string | null;
    confidence: number | null;
    risk_factors: string[] | null;
  };
  onAnalyze: (accountId: string) => Promise<void>;
  onClick?: () => void;
}

const sentimentConfig = {
  red: {
    stripe: "border-l-red-500",
    label: "At Risk",
    labelClass: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
  yellow: {
    stripe: "border-l-yellow-500",
    label: "Attention",
    labelClass: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  },
  green: {
    stripe: "border-l-green-500",
    label: "Healthy",
    labelClass: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  },
  null: {
    stripe: "border-l-gray-300",
    label: "Pending",
    labelClass: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  },
};

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "yesterday";
  return `${diffDays}d ago`;
}

export function AccountRow({ account, onAnalyze, onClick }: AccountRowProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const config = sentimentConfig[account.latest_sentiment ?? "null"];

  const handleAnalyze = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsAnalyzing(true);
    try {
      await onAnalyze(account.id);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const riskFactors = account.risk_factors || [];

  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === "Enter" && onClick() : undefined}
      className={`
        flex items-start gap-4 p-3
        bg-card border rounded-lg border-l-4
        ${config.stripe}
        hover:bg-muted/50 transition-colors
        ${onClick ? "cursor-pointer" : ""}
      `}
    >
      {/* Left: Account Info */}
      <div className="flex-1 min-w-0">
        {/* Row 1: Name + Status Badge */}
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-semibold text-sm">{account.name}</h3>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${config.labelClass}`}>
            {config.label}
          </span>
        </div>

        {/* Row 2: Summary */}
        <p className="text-sm text-muted-foreground line-clamp-1 mb-1">
          {account.latest_summary || `#${account.slack_channel_name || "No analysis yet"}`}
        </p>

        {/* Row 3: Risk Factor Tags */}
        {riskFactors.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {riskFactors.slice(0, 3).map((factor, i) => (
              <Badge key={i} variant="secondary" className="text-xs py-0 h-5">
                {factor}
              </Badge>
            ))}
            {riskFactors.length > 3 && (
              <Badge variant="secondary" className="text-xs py-0 h-5">
                +{riskFactors.length - 3}
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Right: Timestamp + Action */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs text-muted-foreground">
          {account.last_analyzed ? formatRelativeTime(account.last_analyzed) : "—"}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleAnalyze}
          disabled={isAnalyzing}
          title="Re-analyze"
        >
          <RefreshCw className={`h-4 w-4 ${isAnalyzing ? "animate-spin" : ""}`} />
        </Button>
      </div>
    </div>
  );
}
