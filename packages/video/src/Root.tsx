import {
  premiumReelPropsSchema,
  VIDEO_FPS,
  VIDEO_HEIGHT,
  VIDEO_WIDTH,
  videoInputPropsSchema,
} from "@wordcast/shared";
import { Composition } from "remotion";
import { calcWordVideoMetadata } from "./compositions/metadata";
import { PremiumReel } from "./compositions/PremiumReel";
import { WordVideo } from "./compositions/WordVideo";
import { reelSampleProps } from "./fixtures/reel-sample";
import { fixtureProps } from "./fixtures/sample-props";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="WordVideo"
      component={WordVideo}
      schema={videoInputPropsSchema}
      defaultProps={fixtureProps}
      width={VIDEO_WIDTH}
      height={VIDEO_HEIGHT}
      fps={VIDEO_FPS}
      durationInFrames={300}
      calculateMetadata={calcWordVideoMetadata}
    />
    <Composition
      id="PremiumReel"
      component={PremiumReel}
      schema={premiumReelPropsSchema}
      defaultProps={reelSampleProps}
      width={VIDEO_WIDTH}
      height={VIDEO_HEIGHT}
      fps={VIDEO_FPS}
      durationInFrames={Math.round(reelSampleProps.durationSec * VIDEO_FPS)}
      calculateMetadata={({ props }) => ({
        durationInFrames: Math.round(props.durationSec * VIDEO_FPS) + VIDEO_FPS, // + 1s tail
      })}
    />
  </>
);
