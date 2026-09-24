import { VIDEO_FPS, type VideoInputProps, type VoiceSegment } from "@wordcast/shared";

/** Fixed duration for the synonyms scene (it has no narration segment). */
export const SYNONYMS_SCENE_SECONDS = 2.2;
/** Trailing padding after the last scene so the video doesn't cut abruptly. */
export const END_PADDING_SECONDS = 0.8;

export type SceneType = "hook" | "word" | "meaning" | "example" | "synonyms" | "outro";

export interface SceneSpec {
  id: string;
  type: SceneType;
  durationInFrames: number;
  audioSrc?: string;
  exampleIndex?: number;
}

/** Narration segment keys the worker must produce (examples are numbered). */
export function exampleSegmentKey(index: number): string {
  return `example-${index}`;
}

function findSegment(segments: VoiceSegment[], key: string): VoiceSegment | undefined {
  return segments.find((s) => s.key === key);
}

function secondsToFrames(seconds: number, fps: number): number {
  return Math.max(1, Math.round(seconds * fps));
}

/**
 * Build the ordered scene timeline from content + voice segments. Each scene's
 * length is driven by its narration segment (so visuals sync to the voice); the
 * synonyms scene is a fixed length and is skipped when there are no synonyms.
 */
export function buildTimeline(props: VideoInputProps, fps: number = VIDEO_FPS): SceneSpec[] {
  const { content, voice } = props;
  const segments = voice.segments;
  const scenes: SceneSpec[] = [];

  const push = (id: string, type: SceneType, key: string, extra?: Partial<SceneSpec>) => {
    const seg = findSegment(segments, key);
    if (!seg) return;
    scenes.push({
      id,
      type,
      durationInFrames: secondsToFrames(seg.durationSec, fps),
      audioSrc: seg.src,
      ...extra,
    });
  };

  push("hook", "hook", "hook");
  push("word", "word", "word");
  push("meaning", "meaning", "meaning");
  content.examples.forEach((_, i) => {
    push(exampleSegmentKey(i), "example", exampleSegmentKey(i), { exampleIndex: i });
  });
  if (content.synonyms.length > 0) {
    scenes.push({
      id: "synonyms",
      type: "synonyms",
      durationInFrames: secondsToFrames(SYNONYMS_SCENE_SECONDS, fps),
    });
  }
  push("outro", "outro", "outro");

  return scenes;
}

/** Total composition length: sum of scene frames + trailing padding. */
export function totalDurationInFrames(scenes: SceneSpec[], fps: number = VIDEO_FPS): number {
  const body = scenes.reduce((acc, s) => acc + s.durationInFrames, 0);
  return body + secondsToFrames(END_PADDING_SECONDS, fps);
}
