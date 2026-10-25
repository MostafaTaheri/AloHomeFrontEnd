import { describe, expect, it } from "vitest";
import { en } from "./dictionaries/en";
import { fa } from "./dictionaries/fa";
import { createTranslator } from "./translator";

function leaves(node: unknown, prefix = ""): [string, string][] {
  if (typeof node === "string") return [[prefix, node]];
  return Object.entries(node as Record<string, unknown>).flatMap(([k, v]) =>
    leaves(v, prefix ? `${prefix}.${k}` : k),
  );
}

function placeholders(value: string): string[] {
  return [...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!).sort();
}

describe("dictionaries", () => {
  const english = new Map(leaves(en));
  const persian = new Map(leaves(fa));

  it("have the same keys", () => {
    expect([...persian.keys()].sort()).toEqual([...english.keys()].sort());
  });

  it("have no empty values", () => {
    for (const [key, value] of [...english, ...persian]) {
      expect(value.trim(), key).not.toBe("");
    }
  });

  it("use the same placeholders in both languages", () => {
    for (const [key, value] of english) {
      expect(placeholders(persian.get(key) ?? ""), key).toEqual(placeholders(value));
    }
  });
});

describe("market terminology", () => {
  it("resolves region terms inside dictionary strings", () => {
    expect(createTranslator("en", "au").t("workspace.selectTitle")).toBe("Choose a scheme");
    expect(createTranslator("en", "ir").t("workspace.selectTitle")).toBe("Choose a building");
    expect(createTranslator("fa", "ir").t("workspace.selectTitle")).toBe("یک ساختمان انتخاب کنید");
  });

  it("capitalises a term when the placeholder starts upper-case", () => {
    expect(createTranslator("en", "au").t("workspace.contextNotFoundTitle")).toBe(
      "Scheme not found",
    );
    expect(createTranslator("en", "ir").t("workspace.contextNotFoundTitle")).toBe(
      "Building not found",
    );
  });

  it("lets explicit values win over terms", () => {
    expect(createTranslator("en", "au").t("workspace.selectTitle", { scheme: "x" })).toBe(
      "Choose a x",
    );
  });
});

describe("createTranslator", () => {
  it("interpolates values and leaves unknown placeholders alone", () => {
    const { t } = createTranslator("en", "au");
    expect(t("auth.codeSent", { phone: "+61412345678" })).toContain("+61412345678");
    expect(t("auth.codeSent")).toContain("{phone}");
  });

  it("formats numbers per locale", () => {
    expect(createTranslator("fa").formatNumber(12)).toBe("۱۲");
    expect(createTranslator("en").formatNumber(1200)).toBe("1,200");
  });

  it("returns a placeholder for empty dates", () => {
    const { formatDate, t } = createTranslator("en");
    expect(formatDate(null)).toBe(t("common.none"));
    expect(formatDate("not a date")).toBe(t("common.none"));
  });
});
