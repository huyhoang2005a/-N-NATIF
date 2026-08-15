import { loadEnv } from "@r2m/env";
import { Injectable } from "@nestjs/common";

export interface GeminiTurn {
  role: "user" | "model";
  text: string;
}

/** Thin wrapper around the Gemini REST API (`generateContent`) — no SDK dependency added
 * just for this; the REST call is a single `fetch`. Demo-phase choice per the AI plan
 * (Google AI Studio key, free tier) — swap this class out if/when a paid provider
 * (Claude/OpenAI) replaces it later, the rest of `AssistantService` doesn't need to change. */
@Injectable()
export class GeminiClient {
  isConfigured(): boolean {
    return Boolean(loadEnv().GEMINI_API_KEY);
  }

  async generate(systemInstruction: string, turns: GeminiTurn[]): Promise<string> {
    const env = loadEnv();
    if (!env.GEMINI_API_KEY) {
      throw new Error("GeminiClient.generate called without GEMINI_API_KEY configured.");
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`;
    const body = {
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: turns.map((turn) => ({ role: turn.role, parts: [{ text: turn.text }] })),
      generationConfig: { temperature: 0.3, maxOutputTokens: 600 },
    };

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`Gemini API request failed with status ${response.status}: ${errorText.slice(0, 500)}`);
    }

    const data = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error("Gemini API returned no text candidate.");
    }
    return text;
  }

  /** Structured-output mode (`responseMimeType: "application/json"` + `responseSchema`,
   * Gemini's native JSON-mode — verified live against the actual key/model, not assumed)
   * for callers that need a shape the model must conform to, rather than freeform chat
   * text. Returns the raw parsed JSON `unknown` — callers must still zod-validate it
   * before trusting field values/enums, since JSON-mode constrains shape/type but not
   * business-rule validity (e.g. an enum member Gemini invents that happens to be a
   * string isn't caught by `responseSchema` alone in every case). */
  async generateJson(systemInstruction: string, userPrompt: string, responseSchema: object): Promise<unknown> {
    const env = loadEnv();
    if (!env.GEMINI_API_KEY) {
      throw new Error("GeminiClient.generateJson called without GEMINI_API_KEY configured.");
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`;
    const body = {
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: 0.4,
        // 4096, not 2000 — verified live: with 2+ gaps feeding a multi-milestone roadmap
        // suggestion, the default reasoning-model "thinking" budget plus a longer JSON
        // payload occasionally exceeded 2000 total output tokens and got cut mid-string,
        // producing "malformed JSON despite JSON response mode" (caught, not a crash, but
        // a needless failure under normal-sized input).
        maxOutputTokens: 4096,
        responseMimeType: "application/json",
        responseSchema,
      },
    };

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`Gemini API request failed with status ${response.status}: ${errorText.slice(0, 500)}`);
    }

    const data = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error("Gemini API returned no JSON candidate.");
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new Error("Gemini API returned malformed JSON despite JSON response mode.");
    }
  }
}
