import type { SchemeContext, SchemePermissionName } from "@/lib/api/finance/types";

/**
 * The backend's role matrix (SchemePermissions.cs). Used only when the scheme context carries no
 * permission list, which older API versions do not send. The API enforces every permission
 * itself; the UI uses them to hide actions a person cannot take.
 */
const ROLE_PERMISSIONS: Record<string, readonly SchemePermissionName[]> = {
  Manager: [
    "ViewFinancials",
    "ManageFinancials",
    "ApproveBudgets",
    "ApproveReminders",
    "ManageMembers",
    "ViewAudit",
    "ExportReports",
    "ManageProperty",
  ],
  Treasurer: [
    "ViewFinancials",
    "ManageFinancials",
    "ApproveBudgets",
    "ApproveReminders",
    "ViewAudit",
    "ExportReports",
  ],
  CommitteeMember: [
    "ViewFinancials",
    "ApproveBudgets",
    "ApproveReminders",
    "ViewAudit",
    "ExportReports",
  ],
  ReadOnly: ["ViewFinancials", "ExportReports"],
  Analyst: ["ViewFinancials"],
};

/** The permissions that apply to a scheme context, from the API or from the role. */
export function permissionsFor(
  context: Pick<SchemeContext, "role" | "permissions">,
): ReadonlySet<string> {
  if (Array.isArray(context.permissions)) return new Set(context.permissions);
  return new Set(ROLE_PERMISSIONS[context.role] ?? ["ViewFinancials"]);
}
