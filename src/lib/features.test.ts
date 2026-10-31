import { describe, expect, it } from "vitest";
import type { FeatureDecision } from "@/lib/api/governance";
import { activeItems, isFeatureActive } from "./features";

const decision = (key: string, status: number | string): FeatureDecision => ({
  key,
  name: key,
  status,
  reason: "",
  wedge: "",
  stories: [],
  decidedOn: "2026-10-03",
});

const features = [
  decision("budgets", 1),
  decision("payments", 2),
  decision("visitor-management", 3),
  decision("generic-ai-chat", "Rejected"),
];

describe("isFeatureActive", () => {
  it("accepts numeric and named statuses", () => {
    expect(isFeatureActive(features, "budgets")).toBe(true);
    expect(isFeatureActive(features, "payments")).toBe(false);
    expect(isFeatureActive(features, "visitor-management")).toBe(false);
    expect(isFeatureActive(features, "generic-ai-chat")).toBe(false);
  });

  it("keeps screens visible when the catalogue is missing or silent", () => {
    expect(isFeatureActive(undefined, "payments")).toBe(true);
    expect(isFeatureActive(features, "unknown-feature")).toBe(true);
    expect(isFeatureActive(features, undefined)).toBe(true);
  });
});

describe("activeItems", () => {
  it("drops items tied to frozen features", () => {
    const items = [
      { id: "health" },
      { id: "budgets", feature: "budgets" },
      { id: "pay", feature: "payments" },
    ];
    expect(activeItems(items, features).map((i) => i.id)).toEqual(["health", "budgets"]);
  });
});
