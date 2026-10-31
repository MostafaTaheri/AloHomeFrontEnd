import { describe, expect, it } from "vitest";
import { checkTransfer, datesInOrder, parseParty, parseShare } from "./parse";

describe("parseShare", () => {
  it("accepts shares above 0 up to 100 with two decimals", () => {
    expect(parseShare("50")).toBe(50);
    expect(parseShare("33.33")).toBe(33.33);
    expect(parseShare("۲۵")).toBe(25);
    expect(parseShare("100")).toBe(100);
  });

  it("rejects zero, more than 100 and extra decimals", () => {
    expect(parseShare("0")).toBeNull();
    expect(parseShare("100.01")).toBeNull();
    expect(parseShare("12.345")).toBeNull();
    expect(parseShare("abc")).toBeNull();
  });
});

describe("parseParty", () => {
  it("treats a GUID as a user and anything else as a name", () => {
    expect(parseParty("3F2B8A52-0C4E-4D6E-9D56-0A8D1A7C9B11")).toEqual({
      userId: "3f2b8a52-0c4e-4d6e-9d56-0a8d1a7c9b11",
    });
    expect(parseParty("  J. Citizen ")).toEqual({ partyName: "J. Citizen" });
    expect(parseParty("   ")).toBeNull();
  });
});

describe("checkTransfer", () => {
  it("builds the owners when every row is valid and shares total 100", () => {
    const result = checkTransfer([
      { party: "A", share: "33.33" },
      { party: "B", share: "33.33" },
      { party: "C", share: "33.34" },
    ]);
    expect(result.totalOk).toBe(true);
    expect(result.owners).toHaveLength(3);
    expect(result.owners?.[2]).toEqual({ partyName: "C", sharePercent: 33.34 });
  });

  it("reports the row error and a short total", () => {
    const result = checkTransfer([
      { party: "", share: "50" },
      { party: "B", share: "40" },
    ]);
    expect(result.rows).toEqual(["party", null]);
    expect(result.total).toBe(90);
    expect(result.totalOk).toBe(false);
    expect(result.owners).toBeNull();
  });
});

describe("datesInOrder", () => {
  it("allows an open end and equal dates", () => {
    expect(datesInOrder("2026-01-01", "")).toBe(true);
    expect(datesInOrder("2026-01-01", "2026-01-01")).toBe(true);
    expect(datesInOrder("2026-01-02", "2026-01-01")).toBe(false);
  });
});
