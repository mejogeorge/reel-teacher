import { z } from "zod";

/** A normalized document from a word source (one RSS item, etc.). */
export const sourceDocSchema = z.object({
  sourceId: z.string(),
  title: z.string(),
  summary: z.string(),
  url: z.string(),
  publishedAt: z.number().optional(),
});

export type SourceDoc = z.infer<typeof sourceDocSchema>;

/** Result of the batched LLM word-pick over scored candidates. */
export const pickWordResultSchema = z.object({
  /** The chosen term, or null if none of the candidates qualify (→ fallback). */
  pick: z.string().nullable(),
  reason: z.string(),
  /** 0–10 rarity/usefulness rating of the pick (higher = rarer/more worth teaching). */
  rarity: z.number().min(0).max(10).optional(),
  rejected: z.array(z.object({ term: z.string(), reason: z.string() })).default([]),
});

export type PickWordResult = z.infer<typeof pickWordResultSchema>;
