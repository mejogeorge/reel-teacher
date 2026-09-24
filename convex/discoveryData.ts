import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

const HISTORY_WINDOW_DAYS = 30;

export const getEnabledSources = internalQuery({
  args: {},
  handler: async (ctx) => {
    const settings = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "global"))
      .unique();
    return settings?.enabledSources ?? [];
  },
});

export const getBlocklistTerms = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("blocklist").collect();
    return rows.map((r) => r.term.toLowerCase());
  },
});

/** Average docCount over the last HISTORY_WINDOW_DAYS (excluding today) per term. */
export const getHistoryAverages = internalQuery({
  args: { terms: v.array(v.string()), runDate: v.string() },
  handler: async (ctx, { terms, runDate }) => {
    const cutoffMs = new Date(`${runDate}T00:00:00Z`).getTime() - HISTORY_WINDOW_DAYS * 86400_000;
    const cutoffDate = new Date(cutoffMs).toISOString().slice(0, 10);
    const averages: Record<string, number> = {};
    for (const term of terms) {
      const rows = await ctx.db
        .query("termStats")
        .withIndex("by_term_date", (q) => q.eq("term", term))
        .collect();
      const recent = rows.filter((r) => r.date >= cutoffDate && r.date !== runDate);
      averages[term] =
        recent.length === 0 ? 0 : recent.reduce((acc, r) => acc + r.docCount, 0) / recent.length;
    }
    return averages;
  },
});

export const storeCandidates = internalMutation({
  args: {
    runDate: v.string(),
    todayStats: v.array(
      v.object({ term: v.string(), docCount: v.number(), sourceCount: v.number() }),
    ),
    candidates: v.array(
      v.object({
        term: v.string(),
        score: v.number(),
        sampleContext: v.string(),
        sourceIds: v.array(v.string()),
      }),
    ),
  },
  handler: async (ctx, { runDate, todayStats, candidates }) => {
    for (const stat of todayStats) {
      const existing = await ctx.db
        .query("termStats")
        .withIndex("by_term_date", (q) => q.eq("term", stat.term).eq("date", runDate))
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, {
          docCount: stat.docCount,
          sourceCount: stat.sourceCount,
        });
      } else {
        await ctx.db.insert("termStats", {
          term: stat.term,
          date: runDate,
          docCount: stat.docCount,
          sourceCount: stat.sourceCount,
        });
      }
    }

    const old = await ctx.db
      .query("candidates")
      .withIndex("by_runDate", (q) => q.eq("runDate", runDate))
      .collect();
    for (const row of old) await ctx.db.delete(row._id);

    for (const c of candidates) {
      await ctx.db.insert("candidates", {
        runDate,
        term: c.term,
        score: c.score,
        sampleContext: c.sampleContext,
        sourceIds: c.sourceIds,
      });
    }
  },
});
