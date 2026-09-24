import { describe, expect, it } from "vitest";
import { constantTimeEqual, isAdminEmail, parseAdminEmails } from "./auth.js";

describe("constantTimeEqual", () => {
  it("matches identical strings", () => {
    expect(constantTimeEqual("s3cr3t-value", "s3cr3t-value")).toBe(true);
  });
  it("rejects different strings and lengths", () => {
    expect(constantTimeEqual("s3cr3t-value", "s3cr3t-valuX")).toBe(false);
    expect(constantTimeEqual("short", "longer-secret")).toBe(false);
    expect(constantTimeEqual("", "x")).toBe(false);
  });
});

describe("admin allowlist", () => {
  it("parses and normalizes ADMIN_EMAILS", () => {
    expect(parseAdminEmails(" A@x.com, b@Y.com ,")).toEqual(["a@x.com", "b@y.com"]);
    expect(parseAdminEmails(undefined)).toEqual([]);
    expect(parseAdminEmails("")).toEqual([]);
  });
  it("checks membership case-insensitively", () => {
    const list = parseAdminEmails("admin@wordcast.app");
    expect(isAdminEmail("ADMIN@wordcast.app", list)).toBe(true);
    expect(isAdminEmail("other@wordcast.app", list)).toBe(false);
    expect(isAdminEmail(null, list)).toBe(false);
    expect(isAdminEmail(undefined, list)).toBe(false);
  });
});
