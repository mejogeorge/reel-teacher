import type { WordContent } from "./schemas/content.js";
import type { VoiceSegment } from "./schemas/video.js";

/** Estimated speaking rate for timing silent scenes (~155 wpm). */
export const WORDS_PER_SECOND = 2.6;
export const MIN_SCENE_SECONDS = 1.8;
export const MAX_SCENE_SECONDS = 7;
/** Extra seconds per scene so text is readable before it cuts. */
const SCENE_LEAD_SECONDS = 0.7;

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** Estimate how long a line should stay on screen from its word count. */
export function estimateSceneSeconds(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return clamp(words / WORDS_PER_SECOND + SCENE_LEAD_SECONDS, MIN_SCENE_SECONDS, MAX_SCENE_SECONDS);
}

/**
 * Build timing-only segments (no audio) from content, so the video can be sized
 * and rendered without TTS. Example keys align with buildTimeline (example-{i}).
 * When TTS is added later, real audio srcs + measured durations replace these.
 */
export function estimateTimingSegments(content: WordContent): VoiceSegment[] {
  const n = content.narration;
  const segments: VoiceSegment[] = [
    { key: "hook", durationSec: estimateSceneSeconds(n.hook) },
    { key: "word", durationSec: estimateSceneSeconds(n.word || content.word) },
    { key: "meaning", durationSec: estimateSceneSeconds(n.meaning) },
  ];
  content.examples.forEach((example, i) => {
    const spoken = n.examples[i] ?? example;
    segments.push({ key: `example-${i}`, durationSec: estimateSceneSeconds(spoken) });
  });
  segments.push({ key: "outro", durationSec: estimateSceneSeconds(n.outro) });
  return segments;
}
