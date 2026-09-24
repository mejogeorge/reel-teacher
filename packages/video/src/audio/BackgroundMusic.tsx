import { Audio, interpolate, useVideoConfig } from "remotion";
import { resolveSrc } from "../media";

/**
 * Background music at low volume with fade in/out. Loops to cover the full video.
 * (Base volume is already low ~0.12 so it sits under the narration.)
 */
export const BackgroundMusic: React.FC<{ src: string; volume: number }> = ({ src, volume }) => {
  const { durationInFrames, fps } = useVideoConfig();
  return (
    <Audio
      src={resolveSrc(src)}
      loop
      volume={(f) => {
        const fadeIn = interpolate(f, [0, fps], [0, volume], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const fadeOut = interpolate(f, [durationInFrames - fps, durationInFrames], [volume, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        return Math.max(0, Math.min(fadeIn, fadeOut));
      }}
    />
  );
};
