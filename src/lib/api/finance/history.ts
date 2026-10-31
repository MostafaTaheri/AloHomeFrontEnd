import { apiRequest } from "../client";
import { asList, unwrap } from "../envelope";

/**
 * Version history of a financial record (FIN-06, FIN-08). Every change creates a version with a
 * full snapshot; `changedFields` names the snapshot fields that differ from the previous version.
 */

export type ChangeTypeName = "Created" | "Corrected" | "Recategorised" | "Verified" | "Voided";

export interface FinancialRecordSnapshot {
  recordType: string;
  fund: string;
  status: string;
  direction: string;
  amount: number;
  currency: string;
  transactionDate: string;
  dueDate: string | null;
  financialPeriodId: string;
  lotId: number | null;
  supplierId: string | null;
  categoryId: string | null;
  externalReference: string | null;
  description: string | null;
  sourceDocumentId: string;
  importBatchId: string | null;
}

export type SnapshotField = keyof FinancialRecordSnapshot;

export interface FinancialRecordVersion {
  version: number;
  changeType: ChangeTypeName | string;
  reason: string | null;
  changedBy: string;
  changedAtUtc: string;
  /** PascalCase snapshot property names, e.g. "Amount". Empty for version 1. */
  changedFields: string[];
  snapshot: FinancialRecordSnapshot;
}

export interface FinancialRecordHistory {
  recordId: string;
  currentVersion: number;
  versions: FinancialRecordVersion[];
}

type Signal = { signal?: AbortSignal };

export const recordHistoryApi = {
  history: async (schemeId: number, recordId: string, opts: Signal = {}) => {
    const result = unwrap<FinancialRecordHistory>(
      await apiRequest(`schemes/${schemeId}/financial-records/${recordId}/versions`, opts),
    );
    return { ...result, versions: asList<FinancialRecordVersion>(result?.versions) };
  },
};

/** Maps the API's PascalCase field names onto snapshot keys ("CategoryId" -> "categoryId"). */
export function snapshotField(name: string): SnapshotField | null {
  const key = name.charAt(0).toLowerCase() + name.slice(1);
  return SNAPSHOT_FIELDS.includes(key as SnapshotField) ? (key as SnapshotField) : null;
}

export const SNAPSHOT_FIELDS: SnapshotField[] = [
  "recordType",
  "fund",
  "status",
  "direction",
  "amount",
  "currency",
  "transactionDate",
  "dueDate",
  "financialPeriodId",
  "lotId",
  "supplierId",
  "categoryId",
  "externalReference",
  "description",
  "sourceDocumentId",
  "importBatchId",
];

/** Newest first, with each version's changed fields resolved to snapshot keys. */
export function versionsNewestFirst(history: FinancialRecordHistory) {
  return [...history.versions]
    .sort((a, b) => b.version - a.version)
    .map((v) => ({
      ...v,
      changed: v.changedFields
        .map(snapshotField)
        .filter((field): field is SnapshotField => field !== null),
    }));
}
