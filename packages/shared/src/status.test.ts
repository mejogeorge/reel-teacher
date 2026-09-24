import { describe, expect, it } from "vitest";
import {
  allowedNext,
  assertTransition,
  canTransition,
  IllegalTransitionError,
  isTerminal,
  TERMINAL_STATUSES,
  WORD_STATUSES,
  type WordStatus,
} from "./status.js";

describe("word status machine", () => {
  it("walks the full happy path", () => {
    const path: WordStatus[] = [
      "candidate",
      "selected",
      "enriched",
      "safety_passed",
      "approved",
      "voiced",
      "rendering",
      "rendered",
    ];
    for (let i = 0; i < path.length - 1; i++) {
      const from = path[i];
      const to = path[i + 1];
      if (!from || !to) throw new Error("bad test fixture");
      expect(canTransition(from, to)).toBe(true);
      expect(() => assertTransition(from, to)).not.toThrow();
    }
  });

  it("throws IllegalTransitionError on illegal jumps", () => {
    expect(() => assertTransition("candidate", "rendered")).toThrow(IllegalTransitionError);
    expect(() => assertTransition("rendered", "approved")).toThrow(IllegalTransitionError);
    expect(() => assertTransition("enriched", "voiced")).toThrow(IllegalTransitionError);
  });

  it("allows failing from every non-terminal state", () => {
    for (const s of WORD_STATUSES) {
      if (isTerminal(s)) continue;
      expect(canTransition(s, "failed")).toBe(true);
    }
  });

  it("allows rejection only before rendering starts", () => {
    expect(canTransition("approved", "rejected")).toBe(true);
    expect(canTransition("voiced", "rejected")).toBe(false);
    expect(canTransition("rendering", "rejected")).toBe(false);
  });

  it("has no outgoing transitions from terminal states", () => {
    for (const s of TERMINAL_STATUSES) {
      expect(allowedNext(s)).toHaveLength(0);
      expect(isTerminal(s)).toBe(true);
    }
  });
});
