"use client";

import { useState, useCallback } from "react";
import { AlertCircle, RefreshCw, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { VoiceRecordButton } from "@/components/voice/voice-record-button";
import { TranscriptionDisplay } from "@/components/voice/transcription-display";
import { FeedbackInput } from "@/components/voice/feedback-input";
import { GmailConnect } from "@/components/voice/gmail-connect";
import { ReplyDraftCard, InboxDraft } from "./reply-draft-card";
import {
  ClarificationCard,
  ClarificationOption,
} from "./clarification-card";
import { TranscriptionResult } from "@/lib/deepgram";

type AssistantState =
  | "idle"
  | "recording"
  | "processing"
  | "clarification"
  | "draft_ready"
  | "revising"
  | "approved"
  | "sending"
  | "sent"
  | "error";

interface ClarificationData {
  question: string;
  options: ClarificationOption[];
  context?: string;
}

export function InboxAssistant() {
  const [state, setState] = useState<AssistantState>("idle");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [draft, setDraft] = useState<InboxDraft | null>(null);
  const [clarification, setClarification] = useState<ClarificationData | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailEmail, setGmailEmail] = useState<string | undefined>();
  const [showTextInput, setShowTextInput] = useState(false);
  const [textInput, setTextInput] = useState("");

  const handleTranscriptionUpdate = useCallback(
    (result: TranscriptionResult) => {
      if (result.isFinal && result.transcript) {
        setFinalTranscript((prev) => prev + result.transcript + " ");
        setInterimTranscript("");
      } else {
        setInterimTranscript(result.transcript);
      }
    },
    []
  );

  const handleRecordingStart = useCallback(() => {
    setState("recording");
    setError(null);
    setErrorCode(null);
  }, []);

  const processRequest = useCallback(
    async (
      transcript: string,
      clarificationChoice?: ClarificationOption
    ) => {
      setState("processing");

      try {
        const response = await fetch("/api/inbox-assistant/compose", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transcription: transcript,
            sessionId: sessionId,
            clarificationChoice: clarificationChoice
              ? { id: clarificationChoice.id, label: clarificationChoice.label }
              : undefined,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to process request");
        }

        // Handle different response types
        if (data.type === "clarification") {
          setClarification({
            question: data.question,
            options: data.options,
            context: data.context,
          });
          setSessionId(data.sessionId);
          setState("clarification");
        } else if (data.type === "draft") {
          setDraft(data.draft);
          setSessionId(data.draft.sessionId);
          setClarification(null);
          setState("draft_ready");
        } else if (data.type === "message") {
          // Informational message (e.g., no emails found)
          setError(data.message);
          setSessionId(data.sessionId);
          setState("error");
        } else if (data.type === "error") {
          throw new Error(data.error);
        }
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : "Failed to process request";
        setError(errorMsg);
        setErrorCode(
          errorMsg.includes("reconnect Gmail")
            ? "SCOPE_INSUFFICIENT"
            : errorMsg.includes("connect your Gmail")
            ? "GMAIL_NOT_CONNECTED"
            : null
        );
        setState("error");
      }
    },
    [sessionId]
  );

  const handleRecordingStop = useCallback(
    async (transcript: string) => {
      if (!transcript.trim()) {
        setState("idle");
        return;
      }

      setFinalTranscript(transcript);
      setInterimTranscript("");
      await processRequest(transcript);
    },
    [processRequest]
  );

  const handleClarificationSelect = useCallback(
    async (option: ClarificationOption) => {
      await processRequest(finalTranscript, option);
    },
    [finalTranscript, processRequest]
  );

  const handleApprove = useCallback(async () => {
    if (!draft) return;

    try {
      await fetch(`/api/inbox-assistant/drafts/${draft.id}/approve`, {
        method: "POST",
      });
      setDraft({ ...draft, status: "approved" });
      setState("approved");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to approve draft"
      );
    }
  }, [draft]);

  const handleReject = useCallback(() => {
    handleReset();
  }, []);

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
        const response = await fetch("/api/inbox-assistant/revise", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: draft.sessionId,
            feedback,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to revise reply");
        }

        const data = await response.json();
        setDraft(data.draft);
        setState("draft_ready");
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to revise reply"
        );
        setState("error");
      }
    },
    [draft]
  );

  const handleSend = useCallback(async () => {
    if (!draft) return;

    setState("sending");

    try {
      const response = await fetch("/api/inbox-assistant/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId: draft.id }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to send reply");
      }

      setDraft({ ...draft, status: "sent" });
      setState("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send reply");
      setState("error");
    }
  }, [draft]);

  const handleReset = useCallback(() => {
    setState("idle");
    setFinalTranscript("");
    setInterimTranscript("");
    setDraft(null);
    setClarification(null);
    setSessionId(null);
    setError(null);
    setErrorCode(null);
    setShowFeedback(false);
    setShowTextInput(false);
    setTextInput("");
  }, []);

  const handleError = useCallback((errorMsg: string) => {
    setError(errorMsg);
    setState("error");
  }, []);

  const handleTextSubmit = useCallback(() => {
    if (!textInput.trim()) return;
    setShowTextInput(false);
    setFinalTranscript(textInput.trim());
    processRequest(textInput.trim());
    setTextInput("");
  }, [textInput, processRequest]);

  const handleGmailStatusChange = useCallback(
    (connected: boolean, email?: string) => {
      setGmailConnected(connected);
      setGmailEmail(email);
    },
    []
  );

  const isRecording = state === "recording";
  const isProcessing = state === "processing";
  const showDraft =
    draft &&
    ["draft_ready", "revising", "approved", "sending", "sent"].includes(state);
  const showClarification = state === "clarification" && clarification;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Gmail Connection Status */}
      <GmailConnect onStatusChange={handleGmailStatusChange} />

      {/* Main Recording Area */}
      <Card className="p-6">
        <div className="flex flex-col items-center space-y-6">
          {/* Instructions */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Inbox className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Inbox Assistant</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              {state === "idle" &&
                "Tell me to find an email and draft a response"}
              {state === "recording" && "Listening... Tap again to stop"}
              {state === "processing" && "Searching and drafting..."}
              {state === "clarification" && "Please select an option below"}
              {state === "draft_ready" && "Review your reply draft below"}
              {state === "revising" && "Provide feedback to revise the draft"}
              {state === "approved" &&
                gmailConnected &&
                "Ready to send!"}
              {state === "approved" &&
                !gmailConnected &&
                "Connect Gmail to send"}
              {state === "sending" && "Sending reply..."}
              {state === "sent" && "Reply sent successfully!"}
              {state === "error" && "Something went wrong"}
            </p>
          </div>

          {/* Voice Record Button */}
          {!showDraft &&
            !showClarification &&
            !showFeedback &&
            state !== "processing" &&
            !showTextInput && (
              <VoiceRecordButton
                onTranscriptionUpdate={handleTranscriptionUpdate}
                onRecordingStart={handleRecordingStart}
                onRecordingStop={handleRecordingStop}
                onError={handleError}
                disabled={isProcessing}
              />
            )}

          {/* Text Input Toggle */}
          {state === "idle" && !showTextInput && (
            <button
              onClick={() => setShowTextInput(true)}
              className="text-sm text-muted-foreground hover:text-foreground underline"
            >
              Or type your request
            </button>
          )}

          {/* Text Input */}
          {state === "idle" && showTextInput && (
            <div className="w-full space-y-3">
              <Input
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="e.g., Find the email from Jeff today and reply saying we can accommodate their request"
                onKeyDown={(e) => e.key === "Enter" && handleTextSubmit()}
              />
              <div className="flex gap-2 justify-center">
                <Button
                  onClick={handleTextSubmit}
                  disabled={!textInput.trim()}
                >
                  Submit
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowTextInput(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Processing Indicator */}
          {isProcessing && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <RefreshCw className="h-5 w-5 animate-spin" />
              <span>Processing...</span>
            </div>
          )}

          {/* Transcription Display */}
          {(isRecording || finalTranscript || interimTranscript) &&
            !showDraft &&
            !showClarification && (
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
              <p className="font-medium text-destructive">
                {errorCode === "SCOPE_INSUFFICIENT"
                  ? "Gmail Access Required"
                  : errorCode === "GMAIL_NOT_CONNECTED"
                  ? "Gmail Not Connected"
                  : "Error"}
              </p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleReset}>
              Try Again
            </Button>
          </div>
        </Card>
      )}

      {/* Clarification Card */}
      {showClarification && clarification && (
        <ClarificationCard
          question={clarification.question}
          options={clarification.options}
          context={clarification.context}
          onSelect={handleClarificationSelect}
          onCancel={handleReset}
          isProcessing={isProcessing}
        />
      )}

      {/* Reply Draft Card */}
      {showDraft && draft && (
        <ReplyDraftCard
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
          placeholder="Make it shorter, more formal, add more context..."
        />
      )}

      {/* New Request Button */}
      {(state === "sent" || (state === "error" && !errorCode)) && (
        <div className="flex justify-center">
          <Button onClick={handleReset} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            New Request
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
