import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { logEvent } from "./events";

const DAY_MS = 86400_000;

/**
 * Enqueue a render job for an approved word. Resolves theme (rotated by day),
 * brand handle and music mode from settings. Voice + music are resolved later
 * by the worker. Returns the new renderJobs id.
 */
export async function enqueueRenderForWord(
  ctx: MutationCtx,
  wordId: Id<"words">,
): Promise<Id<"renderJobs">> {
  const word = await ctx.db.get(wordId);
  if (!word) throw new Error("word not found");
  if (!word.content) throw new Error("cannot enqueue render: word has no content");

  const settings = await ctx.db
    .query("settings")
    .withIndex("by_key", (q) => q.eq("key", "global"))
    .unique();

  const themeRotation = settings?.themeRotation?.length ? settings.themeRotation : ["minimal-light"];
  const dayIndex = Math.floor(Date.now() / DAY_MS);
  const themeId = themeRotation[dayIndex % themeRotation.length] ?? "minimal-light";
  const brandHandle = settings?.brandHandle ?? "@wordcast";
  const backgroundMusicMode = settings?.backgroundMusicMode ?? "library";
  const maxAttempts = settings?.maxAttemptsPerStep ?? 3;

  const priorJobs = await ctx.db
    .query("renderJobs")
    .withIndex("by_wordId", (q) => q.eq("wordId", wordId))
    .collect();
  const renderVersion = priorJobs.length + 1;

  const now = Date.now();
  const jobId = await ctx.db.insert("renderJobs", {
    wordId,
    status: "queued",
    attempts: 0,
    maxAttempts,
    request: { content: word.content, themeId, brandHandle, backgroundMusicMode },
    renderVersion,
    createdAt: now,
    updatedAt: now,
  });
  await ctx.db.patch(wordId, { themeId, updatedAt: now });
  await logEvent(ctx, {
    wordId,
    type: "render.enqueued",
    message: `Enqueued render v${renderVersion} (theme ${themeId})`,
  });
  return jobId;
}
