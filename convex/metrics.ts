import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { convexEnv } from "./lib/env";

const TIMEOUT_MS = 15_000;

interface GraphValue {
  value?: number;
}
interface InsightsResponse {
  data?: { name: string; values?: GraphValue[] }[];
}
interface MediaFieldsResponse {
  like_count?: number;
  comments_count?: number;
  likes?: { summary?: { total_count?: number } };
  comments?: { summary?: { total_count?: number } };
}

async function graphGet<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function insight(resp: InsightsResponse | null, name: string): number | undefined {
  return resp?.data?.find((d) => d.name === name)?.values?.[0]?.value;
}

interface Snapshot {
  likes?: number;
  comments?: number;
  shares?: number;
  views?: number;
  reach?: number;
  saved?: number;
}

async function instagramMetrics(base: string, mediaId: string, token: string): Promise<Snapshot> {
  const fields = await graphGet<MediaFieldsResponse>(
    `${base}/${mediaId}?fields=like_count,comments_count&access_token=${token}`,
  );
  const ins = await graphGet<InsightsResponse>(
    `${base}/${mediaId}/insights?metric=reach,saved,shares,views&access_token=${token}`,
  );
  return {
    likes: fields?.like_count,
    comments: fields?.comments_count,
    reach: insight(ins, "reach"),
    saved: insight(ins, "saved"),
    shares: insight(ins, "shares"),
    views: insight(ins, "views"),
  };
}

async function facebookMetrics(base: string, videoId: string, token: string): Promise<Snapshot> {
  const fields = await graphGet<MediaFieldsResponse>(
    `${base}/${videoId}?fields=likes.summary(true).limit(0),comments.summary(true).limit(0)&access_token=${token}`,
  );
  const ins = await graphGet<InsightsResponse>(
    `${base}/${videoId}/video_insights?metric=total_video_views&access_token=${token}`,
  );
  return {
    likes: fields?.likes?.summary?.total_count,
    comments: fields?.comments?.summary?.total_count,
    views: insight(ins, "total_video_views"),
  };
}

/** Refresh engagement metrics for every published post (IG + FB). Best-effort. */
export const refreshAll = internalAction({
  args: {},
  handler: async (ctx): Promise<{ updated: number; skipped: number }> => {
    const env = convexEnv();
    const base = `https://graph.facebook.com/${env.IG_GRAPH_VERSION}`;
    const targets = await ctx.runQuery(internal.metricsData.listPublishedTargets, {});

    let updated = 0;
    let skipped = 0;
    for (const t of targets) {
      let snap: Snapshot | null = null;
      if (t.platform === "instagram" && env.IG_ACCESS_TOKEN) {
        snap = await instagramMetrics(base, t.externalId, env.IG_ACCESS_TOKEN);
      } else if (t.platform === "facebook" && env.FB_ACCESS_TOKEN) {
        snap = await facebookMetrics(base, t.externalId, env.FB_ACCESS_TOKEN);
      }
      if (!snap) {
        skipped += 1;
        continue;
      }
      await ctx.runMutation(internal.metricsData.upsertMetric, {
        wordId: t.wordId,
        postTargetId: t.postTargetId,
        platform: t.platform,
        externalId: t.externalId,
        ...snap,
      });
      updated += 1;
    }
    return { updated, skipped };
  },
});
