"use node";

import { extractTerms, rankCandidates } from "@wordcast/shared";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { fetchAllSources } from "./lib/sources/rss";

const MAX_TERM_STATS_PER_RUN = 300;

/**
 * Fetch RSS sources, extract + score candidate terms (corpus-internal spike vs
 * 30-day history — no external frequency table), and store the top candidates.
 * Runs in the Node runtime for reliable fetch + XML parsing.
 */
export const discoverCandidates = internalAction({
  args: { runDate: v.string() },
  handler: async (ctx, { runDate }) => {
    const enabledSources = await ctx.runQuery(internal.discoveryData.getEnabledSources, {});
    const { docs, errors } = await fetchAllSources(enabledSources);

    const blocklist = new Set(await ctx.runQuery(internal.discoveryData.getBlocklistTerms, {}));
    const extracts = extractTerms(docs, { blocklist });

    const avg = await ctx.runQuery(internal.discoveryData.getHistoryAverages, {
      terms: extracts.map((e) => e.term),
      runDate,
    });
    const ranked = rankCandidates(extracts, avg, 50);

    const todayStats = [...extracts]
      .sort((a, b) => b.docCount - a.docCount)
      .slice(0, MAX_TERM_STATS_PER_RUN)
      .map((e) => ({ term: e.term, docCount: e.docCount, sourceCount: e.sourceIds.length }));

    await ctx.runMutation(internal.discoveryData.storeCandidates, {
      runDate,
      todayStats,
      candidates: ranked.map((c) => ({
        term: c.term,
        score: c.score,
        sampleContext: c.sample,
        sourceIds: c.sourceIds,
      })),
    });

    await ctx.runMutation(internal.events.log, {
      type: "discovery.complete",
      message: `Discovered ${ranked.length} candidates from ${docs.length} docs`,
      data: { docCount: docs.length, candidateCount: ranked.length, feedErrors: errors },
      level: errors.length > 0 ? "warn" : "info",
    });

    return { docCount: docs.length, candidateCount: ranked.length, feedErrors: errors.length };
  },
});
