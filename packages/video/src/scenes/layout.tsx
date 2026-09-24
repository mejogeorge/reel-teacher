import { SAFE_AREA } from "@wordcast/shared";
import type { ReactNode } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { Theme } from "../themes/themes";

/** Content column that keeps everything inside the platform safe area. */
export const SceneFrame: React.FC<{ theme: Theme; children: ReactNode }> = ({ theme, children }) => (
  <AbsoluteFill
    style={{
      paddingTop: SAFE_AREA.top,
      paddingBottom: SAFE_AREA.bottom,
      paddingLeft: SAFE_AREA.side,
      paddingRight: SAFE_AREA.side,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      textAlign: "center",
      color: theme.foreground,
      fontFamily: theme.fontFamily,
    }}
  >
    {children}
  </AbsoluteFill>
);

/** Top progress bar spanning the whole video (driven by the global frame). */
export const ProgressBar: React.FC<{ theme: Theme }> = ({ theme }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const pct = interpolate(frame, [0, Math.max(1, durationInFrames - 1)], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        top: SAFE_AREA.top - 44,
        left: SAFE_AREA.side,
        right: SAFE_AREA.side,
        height: 8,
        borderRadius: 4,
        background: "rgba(128,128,128,0.25)",
        overflow: "hidden",
      }}
    >
      <div style={{ width: `${pct}%`, height: "100%", background: theme.progressColor }} />
    </div>
  );
};

/** Debug overlay drawing the safe-area box. */
export const SafeAreaOverlay: React.FC = () => (
  <AbsoluteFill>
    <div
      style={{
        position: "absolute",
        top: SAFE_AREA.top,
        bottom: SAFE_AREA.bottom,
        left: SAFE_AREA.side,
        right: SAFE_AREA.side,
        border: "3px dashed rgba(255,0,0,0.6)",
      }}
    />
  </AbsoluteFill>
);
