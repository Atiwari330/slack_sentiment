"use client";

import { ArrowRight, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ChangedAccount {
  accountId: string;
  accountName: string;
  previousSentiment: "green" | "yellow" | "red";
  currentSentiment: "green" | "yellow" | "red";
  currentSummary: string;
  changedAt: string;
}

interface WhatsChangedProps {
  changes: ChangedAccount[];
  onAccountClick?: (accountId: string) => void;
}

const sentimentConfig = {
  red: {
    label: "At Risk",
    bgClass: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    dotClass: "bg-red-500",
  },
  yellow: {
    label: "Attention",
    bgClass: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    dotClass: "bg-yellow-500",
  },
  green: {
    label: "Healthy",
    bgClass: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    dotClass: "bg-green-500",
  },
};

const sentimentOrder = { red: 0, yellow: 1, green: 2 };

function getChangeIcon(from: string, to: string) {
  const fromOrder = sentimentOrder[from as keyof typeof sentimentOrder];
  const toOrder = sentimentOrder[to as keyof typeof sentimentOrder];

  if (toOrder < fromOrder) {
    // Getting worse (e.g., green -> red)
    return <TrendingDown className="h-4 w-4 text-red-500" />;
  } else if (toOrder > fromOrder) {
    // Getting better (e.g., red -> green)
    return <TrendingUp className="h-4 w-4 text-green-500" />;
  }
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

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

export function WhatsChanged({ changes, onAccountClick }: WhatsChangedProps) {
  if (changes.length === 0) {
    return null;
  }

  return (
    <Card className="mb-6 p-4">
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
        </span>
        What&apos;s Changed
      </h3>
      <div className="space-y-3">
        {changes.map((change) => {
          const fromConfig = sentimentConfig[change.previousSentiment];
          const toConfig = sentimentConfig[change.currentSentiment];

          return (
            <div
              key={change.accountId}
              className={`flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors ${
                onAccountClick ? "cursor-pointer" : ""
              }`}
              onClick={() => onAccountClick?.(change.accountId)}
              role={onAccountClick ? "button" : undefined}
              tabIndex={onAccountClick ? 0 : undefined}
            >
              {/* Change indicator */}
              <div className="mt-1">
                {getChangeIcon(change.previousSentiment, change.currentSentiment)}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{change.accountName}</span>
                  <div className="flex items-center gap-1">
                    <Badge className={`${fromConfig.bgClass} text-xs py-0`}>
                      {fromConfig.label}
                    </Badge>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <Badge className={`${toConfig.bgClass} text-xs py-0`}>
                      {toConfig.label}
                    </Badge>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                  {change.currentSummary}
                </p>
              </div>

              {/* Timestamp */}
              <span className="text-xs text-muted-foreground shrink-0">
                {formatRelativeTime(change.changedAt)}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
