"use client";

import { useState } from "react";
import { MessageSquare, Check, Edit2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

interface SlackDraft {
  message: string;
  recipientName: string | null;
  recipientSlackId: string | null;
  context: string | null;
}

interface InlineSlackDraftProps {
  draft: SlackDraft;
  channelId: string;
  channelName: string;
  onApprove: (result: { success: boolean; messageTs?: string }) => void;
  onRevise: (feedback: string) => void;
}

export function InlineSlackDraft({
  draft,
  channelId,
  channelName,
  onApprove,
  onRevise,
}: InlineSlackDraftProps) {
  const [isApproving, setIsApproving] = useState(false);
  const [isRevising, setIsRevising] = useState(false);
  const [revisionFeedback, setRevisionFeedback] = useState("");
  const [status, setStatus] = useState<"pending" | "approved" | "error">("pending");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleApprove = async () => {
    setIsApproving(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/channel-audit/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "slack",
          channelId,
          message: draft.message,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setStatus("approved");
        onApprove({ success: true, messageTs: result.messageTs });
      } else {
        setStatus("error");
        setErrorMessage(result.error || "Failed to send message");
        onApprove({ success: false });
      }
    } catch (error) {
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Failed to send message");
      onApprove({ success: false });
    } finally {
      setIsApproving(false);
    }
  };

  const handleRevise = () => {
    if (revisionFeedback.trim()) {
      onRevise(revisionFeedback);
      setRevisionFeedback("");
      setIsRevising(false);
    }
  };

  if (status === "approved") {
    return (
      <Card className="p-4 bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
        <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
          <Check className="h-4 w-4" />
          <span className="font-medium">Message sent to #{channelName}</span>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/50">
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-blue-600" />
            <span className="font-medium text-sm">Slack Message Draft</span>
          </div>
          <Badge variant="outline" className="text-xs">
            #{channelName}
          </Badge>
        </div>

        {/* Context */}
        {draft.context && (
          <p className="text-xs text-muted-foreground">{draft.context}</p>
        )}

        {/* Recipient */}
        {draft.recipientName && (
          <div className="text-xs text-muted-foreground">
            To: <span className="font-medium">{draft.recipientName}</span>
            {draft.recipientSlackId && (
              <span className="text-blue-600 ml-1">(@{draft.recipientSlackId})</span>
            )}
          </div>
        )}

        {/* Message Preview */}
        <div className="bg-white dark:bg-gray-900 rounded-md p-3 border text-sm whitespace-pre-wrap">
          {draft.message}
        </div>

        {/* Error Message */}
        {errorMessage && (
          <div className="text-xs text-destructive bg-destructive/10 p-2 rounded">
            {errorMessage}
          </div>
        )}

        {/* Revision Input */}
        {isRevising && (
          <div className="space-y-2">
            <Textarea
              value={revisionFeedback}
              onChange={(e) => setRevisionFeedback(e.target.value)}
              placeholder="What would you like to change?"
              className="text-sm"
              rows={2}
            />
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setIsRevising(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleRevise}
                disabled={!revisionFeedback.trim()}
              >
                Submit Revision
              </Button>
            </div>
          </div>
        )}

        {/* Actions */}
        {!isRevising && (
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleApprove}
              disabled={isApproving}
              className="flex-1"
            >
              {isApproving ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Check className="h-3 w-3 mr-1" />
                  Approve & Send
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsRevising(true)}
              disabled={isApproving}
            >
              <Edit2 className="h-3 w-3 mr-1" />
              Revise
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
