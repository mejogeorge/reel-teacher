import { runWorker } from "./worker.js";

runWorker().catch((err) => {
  console.error("worker crashed:", err);
  process.exit(1);
});
