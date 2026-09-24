import { describe, expect, it } from "vitest";
import type { SourceDoc } from "./schemas/sources.js";
import {
  extractTerms,
  rankCandidates,
  scoreCandidate,
  toSlug,
  type TermExtract,
} from "./trend.js";

const docs: SourceDoc[] = [
  {
    sourceId: "a",
    title: "Tech shifts",
    summary: "Analysts praised Microsoft today. The ephemeral trend surprised many.",
    url: "https://x/1",
  },
  {
    sourceId: "b",
    title: "More on tech",
    summary: "Investors watched Microsoft again. Truly ephemeral gains, they warned.",
    url: "https://x/2",
  },
  {
    sourceId: "a",
    title: "Extra",
    summary: "The ephemeral idea returns.",
    url: "https://x/3",
  },
];

describe("extractTerms", () => {
  const terms = extractTerms(docs);
  const byTerm = new Map(terms.map((t) => [t.term, t]));

  it("aggregates docCount and distinct sources for a real word", () => {
    const e = byTerm.get("ephemeral");
    expect(e).toBeDefined();
    expect(e?.docCount).toBe(3);
    expect(new Set(e?.sourceIds)).toEqual(new Set(["a", "b"]));
    expect(e?.sample.length).toBeGreaterThan(0);
  });

  it("drops likely proper nouns (capitalized mid-sentence)", () => {
    expect(byTerm.has("microsoft")).toBe(false);
  });

  it("drops stop-words and short tokens", () => {
    for (const junk of ["the", "they", "again", "on", "to"]) {
      expect(byTerm.has(junk)).toBe(false);
    }
  });

  it("respects a blocklist", () => {
    const filtered = extractTerms(docs, { blocklist: new Set(["ephemeral"]) });
    expect(filtered.some((t) => t.term === "ephemeral")).toBe(false);
  });
});

describe("scoreCandidate", () => {
  const base: TermExtract = { term: "x", docCount: 5, sourceIds: ["a", "b"], sample: "" };

  it("penalizes words that are already common (higher 30d average)", () => {
    expect(scoreCandidate(base, 0)).toBeGreaterThan(scoreCandidate(base, 10));
  });

  it("increases with docCount when history is equal", () => {
    const more = { ...base, docCount: 8 };
    const less = { ...base, docCount: 2 };
    expect(scoreCandidate(more, 0)).toBeGreaterThan(scoreCandidate(less, 0));
  });
});

describe("rankCandidates", () => {
  const extracts: TermExtract[] = [
    { term: "spike", docCount: 3, sourceIds: ["a", "b"], sample: "" },
    { term: "steady", docCount: 3, sourceIds: ["a", "b"], sample: "" },
    { term: "rare", docCount: 1, sourceIds: ["a"], sample: "" },
  ];

  it("sorts by score descending and applies the limit", () => {
    const ranked = rankCandidates(extracts, { steady: 20 }, 2);
    expect(ranked).toHaveLength(2);
    const [first, second] = ranked;
    if (!first || !second) throw new Error("expected two ranked candidates");
    // "steady" is penalized by its high 30d average, so "spike" should outrank it.
    expect(first.term).toBe("spike");
    expect(first.score).toBeGreaterThanOrEqual(second.score);
  });
});

describe("toSlug", () => {
  it("lowercases and trims", () => {
    expect(toSlug("  Ephemeral ")).toBe("ephemeral");
  });
});
