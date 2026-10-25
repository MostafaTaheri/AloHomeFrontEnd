import { describe, expect, it } from "vitest";
import { parseHorizon, parsePercent, parseYear, yearBounds } from "./parse";

describe("capital works parsing", () => {
  it("parses years per calendar and accepts Persian digits", () => {
    expect(parseYear("2027", yearBounds("gregory"))).toBe(2027);
    expect(parseYear("۱۴۰۵", yearBounds("persian"))).toBe(1405);
    expect(parseYear("1405", yearBounds("gregory"))).toBeNull();
    expect(parseYear("27", yearBounds("gregory"))).toBeNull();
    expect(parseYear("", yearBounds("gregory"))).toBeNull();
  });
  it("parses percentages", () => {
    expect(parsePercent("2.5")).toBe(2.5);
    expect(parsePercent("-3")).toBe(-3);
    expect(parsePercent("0")).toBe(0);
    expect(parsePercent("101")).toBeNull();
    expect(parsePercent("")).toBeNull();
    expect(parsePercent("abc")).toBeNull();
  });
  it("parses horizon", () => {
    expect(parseHorizon("10")).toBe(10);
    expect(parseHorizon("31")).toBeNull();
    expect(parseHorizon("0")).toBeNull();
  });
});
