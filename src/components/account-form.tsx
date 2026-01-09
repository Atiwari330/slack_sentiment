"use client";

import { useState, useEffect } from "react";
import { Hash, Lock, Search, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Channel {
  id: string;
  name: string;
  topic?: string;
  purpose?: string;
  memberCount?: number;
  isPrivate: boolean;
}

interface AccountFormProps {
  onAccountCreated: () => void;
}

export function AccountForm({ onAccountCreated }: AccountFormProps) {
  const [open, setOpen] = useState(false);
  const [accountName, setAccountName] = useState("");
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      fetchChannels();
    }
  }, [open]);

  async function fetchChannels() {
    try {
      setLoadingChannels(true);
      const response = await fetch("/api/slack/channels");
      const data = await response.json();
      if (response.ok) {
        setChannels(data.channels);
      }
    } catch (err) {
      console.error("Failed to fetch channels:", err);
    } finally {
      setLoadingChannels(false);
    }
  }

  const filteredChannels = channels.filter((channel) =>
    channel.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accountName.trim() || !selectedChannel) return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: accountName.trim(),
          slackChannelId: selectedChannel.id,
          slackChannelName: selectedChannel.name,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create account");
      }

      // Reset form and close
      setAccountName("");
      setSelectedChannel(null);
      setSearchQuery("");
      setOpen(false);
      onAccountCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create account");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Account
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add New Account</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Account Name */}
          <div className="space-y-2">
            <label htmlFor="accountName" className="text-sm font-medium">
              Account Name
            </label>
            <Input
              id="accountName"
              placeholder="e.g., Sunrise Behavioral Health"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              disabled={submitting}
            />
          </div>

          {/* Channel Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Slack Channel</label>
            {selectedChannel ? (
              <div className="flex items-center gap-2 p-3 border rounded-md bg-muted/50">
                {selectedChannel.isPrivate ? (
                  <Lock className="h-4 w-4" />
                ) : (
                  <Hash className="h-4 w-4" />
                )}
                <span className="font-medium">{selectedChannel.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="ml-auto"
                  onClick={() => setSelectedChannel(null)}
                  disabled={submitting}
                >
                  Change
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search channels..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                    disabled={submitting}
                  />
                </div>
                <ScrollArea className="h-[200px] border rounded-md">
                  {loadingChannels ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : filteredChannels.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground">
                      No channels found.
                    </div>
                  ) : (
                    <div className="p-1">
                      {filteredChannels.map((channel) => (
                        <button
                          key={channel.id}
                          type="button"
                          onClick={() => setSelectedChannel(channel)}
                          className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-left hover:bg-accent transition-colors"
                          disabled={submitting}
                        >
                          {channel.isPrivate ? (
                            <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
                          ) : (
                            <Hash className="h-4 w-4 shrink-0 text-muted-foreground" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">
                              {channel.name}
                            </div>
                          </div>
                          {channel.memberCount !== undefined && (
                            <Badge variant="secondary" className="shrink-0">
                              {channel.memberCount}
                            </Badge>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              {error}
            </div>
          )}

          {/* Submit */}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!accountName.trim() || !selectedChannel || submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Account"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
