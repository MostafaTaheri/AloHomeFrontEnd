import { describe, expect, it } from "vitest";
import {
  parseLatitude,
  parseLongitude,
  parsePositive,
  parsePostal,
  parseUserId,
  parseWhole,
} from "./parse";

describe("back-office parsing", () => {
  it("bounds coordinates and accepts Persian digits", () => {
    expect(parseLatitude("-33.86")).toBe(-33.86);
    expect(parseLatitude("۳۵.۷")).toBe(35.7);
    expect(parseLatitude("91")).toBeNull();
    expect(parseLongitude("151.2")).toBe(151.2);
    expect(parseLongitude("-181")).toBeNull();
    expect(parseLongitude("")).toBeNull();
  });
  it("parses whole and positive numbers", () => {
    expect(parseWhole("0")).toBe(0);
    expect(parseWhole("12")).toBe(12);
    expect(parseWhole("-1")).toBeNull();
    expect(parseWhole("1.5")).toBeNull();
    expect(parsePositive("72.5")).toBe(72.5);
    expect(parsePositive("0")).toBeNull();
  });
  it("checks postal codes per market", () => {
    expect(parsePostal("2000", 4)).toBe("2000");
    expect(parsePostal("20000", 4)).toBeNull();
    expect(parsePostal("1234567890", 10)).toBe("1234567890");
    expect(parsePostal("۱۲۳۴۵۶۷۸۹۰", 10)).toBe("1234567890");
    expect(parsePostal("12345", 10)).toBeNull();
  });
  it("validates user ids", () => {
    expect(parseUserId(" 3F2504E0-4F89-41D3-9A0C-0305E82C3301 ")).toBe(
      "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
    );
    expect(parseUserId("not-a-guid")).toBeNull();
  });
});
