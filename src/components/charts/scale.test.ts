import { describe, expect, it } from "vitest";
import { labelIndices, niceDomain, project } from "./scale";

describe("niceDomain", () => {
  it("includes zero and rounds to friendly ticks", () => {
    const d = niceDomain([120, 340, 90], 4);
    expect(d.min).toBe(0);
    expect(d.max).toBe(400);
    expect(d.ticks).toEqual([0, 100, 200, 300, 400]);
  });

  it("covers negative values", () => {
    const d = niceDomain([-250, 600], 4);
    expect(d.min).toBeLessThanOrEqual(-250);
    expect(d.max).toBeGreaterThanOrEqual(600);
    expect(d.ticks).toContain(0);
  });

  it("handles all zeros and empty input", () => {
    expect(niceDomain([0, 0]).max).toBe(1);
    expect(niceDomain([]).ticks.length).toBeGreaterThan(1);
  });

  it("avoids floating point noise on fractional steps", () => {
    const d = niceDomain([0.1, 0.3], 3);
    for (const tick of d.ticks) expect(String(tick).length).toBeLessThan(8);
  });
});

describe("project", () => {
  it("maps linearly and survives a flat domain", () => {
    expect(project(5, 0, 10, 0, 100)).toBe(50);
    expect(project(5, 5, 5, 0, 100)).toBe(0);
  });
});

describe("labelIndices", () => {
  it("shows everything when it fits", () => {
    expect(labelIndices(4, 6)).toEqual([0, 1, 2, 3]);
  });

  it("thins out and keeps the last label", () => {
    const idx = labelIndices(12, 4);
    expect(idx.length).toBeLessThanOrEqual(4);
    expect(idx.at(-1)).toBe(11);
  });
});
