import { describe, expect, it } from "vitest";
import { z } from "zod";
import { EnvValidationError, parseEnv, rendererEnvSchema } from "./env.js";

describe("parseEnv", () => {
  it("returns parsed values and applies defaults/coercion", () => {
    const env = parseEnv(
      rendererEnvSchema,
      { CONVEX_URL: "https://x.convex.cloud", WORKER_SECRET: "abc", RENDER_CONCURRENCY: "2" },
      "renderer",
    );
    expect(env.RENDER_CONCURRENCY).toBe(2);
    expect(env.WORKER_ID).toBe("local-worker-1");
    expect(env.MODEL_CACHE_DIR).toBe("./.model-cache");
  });

  it("throws EnvValidationError listing every problem", () => {
    const schema = z.object({ A: z.string().min(1), B: z.string().url() });
    try {
      parseEnv(schema, { A: "", B: "not-a-url" }, "test");
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(EnvValidationError);
      expect((err as Error).message).toContain("A:");
      expect((err as Error).message).toContain("B:");
    }
  });
});
