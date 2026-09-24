import { assertTransition, isTerminal, type WordStatus } from "@wordcast/shared";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, internalQuery } from "./_generated/server";
import { logEvent } from "./lib/events";
import {
  dictionaryResultValidator,
  safetyValidator,
  wordContentValidator,
} from "./lib/validators";

export const getWord = internalQuery({
  args: { wordId: v.id("words") },
  handler: async (ctx, { wordId }) => ctx.db.get(wordId),
});

export const setDefinition = internalMutation({
  args: { wordId: v.id("words"), definition: dictionaryResultValidator },
  handler: async (ctx, { wordId, definition }) => {
    await ctx.db.patch(wordId, { definition, updatedAt: Date.now() });
    await logEvent(ctx, {
      wordId,
      type: "enrich.definition",
      message: `Stored definition (${definition.source})`,
    });
  },
});

export const setContentEnriched = internalMutation({
  args: { wordId: v.id("words"), content: wordContentValidator },
  handler: async (ctx, { wordId, content }) => {
    const word = await ctx.db.get(wordId);
    if (!word) throw new Error("word not found");
    assertTransition(word.status as WordStatus, "enriched");
    await ctx.db.patch(wordId, { content, status: "enriched", updatedAt: Date.now() });
    await logEvent(ctx, { wordId, type: "enrich.content", message: "Generated content" });
  },
});

export const setSafetyResult = internalMutation({
  args: { wordId: v.id("words"), safety: safetyValidator },
  handler: async (ctx, { wordId, safety }) => {
    const word = await ctx.db.get(wordId);
    if (!word) throw new Error("word not found");
    const now = Date.now();

    if (!safety.passed) {
      assertTransition(word.status as WordStatus, "rejected");
      await ctx.db.patch(wordId, {
        safety,
        status: "rejected",
        rejectedReason: safety.reasons.join("; ") || "failed safety check",
        updatedAt: now,
      });
      await logEvent(ctx, {
        wordId,
        type: "safety.rejected",
        message: "Rejected by safety check",
        data: safety,
        level: "warn",
      });
      return;
    }

    assertTransition(word.status as WordStatus, "safety_passed");
    await ctx.db.patch(wordId, { safety, status: "safety_passed", updatedAt: now });
    await logEvent(ctx, { wordId, type: "safety.passed", message: "Passed safety check" });

    // Auto-approve after the configured delay unless in manual mode.
    const settings = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "global"))
      .unique();
    if (settings?.approvalMode === "auto") {
      const delayMs = Math.max(0, settings.autoApproveDelayMinutes) * 60_000;
      await ctx.scheduler.runAfter(delayMs, internal.enrichData.approve, { wordId });
      await logEvent(ctx, {
        wordId,
        type: "approve.scheduled",
        message: `Auto-approve scheduled in ${settings.autoApproveDelayMinutes} min`,
      });
    }
  },
});

/** Approve a word (scheduled in auto mode, or called by the admin in manual mode). */
export const approve = internalMutation({
  args: { wordId: v.id("words") },
  handler: async (ctx, { wordId }) => {
    const word = await ctx.db.get(wordId);
    if (!word) return;
    if (word.status !== "safety_passed") {
      await logEvent(ctx, {
        wordId,
        type: "approve.skipped",
        message: `Not approving; status is ${word.status}`,
        level: "info",
      });
      return;
    }
    assertTransition(word.status, "approved");
    const now = Date.now();
    await ctx.db.patch(wordId, { status: "approved", approvedAt: now, updatedAt: now });
    await logEvent(ctx, { wordId, type: "approve.done", message: "Approved" });
  },
});

/** Reject a word manually (unsafe or unwanted). */
export const reject = internalMutation({
  args: { wordId: v.id("words"), reason: v.string() },
  handler: async (ctx, { wordId, reason }) => {
    const word = await ctx.db.get(wordId);
    if (!word) throw new Error("word not found");
    assertTransition(word.status as WordStatus, "rejected");
    await ctx.db.patch(wordId, {
      status: "rejected",
      rejectedReason: reason,
      updatedAt: Date.now(),
    });
    await logEvent(ctx, { wordId, type: "reject.manual", message: reason, level: "warn" });
  },
});

/** Mark a word failed at a given step (unless already terminal). */
export const markFailed = internalMutation({
  args: { wordId: v.id("words"), step: v.string(), message: v.string() },
  handler: async (ctx, { wordId, step, message }) => {
    const word = await ctx.db.get(wordId);
    if (!word) return;
    if (isTerminal(word.status)) return;
    assertTransition(word.status, "failed");
    await ctx.db.patch(wordId, {
      status: "failed",
      error: { step, message, at: Date.now() },
      updatedAt: Date.now(),
    });
    await logEvent(ctx, { wordId, type: "step.failed", message: `${step}: ${message}`, level: "error" });
  },
});
