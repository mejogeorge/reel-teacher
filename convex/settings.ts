import { DEFAULT_SETTINGS } from "@wordcast/shared";
import type { Doc } from "./_generated/dataModel";
import { internalMutation, mutation, query, type QueryCtx } from "./_generated/server";
import { requireAdmin } from "./lib/auth";
import { logEvent } from "./lib/events";
import { settingsPatchValidator } from "./lib/validators";

async function readGlobal(ctx: QueryCtx): Promise<Doc<"settings"> | null> {
  return ctx.db
    .query("settings")
    .withIndex("by_key", (q) => q.eq("key", "global"))
    .unique();
}

/** Idempotently create the global settings row with defaults. */
export const seed = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await readGlobal(ctx);
    if (existing) return existing._id;
    const id = await ctx.db.insert("settings", { key: "global", ...DEFAULT_SETTINGS });
    await logEvent(ctx, { type: "settings.seed", message: "Seeded default settings" });
    return id;
  },
});

/** Read the global settings (admin only). */
export const get = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return readGlobal(ctx);
  },
});

/** Patch global settings (admin only). */
export const update = mutation({
  args: { patch: settingsPatchValidator },
  handler: async (ctx, { patch }) => {
    await requireAdmin(ctx);
    const existing = await readGlobal(ctx);
    if (!existing) {
      throw new Error("Settings not seeded — run the seed mutation first");
    }
    await ctx.db.patch(existing._id, patch);
    await logEvent(ctx, {
      type: "settings.update",
      message: "Updated settings",
      data: patch,
    });
  },
});
