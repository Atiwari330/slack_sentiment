"use client";

import { useState, useCallback } from "react";
import {
  ArrowLeft,
  RefreshCw,
  Coffee,
  AlertCircle,
  CheckCircle,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BriefingCard } from "@/components/briefing/briefing-card";

interface BriefingItem {
  actionId: string;
  account: {
    id: string;
    name: string;
    slackChannelId: string;
    slackChannelName: string | null;
  };
  sentiment: string | null;
  urgency: string | null;
  issueSummary: string;
  suggestedMessage: string;
  reasoning: string;
  conversationState?: {
    description: string;
    customerWaitingHours: number | null;
    lastVendorResponseHours: number | null;
  } | null;
  riskFactors: string[] | null;
}

type PageState = "loading" | "empty" | "ready" | "error" | "complete";

export default function BriefingPage() {
  const [state, setState] = useState<PageState>("loading");
  const [items, setItems] = useState<BriefingItem[]>([]);
  const [totalAtRisk, setTotalAtRisk] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [completedCount, setCompletedCount] = useState(0);

  const loadBriefing = useCallback(async () => {
    setState("loading");
    setError(null);
    setCompletedCount(0);

    try {
      const response = await fetch("/api/briefing/generate?limit=5");
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to generate briefing");
      }

      const data = await response.json();
      setItems(data.briefing || []);
      setTotalAtRisk(data.totalAtRisk || 0);

      if (data.briefing.length === 0) {
        setState("empty");
      } else {
        setState("ready");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load briefing");
      setState("error");
    }
  }, []);

  // Load on mount
  useState(() => {
    loadBriefing();
  });

  const handleApprove = useCallback(async (actionId: string, message: string) => {
    const response = await fetch("/api/briefing/action/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actionId, message }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Failed to approve action");
    }

    setCompletedCount((prev) => prev + 1);

    // Check if all items are complete
    const newCompleted = completedCount + 1;
    if (newCompleted >= items.length) {
      setState("complete");
    }
  }, [completedCount, items.length]);

  const handleSkip = useCallback(async (actionId: string, reason?: string) => {
    const response = await fetch("/api/briefing/action/skip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actionId, reason }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Failed to skip action");
    }

    setCompletedCount((prev) => prev + 1);

    // Check if all items are complete
    const newCompleted = completedCount + 1;
    if (newCompleted >= items.length) {
      setState("complete");
    }
  }, [completedCount, items.length]);

  const handleRevise = useCallback(async (actionId: string, feedback: string): Promise<string> => {
    const response = await fetch("/api/briefing/action/revise", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actionId, feedback }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Failed to revise action");
    }

    const data = await response.json();

    // Update the item in the list with the new message
    setItems((prevItems) =>
      prevItems.map((item) =>
        item.actionId === actionId
          ? { ...item, suggestedMessage: data.revised.suggestedMessage }
          : item
      )
    );

    return data.revised.suggestedMessage;
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/dashboard">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div>
                <h1 className="font-semibold flex items-center gap-2">
                  <Coffee className="h-5 w-5" />
                  Morning Briefing
                </h1>
                <p className="text-xs text-muted-foreground">
                  Triage at-risk accounts with AI-suggested actions
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadBriefing}
              disabled={state === "loading"}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${state === "loading" ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 max-w-3xl">
        {state === "loading" && (
          <Card>
            <CardContent className="py-12 flex flex-col items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground">
                Analyzing at-risk accounts and generating suggestions...
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                This may take a moment
              </p>
            </CardContent>
          </Card>
        )}

        {state === "error" && (
          <Card className="border-red-200">
            <CardContent className="py-8 flex flex-col items-center justify-center">
              <AlertCircle className="h-8 w-8 text-red-500 mb-4" />
              <p className="text-sm font-medium text-red-600">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={loadBriefing}
                className="mt-4"
              >
                Try Again
              </Button>
            </CardContent>
          </Card>
        )}

        {state === "empty" && (
          <Card className="border-green-200 bg-green-50/50 dark:bg-green-900/10">
            <CardContent className="py-12 flex flex-col items-center justify-center">
              <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
              <h2 className="text-lg font-semibold mb-2">All Clear!</h2>
              <p className="text-sm text-muted-foreground text-center max-w-md">
                No at-risk accounts found. All your accounts appear healthy.
                Check back later or use the dashboard for detailed views.
              </p>
              <Link href="/dashboard" className="mt-4">
                <Button variant="outline">View Dashboard</Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {state === "complete" && (
          <Card className="border-green-200 bg-green-50/50 dark:bg-green-900/10 mb-6">
            <CardContent className="py-8 flex flex-col items-center justify-center">
              <CheckCircle className="h-10 w-10 text-green-500 mb-3" />
              <h2 className="text-lg font-semibold mb-1">Briefing Complete!</h2>
              <p className="text-sm text-muted-foreground text-center">
                You&apos;ve processed {completedCount} account{completedCount !== 1 ? "s" : ""}.
                {totalAtRisk > items.length && (
                  <span className="block mt-1">
                    {totalAtRisk - items.length} more accounts need attention.
                  </span>
                )}
              </p>
              <div className="flex gap-2 mt-4">
                <Button variant="outline" onClick={loadBriefing}>
                  Load More
                </Button>
                <Link href="/dashboard">
                  <Button>View Dashboard</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {(state === "ready" || state === "complete") && items.length > 0 && (
          <div className="space-y-4">
            {/* Stats bar */}
            {state === "ready" && (
              <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
                <span>
                  Showing {items.length} of {totalAtRisk} at-risk accounts
                </span>
                <span>
                  {completedCount} / {items.length} processed
                </span>
              </div>
            )}

            {/* Briefing Cards */}
            {items.map((item) => (
              <BriefingCard
                key={item.actionId}
                item={item}
                onApprove={handleApprove}
                onSkip={handleSkip}
                onRevise={handleRevise}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
