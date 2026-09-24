import { describe, expect, it } from "vitest";
import {
  buildContentPrompt,
  normalizeDictionaryApiResponse,
  normalizeWordnikResponse,
} from "./dictionary.js";

const dictionaryApiFixture = [
  {
    word: "ephemeral",
    phonetic: "/ɪˈfɛm(ə)rəl/",
    phonetics: [{ text: "/ɪˈfɛm(ə)rəl/" }],
    origin: "Greek ephēmeros 'lasting only a day'",
    meanings: [
      {
        partOfSpeech: "adjective",
        definitions: [
          {
            definition: "Lasting for a very short time.",
            example: "fashions are ephemeral",
            synonyms: ["transitory", "fleeting"],
          },
        ],
      },
    ],
  },
];

describe("normalizeDictionaryApiResponse", () => {
  it("normalizes a well-formed response", () => {
    const result = normalizeDictionaryApiResponse(dictionaryApiFixture);
    expect(result).not.toBeNull();
    expect(result?.word).toBe("ephemeral");
    expect(result?.phonetic).toBe("/ɪˈfɛm(ə)rəl/");
    expect(result?.origin).toContain("Greek");
    expect(result?.source).toBe("dictionaryapi");
    expect(result?.definitions[0]?.definition).toBe("Lasting for a very short time.");
    expect(result?.definitions[0]?.synonyms).toEqual(["transitory", "fleeting"]);
  });

  it("returns null for the 'No Definitions Found' error object", () => {
    expect(normalizeDictionaryApiResponse({ title: "No Definitions Found" })).toBeNull();
    expect(normalizeDictionaryApiResponse([])).toBeNull();
  });
});

describe("normalizeWordnikResponse", () => {
  it("normalizes definitions and skips empty ones", () => {
    const result = normalizeWordnikResponse(
      [
        { text: "Lasting a very short time.", partOfSpeech: "adjective" },
        { partOfSpeech: "noun" },
      ],
      "ephemeral",
    );
    expect(result?.definitions).toHaveLength(1);
    expect(result?.source).toBe("wordnik");
  });

  it("returns null when there are no usable definitions", () => {
    expect(normalizeWordnikResponse([{ partOfSpeech: "noun" }], "x")).toBeNull();
  });
});

describe("buildContentPrompt", () => {
  it("includes the word, source-of-truth guidance and JSON shape", () => {
    const def = normalizeDictionaryApiResponse(dictionaryApiFixture);
    if (!def) throw new Error("fixture should normalize");
    const prompt = buildContentPrompt(def);
    expect(prompt).toContain("ephemeral");
    expect(prompt).toContain("SOURCE OF TRUTH");
    expect(prompt).toContain("simpleMeaning");
    expect(prompt).toContain("hashtags");
  });
});
