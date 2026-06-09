/**
 * geminiService.ts
 * Gemini AI client using the REST API directly (no extra packages needed).
 * Uses Gemini 2.0 Flash by default - fast and cheap for workout analysis.
 *
 * Usage:
 *   const gemini = new GeminiService(apiKey);
 *   const reply = await gemini.chat("Suggest my next bench press weight", history, systemPrompt);
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChatMessage {
  role: "user" | "model";
  text: string;
}

export interface GeminiConfig {
  apiKey: string;
  /** Default: "gemini-2.0-flash" */
  model?: string;
  /** Max tokens in response. Default: 1024 */
  maxOutputTokens?: number;
  /** Temperature 0-2. Default: 0.7 */
  temperature?: number;
}

interface GeminiPart {
  text: string;
}

interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

interface GeminiRequestBody {
  contents: GeminiContent[];
  systemInstruction?: { parts: GeminiPart[] };
  generationConfig?: {
    maxOutputTokens: number;
    temperature: number;
  };
}

interface GeminiResponseCandidate {
  content: { parts: GeminiPart[]; role: string };
  finishReason: string;
}

interface GeminiResponse {
  candidates: GeminiResponseCandidate[];
  error?: { message: string; code: number };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class GeminiService {
  private apiKey: string;
  private model: string;
  private maxOutputTokens: number;
  private temperature: number;

  private static BASE_URL =
    "https://generativelanguage.googleapis.com/v1beta/models";

  constructor(config: GeminiConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model ?? "gemini-2.0-flash";
    this.maxOutputTokens = config.maxOutputTokens ?? 1024;
    this.temperature = config.temperature ?? 0.7;
  }

  /**
   * Send a single message (with optional history) and get a text reply.
   * @param userMessage - The user's current message
   * @param history - Previous turns in the conversation
   * @param systemPrompt - Optional system instruction (sets AI persona/context)
   */
  async chat(
    userMessage: string,
    history: ChatMessage[] = [],
    systemPrompt?: string
  ): Promise<string> {
    const url = `${GeminiService.BASE_URL}/${this.model}:generateContent?key=${this.apiKey}`;

    // Build contents array from history + current message
    const contents: GeminiContent[] = [
      ...history.map((msg) => ({
        role: msg.role,
        parts: [{ text: msg.text }],
      })),
      { role: "user" as const, parts: [{ text: userMessage }] },
    ];

    const body: GeminiRequestBody = {
      contents,
      generationConfig: {
        maxOutputTokens: this.maxOutputTokens,
        temperature: this.temperature,
      },
    };

    if (systemPrompt) {
      body.systemInstruction = { parts: [{ text: systemPrompt }] };
    }

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API error ${response.status}: ${errText}`);
    }

    const data: GeminiResponse = await response.json();

    if (data.error) {
      throw new Error(`Gemini error ${data.error.code}: ${data.error.message}`);
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error("No response from Gemini");
    }

    return text;
  }

  /**
   * Quick one-shot call without history - useful for analysis tasks.
   */
  async analyze(prompt: string, systemPrompt?: string): Promise<string> {
    return this.chat(prompt, [], systemPrompt);
  }

  /**
   * Validate an API key by sending a minimal request.
   * Returns true if key is valid, false otherwise.
   */
  async validateKey(): Promise<boolean> {
    try {
      await this.chat("Hi");
      return true;
    } catch {
      return false;
    }
  }
}

// ---------------------------------------------------------------------------
// Storage helpers (uses React Native MMKV - already in Liftosaur's deps)
// ---------------------------------------------------------------------------
// Import MMKV in the file that uses these helpers:
//   import { MMKV } from "react-native-mmkv";
//   const storage = new MMKV({ id: "ai-settings" });

export const AI_STORAGE_KEYS = {
  GEMINI_API_KEY: "gemini_api_key",
  CHAT_HISTORY: "ai_chat_history",
} as const;
