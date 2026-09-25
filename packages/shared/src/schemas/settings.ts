import { z } from "zod";
import { approvalModeSchema, backgroundMusicModeSchema, frequencyUnitSchema } from "./domain.js";

/** Global pipeline settings (single row, key "global"). */
export const settingsSchema = z.object({
  approvalMode: approvalModeSchema,
  autoApproveDelayMinutes: z.number().int().min(0),
  dailyRunHourUtc: z.number().int().min(0).max(23),
  dailyRunMinuteUtc: z.number().int().min(0).max(59),
  enabledSources: z.array(z.string()),
  defaultVoice: z.string().min(1),
  brandHandle: z.string().min(1),
  themeRotation: z.array(z.string()).min(1),
  backgroundMusicMode: backgroundMusicModeSchema,
  maxAttemptsPerStep: z.number().int().min(1),
  pipelinePaused: z.boolean(),
  alertWebhookUrl: z.string().url().optional(),
  // Auto-publish: post the reel to social platforms once it's rendered.
  autoPublish: z.boolean(),
  publishPlatforms: z.array(z.string()),
  // Posting cadence: `frequencyCount` reels per `frequencyUnit`.
  frequencyCount: z.number().int().min(1),
  frequencyUnit: frequencyUnitSchema,
});

export type Settings = z.infer<typeof settingsSchema>;

/** Minimum days between pipeline runs, derived from the cadence (e.g. 3/week ≈ 2.33). */
export function frequencyToIntervalDays(count: number, unit: Settings["frequencyUnit"]): number {
  const unitDays = unit === "week" ? 7 : unit === "month" ? 30 : 1;
  return unitDays / Math.max(1, count);
}

/** Defaults used by the settings seed mutation (fully hands-free, 06:00 IST run). */
export const DEFAULT_SETTINGS: Settings = {
  approvalMode: "auto",
  autoApproveDelayMinutes: 0,
  dailyRunHourUtc: 0,
  dailyRunMinuteUtc: 30,
  enabledSources: [],
  defaultVoice: "af_heart",
  brandHandle: "@wordcast",
  themeRotation: ["minimal-light", "bold-dark", "chalkboard"],
  backgroundMusicMode: "library",
  maxAttemptsPerStep: 3,
  pipelinePaused: false,
  autoPublish: false,
  publishPlatforms: ["instagram", "facebook"],
  frequencyCount: 1,
  frequencyUnit: "day",
};
