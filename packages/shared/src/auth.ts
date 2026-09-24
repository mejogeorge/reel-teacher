/** Pure auth helpers shared by Convex functions and the worker. No runtime deps. */

/**
 * Constant-time string comparison — avoids leaking secret length/prefix via timing.
 * Returns false for length mismatch (after a full-length compare to keep timing flat).
 */
export function constantTimeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

/** Parse a comma-separated ADMIN_EMAILS value into a normalized lowercase list. */
export function parseAdminEmails(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);
}

/** True if `email` is present in the admin allowlist (case-insensitive). */
export function isAdminEmail(email: string | null | undefined, allowlist: string[]): boolean {
  if (!email) return false;
  return allowlist.includes(email.trim().toLowerCase());
}
