"use client";

import { useState } from "react";
import { ChannelSelector } from "@/components/channel-selector";
import { AsanaProjectSelect } from "@/components/asana-project-select";
import { ChannelAuditChat } from "@/components/channel-audit/channel-audit-chat";
import { Search } from "lucide-react";

interface Channel {
  id: string;
  name: string;
  topic?: string;
  purpose?: string;
  memberCount?: number;
  isPrivate: boolean;
}

export default function ChannelAuditPage() {
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [asanaProject, setAsanaProject] = useState<{
    id: string | null;
    name: string | null;
  }>({ id: null, name: null });

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="border-b bg-card px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-primary/10 p-2">
              <Search className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Channel Audit</h1>
              <p className="text-sm text-muted-foreground">
                Analyze Slack channels and take action
              </p>
            </div>
          </div>
        </div>

        {/* Selectors */}
        <div className="flex gap-4">
          <div className="flex-1 max-w-xs">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Slack Channel
            </label>
            <ChannelSelector
              selectedChannel={selectedChannel}
              onSelectChannel={setSelectedChannel}
            />
          </div>
          <div className="flex-1 max-w-xs">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Asana Project (for tasks)
            </label>
            <AsanaProjectSelect value={asanaProject} onChange={setAsanaProject} />
          </div>
        </div>
      </header>

      {/* Chat Area */}
      <main className="flex-1 overflow-hidden">
        <ChannelAuditChat channel={selectedChannel} asanaProject={asanaProject} />
      </main>
    </div>
  );
}
