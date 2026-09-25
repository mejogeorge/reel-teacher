import { v } from "convex/values";

/**
 * Convex validators mirroring the zod schemas in `@wordcast/shared`.
 * zod validates at runtime boundaries (LLM/API/worker I/O); these enforce the
 * database shape. Keep the two in sync — see packages/shared/src/schemas.
 */

export const wordStatusValidator = v.union(
  v.literal("candidate"),
  v.literal("selected"),
  v.literal("enriched"),
  v.literal("safety_passed"),
  v.literal("approved"),
  v.literal("voiced"),
  v.literal("rendering"),
  v.literal("rendered"),
  v.literal("rejected"),
  v.literal("failed"),
);

export const wordOriginValidator = v.union(
  v.literal("trending"),
  v.literal("fallback"),
  v.literal("manual"),
);

export const approvalModeValidator = v.union(v.literal("auto"), v.literal("manual"));

export const backgroundMusicModeValidator = v.union(
  v.literal("library"),
  v.literal("auto"),
  v.literal("none"),
);

export const frequencyUnitValidator = v.union(
  v.literal("day"),
  v.literal("week"),
  v.literal("month"),
);

export const renderJobStatusValidator = v.union(
  v.literal("queued"),
  v.literal("claimed"),
  v.literal("rendering"),
  v.literal("succeeded"),
  v.literal("failed"),
);

export const pipelineRunStatusValidator = v.union(
  v.literal("running"),
  v.literal("succeeded"),
  v.literal("failed"),
);

export const eventLevelValidator = v.union(
  v.literal("info"),
  v.literal("warn"),
  v.literal("error"),
);

export const assetKindValidator = v.union(
  v.literal("video"),
  v.literal("thumbnail"),
  v.literal("voice"),
);

export const dictionaryResultValidator = v.object({
  word: v.string(),
  phonetic: v.optional(v.string()),
  definitions: v.array(
    v.object({
      partOfSpeech: v.string(),
      definition: v.string(),
      example: v.optional(v.string()),
      synonyms: v.array(v.string()),
    }),
  ),
  origin: v.optional(v.string()),
  source: v.union(v.literal("dictionaryapi"), v.literal("wordnik"), v.literal("llm")),
});

export const wordContentValidator = v.object({
  word: v.string(),
  phonetic: v.string(),
  partOfSpeech: v.string(),
  simpleMeaning: v.string(),
  examples: v.array(v.string()),
  synonyms: v.array(v.string()),
  funFact: v.optional(v.string()),
  narration: v.object({
    hook: v.string(),
    word: v.string(),
    meaning: v.string(),
    examples: v.array(v.string()),
    outro: v.string(),
  }),
  caption: v.string(),
  hashtags: v.array(v.string()),
});

export const voiceSegmentValidator = v.object({
  key: v.string(),
  src: v.string(),
  durationSec: v.number(),
});

export const videoInputPropsValidator = v.object({
  content: wordContentValidator,
  themeId: v.string(),
  voice: v.object({ segments: v.array(voiceSegmentValidator) }),
  music: v.optional(v.object({ src: v.string(), volume: v.number() })),
  brandHandle: v.string(),
  showSafeArea: v.optional(v.boolean()),
});

export const safetyValidator = v.object({
  passed: v.boolean(),
  reasons: v.array(v.string()),
  model: v.string(),
});

/** What the pipeline enqueues for a render (voice + music resolved by the worker). */
export const renderRequestValidator = v.object({
  content: wordContentValidator,
  themeId: v.string(),
  brandHandle: v.string(),
  backgroundMusicMode: backgroundMusicModeValidator,
});

/** All-optional patch validator for the settings update mutation. */
export const settingsPatchValidator = v.object({
  approvalMode: v.optional(approvalModeValidator),
  autoApproveDelayMinutes: v.optional(v.number()),
  dailyRunHourUtc: v.optional(v.number()),
  dailyRunMinuteUtc: v.optional(v.number()),
  enabledSources: v.optional(v.array(v.string())),
  defaultVoice: v.optional(v.string()),
  brandHandle: v.optional(v.string()),
  themeRotation: v.optional(v.array(v.string())),
  backgroundMusicMode: v.optional(backgroundMusicModeValidator),
  maxAttemptsPerStep: v.optional(v.number()),
  pipelinePaused: v.optional(v.boolean()),
  alertWebhookUrl: v.optional(v.string()),
  autoPublish: v.optional(v.boolean()),
  publishPlatforms: v.optional(v.array(v.string())),
  frequencyCount: v.optional(v.number()),
  frequencyUnit: v.optional(frequencyUnitValidator),
});
