import { DEDUP_WINDOW_DAYS, toSlug } from "@wordcast/shared";
import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { logEvent } from "./lib/events";
import { wordOriginValidator } from "./lib/validators";

/** A slug is usable if it is not blocklisted and was not rendered within the dedup window. */
async function slugUsable(ctx: QueryCtx | MutationCtx, slug: string): Promise<boolean> {
  const blocked = await ctx.db
    .query("blocklist")
    .withIndex("by_term", (q) => q.eq("term", slug))
    .unique();
  if (blocked) return false;

  const cutoff = Date.now() - DEDUP_WINDOW_DAYS * 86400_000;
  const priors = await ctx.db
    .query("words")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .collect();
  return !priors.some((w) => w.status === "rendered" && w.createdAt >= cutoff);
}

export const getCandidates = internalQuery({
  args: { runDate: v.string() },
  handler: async (ctx, { runDate }) => {
    const rows = await ctx.db
      .query("candidates")
      .withIndex("by_runDate", (q) => q.eq("runDate", runDate))
      .collect();
    return rows
      .sort((a, b) => b.score - a.score)
      .map((r) => ({ term: r.term, score: r.score, sampleContext: r.sampleContext }));
  },
});

export const canUseSlug = internalQuery({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => slugUsable(ctx, slug),
});

export const createSelectedWord = internalMutation({
  args: {
    word: v.string(),
    slug: v.string(),
    origin: wordOriginValidator,
    runId: v.optional(v.id("pipelineRuns")),
    rarity: v.optional(v.number()),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { word, slug, origin, runId, rarity, reason }) => {
    const now = Date.now();
    const wordId = await ctx.db.insert("words", {
      slug,
      word,
      status: "selected",
      origin,
      runId,
      createdAt: now,
      updatedAt: now,
    });
    await logEvent(ctx, {
      wordId,
      runId,
      type: "pick.selected",
      message: `Selected "${word}" (${origin})`,
      data: { rarity, reason },
    });
    return wordId;
  },
});

/** Select the least-recently-used curated fallback word that is still usable. */
export const useFallbackWord = internalMutation({
  args: { runId: v.optional(v.id("pipelineRuns")) },
  handler: async (ctx, { runId }) => {
    const fallbacks = await ctx.db.query("fallbackWords").withIndex("by_used").order("asc").collect();
    for (const fb of fallbacks) {
      const slug = toSlug(fb.word);
      if (!(await slugUsable(ctx, slug))) continue;
      const now = Date.now();
      const wordId = await ctx.db.insert("words", {
        slug,
        word: fb.word,
        status: "selected",
        origin: "fallback",
        runId,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.patch(fb._id, { lastUsedAt: now });
      await logEvent(ctx, {
        wordId,
        runId,
        type: "pick.fallback",
        message: `Selected fallback word "${fb.word}"`,
      });
      return { wordId, word: fb.word, origin: "fallback" as const };
    }
    throw new Error("No usable fallback word available (all blocklisted or recently used)");
  },
});
