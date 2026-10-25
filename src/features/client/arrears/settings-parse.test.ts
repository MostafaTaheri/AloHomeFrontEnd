import { describe, expect, it } from "vitest";
import { parseBoundaries, parseTopN } from "./settings-parse";

describe("ageing settings parsing", () => {
  it("accepts increasing whole numbers", () => {
    expect(parseBoundaries("30, 60, 90")).toEqual([30, 60, 90]);
    expect(parseBoundaries("7;14")).toEqual([7, 14]);
  });
  it("rejects bad input", () => {
    for (const bad of ["", "0", "30, 30", "60, 30", "a", "1.5", "1,2,3,4,5,6,7", "-3"]) {
      expect(parseBoundaries(bad), bad).toBeNull();
    }
  });
  it("validates top N", () => {
    expect(parseTopN("5")).toBe(5);
    expect(parseTopN("50")).toBe(50);
    for (const bad of ["0", "51", "", "x", "1.5"]) expect(parseTopN(bad), bad).toBeNull();
  });
});
