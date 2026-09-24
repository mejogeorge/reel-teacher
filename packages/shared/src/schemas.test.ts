import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  settingsSchema,
  videoInputPropsSchema,
  wordContentSchema,
  type WordContent,
} from "./schemas/index.js";

const validContent: WordContent = {
  word: "ephemeral",
  phonetic: "/ɪˈfɛm(ə)rəl/",
  partOfSpeech: "adjective",
  simpleMeaning: "Lasting for a very short time.",
  examples: ["The mist was ephemeral.", "Fame can be ephemeral."],
  synonyms: ["fleeting"],
  narration: {
    hook: "A word you keep seeing:",
    word: "ephemeral",
    meaning: "It means lasting a very short time.",
    examples: ["The mist was ephemeral."],
    outro: "Follow for more.",
  },
  caption: "Word of the day",
  hashtags: ["english", "vocab", "wordoftheday", "learnenglish", "ielts"],
};

describe("settingsSchema", () => {
  it("accepts the defaults", () => {
    expect(settingsSchema.safeParse(DEFAULT_SETTINGS).success).toBe(true);
  });
});

describe("wordContentSchema", () => {
  it("accepts valid content", () => {
    expect(wordContentSchema.safeParse(validContent).success).toBe(true);
  });
  it("rejects fewer than 2 examples", () => {
    expect(wordContentSchema.safeParse({ ...validContent, examples: ["only one"] }).success).toBe(
      false,
    );
  });
  it("rejects hashtags containing '#'", () => {
    const bad = { ...validContent, hashtags: ["#english", "vocab", "a", "b", "c"] };
    expect(wordContentSchema.safeParse(bad).success).toBe(false);
  });
  it("rejects too few hashtags", () => {
    expect(wordContentSchema.safeParse({ ...validContent, hashtags: ["a", "b"] }).success).toBe(
      false,
    );
  });
});

describe("videoInputPropsSchema", () => {
  it("accepts props with timing-only (srcless) segments", () => {
    const result = videoInputPropsSchema.safeParse({
      content: validContent,
      themeId: "minimal-light",
      brandHandle: "@wordcast",
      voice: { segments: [{ key: "hook", durationSec: 2 }] },
    });
    expect(result.success).toBe(true);
  });
  it("rejects props without content", () => {
    const result = videoInputPropsSchema.safeParse({
      themeId: "minimal-light",
      brandHandle: "@wordcast",
      voice: { segments: [{ key: "hook", durationSec: 2 }] },
    });
    expect(result.success).toBe(false);
  });
});
