"use node";

import { pickWordResultSchema, toSlug } from "@wordcast/shared";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction } from "./_generated/server";
import { callLLMJSON } from "./lib/llm";
import { rateLimiter } from "./lib/ratelimit";

interface Candidate {
  term: string;
  score: number;
  sampleContext: string;
}

function buildPickPrompt(candidates: Candidate[]): string {
  const list = candidates
    .map((c, i) => `${i + 1}. ${c.term} — "${c.sampleContext}"`)
    .join("\n");
  return [
    'You are choosing ONE English word to teach language learners as a "word of the day".',
    "",
    "Candidates were extracted from today's news headlines; each has a usage snippet:",
    list,
    "",
    "Choose the single best word for learners. Criteria:",
    "- genuinely useful and broadly applicable to learn",
    "- uncommon-but-real (NOT an everyday word everyone already knows)",
    "- NOT a proper noun, brand, place or person's name",
    "- NOT a typo, fragment, or non-word",
    "- NOT tied to tragedy/violence, offensive, or a political flashpoint",
    "",
    "Respond with JSON only, no prose, no code fences:",
    '{"pick": "<chosen word, or null if none qualify>", "reason": "<why>", "rarity": <0-10 how rare/worth-teaching>, "rejected": [{"term": "...", "reason": "..."}]}',
  ].join("\n");
}

/**
 * Pick the best learner word from today's candidates via a single batched Claude
 * call. Falls back to the curated LRU list if nothing qualifies or the pick is
 * unusable (blocklisted / recently rendered).
 */
export const pickWord = internalAction({
  args: { runDate: v.string(), runId: v.optional(v.id("pipelineRuns")) },
  handler: async (
    ctx,
    { runDate, runId },
  ): Promise<{ wordId: Id<"words">; word: string; origin: "trending" | "fallback" }> => {
    const candidates = await ctx.runQuery(internal.pickData.getCandidates, { runDate });

    if (candidates.length > 0) {
      try {
        await rateLimiter.limit(ctx, "llm", { throws: true });
        const raw = await callLLMJSON(buildPickPrompt(candidates.slice(0, 40)), {
          maxTokens: 1500,
        });
        const parsed = pickWordResultSchema.safeParse(raw);
        if (parsed.success && parsed.data.pick) {
          const word = parsed.data.pick.trim();
          const slug = toSlug(word);
          const usable = await ctx.runQuery(internal.pickData.canUseSlug, { slug });
          if (usable) {
            const wordId = await ctx.runMutation(internal.pickData.createSelectedWord, {
              word,
              slug,
              origin: "trending",
              runId,
              rarity: parsed.data.rarity,
              reason: parsed.data.reason,
            });
            return { wordId, word, origin: "trending" as const };
          }
        }
      } catch {
        // Fall through to the curated fallback list.
      }
    }

    return ctx.runMutation(internal.pickData.useFallbackWord, { runId });
  },
});
