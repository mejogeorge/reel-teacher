import type { SourceDoc } from "./schemas/sources.js";
import { STOPWORDS } from "./stopwords.js";

/** Keep alphabetic tokens in this length band (uncommon-but-real words). */
export const MIN_TERM_LENGTH = 4;
export const MAX_TERM_LENGTH = 20;

/** A term whose mid-sentence occurrences are capitalized above this ratio is a likely proper noun. */
export const PROPER_NOUN_CAP_RATIO = 0.5;

/** Per-term aggregation across today's documents. */
export interface TermExtract {
  term: string;
  /** Distinct documents the term appeared in. */
  docCount: number;
  /** Distinct source feeds the term appeared in. */
  sourceIds: string[];
  /** A short context snippet (the first sentence the term appeared in). */
  sample: string;
}

export interface ScoredCandidate extends TermExtract {
  score: number;
}

/** Split text into rough sentences (for proper-noun / sentence-start detection). */
export function splitSentences(text: string): string[] {
  return text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1)}…`;
}

interface MutableStat {
  docCount: number;
  sourceIds: Set<string>;
  total: number;
  midSentenceCap: number;
  sample: string;
}

/**
 * Extract and aggregate candidate terms from a set of documents.
 * Drops stop-words, out-of-band lengths, blocklisted terms, and likely proper nouns.
 */
export function extractTerms(
  docs: SourceDoc[],
  opts?: { blocklist?: ReadonlySet<string> },
): TermExtract[] {
  const blocklist = opts?.blocklist ?? new Set<string>();
  const stats = new Map<string, MutableStat>();

  for (const doc of docs) {
    const text = `${doc.title}. ${doc.summary}`;
    const seenInDoc = new Set<string>();

    for (const sentence of splitSentences(text)) {
      const surfaces = sentence.match(/[A-Za-z]+/g) ?? [];
      surfaces.forEach((surface, wordIndex) => {
        if (surface.length < MIN_TERM_LENGTH || surface.length > MAX_TERM_LENGTH) return;

        // Key on the lowercased surface form — real words, not stems. Grouping
        // inflections is left to the LLM pick step (which sees real candidates).
        const term = surface.toLowerCase();
        if (STOPWORDS.has(term) || blocklist.has(term)) return;

        const firstChar = surface.charAt(0);
        const isCapitalized = firstChar !== firstChar.toLowerCase();
        const isMidSentence = wordIndex > 0;

        let stat = stats.get(term);
        if (!stat) {
          stat = { docCount: 0, sourceIds: new Set(), total: 0, midSentenceCap: 0, sample: "" };
          stats.set(term, stat);
        }
        stat.total += 1;
        if (isCapitalized && isMidSentence) stat.midSentenceCap += 1;
        stat.sourceIds.add(doc.sourceId);
        if (!stat.sample) stat.sample = truncate(sentence, 160);
        if (!seenInDoc.has(term)) {
          seenInDoc.add(term);
          stat.docCount += 1;
        }
      });
    }
  }

  const out: TermExtract[] = [];
  for (const [term, stat] of stats) {
    // Drop likely proper nouns (mostly capitalized mid-sentence).
    if (stat.total >= 2 && stat.midSentenceCap / stat.total > PROPER_NOUN_CAP_RATIO) continue;
    out.push({
      term,
      docCount: stat.docCount,
      sourceIds: [...stat.sourceIds],
      sample: stat.sample,
    });
  }
  return out;
}

/**
 * Trend score = log1p(docCount) * sourceDiversity * spike, where
 * spike = (docCount + 1) / (avg30dCount + 1). With no history (avg = 0) spike
 * reduces to docCount + 1 (cold start — weak for ~30 days, then sharpens).
 */
export function scoreCandidate(extract: TermExtract, avg30dCount: number): number {
  const spike = (extract.docCount + 1) / (avg30dCount + 1);
  const sourceDiversity = Math.max(1, extract.sourceIds.length);
  return Math.log1p(extract.docCount) * sourceDiversity * spike;
}

/**
 * Score and rank extracted terms. `avgCounts` maps term → 30-day average docCount
 * (from termStats history); missing terms default to 0.
 */
export function rankCandidates(
  extracts: TermExtract[],
  avgCounts: Record<string, number> = {},
  limit = 50,
): ScoredCandidate[] {
  return extracts
    .map((e) => ({ ...e, score: scoreCandidate(e, avgCounts[e.term] ?? 0) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** Canonical slug for a word (lowercase, trimmed). Used for dedup + lookup. */
export function toSlug(word: string): string {
  return word.trim().toLowerCase();
}
