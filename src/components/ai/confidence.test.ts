import { describe, expect, it } from "vitest";
import { confidencePercent } from "./confidence";

describe("confidencePercent", () => {
  it("scales fractions and clamps", () => {
    expect(confidencePercent(0.82)).toBeCloseTo(82);
    expect(confidencePercent(1)).toBe(100);
    expect(confidencePercent(0)).toBe(0);
    expect(confidencePercent(73)).toBe(73);
    expect(confidencePercent(140)).toBe(100);
    expect(confidencePercent(-1)).toBe(0);
  });
});
