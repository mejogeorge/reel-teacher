import { VIDEO_FPS, VIDEO_HEIGHT, VIDEO_WIDTH } from "@wordcast/shared";

/**
 * Placeholder for the Remotion compositions built in M5.
 * Exported now to validate the shared -> video dependency graph.
 */
export const videoDimensions = {
  width: VIDEO_WIDTH,
  height: VIDEO_HEIGHT,
  fps: VIDEO_FPS,
} as const;
