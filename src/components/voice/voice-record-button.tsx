"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { parseDeepgramMessage, TranscriptionResult } from "@/lib/deepgram";

interface VoiceRecordButtonProps {
  onTranscriptionUpdate: (result: TranscriptionResult) => void;
  onRecordingStart?: () => void;
  onRecordingStop?: (finalTranscript: string) => void;
  onError?: (error: string) => void;
  disabled?: boolean;
  className?: string;
  autoStart?: boolean;
}

export function VoiceRecordButton({
  onTranscriptionUpdate,
  onRecordingStart,
  onRecordingStop,
  onError,
  disabled,
  className,
  autoStart,
}: VoiceRecordButtonProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isPulsing, setIsPulsing] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const finalTranscriptRef = useRef<string>("");

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, []);

  const hasAutoStarted = useRef(false);

  const stopRecording = useCallback(() => {
    // Stop MediaRecorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;

    // Close WebSocket
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
      wsRef.current = null;
    }

    // Stop media stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    setIsRecording(false);
    setIsPulsing(false);

    // Return final transcript
    const finalTranscript = finalTranscriptRef.current.trim();
    if (finalTranscript && onRecordingStop) {
      onRecordingStop(finalTranscript);
    }
    finalTranscriptRef.current = "";
  }, [onRecordingStop]);

  const startRecording = useCallback(async () => {
    try {
      setIsConnecting(true);
      finalTranscriptRef.current = "";

      // Get Deepgram token
      const tokenRes = await fetch("/api/voice/token");
      if (!tokenRes.ok) {
        const data = await tokenRes.json();
        throw new Error(data.error || "Failed to get voice token");
      }
      const { apiKey, wsUrl } = await tokenRes.json();

      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
        },
      });
      streamRef.current = stream;

      // Connect to Deepgram WebSocket
      const ws = new WebSocket(wsUrl, ["token", apiKey]);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnecting(false);
        setIsRecording(true);
        setIsPulsing(true);
        onRecordingStart?.();

        // Start MediaRecorder
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: "audio/webm;codecs=opus",
        });
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
            ws.send(event.data);
          }
        };

        mediaRecorder.start(250); // Send data every 250ms
      };

      ws.onmessage = (event) => {
        const result = parseDeepgramMessage(event.data);
        if (result) {
          if (result.isFinal && result.transcript) {
            finalTranscriptRef.current += result.transcript + " ";
          }
          onTranscriptionUpdate(result);
        }
      };

      ws.onerror = () => {
        onError?.("WebSocket connection error");
        stopRecording();
      };

      ws.onclose = () => {
        if (isRecording) {
          stopRecording();
        }
      };
    } catch (error) {
      setIsConnecting(false);
      if (error instanceof Error) {
        if (error.name === "NotAllowedError") {
          onError?.("Microphone access denied. Please allow microphone access to use voice recording.");
        } else {
          onError?.(error.message);
        }
      } else {
        onError?.("Failed to start recording");
      }
      stopRecording();
    }
  }, [onTranscriptionUpdate, onRecordingStart, onError, stopRecording, isRecording]);

  // Auto-start recording if autoStart prop is true
  useEffect(() => {
    if (autoStart && !hasAutoStarted.current && !isRecording && !isConnecting) {
      hasAutoStarted.current = true;
      startRecording();
    }
  }, [autoStart, isRecording, isConnecting, startRecording]);

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <Button
      onClick={toggleRecording}
      disabled={disabled || isConnecting}
      variant={isRecording ? "destructive" : "default"}
      size="lg"
      className={cn(
        "relative h-16 w-16 rounded-full p-0 transition-all",
        isPulsing && "animate-pulse",
        className
      )}
    >
      {isConnecting ? (
        <Loader2 className="h-6 w-6 animate-spin" />
      ) : isRecording ? (
        <>
          <MicOff className="h-6 w-6" />
          {/* Pulse animation rings */}
          <span className="absolute inset-0 rounded-full animate-ping bg-destructive/30" />
        </>
      ) : (
        <Mic className="h-6 w-6" />
      )}
    </Button>
  );
}
