import { apiDownload, apiRequest, type DownloadResult } from "../client";
import { asList, asPage, unwrap, type Page } from "../envelope";
import {
  AiReviewStatus,
  ArrearsActionStatus,
  CapitalWorkPriority,
  CapitalWorkStatus,
  ExpenseFlagStatus,
  ExpenseFlagType,
  FeedbackRating,
  FeedbackSubjectType,
  FundType,
  ImportKind,
  SpendGrouping,
  SuggestionStatus,
} from "./enums";
import type {
  AgeingSettings,
  AiInsight,
  ArrearsAction,
  ArrearsSummary,
  ArrearsTrend,
  CapitalWorkItem,
  CategorySuggestion,
  ExpenseCategory,
  ExpenseFlag,
  FinancialHealth,
  FinancialPeriod,
  FinancialRecord,
  FinancialRecordList,
  FundingComparison,
  FundingProjection,
  FundingScenario,
  HealthReport,
  ImportBatch,
  ImportIssue,
  ImportKindName,
  ImportPreview,
  InsightFeedback,
  LotBalance,
  LotHistory,
  LotSummary,
  MonthlySummary,
  RiskSignals,
  SchemeContext,
  SchemeSummary,
  SpendBreakdown,
  SpendComparison,
  SuggestCategoriesResult,
  Supplier,
} from "./types";

const scheme = (id: number, path = "") => `schemes/${id}${path ? `/${path}` : ""}`;

type Signal = { signal?: AbortSignal };

// ----------------------------------------------------------------- schemes

export const schemesApi = {
  mine: async (opts: Signal = {}) =>
    asList<SchemeSummary>(unwrap(await apiRequest("schemes/mine", opts))),
  context: async (schemeId: number, opts: Signal = {}) =>
    unwrap<SchemeContext>(await apiRequest(scheme(schemeId, "context"), opts)),
  lots: async (schemeId: number, opts: Signal = {}) =>
    asList<LotSummary>(unwrap(await apiRequest(scheme(schemeId, "lots"), opts))),
};

// ----------------------------------------------------------------- imports

export interface ImportMappingInput {
  mapping: Record<string, string>;
}

export const importsApi = {
  list: async (
    schemeId: number,
    params: { kind?: ImportKindName; page?: number; pageSize?: number } = {},
    opts: Signal = {},
  ): Promise<Page<ImportBatch>> =>
    asPage<ImportBatch>(
      unwrap(
        await apiRequest(scheme(schemeId, "imports"), {
          ...opts,
          query: {
            kind: params.kind ? ImportKind.toNumber(params.kind) : undefined,
            page: params.page,
            pageSize: params.pageSize,
          },
        }),
      ),
    ),
  get: async (schemeId: number, importId: string, opts: Signal = {}) =>
    unwrap<ImportBatch>(await apiRequest(scheme(schemeId, `imports/${importId}`), opts)),
  upload: async (schemeId: number, kind: ImportKindName, file: File) => {
    const form = new FormData();
    form.set("Kind", String(ImportKind.toNumber(kind)));
    form.set("File", file, file.name);
    return unwrap<ImportBatch>(
      await apiRequest(scheme(schemeId, "imports"), { method: "POST", form }),
    );
  },
  saveMapping: async (schemeId: number, importId: string, mapping: Record<string, string>) =>
    unwrap<ImportBatch>(
      await apiRequest(scheme(schemeId, `imports/${importId}/mapping`), {
        method: "PUT",
        body: { mapping },
      }),
    ),
  preview: async (schemeId: number, importId: string, take = 50, opts: Signal = {}) =>
    unwrap<ImportPreview>(
      await apiRequest(scheme(schemeId, `imports/${importId}/preview`), {
        ...opts,
        query: { take },
      }),
    ),
  errors: async (
    schemeId: number,
    importId: string,
    params: { severity?: "Error" | "Warning"; page?: number; pageSize?: number } = {},
    opts: Signal = {},
  ): Promise<Page<ImportIssue>> =>
    asPage<ImportIssue>(
      unwrap(
        await apiRequest(scheme(schemeId, `imports/${importId}/errors`), {
          ...opts,
          query: {
            severity: params.severity ? (params.severity === "Error" ? 1 : 2) : undefined,
            page: params.page,
            pageSize: params.pageSize,
          },
        }),
      ),
    ),
  commit: async (schemeId: number, importId: string) =>
    unwrap<ImportBatch>(
      await apiRequest(scheme(schemeId, `imports/${importId}/commit`), { method: "POST" }),
    ),
  controlTotal: async (schemeId: number, importId: string, controlTotal: number | null) =>
    unwrap<ImportBatch>(
      await apiRequest(scheme(schemeId, `imports/${importId}/control-total`), {
        method: "POST",
        body: { controlTotal },
      }),
    ),
  retry: async (
    schemeId: number,
    importId: string,
    file: File,
    options: { mapping?: Record<string, string>; controlTotal?: number | null } = {},
  ) => {
    const form = new FormData();
    form.set("File", file, file.name);
    if (options.controlTotal !== undefined && options.controlTotal !== null) {
      form.set("ControlTotal", String(options.controlTotal));
    }
    for (const [field, column] of Object.entries(options.mapping ?? {})) {
      form.set(`Mapping[${field}]`, column);
    }
    return unwrap<ImportBatch>(
      await apiRequest(scheme(schemeId, `imports/${importId}/retry`), { method: "POST", form }),
    );
  },
};

// ----------------------------------------------------------------- expenses

export type FundFilter = "Admin" | "CapitalWorks" | undefined;

export const expensesApi = {
  spend: async (
    schemeId: number,
    params: {
      groupBy: "Month" | "Category" | "Supplier";
      from?: string;
      to?: string;
      fund?: FundFilter;
    },
    opts: Signal = {},
  ) =>
    unwrap<SpendBreakdown>(
      await apiRequest(scheme(schemeId, "expenses/spend"), {
        ...opts,
        query: {
          groupBy: SpendGrouping.toNumber(params.groupBy),
          from: params.from,
          to: params.to,
          fund: params.fund ? FundType.toNumber(params.fund) : undefined,
        },
      }),
    ),
  comparison: async (
    schemeId: number,
    params: { periodDate?: string; fund?: FundFilter } = {},
    opts: Signal = {},
  ) =>
    unwrap<SpendComparison>(
      await apiRequest(scheme(schemeId, "expenses/comparison"), {
        ...opts,
        query: {
          periodDate: params.periodDate,
          fund: params.fund ? FundType.toNumber(params.fund) : undefined,
        },
      }),
    ),
  flags: async (
    schemeId: number,
    params: {
      type?: "Duplicate" | "UnusualSpend";
      status?: "Open" | "Confirmed" | "Dismissed" | "Investigating";
      page?: number;
      pageSize?: number;
    } = {},
    opts: Signal = {},
  ): Promise<Page<ExpenseFlag>> =>
    asPage<ExpenseFlag>(
      unwrap(
        await apiRequest(scheme(schemeId, "expenses/flags"), {
          ...opts,
          query: {
            type: params.type ? ExpenseFlagType.toNumber(params.type) : undefined,
            status: params.status ? ExpenseFlagStatus.toNumber(params.status) : undefined,
            page: params.page,
            pageSize: params.pageSize,
          },
        }),
      ),
    ),
  flag: async (schemeId: number, flagId: string, opts: Signal = {}) =>
    unwrap<ExpenseFlag>(await apiRequest(scheme(schemeId, `expenses/flags/${flagId}`), opts)),
  detect: async (schemeId: number) =>
    unwrap<unknown>(
      await apiRequest(scheme(schemeId, "expenses/flags/detect"), { method: "POST" }),
    ),
  review: async (
    schemeId: number,
    flagId: string,
    status: "Confirmed" | "Dismissed" | "Investigating" | "Open",
    note: string,
  ) =>
    unwrap<ExpenseFlag>(
      await apiRequest(scheme(schemeId, `expenses/flags/${flagId}/review`), {
        method: "POST",
        body: { status: ExpenseFlagStatus.toNumber(status), note: note || null },
      }),
    ),
};

export const financeApi = {
  periods: async (schemeId: number, fiscalYear?: number, opts: Signal = {}) =>
    asList<FinancialPeriod>(
      unwrap(
        await apiRequest(scheme(schemeId, "financial-periods"), { ...opts, query: { fiscalYear } }),
      ),
    ),
  records: async (
    schemeId: number,
    params: {
      /** FinancialRecordType number (1 = Expense, 2 = Levy, 3 = Payment, ...). */
      recordType?: number;
      fund?: FundFilter;
      from?: string;
      to?: string;
      categoryId?: string;
      supplierId?: string;
      lotId?: number;
      importBatchId?: string;
      verifiedOnly?: boolean;
      page?: number;
      pageSize?: number;
    } = {},
    opts: Signal = {},
  ): Promise<FinancialRecordList> => {
    const raw = unwrap<{ records?: unknown; total?: number; currency?: string }>(
      await apiRequest(scheme(schemeId, "financial-records"), {
        ...opts,
        query: {
          recordTypes: params.recordType,
          fund: params.fund ? FundType.toNumber(params.fund) : undefined,
          from: params.from,
          to: params.to,
          categoryId: params.categoryId,
          supplierId: params.supplierId,
          lotId: params.lotId,
          importBatchId: params.importBatchId,
          verifiedOnly: params.verifiedOnly,
          page: params.page,
          pageSize: params.pageSize,
        },
      }),
    );
    return {
      records: asPage<FinancialRecord>(raw?.records),
      total: raw?.total ?? 0,
      currency: raw?.currency ?? "",
    };
  },
  suppliers: async (schemeId: number, opts: Signal = {}) =>
    asList<Supplier>(
      unwrap(
        await apiRequest(scheme(schemeId, "suppliers"), { ...opts, query: { pageSize: 200 } }),
      ),
    ),
  categories: async (schemeId: number, opts: Signal = {}) =>
    asList<ExpenseCategory>(unwrap(await apiRequest(scheme(schemeId, "expense-categories"), opts))),
};

// ----------------------------------------------------------------- arrears

export const arrearsApi = {
  summary: async (schemeId: number, asOf?: string, opts: Signal = {}) =>
    unwrap<ArrearsSummary>(
      await apiRequest(scheme(schemeId, "arrears/summary"), { ...opts, query: { asOf } }),
    ),
  lots: async (
    schemeId: number,
    params: { asOf?: string; onlyInArrears?: boolean } = {},
    opts: Signal = {},
  ) =>
    asList<LotBalance>(
      unwrap(await apiRequest(scheme(schemeId, "arrears/lots"), { ...opts, query: params })),
    ),
  history: async (
    schemeId: number,
    lotId: number,
    params: { from?: string; to?: string } = {},
    opts: Signal = {},
  ) =>
    unwrap<LotHistory>(
      await apiRequest(scheme(schemeId, `arrears/lots/${lotId}/history`), {
        ...opts,
        query: params,
      }),
    ),
  setPaymentPlan: async (schemeId: number, lotId: number, hasPaymentPlan: boolean, note: string) =>
    unwrap<unknown>(
      await apiRequest(scheme(schemeId, `arrears/lots/${lotId}/payment-plan`), {
        method: "PUT",
        body: { hasPaymentPlan, note: note || null },
      }),
    ),
  trend: async (schemeId: number, periods = 12, opts: Signal = {}) =>
    unwrap<ArrearsTrend>(
      await apiRequest(scheme(schemeId, "arrears/trend"), { ...opts, query: { periods } }),
    ),
  riskSignals: async (schemeId: number, asOf?: string, opts: Signal = {}) =>
    unwrap<RiskSignals>(
      await apiRequest(scheme(schemeId, "arrears/risk-signals"), { ...opts, query: { asOf } }),
    ),
  settings: async (schemeId: number, opts: Signal = {}) =>
    unwrap<AgeingSettings>(await apiRequest(scheme(schemeId, "arrears/settings"), opts)),
  saveSettings: async (
    schemeId: number,
    settings: Pick<AgeingSettings, "bucketBoundaries" | "concentrationTopN">,
  ) =>
    unwrap<AgeingSettings>(
      await apiRequest(scheme(schemeId, "arrears/settings"), { method: "PUT", body: settings }),
    ),
  actions: async (
    schemeId: number,
    params: {
      status?: "Open" | "InReview" | "Resolved" | "Dismissed";
      lotId?: number;
      page?: number;
      pageSize?: number;
    } = {},
    opts: Signal = {},
  ): Promise<Page<ArrearsAction>> =>
    asPage<ArrearsAction>(
      unwrap(
        await apiRequest(scheme(schemeId, "arrears/actions"), {
          ...opts,
          query: {
            status: params.status ? ArrearsActionStatus.toNumber(params.status) : undefined,
            lotId: params.lotId,
            page: params.page,
            pageSize: params.pageSize,
          },
        }),
      ),
    ),
  createAction: async (schemeId: number, input: { lotId: number; reason: string }) =>
    unwrap<ArrearsAction>(
      await apiRequest(scheme(schemeId, "arrears/actions"), { method: "POST", body: input }),
    ),
  changeActionStatus: async (
    schemeId: number,
    actionId: string,
    status: "Open" | "InReview" | "Resolved" | "Dismissed",
    note: string,
  ) =>
    unwrap<ArrearsAction>(
      await apiRequest(scheme(schemeId, `arrears/actions/${actionId}/status`), {
        method: "POST",
        body: { status: ArrearsActionStatus.toNumber(status), note: note || null },
      }),
    ),
  addNote: async (schemeId: number, actionId: string, text: string) =>
    unwrap<ArrearsAction>(
      await apiRequest(scheme(schemeId, `arrears/actions/${actionId}/notes`), {
        method: "POST",
        body: { text },
      }),
    ),
};

// ----------------------------------------------------------------- capital works

export interface CapitalWorkItemInput {
  title: string;
  component: string;
  description: string;
  targetFiscalYear: number;
  priority: "Low" | "Medium" | "High" | "Critical";
  estimate: number;
  estimateDate?: string;
  estimateSource?: string;
}

export interface ScenarioInput {
  name: string;
  openingBalance: number | null;
  annualContribution: number;
  contributionGrowthPercent: number;
  interestPercent: number;
  costEscalationPercent: number;
  startFiscalYear: number | null;
  horizonYears: number;
  isBaseline: boolean;
  notes: string;
}

export const capitalWorksApi = {
  items: async (schemeId: number, includeClosed = false, opts: Signal = {}) =>
    asList<CapitalWorkItem>(
      unwrap(
        await apiRequest(scheme(schemeId, "capital-works/items"), {
          ...opts,
          query: { includeClosed },
        }),
      ),
    ),
  createItem: async (schemeId: number, input: CapitalWorkItemInput) =>
    unwrap<CapitalWorkItem>(
      await apiRequest(scheme(schemeId, "capital-works/items"), {
        method: "POST",
        body: {
          title: input.title,
          component: input.component || null,
          description: input.description || null,
          targetFiscalYear: input.targetFiscalYear,
          priority: CapitalWorkPriority.toNumber(input.priority),
          estimate: input.estimate,
          estimateDate: input.estimateDate || null,
          estimateSource: input.estimateSource || null,
        },
      }),
    ),
  updateItem: async (
    schemeId: number,
    itemId: string,
    input: Omit<CapitalWorkItemInput, "estimate" | "estimateDate" | "estimateSource"> & {
      status: "Planned" | "InProgress" | "Completed" | "Deferred" | "Cancelled";
    },
  ) =>
    unwrap<CapitalWorkItem>(
      await apiRequest(scheme(schemeId, `capital-works/items/${itemId}`), {
        method: "PUT",
        body: {
          title: input.title,
          component: input.component || null,
          description: input.description || null,
          targetFiscalYear: input.targetFiscalYear,
          priority: CapitalWorkPriority.toNumber(input.priority),
          status: CapitalWorkStatus.toNumber(input.status),
        },
      }),
    ),
  addEstimate: async (
    schemeId: number,
    itemId: string,
    input: { amount: number; estimateDate?: string; source?: string; note?: string },
  ) =>
    unwrap<CapitalWorkItem>(
      await apiRequest(scheme(schemeId, `capital-works/items/${itemId}/estimates`), {
        method: "POST",
        body: {
          amount: input.amount,
          estimateDate: input.estimateDate || null,
          source: input.source || null,
          note: input.note || null,
        },
      }),
    ),
  scenarios: async (schemeId: number, opts: Signal = {}) =>
    asList<FundingScenario>(
      unwrap(await apiRequest(scheme(schemeId, "capital-works/scenarios"), opts)),
    ),
  createScenario: async (schemeId: number, input: ScenarioInput) =>
    unwrap<FundingScenario>(
      await apiRequest(scheme(schemeId, "capital-works/scenarios"), {
        method: "POST",
        body: { ...input, notes: input.notes || null },
      }),
    ),
  updateScenario: async (
    schemeId: number,
    scenarioId: string,
    input: Omit<ScenarioInput, "openingBalance" | "startFiscalYear"> & {
      openingBalance: number;
      startFiscalYear: number;
    },
  ) =>
    unwrap<FundingScenario>(
      await apiRequest(scheme(schemeId, `capital-works/scenarios/${scenarioId}`), {
        method: "PUT",
        body: { ...input, notes: input.notes || null },
      }),
    ),
  fundingGap: async (schemeId: number, scenarioId: string, opts: Signal = {}) =>
    unwrap<FundingProjection>(
      await apiRequest(scheme(schemeId, `capital-works/scenarios/${scenarioId}/funding-gap`), opts),
    ),
  compare: async (schemeId: number, scenarioIds: string[]) =>
    unwrap<FundingComparison>(
      await apiRequest(scheme(schemeId, "capital-works/scenarios/compare"), {
        method: "POST",
        body: { scenarioIds },
      }),
    ),
};

// ----------------------------------------------------------------- AI

export const aiApi = {
  explainFlag: async (schemeId: number, flagId: string, regenerate = false) =>
    unwrap<AiInsight>(
      await apiRequest(scheme(schemeId, `ai/expense-flags/${flagId}/explanation`), {
        method: "POST",
        query: { regenerate },
      }),
    ),
  insights: async (schemeId: number, params: { subjectId?: string } = {}, opts: Signal = {}) =>
    asList<AiInsight>(
      unwrap(
        await apiRequest(scheme(schemeId, "ai/insights"), {
          ...opts,
          query: {
            subjectType: params.subjectId ? 1 : undefined,
            subjectId: params.subjectId,
          },
        }),
      ),
    ),
  reviewInsight: async (
    schemeId: number,
    insightId: string,
    reviewStatus: "Useful" | "Incorrect" | "NeedsReview" | "Unreviewed",
    note: string,
  ) =>
    unwrap<AiInsight>(
      await apiRequest(scheme(schemeId, `ai/insights/${insightId}/review`), {
        method: "POST",
        body: { reviewStatus: AiReviewStatus.toNumber(reviewStatus), note: note || null },
      }),
    ),
  suggestCategories: async (
    schemeId: number,
    input: { importBatchId?: string; maxRecords?: number } = {},
  ) =>
    unwrap<SuggestCategoriesResult>(
      await apiRequest(scheme(schemeId, "ai/category-suggestions"), {
        method: "POST",
        body: { importBatchId: input.importBatchId ?? null, maxRecords: input.maxRecords ?? 50 },
      }),
    ),
  suggestions: async (
    schemeId: number,
    status: "Pending" | "Accepted" | "Rejected" = "Pending",
    opts: Signal = {},
  ) =>
    asList<CategorySuggestion>(
      unwrap(
        await apiRequest(scheme(schemeId, "ai/category-suggestions"), {
          ...opts,
          query: { status: SuggestionStatus.toNumber(status) },
        }),
      ),
    ),
  reviewSuggestion: async (schemeId: number, suggestionId: string, accept: boolean) =>
    unwrap<CategorySuggestion>(
      await apiRequest(scheme(schemeId, `ai/category-suggestions/${suggestionId}/review`), {
        method: "POST",
        body: { accept },
      }),
    ),
};

// ----------------------------------------------------------------- health, reports, feedback

export const healthApi = {
  health: async (schemeId: number, asOf?: string, opts: Signal = {}) =>
    unwrap<FinancialHealth>(
      await apiRequest(scheme(schemeId, "financial-health"), { ...opts, query: { asOf } }),
    ),
  monthly: async (schemeId: number, periodDate?: string, opts: Signal = {}) =>
    unwrap<MonthlySummary>(
      await apiRequest(scheme(schemeId, "monthly-summary"), { ...opts, query: { periodDate } }),
    ),
  reports: async (
    schemeId: number,
    params: { page?: number; pageSize?: number } = {},
    opts: Signal = {},
  ): Promise<Page<HealthReport>> =>
    asPage<HealthReport>(
      unwrap(await apiRequest(scheme(schemeId, "reports"), { ...opts, query: params })),
    ),
  report: async (schemeId: number, reportId: string, opts: Signal = {}) =>
    unwrap<HealthReport>(await apiRequest(scheme(schemeId, `reports/${reportId}`), opts)),
  generate: async (schemeId: number, input: { periodDate?: string; commentary?: string }) =>
    unwrap<HealthReport>(
      await apiRequest(scheme(schemeId, "reports"), {
        method: "POST",
        body: { periodDate: input.periodDate || null, commentary: input.commentary || null },
      }),
    ),
  saveCommentary: async (schemeId: number, reportId: string, commentary: string) =>
    unwrap<HealthReport>(
      await apiRequest(scheme(schemeId, `reports/${reportId}/commentary`), {
        method: "PUT",
        body: { commentary },
      }),
    ),
  pdf: (schemeId: number, reportId: string): Promise<DownloadResult> =>
    apiDownload(scheme(schemeId, `reports/${reportId}/pdf`)),
};

export interface FeedbackInput {
  subjectType: "ExpenseFlag" | "AiInsight" | "RiskSignal" | "Report" | "Dashboard" | "Metric";
  subjectId: string;
  rating: "Useful" | "NotUseful" | "Incorrect" | "NeedsReview";
  note?: string;
  actionTaken?: string;
  hoursSavedEstimate?: number | null;
}

export const feedbackApi = {
  submit: async (schemeId: number, input: FeedbackInput) =>
    unwrap<InsightFeedback>(
      await apiRequest(scheme(schemeId, "feedback"), {
        method: "POST",
        body: {
          subjectType: FeedbackSubjectType.toNumber(input.subjectType),
          subjectId: input.subjectId,
          rating: FeedbackRating.toNumber(input.rating),
          note: input.note || null,
          actionTaken: input.actionTaken || null,
          hoursSavedEstimate: input.hoursSavedEstimate ?? null,
        },
      }),
    ),
  list: async (
    schemeId: number,
    params: { subjectType?: FeedbackInput["subjectType"]; page?: number; pageSize?: number } = {},
    opts: Signal = {},
  ): Promise<Page<InsightFeedback>> =>
    asPage<InsightFeedback>(
      unwrap(
        await apiRequest(scheme(schemeId, "feedback"), {
          ...opts,
          query: {
            subjectType: params.subjectType
              ? FeedbackSubjectType.toNumber(params.subjectType)
              : undefined,
            page: params.page,
            pageSize: params.pageSize,
          },
        }),
      ),
    ),
};
