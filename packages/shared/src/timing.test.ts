import { describe, expect, it } from "vitest";
import type { WordContent } from "./schemas/content.js";
import {
  estimateSceneSeconds,
  estimateTimingSegments,
  MAX_SCENE_SECONDS,
  MIN_SCENE_SECONDS,
} from "./timing.js";

const content: WordContent = {
  word: "ephemeral",
  phonetic: "/ɪˈfɛm(ə)rəl/",
  partOfSpeech: "adjective",
  simpleMeaning: "Lasting for a very short time.",
  examples: ["The mist was ephemeral.", "Fame can be ephemeral and fleeting."],
  synonyms: ["fleeting"],
  narration: {
    hook: "Here's a word you keep seeing everywhere today:",
    word: "ephemeral",
    meaning: "It means lasting for a very short time.",
    examples: ["The mist was ephemeral."],
    outro: "Follow for a new word every day!",
  },
  caption: "Word of the day",
  hashtags: ["english", "vocab", "wordoftheday", "learnenglish", "ielts"],
};

describe("estimateSceneSeconds", () => {
  it("stays within the min/max clamps", () => {
    expect(estimateSceneSeconds("one")).toBeGreaterThanOrEqual(MIN_SCENE_SECONDS);
    expect(estimateSceneSeconds("word ".repeat(200))).toBeLessThanOrEqual(MAX_SCENE_SECONDS);
  });
  it("grows with more words", () => {
    expect(estimateSceneSeconds("a b c d e f g h")).toBeGreaterThan(estimateSceneSeconds("a b"));
  });
});

describe("estimateTimingSegments", () => {
  it("produces one segment per scene with example keys aligned to content", () => {
    const segs = estimateTimingSegments(content);
    expect(segs.map((s) => s.key)).toEqual([
      "hook",
      "word",
      "meaning",
      "example-0",
      "example-1",
      "outro",
    ]);
    expect(segs.every((s) => s.durationSec > 0 && s.src === undefined)).toBe(true);
  });
});
