/**
 * Word lifecycle state machine.
 *
 * candidate → selected → enriched → safety_passed → approved → voiced → rendering → rendered
 * Any non-terminal state may fail (→ failed) or be rejected (→ rejected).
 *
 * Every transition in the app must go through {@link assertTransition} so illegal
 * transitions throw loudly instead of silently corrupting a row.
 */

export const WORD_STATUSES = [
  "candidate",
  "selected",
  "enriched",
  "safety_passed",
  "approved",
  "voiced",
  "rendering",
  "rendered",
  "rejected",
  "failed",
] as const;

export type WordStatus = (typeof WORD_STATUSES)[number];

/** States from which no further transition is allowed. */
export const TERMINAL_STATUSES = ["rendered", "rejected", "failed"] as const;

/**
 * Allowed forward transitions. `rejected` is reachable from any pre-render human/safety
 * veto point; `failed` is reachable from any non-terminal state (a step threw).
 */
const TRANSITIONS: Record<WordStatus, readonly WordStatus[]> = {
  candidate: ["selected", "rejected", "failed"],
  selected: ["enriched", "rejected", "failed"],
  enriched: ["safety_passed", "rejected", "failed"],
  safety_passed: ["approved", "rejected", "failed"],
  approved: ["voiced", "rejected", "failed"],
  voiced: ["rendering", "failed"],
  rendering: ["rendered", "failed"],
  rendered: [],
  rejected: [],
  failed: [],
};

export function isTerminal(status: WordStatus): boolean {
  return (TERMINAL_STATUSES as readonly WordStatus[]).includes(status);
}

export function canTransition(from: WordStatus, to: WordStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Illegal-transition error thrown by {@link assertTransition}. */
export class IllegalTransitionError extends Error {
  constructor(
    readonly from: WordStatus,
    readonly to: WordStatus,
  ) {
    super(`Illegal word status transition: ${from} → ${to}`);
    this.name = "IllegalTransitionError";
  }
}

/** Throws {@link IllegalTransitionError} unless `from → to` is a permitted transition. */
export function assertTransition(from: WordStatus, to: WordStatus): void {
  if (!canTransition(from, to)) {
    throw new IllegalTransitionError(from, to);
  }
}

/** The next states reachable from `status` (empty for terminal states). */
export function allowedNext(status: WordStatus): readonly WordStatus[] {
  return TRANSITIONS[status];
}
