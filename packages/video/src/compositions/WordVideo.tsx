import type { VideoInputProps } from "@wordcast/shared";
import { AbsoluteFill, Audio, Series, useVideoConfig } from "remotion";
import { BackgroundMusic } from "../audio/BackgroundMusic";
import { resolveSrc } from "../media";
import { ProgressBar, SafeAreaOverlay } from "../scenes/layout";
import { SceneRouter } from "../scenes/scenes";
import { getTheme } from "../themes/themes";
import { buildTimeline } from "../timeline";

export const WordVideo: React.FC<VideoInputProps> = (props) => {
  const { content, themeId, music, brandHandle, showSafeArea } = props;
  const theme = getTheme(themeId);
  const { fps } = useVideoConfig();
  const scenes = buildTimeline(props, fps);

  return (
    <AbsoluteFill style={{ backgroundColor: theme.background }}>
      {scenes.length > 0 ? (
        <Series>
          {scenes.map((scene) => (
            <Series.Sequence key={scene.id} durationInFrames={scene.durationInFrames}>
              <SceneRouter
                scene={scene}
                content={content}
                theme={theme}
                brandHandle={brandHandle}
              />
              {scene.audioSrc ? <Audio src={resolveSrc(scene.audioSrc)} /> : null}
            </Series.Sequence>
          ))}
        </Series>
      ) : null}
      {music ? <BackgroundMusic src={music.src} volume={music.volume} /> : null}
      <ProgressBar theme={theme} />
      {showSafeArea ? <SafeAreaOverlay /> : null}
    </AbsoluteFill>
  );
};
