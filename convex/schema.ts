import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  approvalModeValidator,
  assetKindValidator,
  backgroundMusicModeValidator,
  dictionaryResultValidator,
  eventLevelValidator,
  pipelineRunStatusValidator,
  renderJobStatusValidator,
  renderRequestValidator,
  safetyValidator,
  wordContentValidator,
  wordOriginValidator,
  wordStatusValidator,
} from "./lib/validators";

/**
 * WordCast data model (Phase 1).
 *
 * Phase 2 note: publishing tables — `accounts` and
 * `postTargets(wordId, accountId, platform, status, ...)` — will be added later.
 * `assets` is kept platform-independent so those slot in without migration.
 */
export default defineSchema({
  // Convex Auth tables (users, sessions, accounts, …).
  ...authTables,

  // Single global settings row (key: "global").
  settings: defineTable({
    key: v.string(),
    approvalMode: approvalModeValidator,
    autoApproveDelayMinutes: v.number(),
    dailyRunHourUtc: v.number(),
    dailyRunMinuteUtc: v.number(),
    enabledSources: v.array(v.string()),
    defaultVoice: v.string(),
    brandHandle: v.string(),
    themeRotation: v.array(v.string()),
    backgroundMusicMode: backgroundMusicModeValidator,
    maxAttemptsPerStep: v.number(),
    pipelinePaused: v.boolean(),
    alertWebhookUrl: v.optional(v.string()),
  }).index("by_key", ["key"]),

  // One row per daily run; idempotent by runDate (YYYY-MM-DD).
  pipelineRuns: defineTable({
    runDate: v.string(),
    status: pipelineRunStatusValidator,
    wordId: v.optional(v.id("words")),
    workflowId: v.optional(v.string()),
    error: v.optional(v.string()),
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
  }).index("by_runDate", ["runDate"]),

  // Rolling per-term counts for trend scoring.
  termStats: defineTable({
    term: v.string(),
    date: v.string(),
    docCount: v.number(),
    sourceCount: v.number(),
  }).index("by_term_date", ["term", "date"]),

  // Scored candidate terms for a run (rarity assigned by the LLM, not a frequency table).
  candidates: defineTable({
    runDate: v.string(),
    term: v.string(),
    score: v.number(),
    rarity: v.optional(v.number()),
    sampleContext: v.string(),
    sourceIds: v.array(v.string()),
  }).index("by_runDate", ["runDate"]),

  // The central pipeline entity — one row per word.
  words: defineTable({
    slug: v.string(),
    word: v.string(),
    status: wordStatusValidator,
    origin: wordOriginValidator,
    runId: v.optional(v.id("pipelineRuns")),
    definition: v.optional(dictionaryResultValidator),
    content: v.optional(wordContentValidator),
    safety: v.optional(safetyValidator),
    themeId: v.optional(v.string()),
    approvedAt: v.optional(v.number()),
    rejectedReason: v.optional(v.string()),
    error: v.optional(
      v.object({ step: v.string(), message: v.string(), at: v.number() }),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_slug", ["slug"])
    .index("by_createdAt", ["createdAt"]),

  // Render jobs claimed by the worker via lease; keyed by word + renderVersion.
  renderJobs: defineTable({
    wordId: v.id("words"),
    status: renderJobStatusValidator,
    attempts: v.number(),
    maxAttempts: v.number(),
    claimedBy: v.optional(v.string()),
    leaseExpiresAt: v.optional(v.number()),
    request: renderRequestValidator,
    renderVersion: v.number(),
    error: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_wordId", ["wordId"]),

  // One snapshot per rendered video: the "recipe" that produced it. Phase-2
  // engagement metrics (likes/shares/views) will correlate against these to bias
  // future word/theme/style choices. Kept platform-independent.
  videoRecipes: defineTable({
    wordId: v.id("words"),
    renderVersion: v.number(),
    word: v.string(),
    slug: v.string(),
    themeId: v.string(),
    brandHandle: v.string(),
    backgroundMusicMode: backgroundMusicModeValidator,
    animationStyleVersion: v.string(),
    voice: v.optional(v.string()),
    durationSec: v.number(),
    content: wordContentValidator,
    createdAt: v.number(),
  })
    .index("by_wordId", ["wordId"])
    .index("by_theme", ["themeId"]),

  // Phase 2: one row per publish attempt of a word's video to a platform.
  postTargets: defineTable({
    wordId: v.id("words"),
    platform: v.string(), // "instagram"
    status: v.union(
      v.literal("pending"),
      v.literal("publishing"),
      v.literal("published"),
      v.literal("failed"),
    ),
    renderVersion: v.number(),
    externalId: v.optional(v.string()), // platform media id
    permalink: v.optional(v.string()),
    error: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_wordId", ["wordId"])
    .index("by_status", ["status"]),

  // Produced media stored in Convex file storage; independent of any platform.
  assets: defineTable({
    wordId: v.id("words"),
    kind: assetKindValidator,
    storageId: v.id("_storage"),
    durationSec: v.optional(v.number()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    bytes: v.number(),
    themeId: v.string(),
    renderVersion: v.number(),
  }).index("by_wordId", ["wordId"]),

  // Royalty-free background music tracks (uploaded or auto-sourced).
  musicTracks: defineTable({
    title: v.string(),
    storageId: v.id("_storage"),
    durationSec: v.number(),
    source: v.string(),
    licenseUrl: v.string(),
    attributionText: v.optional(v.string()),
    active: v.boolean(),
    mood: v.optional(v.string()),
  }).index("by_active", ["active"]),

  // Curated fallback words (used least-recently when trending finds nothing).
  fallbackWords: defineTable({
    word: v.string(),
    lastUsedAt: v.optional(v.number()),
  }).index("by_used", ["lastUsedAt"]),

  // Blocked terms for safety pre-filtering.
  blocklist: defineTable({
    term: v.string(),
    reason: v.optional(v.string()),
  }).index("by_term", ["term"]),

  // Append-only audit log.
  events: defineTable({
    wordId: v.optional(v.id("words")),
    runId: v.optional(v.id("pipelineRuns")),
    type: v.string(),
    message: v.string(),
    data: v.optional(v.any()),
    level: eventLevelValidator,
    createdAt: v.number(),
  })
    .index("by_wordId", ["wordId"])
    .index("by_createdAt", ["createdAt"]),
});
