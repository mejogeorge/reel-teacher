import { constantTimeEqual, isAdminEmail } from "@wordcast/shared";
import type { ActionCtx, MutationCtx, QueryCtx } from "../_generated/server";
import { getAdminEmails, getWorkerSecret } from "./env";

type AnyCtx = QueryCtx | MutationCtx | ActionCtx;

/**
 * Require an authenticated Clerk user whose email is in ADMIN_EMAILS.
 * Returns the normalized admin email. Throws otherwise.
 */
export async function requireAdmin(ctx: AnyCtx): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthenticated");
  }
  const email = identity.email?.trim().toLowerCase();
  if (!email || !isAdminEmail(email, getAdminEmails())) {
    throw new Error("Forbidden: not an admin");
  }
  return email;
}

/**
 * Require a valid worker secret (constant-time compare against WORKER_SECRET).
 * Used by the small set of functions the renderer worker is allowed to call.
 */
export function requireWorker(secret: string): void {
  if (!constantTimeEqual(secret, getWorkerSecret())) {
    throw new Error("Forbidden: invalid worker secret");
  }
}
