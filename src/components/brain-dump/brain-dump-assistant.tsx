"use client";

import { useState, useCallback } from "react";
import { AlertCircle, RefreshCw, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { VoiceRecordButton } from "@/components/voice/voice-record-button";
import { TranscriptionDisplay } from "@/components/voice/transcription-display";
import { FeedbackInput } from "@/components/voice/feedback-input";
import { ChannelSelector } from "@/components/channel-selector";
import { DraftCards } from "./draft-cards";
import { ActionButtons } from "./action-buttons";
import { TranscriptionResult } from "@/lib/deepgram";

interface SlackChannel {
  id: string;
  name: string;
  isPrivate: boolean;
}

interface BrainDumpRun {
  id: string;
  status: string;
  slackChannel: {
    id: string;
    name: string;
  };
  contact: {
    id: string | null;
    name: string;
    email: string;
  };
  asanaProject: {
    id: string | null;
    name: string | null;
  };
  drafts: {
    slack: { message: string } | null;
    asana: {
      taskTitle: string;
      taskDescription: string;
      subtasks: string[];
    } | null;
  };
  slackSent?: boolean;
  asanaCreated?: boolean;
  asanaTaskUrl?: string;
}

type AssistantState =
  | "setup"          // Selecting channel
  | "idle"           // Ready to record
  | "recording"      // Voice recording
  | "processing"     // AI generating drafts
  | "drafts_ready"   // Showing drafts
  | "revising"       // Collecting feedback
  | "sending_slack"  // Posting to Slack
  | "creating_asana" // Creating task
  | "complete"       // Done
  | "error";

export function BrainDumpAssistant() {
  const [state, setState] = useState<AssistantState>("setup");
  const [selectedChannel, setSelectedChannel] = useState<SlackChannel | null>(null);
  const [finalTranscript, setFinalTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [run, setRun] = useState<BrainDumpRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showTextInput, setShowTextInput] = useState(false);
  const [textInput, setTextInput] = useState("");

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

    if (!selectedChannel) {
      setError("Please select a Slack channel first");
      setState("setup");
      return;
    }

    setState("processing");
    setFinalTranscript(transcript);
    setInterimTranscript("");

    try {
      const response = await fetch("/api/brain-dump/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcription: transcript,
          slackChannelId: selectedChannel.id,
          slackChannelName: selectedChannel.name,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to compose drafts");
      }

      const data = await response.json();
      setRun(data.run);
      setState("drafts_ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to compose drafts");
      setState("error");
    }
  }, [selectedChannel]);

  const handleChannelSelect = useCallback((channel: SlackChannel) => {
    setSelectedChannel(channel);
    setState("idle");
  }, []);

  const handleRevise = useCallback(() => {
    setShowFeedback(true);
    setState("revising");
  }, []);

  const handleFeedbackSubmit = useCallback(async (feedback: string) => {
    if (!run) return;

    setState("processing");
    setShowFeedback(false);

    try {
      const response = await fetch("/api/brain-dump/revise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runId: run.id,
          feedback,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to revise drafts");
      }

      const data = await response.json();
      setRun(data.run);
      setState("drafts_ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revise drafts");
      setState("error");
    }
  }, [run]);

  const handleSendSlack = useCallback(async () => {
    if (!run) return;

    setState("sending_slack");

    try {
      const response = await fetch("/api/brain-dump/send-slack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId: run.id }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to send Slack message");
      }

      const data = await response.json();
      setRun({
        ...run,
        slackSent: true,
        status: data.status,
      });
      setState(data.status === "complete" ? "complete" : "drafts_ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send Slack message");
      setState("error");
    }
  }, [run]);

  const handleCreateAsana = useCallback(async () => {
    if (!run) return;

    setState("creating_asana");

    try {
      const response = await fetch("/api/brain-dump/create-asana", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId: run.id }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create Asana task");
      }

      const data = await response.json();
      setRun({
        ...run,
        asanaCreated: true,
        asanaTaskUrl: data.taskUrl,
        status: data.status,
      });
      setState(data.status === "complete" ? "complete" : "drafts_ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create Asana task");
      setState("error");
    }
  }, [run]);

  const handleDoBoth = useCallback(async () => {
    if (!run) return;

    setState("processing");

    try {
      // Send Slack first
      const slackResponse = await fetch("/api/brain-dump/send-slack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId: run.id }),
      });

      if (!slackResponse.ok) {
        const data = await slackResponse.json();
        throw new Error(data.error || "Failed to send Slack message");
      }

      // Then create Asana
      const asanaResponse = await fetch("/api/brain-dump/create-asana", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId: run.id }),
      });

      if (!asanaResponse.ok) {
        const data = await asanaResponse.json();
        // Slack was sent but Asana failed
        setRun({ ...run, slackSent: true });
        throw new Error(data.error || "Slack sent but failed to create Asana task");
      }

      const asanaData = await asanaResponse.json();
      setRun({
        ...run,
        slackSent: true,
        asanaCreated: true,
        asanaTaskUrl: asanaData.taskUrl,
        status: "complete",
      });
      setState("complete");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to complete actions");
      setState("error");
    }
  }, [run]);

  const handleReset = useCallback(() => {
    setState("setup");
    setSelectedChannel(null);
    setFinalTranscript("");
    setInterimTranscript("");
    setRun(null);
    setError(null);
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
    handleRecordingStop(textInput.trim());
    setTextInput("");
  }, [textInput, handleRecordingStop]);

  const isRecording = state === "recording";
  const isProcessing = state === "processing";
  const showDraft = run && ["drafts_ready", "revising", "sending_slack", "creating_asana", "complete"].includes(state);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Channel Selection */}
      {(state === "setup" || state === "idle") && (
        <Card className="p-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Hash className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Slack Channel</span>
            </div>
            <ChannelSelector
              selectedChannel={selectedChannel}
              onSelectChannel={handleChannelSelect}
            />
            {selectedChannel && (
              <p className="text-xs text-muted-foreground">
                Your message will be posted to #{selectedChannel.name}
              </p>
            )}
          </div>
        </Card>
      )}

      {/* Main Recording Area */}
      <Card className="p-6">
        <div className="flex flex-col items-center space-y-6">
          {/* Instructions */}
          <div className="text-center">
            <h2 className="text-lg font-semibold mb-1">Brain Dump Assistant</h2>
            <p className="text-sm text-muted-foreground">
              {state === "setup" && "Select a Slack channel to get started"}
              {state === "idle" && "Tap the microphone and brain dump your thoughts"}
              {state === "recording" && "Listening... Tap again to stop"}
              {state === "processing" && "Processing your brain dump..."}
              {state === "drafts_ready" && "Review your Slack message and Asana task"}
              {state === "revising" && "Provide feedback to revise the drafts"}
              {state === "sending_slack" && "Sending to Slack..."}
              {state === "creating_asana" && "Creating Asana task..."}
              {state === "complete" && "All done!"}
              {state === "error" && "Something went wrong"}
            </p>
          </div>

          {/* Voice Record Button */}
          {selectedChannel && !showDraft && !showFeedback && state !== "processing" && !showTextInput && state !== "setup" && (
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
              Or type your brain dump
            </button>
          )}

          {/* Text Input */}
          {state === "idle" && showTextInput && (
            <div className="w-full space-y-3">
              <Input
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="e.g., Need to follow up with Sarah about the Q3 budget review, make sure to check the projections..."
                onKeyDown={(e) => e.key === "Enter" && handleTextSubmit()}
              />
              <div className="flex gap-2 justify-center">
                <Button onClick={handleTextSubmit} disabled={!textInput.trim()}>
                  Submit
                </Button>
                <Button variant="outline" onClick={() => setShowTextInput(false)}>
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

      {/* Draft Cards */}
      {showDraft && run && (
        <DraftCards
          slackChannel={run.slackChannel}
          slackDraft={run.drafts.slack}
          asanaDraft={run.drafts.asana}
          asanaProject={run.asanaProject}
          contact={run.contact}
          slackSent={run.slackSent}
          asanaCreated={run.asanaCreated}
          asanaTaskUrl={run.asanaTaskUrl}
        />
      )}

      {/* Action Buttons */}
      {showDraft && run && !showFeedback && (
        <ActionButtons
          onSendSlack={handleSendSlack}
          onCreateAsana={handleCreateAsana}
          onDoBoth={handleDoBoth}
          onRevise={handleRevise}
          onCancel={handleReset}
          slackSent={run.slackSent || false}
          asanaCreated={run.asanaCreated || false}
          hasAsanaProject={!!run.asanaProject.id}
          isSendingSlack={state === "sending_slack"}
          isCreatingAsana={state === "creating_asana"}
          isProcessing={isProcessing}
        />
      )}

      {/* Feedback Input */}
      {showFeedback && (
        <FeedbackInput
          onSubmit={handleFeedbackSubmit}
          onCancel={() => {
            setShowFeedback(false);
            setState("drafts_ready");
          }}
          isProcessing={isProcessing}
          placeholder="Make the Slack message shorter, add more subtasks..."
        />
      )}

      {/* New Brain Dump Button */}
      {(state === "complete" || state === "error") && (
        <div className="flex justify-center">
          <Button onClick={handleReset} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Start New Brain Dump
          </Button>
        </div>
      )}
    </div>
  );
}
