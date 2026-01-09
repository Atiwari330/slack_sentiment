"use client";

import { useChat } from "@ai-sdk/react";
import { useState, useEffect, useRef } from "react";
import { Send, Loader2, Bot, User, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import ReactMarkdown from "react-markdown";

interface Channel {
  id: string;
  name: string;
}

interface ChatInterfaceProps {
  channel: Channel | null;
}

// Helper to extract text content from v6 message format
function getMessageText(message: { parts?: Array<{ type: string; text?: string }>; content?: string }): string {
  // v6 format uses parts array
  if (message.parts) {
    return message.parts
      .filter((part): part is { type: "text"; text: string } => part.type === "text" && !!part.text)
      .map((part) => part.text)
      .join("");
  }
  // Fallback to content for older format
  return message.content || "";
}

export function ChatInterface({ channel }: ChatInterfaceProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");

  const { messages, status, error, sendMessage, setMessages } =
    useChat({
      api: "/api/chat",
      onMessage: (message) => {
        console.log("=== onMessage ===", message);
      },
      onError: (err) => {
        console.error("=== useChat error ===", err);
      },
      onFinish: (message) => {
        console.log("=== onFinish ===", message);
      },
    });

  const isLoading = status === "streaming" || status === "submitted";

  // Debug logging
  console.log("=== Chat state ===", { status, messagesCount: messages.length, error });

  // Reset messages when channel changes
  useEffect(() => {
    setMessages([]);
  }, [channel?.id, setMessages]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const suggestedPrompts = [
    "Summarize the key discussions from this channel",
    "What are the main action items mentioned?",
    "Who are the most active participants?",
    "What decisions were made recently?",
  ];

  const handleSuggestedPrompt = (prompt: string) => {
    setInput(prompt);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      sendMessage(
        { text: input },
        {
          body: {
            channelId: channel?.id,
            channelName: channel?.name,
          },
        }
      );
      setInput("");
    }
  };

  if (!channel) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <div className="rounded-full bg-primary/10 p-4 mb-4">
          <Sparkles className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Select a Channel</h2>
        <p className="text-muted-foreground max-w-md">
          Choose a Slack channel from the dropdown above to start chatting with
          AI about your team&apos;s conversations from the last day.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="space-y-6">
            <div className="text-center py-8">
              <div className="rounded-full bg-primary/10 p-4 mb-4 inline-block">
                <Bot className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-medium mb-2">
                Chat with #{channel.name}
              </h3>
              <p className="text-muted-foreground text-sm max-w-md mx-auto">
                I have access to the last day of messages from this channel.
                Ask me anything about the discussions!
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground text-center">
                Try asking:
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {suggestedPrompts.map((prompt, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => handleSuggestedPrompt(prompt)}
                    disabled={isLoading}
                  >
                    {prompt}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
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
                      <ReactMarkdown>{getMessageText(message)}</ReactMarkdown>
                    ) : (
                      <p className="m-0">{getMessageText(message)}</p>
                    )}
                  </div>
                </Card>
                {message.role === "user" && (
                  <div className="rounded-full bg-primary p-2 h-8 w-8 flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 text-primary-foreground" />
                  </div>
                )}
              </div>
            ))}
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
          </div>
        )}
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
            placeholder={`Ask about #${channel.name}...`}
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
