import { describe, expect, it } from "vitest";
import { permissionsFor } from "./permissions";

describe("permissionsFor", () => {
  it("uses the list the API sends", () => {
    const set = permissionsFor({ role: "Manager", permissions: ["ViewFinancials"] });
    expect(set.has("ViewFinancials")).toBe(true);
    expect(set.has("ManageFinancials")).toBe(false);
  });

  it("falls back to the role matrix when the API sends no list", () => {
    expect(permissionsFor({ role: "Treasurer" }).has("ManageFinancials")).toBe(true);
    expect(permissionsFor({ role: "Treasurer" }).has("ManageProperty")).toBe(false);
    expect(permissionsFor({ role: "CommitteeMember" }).has("ApproveBudgets")).toBe(true);
    expect(permissionsFor({ role: "CommitteeMember" }).has("ManageFinancials")).toBe(false);
    expect(permissionsFor({ role: "ReadOnly" }).has("ExportReports")).toBe(true);
    expect(permissionsFor({ role: "Analyst" }).has("ExportReports")).toBe(false);
  });

  it("grants only viewing to an unknown role", () => {
    const set = permissionsFor({ role: "Auditor" });
    expect([...set]).toEqual(["ViewFinancials"]);
  });
});
