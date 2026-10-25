import { describe, expect, it } from "vitest";
import { normalizeDigits, normalizePhone, otpSchema, phoneSchemaFor } from "./auth";

describe("normalizeDigits", () => {
  it("converts Persian and Arabic-Indic digits and strips separators", () => {
    expect(normalizeDigits("+۹۸ ۹۱۲-۱۲۳۴۵۶۷")).toBe("+989121234567");
    expect(normalizeDigits("١٢٣٤٥٦")).toBe("123456");
  });
});

describe("normalizePhone", () => {
  it("keeps numbers that carry their own country code", () => {
    expect(normalizePhone("+989121234567", "au")).toBe("+989121234567");
    expect(normalizePhone("+61 412 345 678", "ir")).toBe("+61412345678");
  });

  it("reads 00 as +", () => {
    expect(normalizePhone("00989121234567", "au")).toBe("+989121234567");
  });

  it("reads local numbers by region", () => {
    expect(normalizePhone("09121234567", "ir")).toBe("+989121234567");
    expect(normalizePhone("۰۹۱۲۱۲۳۴۵۶۷", "ir")).toBe("+989121234567");
    expect(normalizePhone("0412 345 678", "au")).toBe("+61412345678");
    expect(normalizePhone("(04) 1234-5678", "au")).toBe("+61412345678");
  });

  it("accepts a national number without the trunk zero", () => {
    expect(normalizePhone("9121234567", "ir")).toBe("+989121234567");
    expect(normalizePhone("412345678", "au")).toBe("+61412345678");
  });

  it("does not double the country code", () => {
    expect(normalizePhone("989121234567", "ir")).toBe("+989121234567");
    expect(normalizePhone("61412345678", "au")).toBe("+61412345678");
  });

  it("returns an empty string for empty input", () => {
    expect(normalizePhone("  ", "ir")).toBe("");
  });
});

describe("phoneSchemaFor / otpSchema", () => {
  it("outputs the format the API accepts", () => {
    expect(phoneSchemaFor("ir").parse("0912 123 4567")).toBe("+989121234567");
    expect(phoneSchemaFor("au").parse("0412345678")).toBe("+61412345678");
  });

  it("rejects numbers the API would refuse", () => {
    expect(phoneSchemaFor("ir").safeParse("091212345").success).toBe(false);
    expect(phoneSchemaFor("ir").safeParse("+9891212345").success).toBe(false);
    expect(phoneSchemaFor("ir").safeParse("+989121234567890").success).toBe(false);
    expect(phoneSchemaFor("au").safeParse("").success).toBe(false);
  });

  it("requires exactly six digits for the code", () => {
    expect(otpSchema.parse("۱۲۳۴۵۶")).toBe("123456");
    expect(otpSchema.safeParse("12345").success).toBe(false);
    expect(otpSchema.safeParse("1234567").success).toBe(false);
  });
});
