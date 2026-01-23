"use client";

import { useChat } from "@ai-sdk/react";
import { UIMessage } from "ai";
import { DefaultChatTransport } from "ai";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Send, Loader2, Bot, User, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import ReactMarkdown from "react-markdown";
import { InlineSlackDraft } from "./inline-slack-draft";
import { InlineAsanaDraft } from "./inline-asana-draft";

interface Channel {
  id: string;
  name: string;
}

interface AsanaProject {
  id: string | null;
  name: string | null;
}

interface ChannelAuditChatProps {
  channel: Channel | null;
  asanaProject: AsanaProject;
}

// Helper to extract text content from v6 message format
function getMessageText(message: {
  parts?: Array<{ type: string; text?: string }>;
  content?: string;
}): string {
  if (message.parts) {
    return message.parts
      .filter(
        (part): part is { type: "text"; text: string } =>
          part.type === "text" && !!part.text
      )
      .map((part) => part.text)
      .join("");
  }
  return message.content || "";
}

// Type for draft data extracted from tool results
interface SlackDraftData {
  type: "slack_draft";
  draft: {
    message: string;
    recipientName: string | null;
    recipientSlackId: string | null;
    context: string | null;
  };
}

interface AsanaDraftData {
  type: "asana_draft";
  draft: {
    taskTitle: string;
    taskDescription: string;
    subtasks: string[];
    assigneeEmail: string | null;
    context: string | null;
  };
}

type DraftData = SlackDraftData | AsanaDraftData;

// Extract drafts from message parts (tool results)
function extractDrafts(message: UIMessage): DraftData[] {
  if (!message.parts) return [];

  const drafts: DraftData[] = [];

  for (const part of message.parts) {
    // Check for tool result parts - they have type starting with "tool-"
    if (
      typeof part === "object" &&
      part !== null &&
      "type" in part &&
      typeof part.type === "string" &&
      part.type.startsWith("tool-")
    ) {
      // Try to extract output/result from the part
      const partObj = part as Record<string, unknown>;
      const output = partObj.output || partObj.result;

      if (output && typeof output === "object" && output !== null) {
        const outputObj = output as Record<string, unknown>;
        if (outputObj.type === "slack_draft" && outputObj.draft) {
          drafts.push(output as SlackDraftData);
        } else if (outputObj.type === "asana_draft" && outputObj.draft) {
          drafts.push(output as AsanaDraftData);
        }
      }
    }
  }

  return drafts;
}

export function ChannelAuditChat({
  channel,
  asanaProject,
}: ChannelAuditChatProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");
  const triggeredForChannelRef = useRef<string | null>(null);

  // Create transport with custom body data
  const transport = useMemo(() => {
    return new DefaultChatTransport({
      api: "/api/channel-audit/chat",
      body: {
        channelId: channel?.id,
        channelName: channel?.name,
        asanaProjectId: asanaProject.id,
      },
    });
  }, [channel?.id, channel?.name, asanaProject.id]);

  const { messages, status, error, sendMessage, setMessages } = useChat({
    id: `channel-audit-${channel?.id || "none"}`,
    transport,
  });

  const isLoading = status === "streaming" || status === "submitted";

  // Trigger initial analysis when channel changes
  useEffect(() => {
    if (channel?.id && channel.id !== triggeredForChannelRef.current) {
      // Clear messages for the new channel
      setMessages([]);
      triggeredForChannelRef.current = channel.id;

      // Small delay to ensure transport is updated, then send analysis request
      const timer = setTimeout(() => {
        sendMessage({
          parts: [
            {
              type: "text" as const,
              text: "Please analyze this channel and provide a summary of the key discussions, action items, and any concerns.",
            },
          ],
          role: "user",
        });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [channel?.id, setMessages, sendMessage]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const suggestedPrompts = [
    "What are the main risks or concerns?",
    "Draft a follow-up message to the team",
    "Create an Asana task for the action items",
    "Who needs to follow up on what?",
  ];

  const handleSuggestedPrompt = (prompt: string) => {
    setInput(prompt);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      sendMessage({
        parts: [{ type: "text" as const, text: input }],
        role: "user",
      });
      setInput("");
    }
  };

  const handleRevise = useCallback(
    (feedback: string) => {
      sendMessage({
        parts: [
          {
            type: "text" as const,
            text: `Please revise the draft with this feedback: ${feedback}`,
          },
        ],
        role: "user",
      });
    },
    [sendMessage]
  );

  if (!channel) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <div className="rounded-full bg-primary/10 p-4 mb-4">
          <Sparkles className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Select a Channel</h2>
        <p className="text-muted-foreground max-w-md">
          Choose a Slack channel from the dropdown above to start analyzing
          conversations and taking action.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.map((message) => {
            const drafts = extractDrafts(message);
            const messageText = getMessageText(message);

            return (
              <div key={message.id} className="space-y-3">
                {/* Message bubble */}
                {messageText && (
                  <div
                    className={`flex gap-3 ${
                      message.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    {message.role === "assistant" && (
                      <div className="rounded-full bg-primary/10 p-2 h-8 w-8 flex items-center justify-center shrink-0">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                    )}
                    <Card
                      className={`px-4 py-3 max-w-[80%] ${
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        {message.role === "assistant" ? (
                          <ReactMarkdown>{messageText}</ReactMarkdown>
                        ) : (
                          <p className="m-0">{messageText}</p>
                        )}
                      </div>
                    </Card>
                    {message.role === "user" && (
                      <div className="rounded-full bg-primary p-2 h-8 w-8 flex items-center justify-center shrink-0">
                        <User className="h-4 w-4 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                )}

                {/* Draft cards from tool results */}
                {drafts.map((draft, index) => {
                  if (draft.type === "slack_draft") {
                    return (
                      <div key={`${message.id}-draft-${index}`} className="ml-11">
                        <InlineSlackDraft
                          draft={draft.draft}
                          channelId={channel!.id}
                          channelName={channel!.name}
                          onApprove={() => {}}
                          onRevise={handleRevise}
                        />
                      </div>
                    );
                  }

                  if (draft.type === "asana_draft") {
                    return (
                      <div key={`${message.id}-draft-${index}`} className="ml-11">
                        <InlineAsanaDraft
                          draft={draft.draft}
                          projectId={asanaProject.id}
                          projectName={asanaProject.name}
                          onApprove={() => {}}
                          onRevise={handleRevise}
                        />
                      </div>
                    );
                  }

                  return null;
                })}
              </div>
            );
          })}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex gap-3 justify-start">
              <div className="rounded-full bg-primary/10 p-2 h-8 w-8 flex items-center justify-center">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <Card className="px-4 py-3 bg-muted">
                <Loader2 className="h-4 w-4 animate-spin" />
              </Card>
            </div>
          )}

          {/* Suggested prompts (show after initial analysis) */}
          {messages.length >= 2 && !isLoading && (
            <div className="pt-4 space-y-2">
              <p className="text-xs text-muted-foreground text-center">
                Continue with:
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {suggestedPrompts.map((prompt, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => handleSuggestedPrompt(prompt)}
                  >
                    {prompt}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Error Display */}
      {error && (
        <div className="px-4 py-2 bg-destructive/10 text-destructive text-sm">
          Error: {error.message}
        </div>
      )}

      {/* Input Area */}
      <div className="border-t p-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            name="message"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Ask about #${channel.name} or request an action...`}
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" disabled={isLoading || !input?.trim()}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
