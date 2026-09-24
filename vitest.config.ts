import { defineConfig } from "vitest/config";

/**
 * Convex backend tests (convex-test). Runs in the edge-runtime environment to
 * mirror the Convex isolate. Requires `convex/_generated` — run `pnpm codegen`
 * (after linking a deployment with `npx convex dev`) before this.
 */
export default defineConfig({
  test: {
    environment: "edge-runtime",
    server: { deps: { inline: ["convex-test"] } },
    include: ["convex/**/*.test.ts"],
  },
});
