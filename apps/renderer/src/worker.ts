import { promises as fs } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { createConvexClient, refs, type ClaimedJob } from "./convex.js";
import { getRendererEnv } from "./env.js";
import { renderJob, validateOutput } from "./render.js";
import { uploadFile } from "./upload.js";

const POLL_MS = 15_000;
const HEARTBEAT_MS = 60_000;
const RENDER_TIMEOUT_MS = 5 * 60_000;

let stopping = false;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err instanceof Error ? err : new Error(String(err)));
      },
    );
  });
}

type Client = ReturnType<typeof createConvexClient>;
type Env = ReturnType<typeof getRendererEnv>;

async function processJob(client: Client, env: Env, job: ClaimedJob): Promise<void> {
  const heartbeat = setInterval(() => {
    void client
      .mutation(refs.heartbeat, {
        secret: env.WORKER_SECRET,
        jobId: job.jobId,
        workerId: env.WORKER_ID,
      })
      .catch(() => undefined);
  }, HEARTBEAT_MS);

  let outDir: string | undefined;
  try {
    await client.mutation(refs.startRender, { secret: env.WORKER_SECRET, jobId: job.jobId });

    const music =
      job.request.backgroundMusicMode !== "none"
        ? await client
            .query(refs.getActiveMusic, { secret: env.WORKER_SECRET })
            .catch(() => null)
        : null;

    const result = await withTimeout(
      renderJob(job.request, { music }),
      RENDER_TIMEOUT_MS,
      "render",
    );
    outDir = result.outDir;
    validateOutput(result);

    const videoStorageId = await uploadFile(
      client,
      env.WORKER_SECRET,
      result.videoPath,
      "video/mp4",
    );
    const thumbStorageId = await uploadFile(
      client,
      env.WORKER_SECRET,
      result.thumbPath,
      "image/png",
    );

    await client.mutation(refs.completeJob, {
      secret: env.WORKER_SECRET,
      jobId: job.jobId,
      videoStorageId,
      thumbStorageId,
      durationSec: result.durationSec,
      bytes: result.bytes,
      width: result.width,
      height: result.height,
    });
    console.log(`✓ rendered word ${job.wordId} (${result.durationSec.toFixed(1)}s)`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`✗ render failed for word ${job.wordId}: ${message}`);
    await client
      .mutation(refs.failJob, { secret: env.WORKER_SECRET, jobId: job.jobId, error: message })
      .catch(() => undefined);
  } finally {
    clearInterval(heartbeat);
    if (outDir) {
      await fs.rm(outDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}

/**
 * Drain the render queue once, then exit — for ephemeral runners (GitHub Actions).
 * Renders all currently-queued jobs; exits after a few empty polls or a time cap.
 */
export async function runOnce(): Promise<void> {
  const env = getRendererEnv();
  const client = createConvexClient(env.CONVEX_URL);
  const deadline = Date.now() + 14 * 60_000;
  let emptyPolls = 0;

  console.log(`WordCast renderer (run-once) "${env.WORKER_ID}" polling ${env.CONVEX_URL}`);
  while (Date.now() < deadline) {
    let job: ClaimedJob | null;
    try {
      job = await client.mutation(refs.claimNextJob, {
        secret: env.WORKER_SECRET,
        workerId: env.WORKER_ID,
      });
    } catch (err) {
      console.error("claim failed:", err);
      await sleep(10_000);
      continue;
    }
    if (!job) {
      emptyPolls += 1;
      if (emptyPolls >= 3) {
        console.log("queue empty — exiting.");
        return;
      }
      await sleep(15_000);
      continue;
    }
    emptyPolls = 0;
    await processJob(client, env, job);
  }
  console.log("run-once time budget reached — exiting.");
}

export async function runWorker(): Promise<void> {
  const env = getRendererEnv();
  const client = createConvexClient(env.CONVEX_URL);

  const shutdown = () => {
    if (!stopping) console.log("received shutdown signal; finishing current job then stopping…");
    stopping = true;
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  console.log(`WordCast renderer "${env.WORKER_ID}" started; polling ${env.CONVEX_URL}`);
  while (!stopping) {
    let job: ClaimedJob | null;
    try {
      job = await client.mutation(refs.claimNextJob, {
        secret: env.WORKER_SECRET,
        workerId: env.WORKER_ID,
      });
    } catch (err) {
      console.error("claim failed:", err);
      await sleep(POLL_MS);
      continue;
    }

    if (!job) {
      await sleep(POLL_MS + Math.floor(Math.random() * 4000));
      continue;
    }
    await processJob(client, env, job);
  }
  console.log("worker stopped.");
}
