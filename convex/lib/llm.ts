import Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";
import { convexEnv } from "./env";

/**
 * Provider-agnostic LLM helpers. Uses Anthropic if ANTHROPIC_API_KEY is set,
 * otherwise Gemini if GEMINI_API_KEY is set. Import only from "use node" actions.
 */

type Provider = "anthropic" | "gemini";

function selectProvider(): Provider {
  const env = convexEnv();
  if (env.ANTHROPIC_API_KEY) return "anthropic";
  if (env.GEMINI_API_KEY) return "gemini";
  throw new Error("No LLM provider configured — set ANTHROPIC_API_KEY or GEMINI_API_KEY");
}

/** The model name that will actually be used (for audit/logging). */
export function activeModel(fast = false): string {
  const env = convexEnv();
  if (env.ANTHROPIC_API_KEY) return fast ? env.ANTHROPIC_MODEL_FAST : env.ANTHROPIC_MODEL;
  if (env.GEMINI_API_KEY) return fast ? env.GEMINI_MODEL_FAST : env.GEMINI_MODEL;
  return "unknown";
}

function stripCodeFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

interface CallOpts {
  /** Use the fast/cheap model instead of the primary model. */
  fast?: boolean;
  system?: string;
  maxTokens?: number;
}

const DEFAULT_SYSTEM =
  "Respond ONLY with valid JSON. No prose, no markdown, no code fences.";

// --- Anthropic ------------------------------------------------------------------

let anthropicClient: Anthropic | undefined;
function anthropic(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: convexEnv().ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}

async function callAnthropic(prompt: string, opts: CallOpts): Promise<string> {
  const env = convexEnv();
  const model = opts.fast ? env.ANTHROPIC_MODEL_FAST : env.ANTHROPIC_MODEL;
  const message = await anthropic().messages.create({
    model,
    max_tokens: opts.maxTokens ?? 1024,
    system: opts.system ?? DEFAULT_SYSTEM,
    messages: [{ role: "user", content: prompt }],
  });
  return message.content.map((block) => (block.type === "text" ? block.text : "")).join("");
}

// --- Gemini ---------------------------------------------------------------------

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function callGemini(prompt: string, opts: CallOpts): Promise<string> {
  const env = convexEnv();
  const model = opts.fast ? env.GEMINI_MODEL_FAST : env.GEMINI_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: opts.system ?? DEFAULT_SYSTEM }] },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      maxOutputTokens: opts.maxTokens ?? 1024,
      temperature: 0.7,
      responseMimeType: "application/json",
    },
  });

  // Retry transient overload (503) / rate-limit (429) with backoff.
  let lastError = "";
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });
    if (res.ok) {
      const data = (await res.json()) as GeminiResponse;
      return (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");
    }
    lastError = `Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`;
    if (res.status !== 503 && res.status !== 429) throw new Error(lastError);
    await sleep(1500 * (attempt + 1));
  }
  throw new Error(lastError);
}

// --- Public API -----------------------------------------------------------------

/** Call the configured LLM and return the raw text response. */
export async function callLLMText(prompt: string, opts: CallOpts = {}): Promise<string> {
  return selectProvider() === "anthropic" ? callAnthropic(prompt, opts) : callGemini(prompt, opts);
}

/** Call the LLM and JSON.parse the (fence-stripped) response. Throws on invalid JSON. */
export async function callLLMJSON(prompt: string, opts: CallOpts = {}): Promise<unknown> {
  return JSON.parse(stripCodeFences(await callLLMText(prompt, opts)));
}

export type ValidatedResult<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Call the LLM, parse JSON, and validate against a zod schema. On failure, retry
 * with the parse/validation error appended so the model can self-correct.
 */
export async function callLLMValidated<T>(
  prompt: string,
  schema: z.ZodType<T>,
  opts: CallOpts & { retries?: number } = {},
): Promise<ValidatedResult<T>> {
  const maxRetries = opts.retries ?? 1;
  let currentPrompt = prompt;
  let lastError = "unknown error";

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let text: string;
    try {
      text = await callLLMText(currentPrompt, opts);
    } catch (err) {
      return { ok: false, error: `LLM call failed: ${String(err)}` };
    }

    let json: unknown;
    try {
      json = JSON.parse(stripCodeFences(text));
    } catch {
      lastError = "response was not valid JSON";
      currentPrompt = `${prompt}\n\nYour previous response was not valid JSON. Respond with JSON only.`;
      continue;
    }

    const parsed = schema.safeParse(json);
    if (parsed.success) return { ok: true, data: parsed.data };

    lastError = parsed.error.issues
      .map((i) => `- ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    currentPrompt = `${prompt}\n\nYour previous JSON failed validation:\n${lastError}\nReturn corrected JSON only.`;
  }

  return { ok: false, error: `validation failed after ${maxRetries + 1} attempts:\n${lastError}` };
}
