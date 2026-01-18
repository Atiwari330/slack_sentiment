// Deepgram configuration and utilities

export const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;

// Deepgram WebSocket URL for real-time transcription
export function getDeepgramWebSocketUrl(options?: {
  model?: string;
  language?: string;
  punctuate?: boolean;
  interim_results?: boolean;
  smart_format?: boolean;
}) {
  const params = new URLSearchParams({
    model: options?.model || "nova-2",
    language: options?.language || "en",
    punctuate: String(options?.punctuate ?? true),
    interim_results: String(options?.interim_results ?? true),
    smart_format: String(options?.smart_format ?? true),
  });

  return `wss://api.deepgram.com/v1/listen?${params.toString()}`;
}

// Create a temporary API key for client-side use
export async function createTemporaryApiKey(): Promise<{
  key: string;
  expiresAt: Date;
}> {
  if (!DEEPGRAM_API_KEY) {
    throw new Error("DEEPGRAM_API_KEY is not configured");
  }

  // For now, we'll return the actual key with a short expiry
  // In production, you'd use Deepgram's temporary key API
  const expiresAt = new Date(Date.now() + 60 * 1000); // 1 minute

  return {
    key: DEEPGRAM_API_KEY,
    expiresAt,
  };
}

// Transcription result type
export interface TranscriptionResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
  words?: Array<{
    word: string;
    start: number;
    end: number;
    confidence: number;
  }>;
}

// Parse Deepgram WebSocket message
export function parseDeepgramMessage(data: string): TranscriptionResult | null {
  try {
    const message = JSON.parse(data);

    if (message.type === "Results" && message.channel?.alternatives?.[0]) {
      const alternative = message.channel.alternatives[0];
      return {
        transcript: alternative.transcript || "",
        confidence: alternative.confidence || 0,
        isFinal: message.is_final || false,
        words: alternative.words,
      };
    }

    return null;
  } catch {
    return null;
  }
}
