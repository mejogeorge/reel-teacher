/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { beforeEach, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

beforeEach(() => {
  process.env.WORKER_SECRET = "test-worker-secret";
});

test("workerPing rejects an invalid secret", async () => {
  const t = convexTest(schema, modules);
  await expect(t.query(api.system.workerPing, { secret: "wrong" })).rejects.toThrow(
    /invalid worker secret/,
  );
});

test("workerPing accepts the correct secret", async () => {
  const t = convexTest(schema, modules);
  expect(await t.query(api.system.workerPing, { secret: "test-worker-secret" })).toBe("pong");
});
