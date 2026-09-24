import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Start today's run once the configured time passes, and catch up missed days.
crons.interval("pipeline tick", { minutes: 30 }, internal.pipeline.tick, {});

// Alert if today's run hasn't produced a rendered video in time.
crons.interval("pipeline watchdog", { hours: 1 }, internal.pipeline.watchdog, {});

export default crons;
