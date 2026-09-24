import type { WordContent } from "@wordcast/shared";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { Theme } from "../themes/themes";
import type { SceneSpec } from "../timeline";
import { SceneFrame } from "./layout";

interface SceneProps {
  content: WordContent;
  theme: Theme;
  brandHandle: string;
  scene: SceneSpec;
}

function useEnter(delayFrames = 0) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delayFrames, fps, config: { damping: 200 } });
  return s;
}

const HookScene: React.FC<SceneProps> = ({ content, theme }) => {
  const s = useEnter();
  return (
    <SceneFrame theme={theme}>
      <div
        style={{
          opacity: s,
          transform: `translateY(${interpolate(s, [0, 1], [50, 0])}px)`,
          fontFamily: theme.displayFontFamily,
          fontSize: 68,
          fontWeight: 700,
          lineHeight: 1.25,
        }}
      >
        {highlightWord(content.narration.hook, content.word, theme)}
      </div>
    </SceneFrame>
  );
};

const WordScene: React.FC<SceneProps> = ({ content, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const letters = [...content.word];
  const badge = spring({ frame: frame - letters.length * 3 - 6, fps, config: { damping: 200 } });

  return (
    <SceneFrame theme={theme}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center" }}>
        {letters.map((ch, i) => {
          const s = spring({ frame: frame - i * 3, fps, config: { damping: 12, stiffness: 120 } });
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                opacity: s,
                transform: `translateY(${interpolate(s, [0, 1], [90, 0])}px) scale(${interpolate(
                  s,
                  [0, 1],
                  [0.6, 1],
                )})`,
                fontFamily: theme.displayFontFamily,
                fontSize: 156,
                fontWeight: 800,
                color: theme.wordColor,
              }}
            >
              {ch}
            </span>
          );
        })}
      </div>
      <div
        style={{
          opacity: badge,
          marginTop: 36,
          display: "flex",
          gap: 20,
          alignItems: "center",
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        {content.phonetic ? (
          <span style={{ fontSize: 44, color: theme.muted }}>{content.phonetic}</span>
        ) : null}
        <span
          style={{
            fontSize: 36,
            fontWeight: 700,
            color: theme.accent,
            border: `3px solid ${theme.accent}`,
            borderRadius: theme.radius,
            padding: "8px 24px",
          }}
        >
          {content.partOfSpeech}
        </span>
      </div>
    </SceneFrame>
  );
};

/** Greedy word-wrap into lines of at most `maxChars` (so each line is its own block). */
function wrapLines(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (current.length === 0) current = word;
    else if (`${current} ${word}`.length <= maxChars) current = `${current} ${word}`;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

const MeaningScene: React.FC<SceneProps> = ({ content, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // All lines occupy their final slots from frame 0 (opacity 0), so revealing them
  // one by one never reflows the block — each animates in place.
  const lines = wrapLines(content.simpleMeaning, 24);
  return (
    <SceneFrame theme={theme}>
      <div style={{ fontSize: 40, color: theme.muted, marginBottom: 24 }}>meaning</div>
      <div style={{ fontSize: 60, fontWeight: 600, lineHeight: 1.3 }}>
        {lines.map((line, i) => {
          const s = spring({ frame: frame - i * 6, fps, config: { damping: 200 } });
          return (
            <div
              key={i}
              style={{ opacity: s, transform: `translateY(${interpolate(s, [0, 1], [24, 0])}px)` }}
            >
              {line}
            </div>
          );
        })}
      </div>
    </SceneFrame>
  );
};

function highlightWord(text: string, word: string, theme: Theme) {
  const trimmed = word.trim();
  if (!trimmed) return [<span key={0}>{text}</span>];
  // Escape regex metacharacters — the word comes from the LLM and may contain them.
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "ig"));
  return parts.map((part, i) =>
    part.toLowerCase() === trimmed.toLowerCase() ? (
      <span key={i} style={{ color: theme.accent, fontWeight: 800 }}>
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

const ExampleScene: React.FC<SceneProps> = ({ content, theme, scene }) => {
  const s = useEnter();
  const index = scene.exampleIndex ?? 0;
  const example = content.examples[index] ?? "";
  const fromLeft = index % 2 === 0;
  const x = interpolate(s, [0, 1], [fromLeft ? -80 : 80, 0]);
  return (
    <SceneFrame theme={theme}>
      <div style={{ fontSize: 40, color: theme.muted, marginBottom: 24 }}>example</div>
      <div
        style={{
          opacity: s,
          transform: `translateX(${x}px)`,
          fontSize: 64,
          fontWeight: 600,
          lineHeight: 1.35,
        }}
      >
        {highlightWord(example, content.word, theme)}
      </div>
    </SceneFrame>
  );
};

const SynonymsScene: React.FC<SceneProps> = ({ content, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <SceneFrame theme={theme}>
      <div style={{ fontSize: 40, color: theme.muted, marginBottom: 36 }}>similar words</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 24, justifyContent: "center" }}>
        {content.synonyms.map((syn, i) => {
          const s = spring({ frame: frame - i * 8, fps, config: { damping: 12, stiffness: 140 } });
          return (
            <span
              key={syn}
              style={{
                opacity: s,
                transform: `scale(${interpolate(s, [0, 1], [0.5, 1])})`,
                fontSize: 56,
                fontWeight: 700,
                color: theme.foreground,
                background: theme.card,
                borderRadius: theme.radius,
                padding: "16px 40px",
              }}
            >
              {syn}
            </span>
          );
        })}
      </div>
    </SceneFrame>
  );
};

const OutroScene: React.FC<SceneProps> = ({ content, theme, brandHandle }) => {
  const s = useEnter();
  return (
    <SceneFrame theme={theme}>
      <div
        style={{
          opacity: s,
          transform: `scale(${interpolate(s, [0, 1], [0.85, 1])})`,
          fontSize: 60,
          fontWeight: 600,
          lineHeight: 1.3,
          marginBottom: 40,
        }}
      >
        {content.narration.outro}
      </div>
      <div
        style={{
          fontFamily: theme.displayFontFamily,
          fontSize: 56,
          fontWeight: 800,
          color: theme.accent,
        }}
      >
        {brandHandle}
      </div>
    </SceneFrame>
  );
};

export const SceneRouter: React.FC<SceneProps> = (props) => {
  switch (props.scene.type) {
    case "hook":
      return <HookScene {...props} />;
    case "word":
      return <WordScene {...props} />;
    case "meaning":
      return <MeaningScene {...props} />;
    case "example":
      return <ExampleScene {...props} />;
    case "synonyms":
      return <SynonymsScene {...props} />;
    case "outro":
      return <OutroScene {...props} />;
    default:
      return null;
  }
};
