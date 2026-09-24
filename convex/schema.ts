import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Placeholder schema. The full data model (settings, pipelineRuns, words,
 * renderJobs, assets, events, etc.) is defined in milestone M1.
 *
 * Phase 2 note: `accounts` and `postTargets` tables (for publishing to
 * Instagram/Facebook/YouTube) will be added later; keep `assets` independent
 * of any platform so they slot in cleanly.
 */
export default defineSchema({
  settings: defineTable({
    key: v.string(),
  }).index("by_key", ["key"]),
});
