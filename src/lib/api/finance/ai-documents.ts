import { apiRequest } from "../client";
import { asList, unwrap } from "../envelope";
import { FundType } from "./enums";
import type { DataFreshness, FundName } from "./types";

/**
 * AI invoice extraction (AI-02) and contextual questions (AI-07). Extraction proposes values from
 * a PDF's text layer; nothing reaches the books until a person accepts it. Questions are mapped
 * to one of a fixed set of intents and answered from verified data, not by the model.
 */

export type ExtractionStatusName = "PendingReview" | "Accepted" | "Rejected" | "Failed";

export interface ExtractedField {
  name: string;
  value: string | null;
  confidence: number;
  /** Whether the value was found in the document's text. Ungrounded values score 0. */
  grounded: boolean;
}

export interface ExtractionSuggestion {
  amount: number | null;
  transactionDate: string | null;
  dueDate: string | null;
  supplierId: string | null;
  supplierName: string | null;
  externalReference: string | null;
  description: string | null;
}

export interface DocumentExtraction {
  origin: string;
  id: string;
  fileName: string;
  pageCount: number;
  status: ExtractionStatusName | string;
  overallConfidence: number;
  fields: ExtractedField[];
  suggestion: ExtractionSuggestion;
  modelName: string;
  modelVersion: string;
  promptTemplateId: string;
  promptTemplateVersion: string;
  failureReason: string | null;
  reviewedBy: string | null;
  reviewedAtUtc: string | null;
  reviewNote: string | null;
  financialRecordId: string | null;
}

export interface AcceptExtractionInput {
  amount: number;
  transactionDate: string;
  dueDate?: string;
  supplierId?: string;
  categoryId?: string;
  fund: FundName;
  externalReference?: string;
  description?: string;
  note?: string;
}

export type AnswerStatusName = "Answered" | "Unsupported" | "Unavailable";

export interface QuestionAnswer {
  origin: string;
  insightId: string | null;
  status: AnswerStatusName | string;
  question: string;
  intent: string | null;
  period: string | null;
  from: string | null;
  to: string | null;
  currency: string;
  answer: string;
  figures: { label: string; amount: number }[];
  evidenceRecordIds: string[];
  confidence: number;
  modelName: string;
  modelVersion: string;
  promptTemplateId: string;
  promptTemplateVersion: string;
  supportedQuestions: string[];
  freshness: DataFreshness | null;
  disclaimer: string;
}

/** The API refuses PDFs over 10 MB and anything that is not a PDF. */
export const MAX_EXTRACTION_BYTES = 10 * 1024 * 1024;
export const MAX_QUESTION_LENGTH = 500;

type Signal = { signal?: AbortSignal };
const ai = (schemeId: number, path: string) => `schemes/${schemeId}/ai/${path}`;
const normalise = (e: DocumentExtraction): DocumentExtraction => ({
  ...e,
  fields: asList<ExtractedField>(e?.fields),
});

export const aiDocumentsApi = {
  list: async (schemeId: number, status?: ExtractionStatusName, opts: Signal = {}) =>
    asList<DocumentExtraction>(
      unwrap(
        await apiRequest(ai(schemeId, "document-extractions"), { ...opts, query: { status } }),
      ),
    ).map(normalise),
  get: async (schemeId: number, id: string, opts: Signal = {}) =>
    normalise(
      unwrap<DocumentExtraction>(
        await apiRequest(ai(schemeId, `document-extractions/${id}`), opts),
      ),
    ),
  upload: async (schemeId: number, file: File) => {
    const form = new FormData();
    form.set("File", file, file.name);
    return normalise(
      unwrap<DocumentExtraction>(
        await apiRequest(ai(schemeId, "document-extractions"), { method: "POST", form }),
      ),
    );
  },
  accept: async (schemeId: number, id: string, input: AcceptExtractionInput) =>
    normalise(
      unwrap<DocumentExtraction>(
        await apiRequest(ai(schemeId, `document-extractions/${id}/accept`), {
          method: "POST",
          body: {
            amount: input.amount,
            transactionDate: input.transactionDate,
            dueDate: input.dueDate || undefined,
            supplierId: input.supplierId || undefined,
            categoryId: input.categoryId || undefined,
            fund: FundType.toNumber(input.fund),
            externalReference: input.externalReference || undefined,
            description: input.description || undefined,
            note: input.note || undefined,
          },
        }),
      ),
    ),
  reject: async (schemeId: number, id: string, note?: string) =>
    normalise(
      unwrap<DocumentExtraction>(
        await apiRequest(ai(schemeId, `document-extractions/${id}/reject`), {
          method: "POST",
          body: { note: note || undefined },
        }),
      ),
    ),
};

export const aiQuestionsApi = {
  ask: async (schemeId: number, question: string) => {
    const result = unwrap<QuestionAnswer>(
      await apiRequest(ai(schemeId, "questions"), { method: "POST", body: { question } }),
    );
    return {
      ...result,
      figures: asList<{ label: string; amount: number }>(result?.figures),
      supportedQuestions: asList<string>(result?.supportedQuestions),
      evidenceRecordIds: asList<string>(result?.evidenceRecordIds),
    };
  },
};

/** Browser-side checks before upload. The API repeats them. */
export function checkExtractionFile(file: File): "type" | "size" | "empty" | null {
  if (file.size === 0) return "empty";
  if (file.size > MAX_EXTRACTION_BYTES) return "size";
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  return isPdf ? null : "type";
}
