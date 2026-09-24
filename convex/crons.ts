import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Start today's run once the configured time passes, and catch up missed days.
crons.interval("pipeline tick", { minutes: 30 }, internal.pipeline.tick, {});

// Alert if today's run hasn't produced a rendered video in time.
crons.interval("pipeline watchdog", { hours: 1 }, internal.pipeline.watchdog, {});

// Requeue render jobs whose worker lease expired (crashed mid-render).
crons.interval("requeue expired renders", { minutes: 5 }, internal.render.requeueExpiredJobs, {});

export default crons;
