import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { logEvent } from "./lib/events";
import { enqueueRenderForWord } from "./lib/render";
import { reelSegmentValidator } from "./lib/validators";

const DAY_MS = 86400_000;

/**
 * Enqueue a PremiumReel render job: stores the timed segments + the uploaded
 * ElevenLabs voice, resolves theme/brand from settings, and resets the word so
 * the worker can process it. Publishing stays gated by settings.autoPublish.
 */
export const enqueueReelRender = internalMutation({
  args: {
    wordId: v.id("words"),
    word: v.string(),
    durationSec: v.number(),
    voiceStorageId: v.id("_storage"),
    segments: v.array(reelSegmentValidator),
  },
  handler: async (ctx, { wordId, word, durationSec, voiceStorageId, segments }) => {
    const doc = await ctx.db.get(wordId);
    if (!doc) throw new Error("word not found");
    if (!doc.content) throw new Error("cannot enqueue reel: word has no content");

    const audioSrc = await ctx.storage.getUrl(voiceStorageId);
    if (!audioSrc) throw new Error("voice storage url missing");

    const settings = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "global"))
      .unique();
    const brandHandle = settings?.brandHandle ?? "@wordcast";
    const themeId = doc.themeId ?? "premium-reel";
    const maxAttempts = settings?.maxAttemptsPerStep ?? 3;

    const priorJobs = await ctx.db
      .query("renderJobs")
      .withIndex("by_wordId", (q) => q.eq("wordId", wordId))
      .collect();
    const renderVersion = priorJobs.length + 1;

    const now = Date.now();
    // Reset a finished/failed word so the worker's state machine can run again.
    if (doc.status === "rendered" || doc.status === "failed") {
      await ctx.db.patch(wordId, { status: "approved", approvedAt: now, updatedAt: now });
    }

    const jobId = await ctx.db.insert("renderJobs", {
      wordId,
      status: "queued",
      attempts: 0,
      maxAttempts,
      request: {
        content: doc.content,
        themeId,
        brandHandle,
        backgroundMusicMode: "none",
        reel: { word, audioSrc, durationSec, brandHandle, segments },
        reelVoiceStorageId: voiceStorageId,
      },
      renderVersion,
      createdAt: now,
      updatedAt: now,
    });
    await logEvent(ctx, {
      wordId,
      type: "reel.enqueued",
      message: `Enqueued premium reel v${renderVersion} (${segments.length} beats, ${durationSec.toFixed(1)}s)`,
    });
    return { jobId, renderVersion, dayIndex: Math.floor(now / DAY_MS) };
  },
});

/**
 * Reel build failed (LLM/ElevenLabs error): log it and fall back to the classic
 * WordVideo renderer so the run still produces a video instead of stranding the
 * word in "approved" with no render job.
 */
export const fallbackToClassic = internalMutation({
  args: { wordId: v.id("words"), error: v.string() },
  handler: async (ctx, { wordId, error }) => {
    const word = await ctx.db.get(wordId);
    if (!word || !word.content) return;
    await logEvent(ctx, {
      wordId,
      type: "reel.failed",
      message: `Reel build failed, falling back to classic render: ${error}`,
      level: "warn",
    });
    // Avoid double-enqueue if a reel job somehow already exists.
    const existing = await ctx.db
      .query("renderJobs")
      .withIndex("by_wordId", (q) => q.eq("wordId", wordId))
      .collect();
    if (existing.some((j) => j.status === "queued" || j.status === "claimed" || j.status === "rendering")) {
      return;
    }
    await enqueueRenderForWord(ctx, wordId);
  },
});
