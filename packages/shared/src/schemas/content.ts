import { z } from "zod";

/** Normalized dictionary lookup result — the source of truth for content generation. */
export const dictionaryDefinitionSchema = z.object({
  partOfSpeech: z.string(),
  definition: z.string(),
  example: z.string().optional(),
  synonyms: z.array(z.string()).default([]),
});

export const dictionaryResultSchema = z.object({
  word: z.string(),
  phonetic: z.string().optional(),
  definitions: z.array(dictionaryDefinitionSchema).min(1),
  /** Etymology, only when the source actually provides it. */
  origin: z.string().optional(),
  source: z.enum(["dictionaryapi", "wordnik", "llm"]),
});

export type DictionaryResult = z.infer<typeof dictionaryResultSchema>;

/** Narration split into segments so the animation can sync scene-by-scene to the voice. */
export const narrationSchema = z.object({
  hook: z.string().min(1),
  word: z.string().min(1),
  meaning: z.string().min(1),
  examples: z.array(z.string().min(1)).min(1).max(3),
  outro: z.string().min(1),
});

export type Narration = z.infer<typeof narrationSchema>;

/** LLM-generated, dictionary-grounded content for one word. */
export const wordContentSchema = z.object({
  word: z.string().min(1),
  phonetic: z.string(),
  partOfSpeech: z.string().min(1),
  simpleMeaning: z.string().min(1).max(140),
  examples: z.array(z.string().min(1).max(110)).min(2).max(3),
  synonyms: z.array(z.string()).max(4),
  funFact: z.string().max(120).optional(),
  narration: narrationSchema,
  caption: z.string().min(1).max(2000),
  hashtags: z
    .array(z.string().min(1).regex(/^[^#\s]+$/, "hashtags must have no '#' or spaces"))
    .min(5)
    .max(12),
});

export type WordContent = z.infer<typeof wordContentSchema>;
