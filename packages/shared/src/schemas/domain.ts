import { z } from "zod";
import { WORD_STATUSES } from "../status.js";

export const wordStatusSchema = z.enum(WORD_STATUSES);

export const wordOriginSchema = z.enum(["trending", "fallback", "manual"]);
export type WordOrigin = z.infer<typeof wordOriginSchema>;

/** Whether words auto-approve after safety, or wait for a manual click. */
export const approvalModeSchema = z.enum(["auto", "manual"]);
export type ApprovalMode = z.infer<typeof approvalModeSchema>;

/** How background music is chosen for a render. */
export const backgroundMusicModeSchema = z.enum(["library", "auto", "none"]);
export type BackgroundMusicMode = z.infer<typeof backgroundMusicModeSchema>;

export const renderJobStatusSchema = z.enum([
  "queued",
  "claimed",
  "rendering",
  "succeeded",
  "failed",
]);
export type RenderJobStatus = z.infer<typeof renderJobStatusSchema>;

export const pipelineRunStatusSchema = z.enum(["running", "succeeded", "failed"]);
export type PipelineRunStatus = z.infer<typeof pipelineRunStatusSchema>;

export const eventLevelSchema = z.enum(["info", "warn", "error"]);
export type EventLevel = z.infer<typeof eventLevelSchema>;

export const assetKindSchema = z.enum(["video", "thumbnail", "voice"]);
export type AssetKind = z.infer<typeof assetKindSchema>;

/** Posting cadence unit. */
export const frequencyUnitSchema = z.enum(["day", "week", "month"]);
export type FrequencyUnit = z.infer<typeof frequencyUnitSchema>;
