"use client";

import { useState } from "react";
import { Mic, Send, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VoiceRecordButton } from "./voice-record-button";
import { TranscriptionResult } from "@/lib/deepgram";
import { cn } from "@/lib/utils";

interface FeedbackInputProps {
  onSubmit: (feedback: string) => void;
  onCancel: () => void;
  isProcessing?: boolean;
  placeholder?: string;
  className?: string;
}

export function FeedbackInput({
  onSubmit,
  onCancel,
  isProcessing,
  placeholder = "Type your feedback or use voice...",
  className,
}: FeedbackInputProps) {
  const [mode, setMode] = useState<"text" | "voice">("text");
  const [textInput, setTextInput] = useState("");
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [isRecording, setIsRecording] = useState(false);

  const handleTranscriptionUpdate = (result: TranscriptionResult) => {
    if (result.isFinal) {
      setVoiceTranscript((prev) => prev + result.transcript + " ");
      setInterimTranscript("");
    } else {
      setInterimTranscript(result.transcript);
    }
  };

  const handleVoiceSubmit = () => {
    const transcript = voiceTranscript.trim();
    if (transcript) {
      onSubmit(transcript);
      setVoiceTranscript("");
      setInterimTranscript("");
    }
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = textInput.trim();
    if (text) {
      onSubmit(text);
      setTextInput("");
    }
  };

  return (
    <div className={cn("space-y-3 p-4 border rounded-lg bg-muted/30", className)}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Provide Feedback</span>
        <div className="flex items-center gap-1">
          <Button
            variant={mode === "text" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setMode("text")}
            disabled={isProcessing || isRecording}
          >
            Text
          </Button>
          <Button
            variant={mode === "voice" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setMode("voice")}
            disabled={isProcessing}
          >
            <Mic className="h-4 w-4 mr-1" />
            Voice
          </Button>
        </div>
      </div>

      {mode === "text" ? (
        <form onSubmit={handleTextSubmit} className="flex gap-2">
          <Input
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder={placeholder}
            disabled={isProcessing}
            className="flex-1"
          />
          <Button
            type="submit"
            disabled={!textInput.trim() || isProcessing}
            size="icon"
          >
            {isProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={isProcessing}
            size="icon"
          >
            <X className="h-4 w-4" />
          </Button>
        </form>
      ) : (
        <div className="space-y-3">
          {/* Voice transcript display */}
          {(voiceTranscript || interimTranscript) && (
            <div className="p-3 bg-background rounded-md border text-sm">
              <span>{voiceTranscript}</span>
              {interimTranscript && (
                <span className="text-muted-foreground italic">
                  {interimTranscript}
                </span>
              )}
            </div>
          )}

          <div className="flex items-center justify-center gap-3">
            <VoiceRecordButton
              onTranscriptionUpdate={handleTranscriptionUpdate}
              onRecordingStart={() => setIsRecording(true)}
              onRecordingStop={() => setIsRecording(false)}
              disabled={isProcessing}
              className="h-12 w-12"
            />

            {voiceTranscript && !isRecording && (
              <Button
                onClick={handleVoiceSubmit}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Submit Feedback
              </Button>
            )}

            <Button
              variant="ghost"
              onClick={onCancel}
              disabled={isProcessing || isRecording}
            >
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
