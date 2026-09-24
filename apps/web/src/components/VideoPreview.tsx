"use client";

import type { WordContent } from "@wordcast/shared";
import dynamic from "next/dynamic";

// Loaded client-side only — the composition imports Google Fonts at module load.
const Inner = dynamic(
  () => import("./VideoPreviewInner").then((m) => m.VideoPreviewInner),
  { ssr: false, loading: () => <div className="text-sm text-muted-foreground">Loading preview…</div> },
);

export function VideoPreview(props: {
  content: WordContent;
  themeId?: string;
  brandHandle?: string;
}) {
  return <Inner {...props} />;
}
