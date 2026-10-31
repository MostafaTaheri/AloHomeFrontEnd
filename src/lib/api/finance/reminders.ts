import { apiRequest } from "../client";
import { asList, unwrap } from "../envelope";

/**
 * Arrears reminder batches (ARR-08). A batch is drafted from the arrears snapshot, reviewed, and
 * approved by a second person with ApproveReminders before any message is sent.
 */

export type ReminderBatchStatusName = "Draft" | "Approved" | "Rejected";
export type ReminderItemStatusName = "Pending" | "Queued" | "Sent" | "Failed" | "Skipped";

export interface ReminderItem {
  id: string;
  lotId: number;
  lotNumber: string;
  hasRecipient: boolean;
  overdue: number;
  daysOverdue: number;
  hasPaymentPlan: boolean;
  status: ReminderItemStatusName | string;
  skipReason: string | null;
  sentAtUtc: string | null;
  error: string | null;
}

export interface ReminderBatch {
  id: string;
  status: ReminderBatchStatusName | string;
  asOf: string;
  minimumOverdue: number;
  minimumDaysOverdue: number;
  includePaymentPlans: boolean;
  language: string;
  currency: string;
  note: string | null;
  createdBy: string;
  reviewedBy: string | null;
  reviewedAtUtc: string | null;
  rejectionReason: string | null;
  sendableCount: number;
  totalOverdue: number;
  messagePreview: string;
  definition: string;
  disclaimer: string;
  items: ReminderItem[];
}

export interface CreateReminderBatchInput {
  asOf?: string;
  minimumOverdue: number;
  minimumDaysOverdue: number;
  includePaymentPlans: boolean;
  note?: string;
}

type Signal = { signal?: AbortSignal };
const path = (schemeId: number, rest = "") =>
  `schemes/${schemeId}/arrears/reminders${rest ? `/${rest}` : ""}`;
const normalise = (batch: ReminderBatch): ReminderBatch => ({
  ...batch,
  items: asList<ReminderItem>(batch?.items),
});

export const remindersApi = {
  list: async (schemeId: number, status?: ReminderBatchStatusName, opts: Signal = {}) =>
    asList<ReminderBatch>(
      unwrap(await apiRequest(path(schemeId), { ...opts, query: { status } })),
    ).map(normalise),
  get: async (schemeId: number, batchId: string, opts: Signal = {}) =>
    normalise(unwrap<ReminderBatch>(await apiRequest(path(schemeId, batchId), opts))),
  create: async (schemeId: number, input: CreateReminderBatchInput) =>
    normalise(
      unwrap<ReminderBatch>(
        await apiRequest(path(schemeId), {
          method: "POST",
          body: { ...input, asOf: input.asOf || undefined, note: input.note || undefined },
        }),
      ),
    ),
  excludeLot: async (schemeId: number, batchId: string, lotId: number) =>
    normalise(
      unwrap<ReminderBatch>(
        await apiRequest(path(schemeId, `${batchId}/lots/${lotId}/exclude`), { method: "POST" }),
      ),
    ),
  approve: async (schemeId: number, batchId: string) =>
    normalise(
      unwrap<ReminderBatch>(
        await apiRequest(path(schemeId, `${batchId}/approve`), { method: "POST" }),
      ),
    ),
  reject: async (schemeId: number, batchId: string, reason: string) =>
    normalise(
      unwrap<ReminderBatch>(
        await apiRequest(path(schemeId, `${batchId}/reject`), {
          method: "POST",
          body: { reason },
        }),
      ),
    ),
};
