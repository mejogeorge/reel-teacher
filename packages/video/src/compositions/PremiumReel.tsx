import type { PremiumReelProps, ReelAnim, ReelSegment } from "@wordcast/shared";
import { useMemo } from "react";
import { AbsoluteFill, Audio, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Icon } from "../icons";
import { resolveSrc } from "../media";
import { FONTS } from "../themes/fonts";

const CREAM = "#f4ede2";
const AMBER = "#ffc06a";

/** vh→px against the 1920px-tall canvas, so sizing reads like a design spec. */
const vh = (n: number) => (n / 100) * 1920;

const CARD_MAX = vh(46);
const CARD_PAD_X = vh(4);
const CARD_INNER = CARD_MAX - 2 * CARD_PAD_X;

/** Shrink a headline so its longest word fits `width`, capped between min/max. */
function fitFont(text: string, width: number, max: number, min: number): number {
  const longest = Math.max(1, ...text.split(" ").map((w) => w.length));
  const byWidth = width / (longest * 0.6); // ~0.6·fontSize per bold glyph
  return Math.max(min, Math.min(max, byWidth));
}

/* ------------------------------------------------------------------ motion */

interface Entrance {
  opacity: number;
  transform: string;
  filter?: string;
}

/** Frame-driven entrance for a beat (no CSS @keyframes — deterministic renders). */
function entrance(anim: ReelAnim, f: number, fps: number): Entrance {
  const p = interpolate(f, [0, 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const blur = interpolate(f, [0, 14], [8, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const soft = { opacity: p, filter: `blur(${blur}px)` };
  switch (anim) {
    case "pop": {
      const s = spring({ frame: f, fps, config: { damping: 14, stiffness: 130, mass: 0.8 } });
      return { ...soft, transform: `scale(${0.9 + 0.1 * s})` };
    }
    case "rise":
      return { ...soft, transform: `translateY(${(1 - p) * 34}px)` };
    case "tilt":
      return { ...soft, transform: `rotate(${(1 - p) * -4}deg) translateY(${(1 - p) * 22}px)` };
    case "drop":
      return { ...soft, transform: `translateY(${(1 - p) * -34}px)` };
    case "whisper":
      return { opacity: p * 0.92, transform: `scale(${0.94 + 0.06 * p})`, filter: `blur(${(1 - p) * 7}px)` };
    case "fromL":
      return { ...soft, transform: `translateX(${(1 - p) * -54}px)` };
    case "fromR":
      return { ...soft, transform: `translateX(${(1 - p) * 54}px)` };
    default:
      return { ...soft, transform: "none" };
  }
}

/**
 * Word-by-word keynote reveal. The passed `style` (incl. the gradient-text
 * treatment) is applied to each word span itself — applying background-clip:text
 * on a parent while the words are transformed children clips to nothing.
 */
const Words: React.FC<{ text: string; localFrame: number; style: React.CSSProperties; stagger?: number }> = ({
  text,
  localFrame,
  style,
  stagger = 2.5,
}) => {
  const { fps } = useVideoConfig();
  const words = text.split(" ");
  return (
    <span style={{ display: "inline" }}>
      {words.map((w, i) => {
        const s = spring({ frame: localFrame - i * stagger, fps, config: { damping: 16, stiffness: 120 } });
        return (
          <span
            key={`${w}-${i}`}
            style={{
              ...style,
              display: "inline-block",
              whiteSpace: "pre",
              opacity: s,
              transform: `translateY(${(1 - s) * 22}px)`,
            }}
          >
            {w}
            {i < words.length - 1 ? " " : ""}
          </span>
        );
      })}
    </span>
  );
};

/* ------------------------------------------------------------------- chip */

const IconChip: React.FC<{ name?: string; localFrame: number }> = ({ name, localFrame }) => {
  const { fps } = useVideoConfig();
  if (!name) return null;
  const s = spring({ frame: localFrame, fps, config: { damping: 12, stiffness: 140 } });
  return (
    <div
      style={{
        width: vh(9),
        height: vh(9),
        borderRadius: "50%",
        margin: `0 auto ${vh(3)}px`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(255,192,106,0.12)",
        border: "1px solid rgba(255,192,106,0.35)",
        boxShadow: "0 0 60px rgba(255,192,106,0.18)",
        opacity: s,
        transform: `scale(${0.6 + 0.4 * s})`,
      }}
    >
      <Icon name={name} size={vh(4.6)} color={AMBER} strokeWidth={1.5} />
    </div>
  );
};

/* ------------------------------------------------------------------- beat */

const Beat: React.FC<{ seg: ReelSegment; localFrame: number }> = ({ seg, localFrame }) => {
  const { fps } = useVideoConfig();
  const e = entrance(seg.anim, localFrame, fps);
  // Font size only depends on the (static) text, not the frame — compute once.
  const bigFont = useMemo(() => (seg.big ? fitFont(seg.big, CARD_INNER, vh(9), vh(4.5)) : 0), [seg.big]);
  const lineFont = useMemo(() => (seg.line ? fitFont(seg.line, CARD_INNER, vh(5.2), vh(3.4)) : 0), [seg.line]);

  let body: React.ReactNode;
  if (seg.bubble) {
    const isMom = seg.bubbleSide === "mom";
    body = (
      <div
        style={{
          display: "inline-block",
          padding: `${vh(2.2)}px ${vh(3)}px`,
          borderRadius: 30,
          fontSize: vh(4.4),
          fontWeight: 700,
          lineHeight: 1.18,
          maxWidth: "94%",
          background: isMom ? "rgba(255,157,184,0.12)" : "rgba(143,208,255,0.12)",
          border: `1px solid ${isMom ? "rgba(255,157,184,0.4)" : "rgba(143,208,255,0.4)"}`,
          color: isMom ? "#ffdbe6" : "#dcefff",
        }}
      >
        {seg.who ? (
          <span
            style={{
              display: "block",
              fontSize: vh(2),
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              opacity: 0.75,
              marginBottom: vh(1.2),
              fontWeight: 700,
            }}
          >
            {seg.who}
          </span>
        ) : null}
        {seg.bubble}
      </div>
    );
  } else {
    body = (
      <>
        {seg.lead ? (
          <div style={{ fontSize: vh(3), opacity: 0.7, marginBottom: vh(1.6), fontWeight: 500, letterSpacing: "0.01em" }}>
            {seg.lead}
          </div>
        ) : null}
        {seg.big ? (
          <Words
            text={seg.big}
            localFrame={localFrame}
            style={{
              display: "inline-block",
              fontSize: bigFont,
              lineHeight: 1.04,
              fontWeight: 900,
              letterSpacing: "-0.03em",
              overflowWrap: "break-word",
              backgroundImage: `linear-gradient(180deg, #fff6ea, ${AMBER})`,
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          />
        ) : null}
        {seg.line ? (
          <Words
            text={seg.line}
            localFrame={localFrame}
            stagger={1.6}
            style={{
              display: "inline-block",
              fontSize: lineFont,
              lineHeight: 1.16,
              fontWeight: 700,
              letterSpacing: "-0.015em",
              overflowWrap: "break-word",
            }}
          />
        ) : null}
        {seg.sub ? (
          <div style={{ fontSize: vh(2.9), opacity: 0.72, marginTop: vh(2.2), fontWeight: 500 }}>{seg.sub}</div>
        ) : null}
      </>
    );
  }

  return (
    <div
      style={{
        opacity: e.opacity,
        transform: e.transform,
        filter: e.filter,
        textAlign: "center",
        maxWidth: vh(46),
        padding: `${vh(5)}px ${vh(4)}px`,
        borderRadius: vh(3.2),
        background: "rgba(255,255,255,0.05)",
        backdropFilter: "blur(28px) saturate(1.2)",
        WebkitBackdropFilter: "blur(28px) saturate(1.2)",
        border: "1px solid rgba(255,255,255,0.10)",
        boxShadow: "0 40px 120px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08)",
        fontFamily: FONTS.inter,
        color: CREAM,
      }}
    >
      <IconChip name={seg.icon} localFrame={localFrame} />
      {body}
    </div>
  );
};

/* -------------------------------------------------------------- background */

const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 90) * 40;
  const drift2 = Math.cos(frame / 110) * 50;
  const orb = (x: number, y: number, size: number, color: string, dx: number): React.CSSProperties => ({
    position: "absolute",
    left: x + dx,
    top: y,
    width: size,
    height: size,
    borderRadius: "50%",
    background: `radial-gradient(circle at 40% 40%, ${color}, transparent 70%)`,
    filter: "blur(60px)",
  });
  return (
    <AbsoluteFill style={{ backgroundColor: "#0f0b09" }}>
      <div style={orb(120, 200, 620, "rgba(255,140,70,0.30)", drift)} />
      <div style={orb(560, 1300, 700, "rgba(120,70,180,0.22)", drift2)} />
      <div style={orb(-100, 900, 520, "rgba(255,190,110,0.16)", -drift)} />
      {/* vignette */}
      <AbsoluteFill
        style={{ background: "radial-gradient(120% 80% at 50% 40%, transparent 40%, rgba(0,0,0,0.55) 100%)" }}
      />
    </AbsoluteFill>
  );
};

/* -------------------------------------------------------------------- root */

export const PremiumReel: React.FC<PremiumReelProps> = ({ word, audioSrc, brandHandle, segments }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Precompute start frames once. Pick the LAST beat whose start has passed —
  // scan fully (no early break) so a non-monotonic start can't strand later beats.
  const starts = useMemo(() => segments.map((s) => Math.round(s.startSec * fps)), [segments, fps]);
  let active = -1;
  for (let i = 0; i < starts.length; i++) {
    const start = starts[i];
    if (start !== undefined && frame >= start) active = i;
  }
  const activeSeg = active >= 0 ? segments[active] : undefined;
  const activeStart = active >= 0 ? (starts[active] ?? 0) : 0;

  const progress = interpolate(frame, [0, durationInFrames], [0, 1], { extrapolateRight: "clamp" });
  const chipOn = spring({ frame: frame - Math.round(0.3 * fps), fps, config: { damping: 16 } });
  const breathe = 1 + Math.sin(frame / 40) * 0.004; // subtle "alive" motion

  return (
    <AbsoluteFill>
      <Background />
      <Audio src={resolveSrc(audioSrc)} />

      {/* Progress bar */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          height: 5,
          width: `${progress * 100}%`,
          backgroundImage: `linear-gradient(90deg, ${AMBER}, #ff7a59)`,
          boxShadow: `0 0 18px ${AMBER}`,
        }}
      />

      {/* Persistent word chip */}
      <div
        style={{
          position: "absolute",
          top: vh(5),
          left: "50%",
          transform: `translateX(-50%) translateY(${(1 - chipOn) * -14}px)`,
          padding: `${vh(0.9)}px ${vh(2.4)}px`,
          borderRadius: 999,
          background: "rgba(255,255,255,0.06)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(255,192,106,0.35)",
          fontFamily: FONTS.inter,
          fontSize: vh(2.3),
          letterSpacing: "0.34em",
          fontWeight: 700,
          color: AMBER,
          opacity: chipOn,
        }}
      >
        {word}
      </div>

      {/* Caption card */}
      <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ transform: `scale(${breathe})` }}>
          {activeSeg ? <Beat seg={activeSeg} localFrame={frame - activeStart} /> : null}
        </div>
      </AbsoluteFill>

      {/* Brand handle */}
      <div
        style={{
          position: "absolute",
          bottom: vh(4.5),
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: FONTS.inter,
          fontSize: vh(2.2),
          letterSpacing: "0.14em",
          color: CREAM,
          opacity: 0.5,
          fontWeight: 500,
        }}
      >
        {brandHandle}
      </div>
    </AbsoluteFill>
  );
};
