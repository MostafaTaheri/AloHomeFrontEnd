import { apiRequest } from "./client";
import { asPage, unwrap, type Page } from "./envelope";

/**
 * Audit log (SEC-02). Every sensitive change is recorded with its actor, before and after
 * values and the correlation id of the request that made it. Scheme members with ViewAudit see
 * their scheme's entries; staff see everything in the back office.
 */

export type AuditCategoryName =
  | "Access"
  | "Membership"
  | "Organisation"
  | "Financial"
  | "Configuration"
  | "Approval"
  | "Export"
  | "Ai"
  | "Property";

export const AUDIT_CATEGORIES: AuditCategoryName[] = [
  "Access",
  "Membership",
  "Organisation",
  "Financial",
  "Configuration",
  "Approval",
  "Export",
  "Ai",
  "Property",
];

export interface AuditEntry {
  id: string;
  schemeId: number | null;
  organisationId: number | null;
  actorId: string;
  category: AuditCategoryName | string;
  action: string;
  entityType: string;
  entityId: string;
  /** JSON-encoded snapshots with PascalCase keys, or null. */
  before: string | null;
  after: string | null;
  reason: string | null;
  correlationId: string | null;
  occurredAtUtc: string;
}

export interface AuditFilter {
  category?: AuditCategoryName | "";
  fromUtc?: string;
  toUtc?: string;
  page?: number;
  pageSize?: number;
}

export interface BoAuditFilter extends AuditFilter {
  schemeId?: number;
  organisationId?: number;
  actorId?: string;
  entityType?: string;
  entityId?: string;
}

type Signal = { signal?: AbortSignal };

/** Date-only filters cover whole days: "to" runs until the end of that day. */
const range = (filter: AuditFilter) => ({
  category: filter.category || undefined,
  fromUtc: filter.fromUtc ? `${filter.fromUtc}T00:00:00Z` : undefined,
  toUtc: filter.toUtc ? `${filter.toUtc}T23:59:59Z` : undefined,
  page: filter.page ?? 1,
  pageSize: filter.pageSize ?? 50,
});

export const auditApi = {
  scheme: async (schemeId: number, filter: AuditFilter = {}, opts: Signal = {}) =>
    asPage<AuditEntry>(
      unwrap(await apiRequest(`schemes/${schemeId}/audit-logs`, { ...opts, query: range(filter) })),
    ) as Page<AuditEntry>,
  backoffice: async (filter: BoAuditFilter = {}, signal?: AbortSignal) =>
    asPage<AuditEntry>(
      unwrap(
        await apiRequest("backoffice/audit-logs", {
          signal,
          surface: "backoffice",
          query: {
            ...range(filter),
            schemeId: filter.schemeId,
            organisationId: filter.organisationId,
            actorId: filter.actorId || undefined,
            entityType: filter.entityType || undefined,
            entityId: filter.entityId || undefined,
          },
        }),
      ),
    ) as Page<AuditEntry>,
};

export interface AuditChange {
  field: string;
  before: string | null;
  after: string | null;
}

function parseSnapshot(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : { Value: value };
  } catch {
    return { Value: raw };
  }
}

const show = (value: unknown): string | null =>
  value === undefined || value === null
    ? null
    : typeof value === "object"
      ? JSON.stringify(value)
      : String(value);

/**
 * The fields that differ between an entry's before and after snapshots, in a stable order.
 * A field present on one side only is reported with null on the other.
 */
export function auditChanges(entry: Pick<AuditEntry, "before" | "after">): AuditChange[] {
  const before = parseSnapshot(entry.before) ?? {};
  const after = parseSnapshot(entry.after) ?? {};
  const fields = [...new Set([...Object.keys(before), ...Object.keys(after)])];
  return fields
    .map((field) => ({ field, before: show(before[field]), after: show(after[field]) }))
    .filter((change) => change.before !== change.after);
}
