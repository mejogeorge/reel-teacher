/** Project-wide constants shared across web, renderer, convex and video packages. */

export const APP_NAME = "WordCast";

/** Vertical video output geometry (Reels / Shorts / TikTok). */
export const VIDEO_WIDTH = 1080;
export const VIDEO_HEIGHT = 1920;
export const VIDEO_FPS = 30;

/** A word cannot be re-selected if its slug was `rendered` within this window. */
export const DEDUP_WINDOW_DAYS = 180;

/**
 * Platform safe area (px) — UI overlays from Reels/Shorts cover these regions,
 * so all important text must stay inside the remaining box.
 */
export const SAFE_AREA = {
  top: 220,
  bottom: 380,
  side: 60,
} as const;

/** Narration length target (words) — roughly 20–40s of speech. */
export const NARRATION_WORDS_MIN = 60;
export const NARRATION_WORDS_MAX = 110;

/**
 * Bump when scene motion/layout changes, so a rendered video's recipe records
 * which animation style produced it (for correlating with engagement later).
 */
export const ANIMATION_STYLE_VERSION = "v1";
