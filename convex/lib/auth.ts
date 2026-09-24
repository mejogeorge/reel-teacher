import { getAuthUserId } from "@convex-dev/auth/server";
import { constantTimeEqual, isAdminEmail } from "@wordcast/shared";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { getAdminEmails, getWorkerSecret } from "./env";

/**
 * Require an authenticated Convex Auth user whose email is in ADMIN_EMAILS.
 * Returns the normalized admin email. Throws otherwise.
 */
export async function requireAdmin(ctx: QueryCtx | MutationCtx): Promise<string> {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("Unauthenticated");
  }
  const user = await ctx.db.get(userId);
  const email = user?.email?.trim().toLowerCase();
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
