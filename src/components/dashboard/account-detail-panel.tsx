"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { X, Clock, AlertCircle, CheckCircle, MessageSquare, AlertTriangle, ThumbsUp, HelpCircle, Send, Bot, User, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import type { AccountWithSentiment, TimelineEventDb, ConversationStateDb } from "@/lib/supabase";

interface AccountDetailPanelProps {
  account: AccountWithSentiment;
  onClose: () => void;
}

const sentimentConfig = {
  red: {
    label: "At Risk",
    bgClass: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
  yellow: {
    label: "Needs Attention",
    bgClass: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  },
  green: {
    label: "Healthy",
    bgClass: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  },
};

const urgencyConfig = {
  low: { label: "Low", bgClass: "bg-gray-100 text-gray-600" },
  medium: { label: "Medium", bgClass: "bg-yellow-100 text-yellow-700" },
  high: { label: "High", bgClass: "bg-orange-100 text-orange-700" },
  critical: { label: "Critical", bgClass: "bg-red-100 text-red-700" },
};

const eventIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  issue_raised: AlertCircle,
  response_given: MessageSquare,
  escalation: AlertTriangle,
  resolution_offered: CheckCircle,
  resolution_accepted: ThumbsUp,
  frustration_expressed: AlertTriangle,
  positive_feedback: ThumbsUp,
  question_asked: HelpCircle,
};

const eventLabels: Record<string, string> = {
  issue_raised: "Issue Raised",
  response_given: "Response",
  escalation: "Escalation",
  resolution_offered: "Resolution Offered",
  resolution_accepted: "Resolved",
  frustration_expressed: "Frustration",
  positive_feedback: "Positive Feedback",
  question_asked: "Question",
};

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "yesterday";
  return `${diffDays}d ago`;
}

function ConversationStateCard({ state }: { state: ConversationStateDb }) {
  const urgency = urgencyConfig[state.urgency as keyof typeof urgencyConfig] || urgencyConfig.low;

  return (
    <div className="bg-muted/50 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-muted-foreground">Conversation State</h4>
        <Badge className={urgency.bgClass}>{urgency.label} Urgency</Badge>
      </div>
      <p className="text-sm mb-3">{state.description}</p>
      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        {state.customerWaitingHours !== null && (
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>Customer waiting {state.customerWaitingHours}h</span>
          </div>
        )}
        {state.lastVendorResponseHours !== null && (
          <div className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            <span>Last response {state.lastVendorResponseHours}h ago</span>
          </div>
        )}
      </div>
    </div>
  );
}

function TimelineItem({ event }: { event: TimelineEventDb }) {
  const Icon = eventIcons[event.eventType] || MessageSquare;
  const label = eventLabels[event.eventType] || event.eventType;
  const isCustomer = event.actor === "customer";

  return (
    <div className="flex gap-3 pb-4">
      <div className="flex flex-col items-center">
        <div className={`
          w-8 h-8 rounded-full flex items-center justify-center
          ${isCustomer ? "bg-blue-100 text-blue-600" : "bg-green-100 text-green-600"}
        `}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="w-px h-full bg-border mt-2" />
      </div>
      <div className="flex-1 pb-2">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium">{label}</span>
          <Badge variant="outline" className="text-xs py-0">
            {isCustomer ? "Customer" : "Vendor"}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mb-1">{event.summary}</p>
        <span className="text-xs text-muted-foreground">
          {formatTimestamp(event.timestamp)}
        </span>
      </div>
    </div>
  );
}

// Suggested questions for the agent
const SUGGESTED_QUESTIONS = [
  "When did this issue first arise?",
  "What's the 30-day trend?",
  "Has our team responded recently?",
  "What are the main concerns?",
];

export function AccountDetailPanel({ account, onClose }: AccountDetailPanelProps) {
  const sentiment = account.latest_sentiment;
  const config = sentiment ? sentimentConfig[sentiment] : null;
  const timeline = account.timeline || [];
  const conversationState = account.conversation_state;

  const [inputValue, setInputValue] = useState("");
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Create transport for the investigate endpoint
  const transport = useMemo(
    () => new DefaultChatTransport({ api: `/api/investigate/${account.id}` }),
    [account.id]
  );

  const { messages, status, sendMessage, setMessages } = useChat({
    id: `investigate-${account.id}`,
    transport,
    onFinish: () => {
      // Scroll to bottom when message finishes
      if (chatScrollRef.current) {
        chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
      }
    },
  });

  const isLoading = status === "streaming" || status === "submitted";

  // Reset messages when account changes
  useEffect(() => {
    setMessages([]);
    setInputValue("");
  }, [account.id, setMessages]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    sendMessage({
      parts: [{ type: "text" as const, text: inputValue }],
      role: "user",
    });
    setInputValue("");
  };

  const handleSuggestedQuestion = (question: string) => {
    if (isLoading) return;
    sendMessage({
      parts: [{ type: "text" as const, text: question }],
      role: "user",
    });
  };

  // Extract text from message parts
  const getMessageText = (message: typeof messages[0]): string => {
    if (!message.parts) return "";
    return message.parts
      .filter((part): part is { type: "text"; text: string } => part.type === "text")
      .map((part) => part.text)
      .join("");
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-[480px] bg-background border-l shadow-xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">{account.name}</h2>
          {config && (
            <Badge className={config.bgClass}>{config.label}</Badge>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 p-4">
        {/* Summary */}
        {account.latest_summary && (
          <div className="mb-4">
            <p className="text-sm text-muted-foreground">{account.latest_summary}</p>
            {account.last_analyzed && (
              <p className="text-xs text-muted-foreground mt-1">
                Last analyzed {formatRelativeTime(account.last_analyzed)}
              </p>
            )}
          </div>
        )}

        {/* Risk Factors */}
        {account.risk_factors && account.risk_factors.length > 0 && (
          <div className="mb-4">
            <h4 className="text-sm font-semibold mb-2">Risk Factors</h4>
            <div className="flex flex-wrap gap-1">
              {account.risk_factors.map((factor, i) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  {factor}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Conversation State */}
        {conversationState && (
          <ConversationStateCard state={conversationState} />
        )}

        {/* Timeline */}
        <div className="mt-4">
          <h4 className="text-sm font-semibold mb-4">Timeline</h4>
          {timeline.length > 0 ? (
            <div className="space-y-0">
              {timeline.map((event, i) => (
                <TimelineItem key={i} event={event} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No significant events in the analysis period.
            </p>
          )}
        </div>
      </ScrollArea>

      {/* Agent Chat Section */}
      <div className="border-t flex flex-col h-[300px]">
        <div className="p-2 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Ask about this account</span>
          </div>
        </div>

        {/* Chat Messages */}
        <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
          {messages.length === 0 ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Ask questions about this customer account. Try:
              </p>
              <div className="flex flex-wrap gap-1">
                {SUGGESTED_QUESTIONS.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => handleSuggestedQuestion(q)}
                    disabled={isLoading}
                    className="text-xs px-2 py-1 bg-muted rounded-full hover:bg-muted/80 transition-colors disabled:opacity-50"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-2 ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {message.role === "assistant" && (
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Bot className="h-3 w-3 text-primary" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{getMessageText(message)}</p>
                </div>
                {message.role === "user" && (
                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center shrink-0">
                    <User className="h-3 w-3 text-primary-foreground" />
                  </div>
                )}
              </div>
            ))
          )}
          {isLoading && (
            <div className="flex gap-2">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Bot className="h-3 w-3 text-primary" />
              </div>
              <div className="bg-muted rounded-lg px-3 py-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
        </div>

        {/* Chat Input */}
        <form onSubmit={handleSubmit} className="p-2 border-t flex gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask a question..."
            disabled={isLoading}
            className="flex-1 h-9 text-sm"
          />
          <Button type="submit" size="sm" disabled={isLoading || !inputValue.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
