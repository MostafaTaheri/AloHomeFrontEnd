import { describe, expect, it } from "vitest";
import { amountToInput, normalizeNumeric, parseAmountInput } from "./amount";

describe("normalizeNumeric", () => {
  it("handles Persian digits and separators", () => {
    expect(normalizeNumeric("۱٬۲۵۰٬۰۰۰")).toBe("1250000");
    expect(normalizeNumeric("۱۲٫۵")).toBe("12.5");
  });
});

describe("parseAmountInput", () => {
  it("reads rial amounts as whole rial", () => {
    expect(parseAmountInput("1,250,000", { currency: "IRR", unit: "rial" })).toEqual({
      ok: true,
      value: 1250000,
    });
    expect(parseAmountInput("12.5", { currency: "IRR", unit: "rial" }).ok).toBe(false);
  });

  it("converts toman to rial", () => {
    expect(parseAmountInput("125,000", { currency: "IRR", unit: "toman" })).toEqual({
      ok: true,
      value: 1250000,
    });
    expect(parseAmountInput("0.5", { currency: "IRR", unit: "toman" })).toEqual({
      ok: true,
      value: 5,
    });
    expect(parseAmountInput("0.55", { currency: "IRR", unit: "toman" }).ok).toBe(false);
  });

  it("reads AUD with up to two decimals", () => {
    expect(parseAmountInput("1,234.56", { currency: "AUD" })).toEqual({ ok: true, value: 1234.56 });
    expect(parseAmountInput("1.234", { currency: "AUD" }).ok).toBe(false);
  });

  it("rejects junk, zero and negatives unless allowed", () => {
    expect(parseAmountInput("", { currency: "AUD" }).ok).toBe(false);
    expect(parseAmountInput("12abc", { currency: "AUD" }).ok).toBe(false);
    expect(parseAmountInput("0", { currency: "AUD" }).ok).toBe(false);
    expect(parseAmountInput("0", { currency: "AUD", allowZero: true }).ok).toBe(true);
    expect(parseAmountInput("-5", { currency: "AUD" }).ok).toBe(false);
    expect(parseAmountInput("-5", { currency: "AUD", allowNegative: true })).toEqual({
      ok: true,
      value: -5,
    });
  });

  it("rejects absurd magnitudes", () => {
    expect(parseAmountInput("99999999999999999", { currency: "AUD" }).ok).toBe(false);
  });
});

describe("amountToInput", () => {
  it("shows toman for rial amounts when toman is chosen", () => {
    expect(amountToInput(1250000, "IRR", "toman")).toBe("125000");
    expect(amountToInput(1250000, "IRR", "rial")).toBe("1250000");
    expect(amountToInput(12.5, "AUD")).toBe("12.5");
  });
});
