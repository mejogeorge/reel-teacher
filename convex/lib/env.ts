import { convexEnvSchema, parseAdminEmails, parseEnv, type ConvexEnv } from "@wordcast/shared";

/**
 * Full Convex env — validated lazily and cached. Use this from actions that need
 * Anthropic/Wordnik keys (M2/M3). Do NOT call at module top-level: Convex evaluates
 * modules at push time when env vars may be unset.
 */
let cachedEnv: ConvexEnv | undefined;
export function convexEnv(): ConvexEnv {
  if (!cachedEnv) {
    cachedEnv = parseEnv(convexEnvSchema, process.env, "convex");
  }
  return cachedEnv;
}

/** Minimal accessor for the worker shared secret (auth only — no LLM keys required). */
export function getWorkerSecret(): string {
  const secret = process.env.WORKER_SECRET;
  if (!secret) {
    throw new Error("WORKER_SECRET is not set in the Convex environment");
  }
  return secret;
}

/** Admin email allowlist from the ADMIN_EMAILS env var. */
export function getAdminEmails(): string[] {
  return parseAdminEmails(process.env.ADMIN_EMAILS);
}
