"use client";

import { cn } from "@/lib/utils";

interface TranscriptionDisplayProps {
  finalTranscript: string;
  interimTranscript: string;
  isRecording: boolean;
  className?: string;
}

export function TranscriptionDisplay({
  finalTranscript,
  interimTranscript,
  isRecording,
  className,
}: TranscriptionDisplayProps) {
  const hasContent = finalTranscript || interimTranscript;

  if (!hasContent && !isRecording) {
    return null;
  }

  return (
    <div
      className={cn(
        "p-4 rounded-lg border bg-muted/50 min-h-[100px] transition-all",
        isRecording && "border-primary/50",
        className
      )}
    >
      {hasContent ? (
        <p className="text-sm leading-relaxed">
          <span>{finalTranscript}</span>
          {interimTranscript && (
            <span className="text-muted-foreground italic">
              {interimTranscript}
            </span>
          )}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground text-center">
          {isRecording ? "Listening..." : "Tap the microphone to start speaking"}
        </p>
      )}

      {isRecording && (
        <div className="flex items-center gap-1 mt-3">
          <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-xs text-muted-foreground">Recording</span>
        </div>
      )}
    </div>
  );
}
