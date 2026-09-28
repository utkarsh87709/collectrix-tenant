// Minimal server-side AI proxy. Holds provider API keys so the browser never
// sees them. Implements the same contract the shared backend is expected to
// grow at POST /tenant/aiGenerate (see src/lib/ai-api.ts), so new frontend
// modules can build against it today and repoint at the real backend later.
//
// Run with:  npm run ai-proxy   (reads server/.env, see server/.env.example)
import { createServer } from "node:http";

const PORT = process.env.PORT ? Number(process.env.PORT) : 8787;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
// gemini-3.8-flash (the current flagship) is intermittently returning 503s
// under high demand as of 2026-09-25; gemini-3.5-flash-lite is confirmed
// healthy. Override via GEMINI_MODEL once the flagship's demand eases.
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

function envelope(status, data, message) {
  return JSON.stringify({ meta: { status, ...(message ? { message } : {}) }, data: data ?? null });
}

function fail(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

async function callGemini({ prompt, systemPrompt, maxTokens }) {
  if (!GEMINI_API_KEY) throw fail(501, "Gemini is not configured on this server (missing GEMINI_API_KEY).");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    ...(systemPrompt ? { systemInstruction: { parts: [{ text: systemPrompt }] } } : {}),
    ...(maxTokens ? { generationConfig: { maxOutputTokens: maxTokens } } : {}),
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw fail(res.status, json?.error?.message || `Gemini request failed (${res.status})`);

  const text = (json?.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");
  return text;
}

async function callClaude({ prompt, systemPrompt, maxTokens }) {
  if (!ANTHROPIC_API_KEY) throw fail(501, "Claude is not configured on this server (missing ANTHROPIC_API_KEY).");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: maxTokens || 1024,
      ...(systemPrompt ? { system: systemPrompt } : {}),
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const json = await res.json();
  if (!res.ok) throw fail(res.status, json?.error?.message || `Claude request failed (${res.status})`);

  const text = (json?.content ?? []).map((block) => block.text ?? "").join("");
  return text;
}

const server = createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== "POST" || req.url !== "/tenant/aiGenerate") {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(envelope(false, null, "Not found"));
    return;
  }

  let raw = "";
  for await (const chunk of req) raw += chunk;

  let input;
  try {
    input = JSON.parse(raw || "{}");
  } catch {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(envelope(false, null, "Invalid JSON body"));
    return;
  }

  const { provider, prompt, systemPrompt, maxTokens } = input;
  if (!prompt || typeof prompt !== "string") {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(envelope(false, null, "prompt is required"));
    return;
  }

  try {
    let text;
    if (provider === "gemini") text = await callGemini({ prompt, systemPrompt, maxTokens });
    else if (provider === "claude") text = await callClaude({ prompt, systemPrompt, maxTokens });
    else throw fail(400, `Unknown provider "${provider}". Use "claude" or "gemini".`);

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(envelope(true, { text }));
  } catch (err) {
    res.writeHead(err.statusCode || 500, { "Content-Type": "application/json" });
    res.end(envelope(false, null, err.message || "AI request failed"));
  }
});

server.listen(PORT, () => {
  console.log(`AI proxy listening on http://localhost:${PORT}`);
});
