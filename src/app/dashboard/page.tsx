"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DashboardHeader } from "@/components/dashboard/header";
import { AccountRow } from "@/components/dashboard/account-row";
import { AccountDetailPanel } from "@/components/dashboard/account-detail-panel";
import { WhatsChanged } from "@/components/dashboard/whats-changed";
import Link from "next/link";
import type { AccountWithSentiment } from "@/lib/supabase";

interface ChangedAccount {
  accountId: string;
  accountName: string;
  previousSentiment: "green" | "yellow" | "red";
  currentSentiment: "green" | "yellow" | "red";
  currentSummary: string;
  changedAt: string;
}

export default function DashboardPage() {
  const [accounts, setAccounts] = useState<AccountWithSentiment[]>([]);
  const [changes, setChanges] = useState<ChangedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<AccountWithSentiment | null>(null);

  const fetchAccounts = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch("/api/accounts?withSentiment=true");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch accounts");
      }

      setAccounts(data.accounts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load accounts");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchChanges = useCallback(async () => {
    try {
      const response = await fetch("/api/dashboard/changes");
      const data = await response.json();
      if (response.ok) {
        setChanges(data.changes || []);
      }
    } catch (err) {
      console.error("Failed to fetch changes:", err);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
    fetchChanges();
  }, [fetchAccounts, fetchChanges]);

  const handleAnalyzeSingle = async (accountId: string) => {
    try {
      const response = await fetch(`/api/analyze/${accountId}`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to analyze account");
      }

      // Refresh the list to show updated sentiment
      await fetchAccounts();
    } catch (err) {
      console.error("Analysis error:", err);
      alert(err instanceof Error ? err.message : "Failed to analyze account");
    }
  };

  const handleAnalyzeAll = async () => {
    try {
      const response = await fetch("/api/analyze/batch", {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to analyze accounts");
      }

      // Refresh the list to show updated sentiments
      await fetchAccounts();
      await fetchChanges();
    } catch (err) {
      console.error("Batch analysis error:", err);
      alert(err instanceof Error ? err.message : "Failed to analyze accounts");
    }
  };

  const handleChangeClick = (accountId: string) => {
    const account = accounts.find((a) => a.id === accountId);
    if (account) {
      setSelectedAccount(account);
    }
  };

  // Calculate summary
  const summary = {
    red: accounts.filter((a) => a.latest_sentiment === "red").length,
    yellow: accounts.filter((a) => a.latest_sentiment === "yellow").length,
    green: accounts.filter((a) => a.latest_sentiment === "green").length,
    unanalyzed: accounts.filter((a) => !a.latest_sentiment).length,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="p-6 text-center max-w-md">
          <p className="text-destructive mb-4">{error}</p>
          <Button onClick={fetchAccounts}>Retry</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader onAnalyzeAll={handleAnalyzeAll} summary={summary} />

      <main className="container mx-auto px-4 py-6">
        {/* What's Changed Section */}
        <WhatsChanged changes={changes} onAccountClick={handleChangeClick} />

        {accounts.length === 0 ? (
          <Card className="p-12 text-center">
            <h2 className="text-lg font-medium mb-2">No accounts configured</h2>
            <p className="text-muted-foreground mb-4">
              Add your customer accounts to start tracking sentiment.
            </p>
            <Link href="/accounts">
              <Button>Add Your First Account</Button>
            </Link>
          </Card>
        ) : (
          <div className="space-y-2">
            {accounts.map((account) => (
              <AccountRow
                key={account.id}
                account={account}
                onAnalyze={handleAnalyzeSingle}
                onClick={() => setSelectedAccount(account)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Account Detail Panel */}
      {selectedAccount && (
        <AccountDetailPanel
          account={selectedAccount}
          onClose={() => setSelectedAccount(null)}
        />
      )}
    </div>
  );
}
