import type { WordContent } from "./schemas/content.js";

/** Instagram caption length limit. */
export const INSTAGRAM_CAPTION_MAX = 2200;
/** Instagram allows at most 30 hashtags per post. */
export const INSTAGRAM_HASHTAG_MAX = 30;

/** Build an Instagram caption from content: caption text + up to 30 '#' hashtags. */
export function buildInstagramCaption(content: WordContent): string {
  const tags = content.hashtags
    .slice(0, INSTAGRAM_HASHTAG_MAX)
    .map((h) => `#${h.replace(/^#+/, "")}`)
    .join(" ");
  const caption = `${content.caption}\n\n${tags}`.trim();
  return caption.length <= INSTAGRAM_CAPTION_MAX ? caption : caption.slice(0, INSTAGRAM_CAPTION_MAX);
}
