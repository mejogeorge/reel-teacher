import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";
import { requireAdmin } from "./lib/auth";

/** Published posts that have a platform media id (candidates for metrics). */
export const listPublishedTargets = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("postTargets")
      .withIndex("by_status", (q) => q.eq("status", "published"))
      .collect();
    return rows
      .filter((r) => r.externalId)
      .map((r) => ({
        postTargetId: r._id,
        wordId: r.wordId,
        platform: r.platform,
        externalId: r.externalId as string,
      }));
  },
});

/** Upsert the latest metrics snapshot for a post (one row per postTarget). */
export const upsertMetric = internalMutation({
  args: {
    wordId: v.id("words"),
    postTargetId: v.id("postTargets"),
    platform: v.string(),
    externalId: v.string(),
    likes: v.optional(v.number()),
    comments: v.optional(v.number()),
    shares: v.optional(v.number()),
    views: v.optional(v.number()),
    reach: v.optional(v.number()),
    saved: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("postMetrics")
      .withIndex("by_postTarget", (q) => q.eq("postTargetId", args.postTargetId))
      .unique();
    const doc = { ...args, fetchedAt: Date.now() };
    if (existing) await ctx.db.patch(existing._id, doc);
    else await ctx.db.insert("postMetrics", doc);
  },
});

/** Dashboard: latest metrics for a word, by platform. */
export const getMetricsByWord = query({
  args: { wordId: v.id("words") },
  handler: async (ctx, { wordId }) => {
    await requireAdmin(ctx);
    return ctx.db
      .query("postMetrics")
      .withIndex("by_wordId", (q) => q.eq("wordId", wordId))
      .collect();
  },
});
