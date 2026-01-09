"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DashboardHeaderProps {
  onAnalyzeAll: () => Promise<void>;
  summary: {
    red: number;
    yellow: number;
    green: number;
    unanalyzed: number;
  };
}

export function DashboardHeader({ onAnalyzeAll, summary }: DashboardHeaderProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAnalyzeAll = async () => {
    setIsAnalyzing(true);
    try {
      await onAnalyzeAll();
    } finally {
      setIsAnalyzing(false);
    }
  };

  const total = summary.red + summary.yellow + summary.green + summary.unanalyzed;

  return (
    <header className="border-b bg-card sticky top-0 z-10">
      <div className="container mx-auto px-4 py-4">
        {/* Title Row */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Account Sentiment Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Monitor customer health across all accounts
            </p>
          </div>
          <Button
              onClick={handleAnalyzeAll}
              disabled={isAnalyzing || total === 0}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isAnalyzing ? "animate-spin" : ""}`} />
              {isAnalyzing ? "Analyzing..." : "Analyze All"}
            </Button>
        </div>

        {/* Summary Row */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-sm font-medium">{summary.red} At Risk</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <span className="text-sm font-medium">{summary.yellow} Needs Attention</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-sm font-medium">{summary.green} Healthy</span>
          </div>
          {summary.unanalyzed > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-400" />
              <span className="text-sm font-medium">{summary.unanalyzed} Pending</span>
            </div>
          )}
          <div className="ml-auto text-sm text-muted-foreground">
            {total} total account{total !== 1 ? "s" : ""}
          </div>
        </div>
      </div>
    </header>
  );
}
