import { convexTest } from "convex-test";
import { beforeEach, describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.helpers";

beforeEach(() => {
  process.env.ADMIN_EMAILS = "admin@wordcast.app";
  process.env.WORKER_SECRET = "test-worker-secret";
});

describe("settings", () => {
  test("seed is idempotent", async () => {
    const t = convexTest(schema, modules);
    const id1 = await t.mutation(internal.settings.seed, {});
    const id2 = await t.mutation(internal.settings.seed, {});
    expect(id1).toEqual(id2);
  });

  test("get rejects an unauthenticated caller", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.settings.seed, {});
    await expect(t.query(api.settings.get, {})).rejects.toThrow(/Unauthenticated/);
  });

  test("get rejects a non-admin caller", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.settings.seed, {});
    const asUser = t.withIdentity({ email: "someone@else.com" });
    await expect(asUser.query(api.settings.get, {})).rejects.toThrow(/not an admin/);
  });

  test("admin reads the seeded defaults", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.settings.seed, {});
    const asAdmin = t.withIdentity({ email: "Admin@Wordcast.app" });
    const s = await asAdmin.query(api.settings.get, {});
    expect(s?.approvalMode).toBe("auto");
    expect(s?.backgroundMusicMode).toBe("library");
    expect(s?.pipelinePaused).toBe(false);
  });

  test("update rejects a non-admin and accepts an admin", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.settings.seed, {});

    await expect(
      t.mutation(api.settings.update, { patch: { pipelinePaused: true } }),
    ).rejects.toThrow(/Unauthenticated/);

    const asAdmin = t.withIdentity({ email: "admin@wordcast.app" });
    await asAdmin.mutation(api.settings.update, { patch: { pipelinePaused: true } });
    const s = await asAdmin.query(api.settings.get, {});
    expect(s?.pipelinePaused).toBe(true);
  });
});
