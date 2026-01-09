"use client";

import { useState } from "react";
import { RefreshCw, ChevronRight, AlertTriangle, AlertCircle, CheckCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
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
}

const sentimentConfig = {
  red: {
    bg: "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800",
    indicator: "bg-red-500",
    Icon: AlertTriangle,
    label: "At Risk",
  },
  yellow: {
    bg: "bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800",
    indicator: "bg-yellow-500",
    Icon: AlertCircle,
    label: "Needs Attention",
  },
  green: {
    bg: "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800",
    indicator: "bg-green-500",
    Icon: CheckCircle,
    label: "Healthy",
  },
  null: {
    bg: "bg-muted/50 border-border",
    indicator: "bg-gray-400",
    Icon: null,
    label: "Pending",
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

export function AccountRow({ account, onAnalyze }: AccountRowProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const config = sentimentConfig[account.latest_sentiment ?? "null"];
  const Icon = config.Icon;

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
    <Card
      className={`p-4 flex items-center gap-4 border transition-all hover:shadow-md cursor-default ${config.bg}`}
    >
      {/* Sentiment Indicator */}
      <div className={`w-4 h-4 rounded-full shrink-0 ${config.indicator}`} />

      {/* Account Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold truncate">{account.name}</h3>
          {Icon && <Icon className="h-4 w-4 shrink-0 opacity-70" />}
        </div>
        <p className="text-sm text-muted-foreground truncate">
          {account.latest_summary || `#${account.slack_channel_name || "Unknown channel"}`}
        </p>
        {riskFactors.length > 0 && (
          <div className="flex gap-1 mt-1 flex-wrap">
            {riskFactors.slice(0, 3).map((factor, i) => (
              <Badge key={i} variant="outline" className="text-xs">
                {factor}
              </Badge>
            ))}
            {riskFactors.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{riskFactors.length - 3} more
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Last Analyzed */}
      <div className="text-xs text-muted-foreground shrink-0 text-right min-w-[80px]">
        {account.last_analyzed ? (
          <>Analyzed {formatRelativeTime(account.last_analyzed)}</>
        ) : (
          <>Never analyzed</>
        )}
      </div>

      {/* Re-analyze Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={handleAnalyze}
        disabled={isAnalyzing}
        className="shrink-0"
        title="Re-analyze this account"
      >
        <RefreshCw className={`h-4 w-4 ${isAnalyzing ? "animate-spin" : ""}`} />
      </Button>
    </Card>
  );
}
