import { describe, expect, it } from "vitest";
import { safeNextPath } from "./redirect";

describe("safeNextPath", () => {
  const fallback = "/dashboard";

  it("keeps same-site relative paths", () => {
    expect(safeNextPath("/admin/buildings?page=2", fallback)).toBe("/admin/buildings?page=2");
  });

  it.each([
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "javascript:alert(1)",
    "/login",
    "/register",
    "/api/auth/logout",
    "/ok\nSet-Cookie: x=1",
    "",
  ])("falls back for %j", (value) => {
    expect(safeNextPath(value, fallback)).toBe(fallback);
  });

  it("falls back for null and undefined", () => {
    expect(safeNextPath(null, fallback)).toBe(fallback);
    expect(safeNextPath(undefined, fallback)).toBe(fallback);
  });
});
