"use client";

import { useState, useEffect } from "react";
import { Hash, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AccountForm } from "@/components/account-form";

interface Account {
  id: string;
  name: string;
  slack_channel_id: string;
  slack_channel_name: string | null;
  is_active: boolean;
  created_at: string;
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchAccounts();
  }, []);

  async function fetchAccounts() {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/accounts?withSentiment=false");
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
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to remove this account?")) return;

    setDeletingId(id);
    try {
      const response = await fetch(`/api/accounts/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete account");
      }

      // Remove from local state
      setAccounts((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete account");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold">Account Management</h1>
              <p className="text-sm text-muted-foreground">
                Map customer accounts to Slack channels
              </p>
            </div>
            <AccountForm onAccountCreated={fetchAccounts} />
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <Card className="p-6 text-center">
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={fetchAccounts}>Retry</Button>
          </Card>
        ) : accounts.length === 0 ? (
          <Card className="p-12 text-center">
            <h2 className="text-lg font-medium mb-2">No accounts yet</h2>
            <p className="text-muted-foreground mb-4">
              Add your first customer account to start tracking sentiment.
            </p>
            <AccountForm onAccountCreated={fetchAccounts} />
          </Card>
        ) : (
          <div className="space-y-2">
            {accounts.map((account) => (
              <Card
                key={account.id}
                className="p-4 flex items-center gap-4 hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium">{account.name}</h3>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Hash className="h-3 w-3" />
                    <span>{account.slack_channel_name || account.slack_channel_id}</span>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  Added {new Date(account.created_at).toLocaleDateString()}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(account.id)}
                  disabled={deletingId === account.id}
                >
                  {deletingId === account.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </Card>
            ))}
            <p className="text-sm text-muted-foreground text-center pt-4">
              {accounts.length} account{accounts.length !== 1 ? "s" : ""} configured
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
