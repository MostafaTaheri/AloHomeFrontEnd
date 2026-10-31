import { describe, expect, it } from "vitest";
import { allowedTransitions, checkTransition } from "./transition";

describe("allowedTransitions", () => {
  it("follows the pilot lifecycle", () => {
    expect(allowedTransitions("Prospect")).toEqual(["Start", "Lose"]);
    expect(allowedTransitions("Active")).toEqual(["Convert", "Lose"]);
    expect(allowedTransitions("Converted")).toEqual([]);
    expect(allowedTransitions("Lost")).toEqual([]);
  });
});

describe("checkTransition", () => {
  const prospect = { status: "Prospect", startDate: null };
  const active = { status: "Active", startDate: "2026-07-01" };

  it("needs a planned end on or after the start", () => {
    expect(checkTransition(prospect, { transition: "Start", date: "2026-07-01" })).toBe(
      "endBeforeStart",
    );
    expect(
      checkTransition(prospect, {
        transition: "Start",
        date: "2026-07-01",
        plannedEndDate: "2026-06-30",
      }),
    ).toBe("endBeforeStart");
    expect(
      checkTransition(prospect, {
        transition: "Start",
        date: "2026-07-01",
        plannedEndDate: "2026-07-01",
      }),
    ).toBeNull();
  });

  it("refuses a conversion before the start and a transition out of order", () => {
    expect(checkTransition(active, { transition: "Convert", date: "2026-06-01" })).toBe(
      "convertBeforeStart",
    );
    expect(checkTransition(active, { transition: "Start", date: "2026-07-01" })).toBe("notAllowed");
  });

  it("needs a reason to lose a pilot", () => {
    expect(checkTransition(active, { transition: "Lose", date: "2026-08-01", reason: " " })).toBe(
      "reasonRequired",
    );
    expect(
      checkTransition(active, { transition: "Lose", date: "2026-08-01", reason: "Budget" }),
    ).toBeNull();
  });
});
