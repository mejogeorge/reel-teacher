import Anthropic from "@anthropic-ai/sdk";
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
