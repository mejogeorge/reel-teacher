import type { VideoInputProps } from "@wordcast/shared";
import { describe, expect, it } from "vitest";
import { buildTimeline, END_PADDING_SECONDS, totalDurationInFrames } from "./timeline";

const FPS = 30;

function props(overrides?: Partial<VideoInputProps["content"]>): VideoInputProps {
  return {
    themeId: "minimal-light",
    brandHandle: "@wordcast",
    content: {
      word: "ephemeral",
      phonetic: "/ɪˈfɛm(ə)rəl/",
      partOfSpeech: "adjective",
      simpleMeaning: "Lasting for a very short time.",
      examples: ["The mist was ephemeral.", "Fame can be ephemeral."],
      synonyms: ["fleeting", "transient"],
      narration: {
        hook: "Here's a word you keep seeing:",
        word: "ephemeral",
        meaning: "It means lasting a very short time.",
        examples: ["The mist was ephemeral."],
        outro: "Follow for a new word every day.",
      },
      caption: "Word of the day: ephemeral",
      hashtags: ["english", "vocabulary", "wordoftheday", "learnenglish", "ielts"],
      ...overrides,
    },
    voice: {
      segments: [
        { key: "hook", src: "silence.wav", durationSec: 2 },
        { key: "word", src: "silence.wav", durationSec: 3 },
        { key: "meaning", src: "silence.wav", durationSec: 4 },
        { key: "example-0", src: "silence.wav", durationSec: 3 },
        { key: "example-1", src: "silence.wav", durationSec: 3 },
        { key: "outro", src: "silence.wav", durationSec: 3 },
      ],
    },
  };
}

describe("buildTimeline", () => {
  it("orders scenes and maps segment durations to frames", () => {
    const scenes = buildTimeline(props(), FPS);
    expect(scenes.map((s) => s.type)).toEqual([
      "hook",
      "word",
      "meaning",
      "example",
      "example",
      "synonyms",
      "outro",
    ]);
    expect(scenes[0]?.durationInFrames).toBe(60); // 2s * 30fps
    expect(scenes[1]?.durationInFrames).toBe(90); // 3s * 30fps
  });

  it("skips the synonyms scene when there are no synonyms", () => {
    const scenes = buildTimeline(props({ synonyms: [] }), FPS);
    expect(scenes.some((s) => s.type === "synonyms")).toBe(false);
  });

  it("computes total duration as scene frames plus padding", () => {
    const scenes = buildTimeline(props(), FPS);
    const body = scenes.reduce((a, s) => a + s.durationInFrames, 0);
    expect(totalDurationInFrames(scenes, FPS)).toBe(body + Math.round(END_PADDING_SECONDS * FPS));
  });
});
