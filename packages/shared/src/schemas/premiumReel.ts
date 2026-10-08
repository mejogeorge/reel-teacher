import { z } from "zod";

/** Entrance animation for a caption segment (frame-driven in the composition). */
export const reelAnimSchema = z.enum([
  "pop",
  "rise",
  "tilt",
  "drop",
  "flat",
  "whisper",
  "fromL",
  "fromR",
]);
export type ReelAnim = z.infer<typeof reelAnimSchema>;

/**
 * One on-screen caption beat, timed to the narration. Only spoken words appear
 * on screen — ElevenLabs delivery cues (e.g. `[sarcastic]`) never leak in here.
 * `startSec` is the moment the beat becomes active (from ElevenLabs word
 * timestamps once TTS is wired; estimated for now).
 */
export const reelSegmentSchema = z.object({
  startSec: z.number().min(0),
  /** Small line above the headline (e.g. "Word of the day…"). */
  lead: z.string().optional(),
  /** Big gradient headline. */
  big: z.string().optional(),
  /** Regular body line. */
  line: z.string().optional(),
  /** Small line below (e.g. an aside). */
  sub: z.string().optional(),
  /** Dialogue bubble text + speaker label + which side it comes from. */
  who: z.string().optional(),
  bubble: z.string().optional(),
  bubbleSide: z.enum(["a", "b"]).optional(), // just picks the bubble colour
  /** Optional line-icon name (see video/src/icons) shown above the caption. */
  icon: z.string().optional(),
  anim: reelAnimSchema.default("rise"),
});
export type ReelSegment = z.infer<typeof reelSegmentSchema>;

/** Props for the premium reel composition (validated at the render boundary). */
export const premiumReelPropsSchema = z.object({
  word: z.string().min(1),
  /** Audio file: a bundled static name (e.g. "voice.mp3") or an absolute URL. */
  audioSrc: z.string().min(1),
  durationSec: z.number().positive(),
  brandHandle: z.string().min(1).default("@wordcast"),
  segments: z.array(reelSegmentSchema).min(1),
});
export type PremiumReelProps = z.infer<typeof premiumReelPropsSchema>;
