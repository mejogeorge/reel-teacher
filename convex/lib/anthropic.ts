import Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";
import { convexEnv } from "./env";

/**
 * Anthropic client helpers. Only import from "use node" actions — the SDK and
 * these helpers run in the Convex Node runtime.
 */
let client: Anthropic | undefined;
function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: convexEnv().ANTHROPIC_API_KEY });
  }
  return client;
}

function stripCodeFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

interface CallOpts {
  /** Use the fast/cheap model (Haiku) instead of the content model. */
  fast?: boolean;
  system?: string;
  maxTokens?: number;
}

/** Call Claude and return the raw text of the response. */
export async function callClaudeText(prompt: string, opts: CallOpts = {}): Promise<string> {
  const env = convexEnv();
  const model = opts.fast ? env.ANTHROPIC_MODEL_FAST : env.ANTHROPIC_MODEL;
  const message = await getClient().messages.create({
    model,
    max_tokens: opts.maxTokens ?? 1024,
    system: opts.system ?? "Respond ONLY with valid JSON. No prose, no markdown, no code fences.",
    messages: [{ role: "user", content: prompt }],
  });
  return message.content.map((block) => (block.type === "text" ? block.text : "")).join("");
}

/** Call Claude and JSON.parse the (fence-stripped) response. Throws on invalid JSON. */
export async function callClaudeJSON(prompt: string, opts: CallOpts = {}): Promise<unknown> {
  const raw = await callClaudeText(prompt, opts);
  return JSON.parse(stripCodeFences(raw));
}

export type ValidatedResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/**
 * Call Claude, parse JSON, and validate against a zod schema. On failure, retry
 * once with the parse/validation error appended so the model can self-correct.
 */
export async function callClaudeValidated<T>(
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
      text = await callClaudeText(currentPrompt, opts);
    } catch (err) {
      return { ok: false, error: `LLM call failed: ${String(err)}` };
    }

    let json: unknown;
    try {
      json = JSON.parse(stripCodeFences(text));
    } catch {
      lastError = "response was not valid JSON";
      currentPrompt = `${prompt}\n\nYour previous response was not valid JSON. Respond with JSON only, no prose or code fences.`;
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
