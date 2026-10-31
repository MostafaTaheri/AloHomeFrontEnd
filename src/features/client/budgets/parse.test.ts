import { describe, expect, it } from "vitest";
import {
  budgetYearBounds,
  checkPhasing,
  evenPhasing,
  parseFiscalYear,
  parseTolerance,
} from "./parse";

describe("parseFiscalYear", () => {
  const bounds = budgetYearBounds(2027);

  it("accepts years in the API's window, including Persian digits", () => {
    expect(bounds).toEqual({ min: 2022, max: 2029 });
    expect(parseFiscalYear("2027", bounds)).toBe(2027);
    expect(parseFiscalYear("۲۰۲۸", bounds)).toBe(2028);
  });

  it("rejects years outside the window and non-years", () => {
    expect(parseFiscalYear("2021", bounds)).toBeNull();
    expect(parseFiscalYear("2030", bounds)).toBeNull();
    expect(parseFiscalYear("27", bounds)).toBeNull();
  });
});

describe("parseTolerance", () => {
  it("treats empty as the default and validates the range", () => {
    expect(parseTolerance("")).toBeUndefined();
    expect(parseTolerance("5")).toBe(5);
    expect(parseTolerance("0")).toBeNull();
    expect(parseTolerance("101")).toBeNull();
  });
});

describe("checkPhasing", () => {
  it("accepts the even split", () => {
    const result = checkPhasing(evenPhasing());
    expect(result.total).toBe(100);
    expect(result.values).toHaveLength(12);
  });

  it("rejects a total other than 100 and flags bad entries", () => {
    const entries = Array.from({ length: 12 }, () => "8");
    expect(checkPhasing(entries).values).toBeNull();
    expect(checkPhasing(entries).total).toBe(96);
    entries[3] = "x";
    expect(checkPhasing(entries).invalid).toEqual([3]);
  });

  it("counts empty months as zero", () => {
    const entries = ["50", "50", ...Array.from({ length: 10 }, () => "")];
    expect(checkPhasing(entries).values?.slice(0, 3)).toEqual([50, 50, 0]);
  });
});
