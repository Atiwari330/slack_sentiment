"use client";

import { Check, X, Edit2, Send, Loader2, Mail, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface InboxDraft {
  id: string;
  sessionId: string;
  version: number;
  status: "draft" | "approved" | "sent" | "cancelled";
  threadId: string;
  originalMessageId: string;
  recipientEmail: string;
  recipientName: string | null;
  subject: string;
  body: string;
  threadContext: string | null;
}

interface ReplyDraftCardProps {
  draft: InboxDraft;
  onApprove: () => void;
  onReject: () => void;
  onRevise: () => void;
  onSend: () => void;
  isProcessing?: boolean;
  isSending?: boolean;
  gmailConnected?: boolean;
  className?: string;
}

export function ReplyDraftCard({
  draft,
  onApprove,
  onReject,
  onRevise,
  onSend,
  isProcessing,
  isSending,
  gmailConnected,
  className,
}: ReplyDraftCardProps) {
  const [showContext, setShowContext] = useState(false);
  const isApproved = draft.status === "approved";
  const isSent = draft.status === "sent";
  const isCancelled = draft.status === "cancelled";

  return (
    <Card className={cn("overflow-hidden", className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">Reply Draft</span>
          {draft.version > 1 && (
            <Badge variant="secondary" className="text-xs">
              v{draft.version}
            </Badge>
          )}
        </div>
        <Badge
          variant={
            isSent
              ? "default"
              : isApproved
              ? "secondary"
              : isCancelled
              ? "destructive"
              : "outline"
          }
        >
          {isSent
            ? "Sent"
            : isApproved
            ? "Approved"
            : isCancelled
            ? "Cancelled"
            : "Draft"}
        </Badge>
      </div>

      {/* Thread Context (collapsible) */}
      {draft.threadContext && (
        <div className="border-b">
          <button
            onClick={() => setShowContext(!showContext)}
            className="w-full px-4 py-2 flex items-center justify-between text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
          >
            <span>Thread Context</span>
            {showContext ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
          {showContext && (
            <div className="px-4 pb-3">
              <div className="text-xs whitespace-pre-wrap bg-muted/50 p-3 rounded-md border max-h-64 overflow-y-auto font-mono">
                {draft.threadContext}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Reply Preview */}
      <div className="p-4 space-y-3">
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">Reply To</div>
          <div className="font-medium">
            {draft.recipientName || "Unknown"}{" "}
            <span className="text-muted-foreground font-normal">
              &lt;{draft.recipientEmail}&gt;
            </span>
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">Subject</div>
          <div className="font-medium">{draft.subject}</div>
        </div>

        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">Message</div>
          <div className="text-sm whitespace-pre-wrap bg-background p-3 rounded-md border">
            {draft.body}
          </div>
        </div>
      </div>

      {/* Actions */}
      {!isSent && !isCancelled && (
        <div className="flex items-center gap-2 p-4 border-t bg-muted/30">
          {!isApproved ? (
            <>
              <Button
                onClick={onApprove}
                disabled={isProcessing}
                className="flex-1"
                variant="default"
              >
                {isProcessing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Check className="mr-2 h-4 w-4" />
                )}
                Approve
              </Button>
              <Button
                onClick={onRevise}
                disabled={isProcessing}
                variant="outline"
              >
                <Edit2 className="mr-2 h-4 w-4" />
                Revise
              </Button>
              <Button
                onClick={onReject}
                disabled={isProcessing}
                variant="ghost"
                className="text-destructive hover:text-destructive"
              >
                <X className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button
                onClick={onSend}
                disabled={isSending || !gmailConnected}
                className="flex-1"
              >
                {isSending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                {gmailConnected ? "Send Reply" : "Connect Gmail to Send"}
              </Button>
              <Button
                onClick={onRevise}
                disabled={isSending}
                variant="outline"
              >
                <Edit2 className="mr-2 h-4 w-4" />
                Edit
              </Button>
            </>
          )}
        </div>
      )}

      {/* Sent confirmation */}
      {isSent && (
        <div className="flex items-center justify-center gap-2 p-4 border-t bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400">
          <Check className="h-4 w-4" />
          <span className="text-sm font-medium">Reply sent successfully!</span>
        </div>
      )}
    </Card>
  );
}
