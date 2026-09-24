import { VIDEO_FPS, VIDEO_HEIGHT, VIDEO_WIDTH } from "@wordcast/shared";

// Side-effect-free exports (safe to import from Node — no font loading).
export * from "./timeline";
export { fixtureProps } from "./fixtures/sample-props";

/** Remotion composition id. */
export const WORD_VIDEO_ID = "WordVideo";

export const videoDimensions = {
  width: VIDEO_WIDTH,
  height: VIDEO_HEIGHT,
  fps: VIDEO_FPS,
} as const;
