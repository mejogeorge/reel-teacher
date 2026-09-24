import naughtyWords from "naughty-words";
import { internalMutation } from "./_generated/server";
import { FALLBACK_WORDS } from "./lib/fallbackSeed";
import { logEvent } from "./lib/events";

/** English profanity/slur list from the maintained `naughty-words` package. */
function englishBlocklist(): string[] {
  return (naughtyWords.en ?? []).map((w) => w.toLowerCase());
}

export const seedBlocklist = internalMutation({
  args: {},
  handler: async (ctx) => {
    let added = 0;
    for (const term of englishBlocklist()) {
      const existing = await ctx.db
        .query("blocklist")
        .withIndex("by_term", (q) => q.eq("term", term))
        .unique();
      if (!existing) {
        await ctx.db.insert("blocklist", { term, reason: "profanity/slur (naughty-words)" });
        added += 1;
      }
    }
    await logEvent(ctx, {
      type: "seed.blocklist",
      message: `Seeded blocklist (+${added})`,
      data: { added },
    });
    return { added };
  },
});

export const seedFallbackWords = internalMutation({
  args: {},
  handler: async (ctx) => {
    let added = 0;
    for (const word of FALLBACK_WORDS) {
      const existing = await ctx.db
        .query("fallbackWords")
        .filter((q) => q.eq(q.field("word"), word))
        .first();
      if (!existing) {
        await ctx.db.insert("fallbackWords", { word });
        added += 1;
      }
    }
    await logEvent(ctx, {
      type: "seed.fallbackWords",
      message: `Seeded fallback words (+${added})`,
      data: { added },
    });
    return { added };
  },
});
