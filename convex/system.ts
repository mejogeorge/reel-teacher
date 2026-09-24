import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireWorker } from "./lib/auth";

/**
 * Health check for the renderer worker. Verifies the worker secret and returns
 * "pong". Exercises the requireWorker guard; expanded in M6.
 */
export const workerPing = query({
  args: { secret: v.string() },
  handler: async (_ctx, { secret }) => {
    requireWorker(secret);
    return "pong" as const;
  },
});
