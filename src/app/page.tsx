"use client";

import { useState } from "react";
import { MessageSquare, Hash, Slack } from "lucide-react";
import { ChannelSelector } from "@/components/channel-selector";
import { ChatInterface } from "@/components/chat-interface";
import { Card } from "@/components/ui/card";

interface Channel {
  id: string;
  name: string;
  topic?: string;
  purpose?: string;
  memberCount?: number;
  isPrivate: boolean;
}

export default function Home() {
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <Slack className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-semibold">Slack Channel Chat</h1>
                <p className="text-sm text-muted-foreground">
                  AI-powered conversation analysis
                </p>
              </div>
            </div>
            <div className="w-80">
              <ChannelSelector
                selectedChannel={selectedChannel}
                onSelectChannel={setSelectedChannel}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-140px)]">
          {/* Sidebar - Channel Info */}
          <aside className="hidden lg:block">
            <Card className="p-4 h-full">
              <h2 className="font-semibold mb-4 flex items-center gap-2">
                <Hash className="h-4 w-4" />
                Channel Info
              </h2>
              {selectedChannel ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Name</p>
                    <p className="font-medium">#{selectedChannel.name}</p>
                  </div>
                  {selectedChannel.purpose && (
                    <div>
                      <p className="text-sm text-muted-foreground">Purpose</p>
                      <p className="text-sm">{selectedChannel.purpose}</p>
                    </div>
                  )}
                  {selectedChannel.topic && (
                    <div>
                      <p className="text-sm text-muted-foreground">Topic</p>
                      <p className="text-sm">{selectedChannel.topic}</p>
                    </div>
                  )}
                  {selectedChannel.memberCount !== undefined && (
                    <div>
                      <p className="text-sm text-muted-foreground">Members</p>
                      <p className="font-medium">
                        {selectedChannel.memberCount}
                      </p>
                    </div>
                  )}
                  <div className="pt-4 border-t">
                    <p className="text-xs text-muted-foreground">
                      Analyzing messages from the last day
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Select a channel to see its details
                </p>
              )}
            </Card>
          </aside>

          {/* Chat Area */}
          <div className="lg:col-span-3">
            <Card className="h-full flex flex-col overflow-hidden">
              {selectedChannel && (
                <div className="border-b px-4 py-3 bg-muted/30">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">
                      Chat with #{selectedChannel.name}
                    </span>
                  </div>
                </div>
              )}
              <div className="flex-1 overflow-hidden">
                <ChatInterface channel={selectedChannel} />
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
