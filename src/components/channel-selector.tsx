"use client";

import { useState, useEffect } from "react";
import { Hash, Lock, Search, Loader2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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

interface ChannelSelectorProps {
  selectedChannel: Channel | null;
  onSelectChannel: (channel: Channel) => void;
}

export function ChannelSelector({
  selectedChannel,
  onSelectChannel,
}: ChannelSelectorProps) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchChannels();
  }, []);

  async function fetchChannels() {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/slack/channels");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch channels");
      }

      setChannels(data.channels);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load channels");
    } finally {
      setLoading(false);
    }
  }

  const filteredChannels = channels.filter((channel) =>
    channel.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelect = (channel: Channel) => {
    onSelectChannel(channel);
    setOpen(false);
    setSearchQuery("");
  };

  if (loading) {
    return (
      <Button variant="outline" className="w-full justify-start" disabled>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading channels...
      </Button>
    );
  }

  if (error) {
    return (
      <div className="space-y-2">
        <Button
          variant="outline"
          className="w-full justify-start text-destructive"
          onClick={fetchChannels}
        >
          Error: {error}. Click to retry.
        </Button>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between bg-background hover:bg-accent"
        >
          {selectedChannel ? (
            <span className="flex items-center gap-2">
              {selectedChannel.isPrivate ? (
                <Lock className="h-4 w-4" />
              ) : (
                <Hash className="h-4 w-4" />
              )}
              {selectedChannel.name}
            </span>
          ) : (
            <span className="text-muted-foreground">Select a channel...</span>
          )}
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Select a Channel</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search channels..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <ScrollArea className="h-[300px]">
            {filteredChannels.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                No channels found.
              </div>
            ) : (
              <div className="space-y-1">
                {filteredChannels.map((channel) => (
                  <button
                    key={channel.id}
                    onClick={() => handleSelect(channel)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left hover:bg-accent transition-colors ${
                      selectedChannel?.id === channel.id ? "bg-accent" : ""
                    }`}
                  >
                    {channel.isPrivate ? (
                      <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <Hash className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{channel.name}</div>
                      {channel.purpose && (
                        <div className="text-xs text-muted-foreground truncate">
                          {channel.purpose}
                        </div>
                      )}
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
          <div className="text-xs text-muted-foreground text-center">
            {channels.length} channels available
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
