import { assertTransition, isTerminal, type WordStatus } from "@wordcast/shared";
import { WorkflowManager } from "@convex-dev/workflow";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { logEvent } from "./lib/events";

const RETRY = { maxAttempts: 3, initialBackoffMs: 2000, base: 2 };
const WATCHDOG_HOURS = 6;
const CATCHUP_DAYS = 2;

export const workflow = new WorkflowManager(components.workflow, {
  workpoolOptions: {
    defaultRetryBehavior: RETRY,
    retryActionsByDefault: true,
  },
});

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

// --- The durable pipeline workflow ---------------------------------------------

export const pipelineWorkflow = workflow.define({
  args: { runId: v.id("pipelineRuns"), runDate: v.string() },
  handler: async (step, { runId, runDate }): Promise<{ wordId: Id<"words"> }> => {
    await step.runAction(internal.discovery.discoverCandidates, { runDate });
    const picked = await step.runAction(internal.pick.pickWord, { runDate, runId });

    const def = await step.runAction(internal.enrich.fetchDefinition, { wordId: picked.wordId });
    if (!def.ok) throw new Error("fetchDefinition failed");

    const content = await step.runAction(internal.enrich.generateContent, {
      wordId: picked.wordId,
    });
    if (!content.ok) throw new Error("generateContent failed");

    await step.runAction(internal.enrich.safetyCheck, { wordId: picked.wordId });
    await step.runMutation(internal.pipeline.linkRunWord, { runId, wordId: picked.wordId });

    // Approval + render enqueue happen via the (auto-scheduled or manual) approve
    // mutation, so the workflow does not block on manual approval.
    return { wordId: picked.wordId };
  },
});

export const linkRunWord = internalMutation({
  args: { runId: v.id("pipelineRuns"), wordId: v.id("words") },
  handler: async (ctx, { runId, wordId }) => {
    await ctx.db.patch(runId, { wordId });
  },
});

/** Called by the workflow component when the run finishes (success/failure/cancel). */
export const onRunComplete = internalMutation({
  args: { workflowId: v.string(), result: v.any(), context: v.any() },
  handler: async (ctx, { result, context }) => {
    const runId = context?.runId as Id<"pipelineRuns"> | undefined;
    if (!runId) return;
    const now = Date.now();
    const run = await ctx.db.get(runId);

    if (result?.kind === "success") {
      await ctx.db.patch(runId, { status: "succeeded", finishedAt: now });
      await logEvent(ctx, { runId, type: "run.succeeded", message: "Pipeline run succeeded" });
      return;
    }

    const error = result?.kind === "failed" ? String(result.error) : "workflow canceled";
    await ctx.db.patch(runId, { status: "failed", error, finishedAt: now });

    // Mark the linked word failed if it isn't already terminal.
    if (run?.wordId) {
      const word = await ctx.db.get(run.wordId);
      if (word && !isTerminal(word.status as WordStatus)) {
        assertTransition(word.status as WordStatus, "failed");
        await ctx.db.patch(run.wordId, {
          status: "failed",
          error: { step: "workflow", message: error, at: now },
          updatedAt: now,
        });
      }
    }

    await logEvent(ctx, { runId, type: "run.failed", message: error, level: "error" });
    await ctx.scheduler.runAfter(0, internal.pipeline.sendAlert, {
      message: `WordCast pipeline run ${run?.runDate ?? ""} failed: ${error}`,
    });
  },
});

// --- Starting runs (idempotent) ------------------------------------------------

export const startDailyRun = internalMutation({
  args: { runDate: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const settings = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "global"))
      .unique();
    if (settings?.pipelinePaused) {
      await logEvent(ctx, {
        type: "run.paused",
        message: "Pipeline paused — skipping run",
        level: "warn",
      });
      return null;
    }

    const runDate = args.runDate ?? todayUtc();
    const existing = await ctx.db
      .query("pipelineRuns")
      .withIndex("by_runDate", (q) => q.eq("runDate", runDate))
      .first();
    // Idempotent: a non-failed run for this date already exists.
    if (existing && existing.status !== "failed") return existing._id;

    const now = Date.now();
    const runId =
      existing?._id ??
      (await ctx.db.insert("pipelineRuns", { runDate, status: "running", startedAt: now }));
    if (existing) {
      await ctx.db.patch(existing._id, { status: "running", startedAt: now, error: undefined });
    }

    const workflowId = await workflow.start(
      ctx,
      internal.pipeline.pipelineWorkflow,
      { runId, runDate },
      { onComplete: internal.pipeline.onRunComplete, context: { runId } },
    );
    await ctx.db.patch(runId, { workflowId });
    await logEvent(ctx, { runId, type: "run.started", message: `Started run ${runDate}` });
    return runId;
  },
});

// --- Scheduling / catch-up / watchdog (cron targets) ---------------------------

export const getScheduleSettings = internalQuery({
  args: {},
  handler: async (ctx) => {
    const s = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "global"))
      .unique();
    return {
      paused: s?.pipelinePaused ?? false,
      hour: s?.dailyRunHourUtc ?? 0,
      minute: s?.dailyRunMinuteUtc ?? 30,
    };
  },
});

export const getRunStatus = internalQuery({
  args: { runDate: v.string() },
  handler: async (ctx, { runDate }) => {
    const run = await ctx.db
      .query("pipelineRuns")
      .withIndex("by_runDate", (q) => q.eq("runDate", runDate))
      .first();
    return run?.status ?? null;
  },
});

/**
 * Cron tick (every 30 min): start today's run once the scheduled time passes,
 * and catch up any missed/failed runs from the last CATCHUP_DAYS days.
 */
export const tick = internalAction({
  args: {},
  handler: async (ctx) => {
    const sched = await ctx.runQuery(internal.pipeline.getScheduleSettings, {});
    if (sched.paused) return;

    const now = new Date();
    const minutesNow = now.getUTCHours() * 60 + now.getUTCMinutes();
    const scheduledMinutes = sched.hour * 60 + sched.minute;

    for (let d = 0; d <= CATCHUP_DAYS; d++) {
      const date = new Date(now.getTime() - d * 86400_000).toISOString().slice(0, 10);
      // Today: only start once the scheduled time has passed.
      if (d === 0 && minutesNow < scheduledMinutes) continue;
      const status = await ctx.runQuery(internal.pipeline.getRunStatus, { runDate: date });
      if (status === "running" || status === "succeeded") continue;
      await ctx.runMutation(internal.pipeline.startDailyRun, { runDate: date });
    }
  },
});

export const getWatchInfo = internalQuery({
  args: { runDate: v.string() },
  handler: async (ctx, { runDate }) => {
    const run = await ctx.db
      .query("pipelineRuns")
      .withIndex("by_runDate", (q) => q.eq("runDate", runDate))
      .first();
    if (!run) return null;

    const rendered = run.wordId
      ? (await ctx.db.get(run.wordId))?.status === "rendered"
      : false;
    // Dedup alerts: has a watchdog alert already been logged for this run?
    const alerts = await ctx.db
      .query("events")
      .withIndex("by_wordId")
      .filter((q) => q.eq(q.field("runId"), run._id))
      .collect();
    const alerted = alerts.some((e) => e.type === "watchdog.alert");

    return { runId: run._id, status: run.status, startedAt: run.startedAt, rendered, alerted };
  },
});

export const markWatchdogAlerted = internalMutation({
  args: { runId: v.id("pipelineRuns"), message: v.string() },
  handler: async (ctx, { runId, message }) => {
    await logEvent(ctx, { runId, type: "watchdog.alert", message, level: "error" });
  },
});

/** Cron watchdog (hourly): alert if today's run hasn't rendered within WATCHDOG_HOURS. */
export const watchdog = internalAction({
  args: {},
  handler: async (ctx) => {
    const runDate = todayUtc();
    const info = await ctx.runQuery(internal.pipeline.getWatchInfo, { runDate });
    if (!info || info.alerted || info.rendered) return;
    const overdue = Date.now() - info.startedAt > WATCHDOG_HOURS * 3600_000;
    if (info.status !== "succeeded" && overdue) {
      const message = `WordCast: run ${runDate} has not produced a rendered video after ${WATCHDOG_HOURS}h (status: ${info.status}).`;
      await ctx.runMutation(internal.pipeline.markWatchdogAlerted, { runId: info.runId, message });
      await ctx.runAction(internal.pipeline.sendAlert, { message });
    }
  },
});

export const getAlertWebhook = internalQuery({
  args: {},
  handler: async (ctx) => {
    const s = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "global"))
      .unique();
    return s?.alertWebhookUrl ?? null;
  },
});

/** POST an alert message to the configured webhook (Slack/Discord/Telegram-compatible). */
export const sendAlert = internalAction({
  args: { message: v.string() },
  handler: async (ctx, { message }) => {
    const url = await ctx.runQuery(internal.pipeline.getAlertWebhook, {});
    if (!url) return;
    try {
      await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: message, content: message }),
      });
    } catch {
      // Alerting is best-effort; never throw from the alert path.
    }
  },
});
