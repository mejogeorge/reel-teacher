import {
  assertTransition,
  DEDUP_WINDOW_DAYS,
  toSlug,
  type WordStatus,
} from "@wordcast/shared";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { requireAdmin } from "./lib/auth";
import { logEvent } from "./lib/events";
import { enqueueRenderForWord } from "./lib/render";
import { backgroundMusicModeValidator, wordContentValidator } from "./lib/validators";

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

async function assetsForWord(ctx: QueryCtx, wordId: Id<"words">) {
  const rows = await ctx.db
    .query("assets")
    .withIndex("by_wordId", (q) => q.eq("wordId", wordId))
    .collect();
  return Promise.all(
    rows.map(async (a) => ({
      _id: a._id,
      kind: a.kind,
      url: await ctx.storage.getUrl(a.storageId),
      durationSec: a.durationSec,
      width: a.width,
      height: a.height,
      bytes: a.bytes,
      themeId: a.themeId,
      renderVersion: a.renderVersion,
    })),
  );
}

// --- Queries -------------------------------------------------------------------

export const getToday = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const runDate = todayUtc();
    const run = await ctx.db
      .query("pipelineRuns")
      .withIndex("by_runDate", (q) => q.eq("runDate", runDate))
      .first();
    const word = run?.wordId ? await ctx.db.get(run.wordId) : null;
    const assets = word ? await assetsForWord(ctx, word._id) : [];
    return { runDate, run, word, assets };
  },
});

export const listWords = query({
  args: { status: v.optional(v.string()) },
  handler: async (ctx, { status }) => {
    await requireAdmin(ctx);
    const rows = status
      ? await ctx.db
          .query("words")
          .withIndex("by_status", (q) => q.eq("status", status as WordStatus))
          .order("desc")
          .take(100)
      : await ctx.db.query("words").withIndex("by_createdAt").order("desc").take(100);
    return rows.map((w) => ({
      _id: w._id,
      word: w.word,
      slug: w.slug,
      status: w.status,
      origin: w.origin,
      themeId: w.themeId,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
    }));
  },
});

export const getWordDetail = query({
  args: { wordId: v.id("words") },
  handler: async (ctx, { wordId }) => {
    await requireAdmin(ctx);
    const word = await ctx.db.get(wordId);
    if (!word) return null;
    const assets = await assetsForWord(ctx, wordId);
    const events = await ctx.db
      .query("events")
      .withIndex("by_wordId", (q) => q.eq("wordId", wordId))
      .order("desc")
      .take(100);
    return { word, assets, events };
  },
});

export const listMusic = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query("musicTracks").collect();
    return Promise.all(
      rows.map(async (t) => ({ ...t, url: await ctx.storage.getUrl(t.storageId) })),
    );
  },
});

export const listBlocklist = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return ctx.db.query("blocklist").take(1000);
  },
});

export const listFallbackWords = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return ctx.db.query("fallbackWords").withIndex("by_used").order("asc").collect();
  },
});

export const systemStatus = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const statuses = ["queued", "claimed", "rendering", "succeeded", "failed"] as const;
    const jobCounts: Record<string, number> = {};
    let latestLease = 0;
    for (const s of statuses) {
      const jobs = await ctx.db
        .query("renderJobs")
        .withIndex("by_status", (q) => q.eq("status", s))
        .collect();
      jobCounts[s] = jobs.length;
      for (const j of jobs) latestLease = Math.max(latestLease, j.leaseExpiresAt ?? 0);
    }
    const recentErrors = (
      await ctx.db.query("events").withIndex("by_createdAt").order("desc").take(200)
    )
      .filter((e) => e.level === "error")
      .slice(0, 20);
    return { jobCounts, latestLease, recentErrors };
  },
});

// --- Mutations -----------------------------------------------------------------

async function slugUsable(ctx: QueryCtx, slug: string): Promise<boolean> {
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

export const approveNow = mutation({
  args: { wordId: v.id("words") },
  handler: async (ctx, { wordId }) => {
    await requireAdmin(ctx);
    const word = await ctx.db.get(wordId);
    if (!word) throw new Error("word not found");
    if (word.status !== "safety_passed") {
      throw new Error(`cannot approve from status ${word.status}`);
    }
    const now = Date.now();
    assertTransition(word.status, "approved");
    await ctx.db.patch(wordId, { status: "approved", approvedAt: now, updatedAt: now });
    await logEvent(ctx, { wordId, type: "approve.manual", message: "Approved by admin" });
    await enqueueRenderForWord(ctx, wordId);
  },
});

export const reject = mutation({
  args: { wordId: v.id("words"), reason: v.string() },
  handler: async (ctx, { wordId, reason }) => {
    await requireAdmin(ctx);
    const word = await ctx.db.get(wordId);
    if (!word) throw new Error("word not found");
    assertTransition(word.status as WordStatus, "rejected");
    await ctx.db.patch(wordId, {
      status: "rejected",
      rejectedReason: reason,
      updatedAt: Date.now(),
    });
    await logEvent(ctx, { wordId, type: "reject.manual", message: reason, level: "warn" });
  },
});

/**
 * Discard the current word (even if already approved) and pick a different one,
 * running it through the same flow. Cancels any pending render for the old word.
 */
export const changeWord = mutation({
  args: { wordId: v.id("words") },
  handler: async (ctx, { wordId }) => {
    await requireAdmin(ctx);
    const word = await ctx.db.get(wordId);
    if (!word) throw new Error("word not found");
    const now = Date.now();

    // Admin override: discard from whatever state it's in.
    await ctx.db.patch(wordId, {
      status: "rejected",
      rejectedReason: "changed by admin",
      updatedAt: now,
    });

    // Cancel any pending/in-flight render so the worker doesn't render a discarded word.
    const jobs = await ctx.db
      .query("renderJobs")
      .withIndex("by_wordId", (q) => q.eq("wordId", wordId))
      .collect();
    for (const j of jobs) {
      if (j.status === "queued" || j.status === "claimed" || j.status === "rendering") {
        await ctx.db.patch(j._id, { status: "failed", error: "word changed by admin", updatedAt: now });
      }
    }

    // Unlink the run's word so the dashboard shows a "finding a word" loader
    // until the replacement is picked + enriched.
    if (word.runId) {
      await ctx.db.patch(word.runId, { wordId: undefined });
    }

    await logEvent(ctx, {
      wordId,
      type: "word.changed",
      message: "Admin changed the word — picking a replacement",
      level: "warn",
    });

    // Pick + enrich a replacement, linked to the same run (auto-approves per settings).
    await ctx.scheduler.runAfter(0, internal.pipeline.rerollWord, { runId: word.runId });
  },
});

/** Admin override: reset a word so content is regenerated (bypasses forward-only rules). */
export const regenerate = mutation({
  args: { wordId: v.id("words") },
  handler: async (ctx, { wordId }) => {
    await requireAdmin(ctx);
    const word = await ctx.db.get(wordId);
    if (!word) throw new Error("word not found");
    await ctx.db.patch(wordId, { status: "selected", rejectedReason: undefined, updatedAt: Date.now() });
    await logEvent(ctx, { wordId, type: "regenerate", message: "Admin regenerate" });
    await ctx.scheduler.runAfter(0, internal.enrich.reprocess, { wordId });
  },
});

/** Admin override: re-render (optionally with a chosen theme). */
export const rerender = mutation({
  args: { wordId: v.id("words"), themeId: v.optional(v.string()) },
  handler: async (ctx, { wordId, themeId }) => {
    await requireAdmin(ctx);
    const word = await ctx.db.get(wordId);
    if (!word) throw new Error("word not found");
    if (!word.content) throw new Error("word has no content to render");
    const now = Date.now();
    // If the word already finished, reset it so the worker can process a new job.
    if (word.status === "rendered" || word.status === "failed") {
      await ctx.db.patch(wordId, { status: "approved", approvedAt: now, updatedAt: now });
    }
    await enqueueRenderForWord(ctx, wordId, themeId);
    await logEvent(ctx, { wordId, type: "rerender", message: `Re-render${themeId ? ` (${themeId})` : ""}` });
  },
});

export const retryFailed = mutation({
  args: { wordId: v.id("words") },
  handler: async (ctx, { wordId }) => {
    await requireAdmin(ctx);
    const word = await ctx.db.get(wordId);
    if (!word || word.status !== "failed") throw new Error("word is not in a failed state");
    await ctx.db.patch(wordId, { status: "selected", error: undefined, updatedAt: Date.now() });
    await logEvent(ctx, { wordId, type: "retry", message: "Admin retry from start" });
    await ctx.scheduler.runAfter(0, internal.enrich.enrichWord, { wordId });
  },
});

export const editContent = mutation({
  args: { wordId: v.id("words"), content: wordContentValidator },
  handler: async (ctx, { wordId, content }) => {
    await requireAdmin(ctx);
    await ctx.db.patch(wordId, { content, updatedAt: Date.now() });
    await logEvent(ctx, { wordId, type: "content.edited", message: "Content edited by admin" });
  },
});

export const addWordManually = mutation({
  args: { word: v.string() },
  handler: async (ctx, { word }) => {
    await requireAdmin(ctx);
    const clean = word.trim();
    if (!/^[a-zA-Z][a-zA-Z-]{1,29}$/.test(clean)) {
      throw new Error("word must be 2–30 letters/hyphens");
    }
    const slug = toSlug(clean);
    if (!(await slugUsable(ctx, slug))) {
      throw new Error("word is blocklisted or was rendered recently");
    }
    const now = Date.now();
    const wordId = await ctx.db.insert("words", {
      slug,
      word: clean,
      status: "selected",
      origin: "manual",
      createdAt: now,
      updatedAt: now,
    });
    await logEvent(ctx, { wordId, type: "word.manual", message: `Added "${clean}" manually` });
    await ctx.scheduler.runAfter(0, internal.enrich.enrichWord, { wordId });
    return wordId;
  },
});

export const addBlocklistTerm = mutation({
  args: { term: v.string(), reason: v.optional(v.string()) },
  handler: async (ctx, { term, reason }) => {
    await requireAdmin(ctx);
    const t = term.trim().toLowerCase();
    const existing = await ctx.db
      .query("blocklist")
      .withIndex("by_term", (q) => q.eq("term", t))
      .unique();
    if (!existing) await ctx.db.insert("blocklist", { term: t, reason });
  },
});

export const removeBlocklistTerm = mutation({
  args: { id: v.id("blocklist") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    await ctx.db.delete(id);
  },
});

export const addFallbackWords = mutation({
  args: { words: v.array(v.string()) },
  handler: async (ctx, { words }) => {
    await requireAdmin(ctx);
    for (const raw of words) {
      const w = raw.trim();
      if (!w) continue;
      const existing = await ctx.db
        .query("fallbackWords")
        .filter((q) => q.eq(q.field("word"), w))
        .first();
      if (!existing) await ctx.db.insert("fallbackWords", { word: w });
    }
  },
});

export const createMusicUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return ctx.storage.generateUploadUrl();
  },
});

export const addMusicTrack = mutation({
  args: {
    title: v.string(),
    storageId: v.id("_storage"),
    durationSec: v.number(),
    source: v.string(),
    licenseUrl: v.string(),
    attributionText: v.optional(v.string()),
    mood: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.insert("musicTracks", { ...args, active: true });
  },
});

export const setMusicActive = mutation({
  args: { trackId: v.id("musicTracks"), active: v.boolean() },
  handler: async (ctx, { trackId, active }) => {
    await requireAdmin(ctx);
    await ctx.db.patch(trackId, { active });
  },
});

export const getPostTargets = query({
  args: { wordId: v.id("words") },
  handler: async (ctx, { wordId }) => {
    await requireAdmin(ctx);
    return ctx.db
      .query("postTargets")
      .withIndex("by_wordId", (q) => q.eq("wordId", wordId))
      .order("desc")
      .collect();
  },
});

/** Queue a rendered word's video to be published to Instagram (manual). */
export const publishToInstagram = mutation({
  args: { wordId: v.id("words") },
  handler: async (ctx, { wordId }) => {
    await requireAdmin(ctx);
    const word = await ctx.db.get(wordId);
    if (!word) throw new Error("word not found");
    if (word.status !== "rendered") throw new Error("word must be rendered before publishing");

    const videos = await ctx.db
      .query("assets")
      .withIndex("by_wordId", (q) => q.eq("wordId", wordId))
      .collect();
    const latest = videos
      .filter((a) => a.kind === "video")
      .sort((a, b) => b.renderVersion - a.renderVersion)[0];
    if (!latest) throw new Error("no video asset to publish");

    const now = Date.now();
    const id = await ctx.db.insert("postTargets", {
      wordId,
      platform: "instagram",
      status: "pending",
      renderVersion: latest.renderVersion,
      createdAt: now,
      updatedAt: now,
    });
    await logEvent(ctx, { wordId, type: "publish.queued", message: "Queued Instagram publish" });
    await ctx.scheduler.runAfter(0, internal.publish.instagramPublish, { wordId, postTargetId: id });
  },
});

/** One-time bootstrap: seed settings, blocklist and fallback words. */
export const bootstrap = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    await ctx.scheduler.runAfter(0, internal.settings.seed, {});
    await ctx.scheduler.runAfter(0, internal.seed.seedBlocklist, {});
    await ctx.scheduler.runAfter(0, internal.seed.seedFallbackWords, {});
  },
});

export type WordDoc = Doc<"words">;
