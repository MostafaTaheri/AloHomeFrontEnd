import { describe, expect, it } from "vitest";
import { telemetryBodySchema } from "./events";

describe("telemetry schema", () => {
  it("accepts a known event with allowlisted props", () => {
    const parsed = telemetryBodySchema.safeParse({
      event: "import_committed",
      props: { kind: "Levies", count: 120, durationMs: 840 },
    });
    expect(parsed.success).toBe(true);
  });

  it("defaults props to an empty object", () => {
    const parsed = telemetryBodySchema.parse({ event: "auth_signed_in" });
    expect(parsed.props).toEqual({});
  });

  it("rejects unknown events", () => {
    expect(telemetryBodySchema.safeParse({ event: "page_view_everything" }).success).toBe(false);
  });

  it("rejects property names outside the allowlist", () => {
    const parsed = telemetryBodySchema.safeParse({
      event: "report_exported",
      props: { phone: "+61412345678" },
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects free text and sensitive-looking values", () => {
    for (const subject of ["Jane Citizen paid $1,200", "a@b.co", "x".repeat(41), ""]) {
      expect(
        telemetryBodySchema.safeParse({ event: "feedback_submitted", props: { subject } }).success,
      ).toBe(false);
    }
  });

  it("bounds numeric props", () => {
    expect(
      telemetryBodySchema.safeParse({ event: "import_failed", props: { count: -1 } }).success,
    ).toBe(false);
    expect(
      telemetryBodySchema.safeParse({ event: "import_failed", props: { count: 1.5 } }).success,
    ).toBe(false);
  });
});
