import { runOnce, runWorker } from "./worker.js";

// RENDER_ONCE=true → drain the queue and exit (ephemeral runners like GitHub
// Actions). Otherwise run the long-lived polling worker.
const once = process.env.RENDER_ONCE === "true";

(once ? runOnce() : runWorker()).catch((err) => {
  console.error("worker crashed:", err);
  process.exit(1);
});
