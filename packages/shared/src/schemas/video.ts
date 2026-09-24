import { z } from "zod";
import { wordContentSchema } from "./content.js";
import { backgroundMusicModeSchema } from "./domain.js";

/** One voiced narration segment: a key matching a scene, its audio src, and duration. */
export const voiceSegmentSchema = z.object({
  key: z.string().min(1),
  src: z.string().min(1),
  durationSec: z.number().positive(),
});

export type VoiceSegment = z.infer<typeof voiceSegmentSchema>;

/** Props passed into the Remotion WordVideo composition (validated at the boundary). */
export const videoInputPropsSchema = z.object({
  content: wordContentSchema,
  themeId: z.string().min(1),
  voice: z.object({
    segments: z.array(voiceSegmentSchema).min(1),
  }),
  music: z
    .object({
      src: z.string().min(1),
      volume: z.number().min(0).max(1),
    })
    .optional(),
  brandHandle: z.string().min(1),
  /** Debug overlay drawing the platform safe-area box. */
  showSafeArea: z.boolean().optional(),
});

export type VideoInputProps = z.infer<typeof videoInputPropsSchema>;

/**
 * What the pipeline enqueues for a render. The worker turns this into full
 * VideoInputProps by generating voice (TTS) and choosing music at render time.
 */
export const renderRequestSchema = z.object({
  content: wordContentSchema,
  themeId: z.string().min(1),
  brandHandle: z.string().min(1),
  backgroundMusicMode: backgroundMusicModeSchema,
});

export type RenderRequest = z.infer<typeof renderRequestSchema>;
