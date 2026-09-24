import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { eventLevelValidator } from "./validators";

type EventLevel = "info" | "warn" | "error";

interface LogArgs {
  wordId?: Id<"words">;
  runId?: Id<"pipelineRuns">;
  type: string;
  message: string;
  data?: unknown;
  level?: EventLevel;
}

/** Append an audit-log event. Call from inside any mutation. */
export async function logEvent(ctx: MutationCtx, args: LogArgs): Promise<void> {
  await ctx.db.insert("events", {
    wordId: args.wordId,
    runId: args.runId,
    type: args.type,
    message: args.message,
    data: args.data,
    level: args.level ?? "info",
    createdAt: Date.now(),
  });
}

/** Internal mutation wrapper so actions/workflows can log via the scheduler. */
export const log = internalMutation({
  args: {
    wordId: v.optional(v.id("words")),
    runId: v.optional(v.id("pipelineRuns")),
    type: v.string(),
    message: v.string(),
    data: v.optional(v.any()),
    level: v.optional(eventLevelValidator),
  },
  handler: async (ctx, args) => {
    await logEvent(ctx, args);
  },
});
