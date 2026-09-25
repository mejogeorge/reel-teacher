import { ANIMATION_STYLE_VERSION, assertTransition, isTerminal, type WordStatus } from "@wordcast/shared";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { requireWorker } from "./lib/auth";
import { logEvent } from "./lib/events";

const LEASE_MS = 10 * 60_000;

/** Claim the next queued render job (worker-authed). Returns null if none. */
export const claimNextJob = mutation({
  args: { secret: v.string(), workerId: v.string() },
  handler: async (ctx, { secret, workerId }) => {
    requireWorker(secret);
    const job = await ctx.db
      .query("renderJobs")
      .withIndex("by_status", (q) => q.eq("status", "queued"))
      .first();
    if (!job) return null;

    const now = Date.now();
    await ctx.db.patch(job._id, {
      status: "claimed",
      claimedBy: workerId,
      leaseExpiresAt: now + LEASE_MS,
      updatedAt: now,
    });
    return {
      jobId: job._id,
      wordId: job.wordId,
      renderVersion: job.renderVersion,
      request: job.request,
    };
  },
});

/** Internal: signed URLs for a word's assets (used for CLI verification/debug). */
export const assetUrls = internalQuery({
  args: { wordId: v.id("words") },
  handler: async (ctx, { wordId }) => {
    const rows = await ctx.db
      .query("assets")
      .withIndex("by_wordId", (q) => q.eq("wordId", wordId))
      .collect();
    return Promise.all(rows.map(async (a) => ({ kind: a.kind, url: await ctx.storage.getUrl(a.storageId) })));
  },
});

/** Worker-authed: URL of an active background-music track (or null). */
export const getActiveMusic = query({
  args: { secret: v.string() },
  handler: async (ctx, { secret }) => {
    requireWorker(secret);
    const tracks = await ctx.db
      .query("musicTracks")
      .withIndex("by_active", (q) => q.eq("active", true))
      .collect();
    if (tracks.length === 0) return null;
    // Deterministic pick by day so a given day's video is consistent on retry.
    const idx = Math.floor(Date.now() / 86400_000) % tracks.length;
    const track = tracks[idx];
    if (!track) return null;
    const url = await ctx.storage.getUrl(track.storageId);
    return url ? { url, title: track.title } : null;
  },
});

/** Extend the lease on a claimed/rendering job (heartbeat). */
export const heartbeat = mutation({
  args: { secret: v.string(), jobId: v.id("renderJobs"), workerId: v.string() },
  handler: async (ctx, { secret, jobId, workerId }) => {
    requireWorker(secret);
    const job = await ctx.db.get(jobId);
    if (!job || job.claimedBy !== workerId) return;
    await ctx.db.patch(jobId, { leaseExpiresAt: Date.now() + LEASE_MS, updatedAt: Date.now() });
  },
});

/** Transition job + word into the rendering state. */
export const startRender = mutation({
  args: { secret: v.string(), jobId: v.id("renderJobs") },
  handler: async (ctx, { secret, jobId }) => {
    requireWorker(secret);
    const job = await ctx.db.get(jobId);
    if (!job) throw new Error("job not found");
    const now = Date.now();
    await ctx.db.patch(jobId, { status: "rendering", updatedAt: now });

    const word = await ctx.db.get(job.wordId);
    if (word && word.status === "approved") {
      assertTransition(word.status, "voiced");
      await ctx.db.patch(job.wordId, { status: "voiced", updatedAt: now });
    }
    const voiced = await ctx.db.get(job.wordId);
    if (voiced && voiced.status === "voiced") {
      assertTransition(voiced.status, "rendering");
      await ctx.db.patch(job.wordId, { status: "rendering", updatedAt: now });
    }
  },
});

/** Worker-authed upload URL for pushing rendered files into Convex storage. */
export const generateUploadUrl = mutation({
  args: { secret: v.string() },
  handler: async (ctx, { secret }) => {
    requireWorker(secret);
    return ctx.storage.generateUploadUrl();
  },
});

/** Mark a job complete: store assets and move the word to `rendered`. */
export const completeJob = mutation({
  args: {
    secret: v.string(),
    jobId: v.id("renderJobs"),
    videoStorageId: v.id("_storage"),
    thumbStorageId: v.id("_storage"),
    thumbWideStorageId: v.optional(v.id("_storage")),
    durationSec: v.number(),
    bytes: v.number(),
    width: v.number(),
    height: v.number(),
  },
  handler: async (ctx, args) => {
    requireWorker(args.secret);
    const job = await ctx.db.get(args.jobId);
    if (!job) throw new Error("job not found");
    const now = Date.now();
    const themeId = job.request.themeId;

    await ctx.db.insert("assets", {
      wordId: job.wordId,
      kind: "video",
      storageId: args.videoStorageId,
      durationSec: args.durationSec,
      width: args.width,
      height: args.height,
      bytes: args.bytes,
      themeId,
      renderVersion: job.renderVersion,
    });
    await ctx.db.insert("assets", {
      wordId: job.wordId,
      kind: "thumbnail",
      storageId: args.thumbStorageId,
      width: args.width,
      height: args.height,
      bytes: 0,
      themeId,
      renderVersion: job.renderVersion,
    });
    if (args.thumbWideStorageId) {
      await ctx.db.insert("assets", {
        wordId: job.wordId,
        kind: "thumbnail",
        storageId: args.thumbWideStorageId,
        width: 1280,
        height: 720,
        bytes: 0,
        themeId,
        renderVersion: job.renderVersion,
      });
    }

    await ctx.db.patch(args.jobId, { status: "succeeded", updatedAt: now });

    const word = await ctx.db.get(job.wordId);
    if (word && word.status === "rendering") {
      assertTransition(word.status, "rendered");
      await ctx.db.patch(job.wordId, { status: "rendered", updatedAt: now });
    }

    // Snapshot the recipe that produced this video (Phase-2 engagement analytics
    // will correlate metrics against these).
    await ctx.db.insert("videoRecipes", {
      wordId: job.wordId,
      renderVersion: job.renderVersion,
      word: word?.word ?? job.request.content.word,
      slug: word?.slug ?? "",
      themeId,
      brandHandle: job.request.brandHandle,
      backgroundMusicMode: job.request.backgroundMusicMode,
      animationStyleVersion: ANIMATION_STYLE_VERSION,
      durationSec: args.durationSec,
      content: job.request.content,
      createdAt: now,
    });

    // Auto-publish once (first render only) if enabled in settings.
    const settings = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "global"))
      .unique();
    if (settings?.autoPublish) {
      const existing = await ctx.db
        .query("postTargets")
        .withIndex("by_wordId", (q) => q.eq("wordId", job.wordId))
        .first();
      if (!existing) {
        const platforms =
          settings.publishPlatforms && settings.publishPlatforms.length > 0
            ? settings.publishPlatforms
            : ["instagram", "facebook"];
        for (const platform of platforms) {
          const ptId = await ctx.db.insert("postTargets", {
            wordId: job.wordId,
            platform,
            status: "pending",
            renderVersion: job.renderVersion,
            createdAt: now,
            updatedAt: now,
          });
          if (platform === "instagram") {
            await ctx.scheduler.runAfter(0, internal.publish.instagramPublish, {
              wordId: job.wordId,
              postTargetId: ptId,
            });
          } else if (platform === "facebook") {
            await ctx.scheduler.runAfter(0, internal.publish.facebookPublish, {
              wordId: job.wordId,
              postTargetId: ptId,
            });
          }
        }
        await logEvent(ctx, {
          wordId: job.wordId,
          type: "publish.auto",
          message: `Auto-publish queued: ${platforms.join(", ")}`,
        });
      }
    }

    await logEvent(ctx, {
      wordId: job.wordId,
      type: "render.complete",
      message: `Rendered video (${args.durationSec.toFixed(1)}s, ${Math.round(args.bytes / 1024)}KB)`,
    });
  },
});

/** Report a failed render: retry (requeue) or dead-letter after maxAttempts. */
export const failJob = mutation({
  args: { secret: v.string(), jobId: v.id("renderJobs"), error: v.string() },
  handler: async (ctx, { secret, jobId, error }) => {
    requireWorker(secret);
    const job = await ctx.db.get(jobId);
    if (!job) return;
    const now = Date.now();
    const attempts = job.attempts + 1;

    if (attempts >= job.maxAttempts) {
      await ctx.db.patch(jobId, { status: "failed", attempts, error, updatedAt: now });
      const word = await ctx.db.get(job.wordId);
      if (word && !isTerminal(word.status as WordStatus)) {
        assertTransition(word.status as WordStatus, "failed");
        await ctx.db.patch(job.wordId, {
          status: "failed",
          error: { step: "render", message: error, at: now },
          updatedAt: now,
        });
      }
      await logEvent(ctx, {
        wordId: job.wordId,
        type: "render.failed",
        message: `Render failed after ${attempts} attempts: ${error}`,
        level: "error",
      });
    } else {
      await ctx.db.patch(jobId, {
        status: "queued",
        attempts,
        claimedBy: undefined,
        leaseExpiresAt: undefined,
        error,
        updatedAt: now,
      });
      await logEvent(ctx, {
        wordId: job.wordId,
        type: "render.retry",
        message: `Render attempt ${attempts} failed, requeued: ${error}`,
        level: "warn",
      });
    }
  },
});

/** Cron: requeue jobs whose lease expired (worker died mid-render), or dead-letter them. */
export const requeueExpiredJobs = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const claimed = await ctx.db
      .query("renderJobs")
      .withIndex("by_status", (q) => q.eq("status", "claimed"))
      .collect();
    const rendering = await ctx.db
      .query("renderJobs")
      .withIndex("by_status", (q) => q.eq("status", "rendering"))
      .collect();

    for (const job of [...claimed, ...rendering]) {
      if ((job.leaseExpiresAt ?? 0) >= now) continue;
      const attempts = job.attempts + 1;
      if (attempts >= job.maxAttempts) {
        await ctx.db.patch(job._id, {
          status: "failed",
          attempts,
          error: "lease expired",
          updatedAt: now,
        });
        const word = await ctx.db.get(job.wordId);
        if (word && !isTerminal(word.status as WordStatus)) {
          assertTransition(word.status as WordStatus, "failed");
          await ctx.db.patch(job.wordId, {
            status: "failed",
            error: { step: "render", message: "lease expired", at: now },
            updatedAt: now,
          });
        }
        await logEvent(ctx, {
          wordId: job.wordId,
          type: "render.lease_expired",
          message: `Job dead-lettered after ${attempts} attempts (lease expired)`,
          level: "error",
        });
      } else {
        await ctx.db.patch(job._id, {
          status: "queued",
          attempts,
          claimedBy: undefined,
          leaseExpiresAt: undefined,
          updatedAt: now,
        });
        await logEvent(ctx, {
          wordId: job.wordId,
          type: "render.requeued",
          message: `Lease expired, requeued (attempt ${attempts})`,
          level: "warn",
        });
      }
    }
  },
});
