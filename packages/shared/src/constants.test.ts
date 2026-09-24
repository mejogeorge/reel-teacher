import { describe, expect, it } from "vitest";
import { SAFE_AREA, VIDEO_HEIGHT, VIDEO_WIDTH } from "./constants.js";

describe("constants", () => {
  it("uses a 9:16 vertical frame", () => {
    expect(VIDEO_WIDTH).toBe(1080);
    expect(VIDEO_HEIGHT).toBe(1920);
    expect(VIDEO_HEIGHT / VIDEO_WIDTH).toBeCloseTo(16 / 9, 5);
  });

  it("keeps safe-area insets within the frame", () => {
    expect(SAFE_AREA.top + SAFE_AREA.bottom).toBeLessThan(VIDEO_HEIGHT);
    expect(SAFE_AREA.side * 2).toBeLessThan(VIDEO_WIDTH);
  });
});
