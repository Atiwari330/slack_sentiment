"use client";

import { useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Clock,
  ChevronDown,
  ChevronUp,
  Send,
  Edit3,
  SkipForward,
  Loader2,
  CheckCircle,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

interface BriefingItemProps {
  item: {
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
  };
  onApprove: (actionId: string, message: string) => Promise<void>;
  onSkip: (actionId: string, reason?: string) => Promise<void>;
  onRevise: (actionId: string, feedback: string) => Promise<string>;
}

const sentimentConfig = {
  red: {
    label: "At Risk",
    bgClass: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    icon: AlertCircle,
    iconClass: "text-red-500",
  },
  yellow: {
    label: "Needs Attention",
    bgClass: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    icon: AlertTriangle,
    iconClass: "text-yellow-500",
  },
  green: {
    label: "Healthy",
    bgClass: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    icon: CheckCircle,
    iconClass: "text-green-500",
  },
};

const urgencyConfig = {
  low: { label: "Low", bgClass: "bg-gray-100 text-gray-600" },
  medium: { label: "Medium", bgClass: "bg-yellow-100 text-yellow-700" },
  high: { label: "High", bgClass: "bg-orange-100 text-orange-700" },
  critical: { label: "Critical", bgClass: "bg-red-100 text-red-700" },
};

type CardState = "ready" | "editing" | "revising" | "sending" | "sent" | "skipped";

export function BriefingCard({ item, onApprove, onSkip, onRevise }: BriefingItemProps) {
  const [state, setState] = useState<CardState>("ready");
  const [expanded, setExpanded] = useState(false);
  const [message, setMessage] = useState(item.suggestedMessage);
  const [feedback, setFeedback] = useState("");
  const [skipReason, setSkipReason] = useState("");
  const [showSkipInput, setShowSkipInput] = useState(false);

  const sentiment = item.sentiment ? sentimentConfig[item.sentiment as keyof typeof sentimentConfig] : null;
  const urgency = item.urgency ? urgencyConfig[item.urgency as keyof typeof urgencyConfig] : null;
  const SentimentIcon = sentiment?.icon || AlertCircle;

  const handleApprove = async () => {
    setState("sending");
    try {
      await onApprove(item.actionId, message);
      setState("sent");
    } catch (error) {
      setState("ready");
      console.error("Failed to approve:", error);
    }
  };

  const handleSkip = async () => {
    setState("sending");
    try {
      await onSkip(item.actionId, skipReason || undefined);
      setState("skipped");
    } catch (error) {
      setState("ready");
      console.error("Failed to skip:", error);
    }
  };

  const handleRevise = async () => {
    if (!feedback.trim()) return;
    setState("revising");
    try {
      const newMessage = await onRevise(item.actionId, feedback);
      setMessage(newMessage);
      setFeedback("");
      setState("ready");
    } catch (error) {
      setState("ready");
      console.error("Failed to revise:", error);
    }
  };

  if (state === "sent") {
    return (
      <Card className="border-green-200 bg-green-50/50 dark:bg-green-900/10">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <div className="flex-1">
              <p className="font-medium">{item.account.name}</p>
              <p className="text-sm text-muted-foreground">Message sent successfully</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (state === "skipped") {
    return (
      <Card className="border-gray-200 bg-gray-50/50 dark:bg-gray-800/20 opacity-60">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <SkipForward className="h-5 w-5 text-gray-400" />
            <div className="flex-1">
              <p className="font-medium">{item.account.name}</p>
              <p className="text-sm text-muted-foreground">
                Skipped{skipReason ? `: ${skipReason}` : ""}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        {/* Header */}
        <div className="p-4 border-b bg-muted/30">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <SentimentIcon className={`h-5 w-5 ${sentiment?.iconClass || "text-gray-400"}`} />
              <div>
                <h3 className="font-semibold">{item.account.name}</h3>
                <p className="text-xs text-muted-foreground">
                  #{item.account.slackChannelName || item.account.slackChannelId}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {sentiment && (
                <Badge className={sentiment.bgClass}>{sentiment.label}</Badge>
              )}
              {urgency && (
                <Badge variant="outline" className={urgency.bgClass}>
                  {urgency.label}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Issue Summary */}
        <div className="p-4 border-b">
          <p className="text-sm font-medium text-muted-foreground mb-1">Issue</p>
          <p className="text-sm">{item.issueSummary}</p>

          {/* Conversation state info */}
          {item.conversationState && (
            <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
              {item.conversationState.customerWaitingHours !== null && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Customer waiting {item.conversationState.customerWaitingHours}h
                </span>
              )}
            </div>
          )}
        </div>

        {/* Suggested Message */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-muted-foreground">Suggested Message</p>
            {state === "ready" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setState("editing")}
                className="h-7 text-xs"
              >
                <Edit3 className="h-3 w-3 mr-1" />
                Edit
              </Button>
            )}
          </div>

          {state === "editing" ? (
            <div className="space-y-2">
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="min-h-[100px] text-sm"
              />
              <div className="flex gap-2 justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setMessage(item.suggestedMessage);
                    setState("ready");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => setState("ready")}
                >
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-sm whitespace-pre-wrap">{message}</p>
            </div>
          )}
        </div>

        {/* Expandable Details */}
        <div className="border-b">
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full p-3 flex items-center justify-between text-sm text-muted-foreground hover:bg-muted/30 transition-colors"
          >
            <span>Details</span>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {expanded && (
            <div className="p-4 pt-0 space-y-3">
              {item.reasoning && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">AI Reasoning</p>
                  <p className="text-sm">{item.reasoning}</p>
                </div>
              )}
              {item.riskFactors && item.riskFactors.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Risk Factors</p>
                  <div className="flex flex-wrap gap-1">
                    {item.riskFactors.map((factor, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {factor}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Revise Section (if active) */}
        {state === "revising" ? (
          <div className="p-4 border-b bg-muted/30">
            <div className="flex items-center gap-2 mb-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Regenerating suggestion...</span>
            </div>
          </div>
        ) : state === "ready" && (
          <div className="p-4 border-b">
            <div className="flex gap-2">
              <Input
                placeholder="Provide feedback to revise the message..."
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                className="flex-1 text-sm"
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleRevise()}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleRevise}
                disabled={!feedback.trim()}
              >
                Revise
              </Button>
            </div>
          </div>
        )}

        {/* Skip Reason Input */}
        {showSkipInput && (
          <div className="p-4 border-b bg-muted/30">
            <div className="flex gap-2">
              <Input
                placeholder="Reason for skipping (optional)"
                value={skipReason}
                onChange={(e) => setSkipReason(e.target.value)}
                className="flex-1 text-sm"
              />
              <Button variant="ghost" size="sm" onClick={() => setShowSkipInput(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="p-4 flex gap-2 justify-end">
          {state === "sending" ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Sending...
            </div>
          ) : (
            <>
              {!showSkipInput ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSkipInput(true)}
                >
                  <SkipForward className="h-4 w-4 mr-1" />
                  Skip
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSkip}
                >
                  Confirm Skip
                </Button>
              )}
              <Button
                onClick={handleApprove}
                disabled={state === "editing" || state === "revising"}
              >
                <Send className="h-4 w-4 mr-2" />
                Approve & Send
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
