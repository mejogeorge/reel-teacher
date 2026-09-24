import { z } from "zod";
import {
  NARRATION_WORDS_MAX,
  NARRATION_WORDS_MIN,
} from "./constants.js";
import type { DictionaryResult } from "./schemas/content.js";

// --- dictionaryapi.dev response shape (lenient) ---------------------------------

const rawDefinitionSchema = z.object({
  definition: z.string(),
  example: z.string().optional(),
  synonyms: z.array(z.string()).optional(),
});

const rawMeaningSchema = z.object({
  partOfSpeech: z.string(),
  definitions: z.array(rawDefinitionSchema),
});

const rawEntrySchema = z.object({
  word: z.string(),
  phonetic: z.string().optional(),
  phonetics: z.array(z.object({ text: z.string().optional() })).optional(),
  meanings: z.array(rawMeaningSchema),
  origin: z.string().optional(),
});

const dictionaryApiResponseSchema = z.array(rawEntrySchema);

/** Normalize a dictionaryapi.dev response into a DictionaryResult, or null if unusable. */
export function normalizeDictionaryApiResponse(raw: unknown): DictionaryResult | null {
  const parsed = dictionaryApiResponseSchema.safeParse(raw);
  if (!parsed.success || parsed.data.length === 0) return null;

  const entries = parsed.data;
  const first = entries[0];
  if (!first) return null;

  const definitions: DictionaryResult["definitions"] = [];
  for (const entry of entries) {
    for (const meaning of entry.meanings) {
      for (const def of meaning.definitions) {
        definitions.push({
          partOfSpeech: meaning.partOfSpeech,
          definition: def.definition,
          example: def.example,
          synonyms: def.synonyms ?? [],
        });
      }
    }
  }
  if (definitions.length === 0) return null;

  const phonetic = first.phonetic ?? first.phonetics?.find((p) => p.text)?.text;
  const origin = entries.map((e) => e.origin).find((o): o is string => Boolean(o));

  return {
    word: first.word,
    phonetic,
    definitions,
    origin,
    source: "dictionaryapi",
  };
}

// --- Wordnik fallback shape -----------------------------------------------------

const wordnikDefinitionSchema = z.object({
  text: z.string().optional(),
  partOfSpeech: z.string().optional(),
});

/** Normalize a Wordnik definitions response into a DictionaryResult, or null. */
export function normalizeWordnikResponse(raw: unknown, word: string): DictionaryResult | null {
  const parsed = z.array(wordnikDefinitionSchema).safeParse(raw);
  if (!parsed.success) return null;

  const definitions: DictionaryResult["definitions"] = [];
  for (const d of parsed.data) {
    if (d.text) {
      definitions.push({
        partOfSpeech: d.partOfSpeech ?? "unknown",
        definition: d.text,
        synonyms: [],
      });
    }
  }
  if (definitions.length === 0) return null;

  return { word, definitions, source: "wordnik" };
}

// --- Prompt builders ------------------------------------------------------------

/**
 * Build the content-generation prompt. The dictionary result is the source of
 * truth — the model must rewrite it simply and NOT invent senses.
 */
export function buildContentPrompt(def: DictionaryResult): string {
  const defs = def.definitions
    .slice(0, 6)
    .map((d, i) => `${i + 1}. (${d.partOfSpeech}) ${d.definition}${d.example ? ` — e.g. "${d.example}"` : ""}`)
    .join("\n");

  return [
    `Create "word of the day" content for the English word: "${def.word}".`,
    def.phonetic ? `Phonetic (IPA): ${def.phonetic}` : "",
    def.origin ? `Etymology: ${def.origin}` : "",
    "",
    "Dictionary definitions (the SOURCE OF TRUTH — rewrite simply, do NOT invent new senses):",
    defs,
    "",
    "Produce JSON matching EXACTLY this shape (respond with JSON only — no prose, no code fences):",
    "{",
    `  "word": "${def.word}",`,
    `  "phonetic": "<IPA, or a simple respelling if unknown>",`,
    `  "partOfSpeech": "<primary part of speech>",`,
    `  "simpleMeaning": "<plain English, <= 140 chars>",`,
    `  "examples": ["<natural modern sentence, <= 110 chars>", "<another>"],  // 2-3 items`,
    `  "synonyms": ["<0-4 synonyms>"],`,
    `  "funFact": "<<= 120 chars; ONLY if verifiable from the etymology above, else omit>",`,
    `  "narration": {`,
    `    "hook": "<short attention grabber>",`,
    `    "word": "<the word + how to say it>",`,
    `    "meaning": "<the meaning, spoken>",`,
    `    "examples": ["<1-2 spoken example lines>"],`,
    `    "outro": "<call to action, e.g. Follow for a new word every day>"`,
    `  },`,
    `  "caption": "<social caption, <= 2000 chars>",`,
    `  "hashtags": ["<5-12 tags, NO # symbol, no spaces>"]`,
    "}",
    "",
    `The total narration (hook+word+meaning+examples+outro) should be ${NARRATION_WORDS_MIN}-${NARRATION_WORDS_MAX} words.`,
  ]
    .filter((line) => line !== "")
    .join("\n");
}

/** Build the safety-classification prompt for generated content. */
export function buildSafetyPrompt(word: string, content: string): string {
  return [
    "You are a content-safety classifier for an educational English-learning channel.",
    `Word: "${word}"`,
    "Content to check:",
    content,
    "",
    "Is this safe and appropriate for a general audience (no hate, slurs, sexual content,",
    "graphic violence, self-harm, or political flashpoints)?",
    "",
    'Respond with JSON only: {"safe": <true|false>, "reasons": ["<reason>", "..."]}',
  ].join("\n");
}

export const safetyClassificationSchema = z.object({
  safe: z.boolean(),
  reasons: z.array(z.string()).default([]),
});

export type SafetyClassification = z.infer<typeof safetyClassificationSchema>;
