import { z } from "zod";
import { approvalModeSchema, backgroundMusicModeSchema } from "./domain.js";

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
});

export type Settings = z.infer<typeof settingsSchema>;

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
};
