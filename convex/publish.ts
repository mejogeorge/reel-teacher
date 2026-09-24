"use node";

import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { convexEnv } from "./lib/env";

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const POLL_ATTEMPTS = 30;
const POLL_INTERVAL_MS = 6000;

interface GraphResult {
  id?: string;
  status_code?: string;
  status?: string;
  permalink?: string;
  error?: { message?: string };
}

async function graphJson(url: string, init?: RequestInit): Promise<GraphResult> {
  const res = await fetch(url, init);
  const json = (await res.json()) as GraphResult;
  if (!res.ok || json.error) {
    throw new Error(json.error?.message ?? `HTTP ${res.status}`);
  }
  return json;
}

/**
 * Publish a word's rendered video to Instagram as a Reel (Meta Content Publishing
 * API): create container → poll until FINISHED → publish → record permalink.
 */
export const instagramPublish = internalAction({
  args: { wordId: v.id("words"), postTargetId: v.id("postTargets") },
  handler: async (ctx, { wordId, postTargetId }) => {
    const env = convexEnv();
    const fail = (error: string) =>
      ctx.runMutation(internal.publishData.updatePostTarget, {
        id: postTargetId,
        status: "failed",
        error,
      });

    if (!env.IG_USER_ID || !env.IG_ACCESS_TOKEN) {
      await fail("IG_USER_ID / IG_ACCESS_TOKEN not configured");
      return;
    }
    const context = await ctx.runQuery(internal.publishData.getPublishContext, { wordId });
    if (!context) {
      await fail("no rendered video / content to publish");
      return;
    }

    await ctx.runMutation(internal.publishData.updatePostTarget, {
      id: postTargetId,
      status: "publishing",
    });

    const base = `https://graph.facebook.com/${env.IG_GRAPH_VERSION}`;
    const token = env.IG_ACCESS_TOKEN;
    const igUserId = env.IG_USER_ID;

    try {
      // 1. Create the media container.
      const container = await graphJson(`${base}/${igUserId}/media`, {
        method: "POST",
        body: new URLSearchParams({
          media_type: "REELS",
          video_url: context.videoUrl,
          caption: context.caption,
          access_token: token,
        }),
      });
      const containerId = container.id;
      if (!containerId) throw new Error("no container id returned");

      // 2. Poll until Instagram finishes processing the video.
      let ready = false;
      for (let i = 0; i < POLL_ATTEMPTS; i++) {
        await sleep(POLL_INTERVAL_MS);
        const status = await graphJson(
          `${base}/${containerId}?fields=status_code,status&access_token=${token}`,
        );
        if (status.status_code === "FINISHED") {
          ready = true;
          break;
        }
        if (status.status_code === "ERROR" || status.status_code === "EXPIRED") {
          throw new Error(`container ${status.status_code}: ${status.status ?? ""}`);
        }
      }
      if (!ready) throw new Error("container processing timed out");

      // 3. Publish.
      const published = await graphJson(`${base}/${igUserId}/media_publish`, {
        method: "POST",
        body: new URLSearchParams({ creation_id: containerId, access_token: token }),
      });
      const mediaId = published.id;
      if (!mediaId) throw new Error("no media id returned");

      let permalink: string | undefined;
      try {
        const perm = await graphJson(`${base}/${mediaId}?fields=permalink&access_token=${token}`);
        permalink = perm.permalink;
      } catch {
        // permalink is best-effort
      }

      await ctx.runMutation(internal.publishData.updatePostTarget, {
        id: postTargetId,
        status: "published",
        externalId: mediaId,
        permalink,
      });
    } catch (err) {
      await fail(err instanceof Error ? err.message : String(err));
    }
  },
});
