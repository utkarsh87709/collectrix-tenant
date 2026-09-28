// Provider-agnostic AI generation calls.
//
// Long-term home: POST {VITE_API_BASE_URL}/tenant/aiGenerate on the shared
// backend, which should hold both provider keys server-side. Until that
// route ships there, this points at the local dev proxy (server/ai-proxy.mjs,
// run via `npm run ai-proxy`) which implements the same contract so new
// modules can build against it now.
//   POST /tenant/aiGenerate  { provider, prompt, systemPrompt?, maxTokens? } -> { text }
import { getAuthToken } from "./auth-token";

const AI_BASE_URL = (import.meta.env.VITE_AI_PROXY_URL ?? "http://localhost:8787").replace(/\/+$/, "");

export type AIProvider = "claude" | "gemini";

export type AIGenerateInput = {
  provider: AIProvider;
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
};

export type AIGenerateResult = {
  text: string;
};

export async function generateWithAI(input: AIGenerateInput): Promise<AIGenerateResult> {
  const token = getAuthToken();

  const res = await fetch(`${AI_BASE_URL}/tenant/aiGenerate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: token } : {}),
    },
    body: JSON.stringify(input),
  });

  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.meta?.status) {
    throw new Error(json?.meta?.message || `AI request failed with status ${res.status}`);
  }
  return json.data as AIGenerateResult;
}
