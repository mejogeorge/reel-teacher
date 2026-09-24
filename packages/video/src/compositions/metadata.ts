import { VIDEO_FPS, type VideoInputProps } from "@wordcast/shared";
import { buildTimeline, totalDurationInFrames } from "../timeline";

/** Remotion calculateMetadata: derive total duration from the voice segments. */
export function calcWordVideoMetadata({ props }: { props: VideoInputProps }) {
  const scenes = buildTimeline(props, VIDEO_FPS);
  return { durationInFrames: totalDurationInFrames(scenes, VIDEO_FPS) };
}
