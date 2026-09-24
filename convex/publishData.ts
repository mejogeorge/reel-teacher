import { buildInstagramCaption } from "@wordcast/shared";
import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { logEvent } from "./lib/events";

const postStatus = v.union(
  v.literal("pending"),
  v.literal("publishing"),
  v.literal("published"),
  v.literal("failed"),
);

/** Video URL + built caption for the latest render of a word (null if not publishable). */
export const getPublishContext = internalQuery({
  args: { wordId: v.id("words") },
  handler: async (ctx, { wordId }) => {
    const word = await ctx.db.get(wordId);
    if (!word || !word.content) return null;
    const assets = await ctx.db
      .query("assets")
      .withIndex("by_wordId", (q) => q.eq("wordId", wordId))
      .collect();
    const video = assets
      .filter((a) => a.kind === "video")
      .sort((a, b) => b.renderVersion - a.renderVersion)[0];
    if (!video) return null;
    const videoUrl = await ctx.storage.getUrl(video.storageId);
    if (!videoUrl) return null;
    return { videoUrl, caption: buildInstagramCaption(word.content), renderVersion: video.renderVersion };
  },
});

export const updatePostTarget = internalMutation({
  args: {
    id: v.id("postTargets"),
    status: postStatus,
    externalId: v.optional(v.string()),
    permalink: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, { id, status, externalId, permalink, error }) => {
    await ctx.db.patch(id, { status, externalId, permalink, error, updatedAt: Date.now() });
    const target = await ctx.db.get(id);
    await logEvent(ctx, {
      wordId: target?.wordId,
      type: `publish.${status}`,
      message: `Instagram: ${status}${error ? ` — ${error}` : ""}${permalink ? ` (${permalink})` : ""}`,
      level: status === "failed" ? "error" : "info",
    });
  },
});
