"use node";

import {
  buildContentPrompt,
  buildSafetyPrompt,
  normalizeDictionaryApiResponse,
  normalizeWordnikResponse,
  safetyClassificationSchema,
  wordContentSchema,
  type DictionaryResult,
} from "@wordcast/shared";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { callClaudeValidated } from "./lib/anthropic";
import { convexEnv } from "./lib/env";
import { rateLimiter } from "./lib/ratelimit";

const DICT_TIMEOUT_MS = 10_000;

async function fetchDictionary(word: string): Promise<DictionaryResult | null> {
  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
      { signal: AbortSignal.timeout(DICT_TIMEOUT_MS) },
    );
    if (res.ok) {
      const norm = normalizeDictionaryApiResponse(await res.json());
      if (norm) return norm;
    }
  } catch {
    // fall through to Wordnik
  }

  const key = process.env.WORDNIK_API_KEY;
  if (key) {
    try {
      const res = await fetch(
        `https://api.wordnik.com/v4/word.json/${encodeURIComponent(word)}/definitions?limit=10&api_key=${key}`,
        { signal: AbortSignal.timeout(DICT_TIMEOUT_MS) },
      );
      if (res.ok) {
        const norm = normalizeWordnikResponse(await res.json(), word);
        if (norm) return norm;
      }
    } catch {
      // fall through to null
    }
  }
  return null;
}

/** Look up and store a dictionary definition (dictionaryapi.dev, Wordnik fallback). */
export const fetchDefinition = internalAction({
  args: { wordId: v.id("words") },
  handler: async (ctx, { wordId }) => {
    const word = await ctx.runQuery(internal.enrichData.getWord, { wordId });
    if (!word) throw new Error("word not found");

    const def = await fetchDictionary(word.word);
    if (!def) {
      await ctx.runMutation(internal.enrichData.markFailed, {
        wordId,
        step: "fetchDefinition",
        message: `No definition found for "${word.word}"`,
      });
      return { ok: false as const };
    }
    await ctx.runMutation(internal.enrichData.setDefinition, { wordId, definition: def });
    return { ok: true as const };
  },
});

/** Generate dictionary-grounded WordContent (zod-validated, one retry on failure). */
export const generateContent = internalAction({
  args: { wordId: v.id("words") },
  handler: async (ctx, { wordId }) => {
    const word = await ctx.runQuery(internal.enrichData.getWord, { wordId });
    if (!word) throw new Error("word not found");
    if (!word.definition) {
      await ctx.runMutation(internal.enrichData.markFailed, {
        wordId,
        step: "generateContent",
        message: "missing definition",
      });
      return { ok: false as const };
    }

    await rateLimiter.limit(ctx, "llm", { throws: true });
    const result = await callClaudeValidated(
      buildContentPrompt(word.definition),
      wordContentSchema,
      { maxTokens: 2000, retries: 1 },
    );
    if (!result.ok) {
      await ctx.runMutation(internal.enrichData.markFailed, {
        wordId,
        step: "generateContent",
        message: result.error,
      });
      return { ok: false as const };
    }

    await ctx.runMutation(internal.enrichData.setContentEnriched, { wordId, content: result.data });
    return { ok: true as const };
  },
});

/** Full enrichment chain for a freshly-selected word (manual add / retry). */
export const enrichWord = internalAction({
  args: { wordId: v.id("words") },
  handler: async (ctx, { wordId }) => {
    const def = await ctx.runAction(internal.enrich.fetchDefinition, { wordId });
    if (!def.ok) return { ok: false as const };
    const content = await ctx.runAction(internal.enrich.generateContent, { wordId });
    if (!content.ok) return { ok: false as const };
    await ctx.runAction(internal.enrich.safetyCheck, { wordId });
    return { ok: true as const };
  },
});

/** Re-run content generation + safety for a word that already has a definition. */
export const reprocess = internalAction({
  args: { wordId: v.id("words") },
  handler: async (ctx, { wordId }) => {
    const content = await ctx.runAction(internal.enrich.generateContent, { wordId });
    if (!content.ok) return { ok: false as const };
    await ctx.runAction(internal.enrich.safetyCheck, { wordId });
    return { ok: true as const };
  },
});

/** Classify content safety: blocklist substring match + LLM classifier. Fail closed. */
export const safetyCheck = internalAction({
  args: { wordId: v.id("words") },
  handler: async (ctx, { wordId }) => {
    const word = await ctx.runQuery(internal.enrichData.getWord, { wordId });
    if (!word || !word.content) throw new Error("word/content not found");

    const contentText = JSON.stringify(word.content);
    const lower = contentText.toLowerCase();

    // 1. Blocklist substring match (fail closed on any hit).
    const blocklist = await ctx.runQuery(internal.discoveryData.getBlocklistTerms, {});
    const hit = blocklist.find((t) => t.length > 2 && lower.includes(t));
    if (hit) {
      await ctx.runMutation(internal.enrichData.setSafetyResult, {
        wordId,
        safety: { passed: false, reasons: [`blocklisted term: ${hit}`], model: "blocklist" },
      });
      return { passed: false as const };
    }

    // 2. LLM classification — fail closed on any error.
    const model = convexEnv().ANTHROPIC_MODEL_FAST;
    await rateLimiter.limit(ctx, "llm", { throws: true });
    const result = await callClaudeValidated(
      buildSafetyPrompt(word.word, contentText),
      safetyClassificationSchema,
      { fast: true, maxTokens: 500, retries: 1 },
    );
    const safety = result.ok
      ? { passed: result.data.safe, reasons: result.data.reasons, model }
      : { passed: false, reasons: [`safety check error: ${result.error}`], model };

    await ctx.runMutation(internal.enrichData.setSafetyResult, { wordId, safety });
    return { passed: safety.passed };
  },
});
