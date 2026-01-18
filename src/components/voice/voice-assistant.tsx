"use client";

import { useState, useCallback } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { VoiceRecordButton } from "./voice-record-button";
import { TranscriptionDisplay } from "./transcription-display";
import { EmailDraftCard, EmailDraft } from "./email-draft-card";
import { FeedbackInput } from "./feedback-input";
import { GmailConnect } from "./gmail-connect";
import { TranscriptionResult } from "@/lib/deepgram";

type AssistantState =
  | "idle"
  | "recording"
  | "processing"
  | "draft_ready"
  | "revising"
  | "approved"
  | "sending"
  | "sent"
  | "error";

export function VoiceAssistant() {
  const [state, setState] = useState<AssistantState>("idle");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [draft, setDraft] = useState<EmailDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailEmail, setGmailEmail] = useState<string | undefined>();

  const handleTranscriptionUpdate = useCallback((result: TranscriptionResult) => {
    if (result.isFinal && result.transcript) {
      setFinalTranscript((prev) => prev + result.transcript + " ");
      setInterimTranscript("");
    } else {
      setInterimTranscript(result.transcript);
    }
  }, []);

  const handleRecordingStart = useCallback(() => {
    setState("recording");
    setError(null);
  }, []);

  const handleRecordingStop = useCallback(async (transcript: string) => {
    if (!transcript.trim()) {
      setState("idle");
      return;
    }

    setState("processing");
    setFinalTranscript(transcript);
    setInterimTranscript("");

    try {
      const response = await fetch("/api/voice/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcription: transcript }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to compose email");
      }

      const data = await response.json();
      setDraft(data.draft);
      setState("draft_ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to compose email");
      setState("error");
    }
  }, []);

  const handleApprove = useCallback(async () => {
    if (!draft) return;

    try {
      await fetch(`/api/voice/drafts/${draft.id}/approve`, {
        method: "POST",
      });
      setDraft({ ...draft, status: "approved" });
      setState("approved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve draft");
    }
  }, [draft]);

  const handleReject = useCallback(async () => {
    if (!draft) return;

    try {
      await fetch(`/api/voice/drafts/${draft.id}/cancel`, {
        method: "POST",
      });
      handleReset();
    } catch (err) {
      console.error("Failed to cancel draft:", err);
      handleReset();
    }
  }, [draft]);

  const handleRevise = useCallback(() => {
    setShowFeedback(true);
    setState("revising");
  }, []);

  const handleFeedbackSubmit = useCallback(
    async (feedback: string) => {
      if (!draft) return;

      setState("processing");
      setShowFeedback(false);

      try {
        const response = await fetch("/api/voice/revise", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: draft.sessionId,
            feedback,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to revise email");
        }

        const data = await response.json();
        setDraft(data.draft);
        setState("draft_ready");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to revise email");
        setState("error");
      }
    },
    [draft]
  );

  const handleSend = useCallback(async () => {
    if (!draft) return;

    setState("sending");

    try {
      const response = await fetch("/api/gmail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId: draft.id }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to send email");
      }

      setDraft({ ...draft, status: "sent" });
      setState("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send email");
      setState("error");
    }
  }, [draft]);

  const handleReset = useCallback(() => {
    setState("idle");
    setFinalTranscript("");
    setInterimTranscript("");
    setDraft(null);
    setError(null);
    setShowFeedback(false);
  }, []);

  const handleError = useCallback((errorMsg: string) => {
    setError(errorMsg);
    setState("error");
  }, []);

  const handleGmailStatusChange = useCallback((connected: boolean, email?: string) => {
    setGmailConnected(connected);
    setGmailEmail(email);
  }, []);

  const isRecording = state === "recording";
  const isProcessing = state === "processing";
  const showDraft = draft && ["draft_ready", "revising", "approved", "sending", "sent"].includes(state);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Gmail Connection Status */}
      <GmailConnect onStatusChange={handleGmailStatusChange} />

      {/* Main Recording Area */}
      <Card className="p-6">
        <div className="flex flex-col items-center space-y-6">
          {/* Instructions */}
          <div className="text-center">
            <h2 className="text-lg font-semibold mb-1">Voice Email Assistant</h2>
            <p className="text-sm text-muted-foreground">
              {state === "idle" && "Tap the microphone and dictate your email"}
              {state === "recording" && "Listening... Tap again to stop"}
              {state === "processing" && "Composing your email..."}
              {state === "draft_ready" && "Review your email draft below"}
              {state === "revising" && "Provide feedback to revise the draft"}
              {state === "approved" && gmailConnected && "Ready to send!"}
              {state === "approved" && !gmailConnected && "Connect Gmail to send"}
              {state === "sending" && "Sending email..."}
              {state === "sent" && "Email sent successfully!"}
              {state === "error" && "Something went wrong"}
            </p>
          </div>

          {/* Voice Record Button */}
          {!showDraft && !showFeedback && state !== "processing" && (
            <VoiceRecordButton
              onTranscriptionUpdate={handleTranscriptionUpdate}
              onRecordingStart={handleRecordingStart}
              onRecordingStop={handleRecordingStop}
              onError={handleError}
              disabled={isProcessing}
            />
          )}

          {/* Processing Indicator */}
          {isProcessing && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <RefreshCw className="h-5 w-5 animate-spin" />
              <span>Processing...</span>
            </div>
          )}

          {/* Transcription Display */}
          {(isRecording || finalTranscript || interimTranscript) && !showDraft && (
            <TranscriptionDisplay
              finalTranscript={finalTranscript}
              interimTranscript={interimTranscript}
              isRecording={isRecording}
              className="w-full"
            />
          )}
        </div>
      </Card>

      {/* Error Display */}
      {error && state === "error" && (
        <Card className="p-4 border-destructive bg-destructive/10">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-destructive">Error</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleReset}>
              Try Again
            </Button>
          </div>
        </Card>
      )}

      {/* Email Draft Card */}
      {showDraft && draft && (
        <EmailDraftCard
          draft={draft}
          onApprove={handleApprove}
          onReject={handleReject}
          onRevise={handleRevise}
          onSend={handleSend}
          isProcessing={isProcessing}
          isSending={state === "sending"}
          gmailConnected={gmailConnected}
        />
      )}

      {/* Feedback Input */}
      {showFeedback && (
        <FeedbackInput
          onSubmit={handleFeedbackSubmit}
          onCancel={() => {
            setShowFeedback(false);
            setState("draft_ready");
          }}
          isProcessing={isProcessing}
          placeholder="Make it shorter, more formal, add a greeting..."
        />
      )}

      {/* New Email Button */}
      {(state === "sent" || state === "error") && (
        <div className="flex justify-center">
          <Button onClick={handleReset} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Compose New Email
          </Button>
        </div>
      )}

      {/* Connected Email Info */}
      {gmailConnected && gmailEmail && (
        <p className="text-xs text-center text-muted-foreground">
          Sending from: {gmailEmail}
        </p>
      )}
    </div>
  );
}
