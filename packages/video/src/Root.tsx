import { VIDEO_FPS, VIDEO_HEIGHT, VIDEO_WIDTH, videoInputPropsSchema } from "@wordcast/shared";
import { Composition } from "remotion";
import { calcWordVideoMetadata } from "./compositions/metadata";
import { WordVideo } from "./compositions/WordVideo";
import { fixtureProps } from "./fixtures/sample-props";

export const RemotionRoot: React.FC = () => (
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
);
