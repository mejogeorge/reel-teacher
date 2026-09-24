import type { RenderRequest } from "@wordcast/shared";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

export interface ClaimedJob {
  jobId: string;
  wordId: string;
  renderVersion: number;
  request: RenderRequest;
}

export type CompleteJobArgs = {
  secret: string;
  jobId: string;
  videoStorageId: string;
  thumbStorageId: string;
  thumbWideStorageId?: string;
  durationSec: number;
  bytes: number;
  width: number;
  height: number;
};

/**
 * Convex function references by name. Using makeFunctionReference (instead of the
 * generated api) keeps the worker buildable without `convex/_generated`; the calls
 * are verified at runtime against the linked deployment.
 */
export const refs = {
  claimNextJob: makeFunctionReference<
    "mutation",
    { secret: string; workerId: string },
    ClaimedJob | null
  >("render:claimNextJob"),
  heartbeat: makeFunctionReference<
    "mutation",
    { secret: string; jobId: string; workerId: string },
    null
  >("render:heartbeat"),
  startRender: makeFunctionReference<"mutation", { secret: string; jobId: string }, null>(
    "render:startRender",
  ),
  generateUploadUrl: makeFunctionReference<"mutation", { secret: string }, string>(
    "render:generateUploadUrl",
  ),
  completeJob: makeFunctionReference<"mutation", CompleteJobArgs, null>("render:completeJob"),
  failJob: makeFunctionReference<"mutation", { secret: string; jobId: string; error: string }, null>(
    "render:failJob",
  ),
  getActiveMusic: makeFunctionReference<
    "query",
    { secret: string },
    { url: string; title: string } | null
  >("render:getActiveMusic"),
};

export function createConvexClient(url: string): ConvexHttpClient {
  return new ConvexHttpClient(url);
}
