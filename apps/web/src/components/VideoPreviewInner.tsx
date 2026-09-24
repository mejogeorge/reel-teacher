"use client";

import { Player } from "@remotion/player";
import {
  estimateTimingSegments,
  VIDEO_FPS,
  VIDEO_HEIGHT,
  VIDEO_WIDTH,
  type VideoInputProps,
  type WordContent,
} from "@wordcast/shared";
import { buildTimeline, totalDurationInFrames } from "@wordcast/video";
import { WordVideo } from "@wordcast/video/remotion";

export function VideoPreviewInner({
  content,
  themeId,
  brandHandle,
}: {
  content: WordContent;
  themeId?: string;
  brandHandle?: string;
}) {
  const inputProps: VideoInputProps = {
    content,
    themeId: themeId ?? "minimal-light",
    brandHandle: brandHandle ?? "@wordcast",
    voice: { segments: estimateTimingSegments(content) },
  };
  const durationInFrames = totalDurationInFrames(buildTimeline(inputProps, VIDEO_FPS), VIDEO_FPS);

  return (
    <Player
      component={WordVideo}
      inputProps={inputProps}
      durationInFrames={durationInFrames}
      compositionWidth={VIDEO_WIDTH}
      compositionHeight={VIDEO_HEIGHT}
      fps={VIDEO_FPS}
      controls
      style={{ width: 270, height: 480, borderRadius: 12, overflow: "hidden" }}
    />
  );
}
