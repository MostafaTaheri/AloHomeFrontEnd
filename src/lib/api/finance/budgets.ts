import { apiDownload, apiRequest, type DownloadResult } from "../client";
import { asList, unwrap } from "../envelope";
import { FundType } from "./enums";
import type { DataFreshness, FinancialHealth, FundName } from "./types";
import type { OfficeHolder } from "../property";

/**
 * Budgets (BUD-01..05) and the committee meeting pack (RPT-03). A budget is a version for one
 * fiscal year; approving one supersedes the previously approved version for that year. Figures
 * against actuals are deterministic and come with their definition and data freshness.
 */

export type BudgetStatusName = "Draft" | "Approved" | "Superseded";
export type VarianceStatusName =
  "WithinTolerance" | "OverBudget" | "UnderBudget" | "NotMeaningful" | "Unbudgeted";

export interface BudgetLine {
  id: string;
  categoryId: string | null;
  category: string | null;
  fund: FundName | string;
  annualAmount: number;
  /** Twelve percentages summing to 100, or null for an even split. */
  phasing: number[] | null;
  note: string | null;
}

export interface Budget {
  id: string;
  fiscalYear: number;
  versionNumber: number;
  name: string;
  status: BudgetStatusName | string;
  currency: string;
  notes: string | null;
  basedOnBudgetId: string | null;
  approvalReference: string | null;
  approvedBy: string | null;
  approvedAtUtc: string | null;
  totalAdmin: number;
  totalCapitalWorks: number;
  total: number;
  lines: BudgetLine[];
}

export interface BudgetVarianceLine {
  lineId: string | null;
  categoryId: string | null;
  category: string | null;
  /** A localised fund label, not the enum name. */
  fund: string;
  annualBudget: number;
  budgetToDate: number;
  actualToDate: number;
  /** Actual minus budget; positive is overspend. */
  variance: number;
  variancePercent: number | null;
  status: VarianceStatusName | string;
  forecastFullYear: number;
  forecastVariance: number;
  recordIds: string[];
}

export interface BudgetVsActual {
  origin: string;
  budgetId: string;
  budgetName: string;
  budgetVersion: number;
  fiscalYear: number;
  currency: string;
  asOf: string;
  periodsElapsed: number;
  tolerancePercent: number;
  totalAnnualBudget: number;
  totalBudgetToDate: number;
  totalActualToDate: number;
  totalVariance: number;
  totalForecast: number;
  lines: BudgetVarianceLine[];
  freshness: DataFreshness;
  definition: string;
  disclaimer: string;
}

export interface VarianceFinding {
  line: BudgetVarianceLine;
  explanation: string;
  topRecordIds: string[];
}

export interface VarianceAnalysis {
  origin: string;
  summary: BudgetVsActual;
  findings: VarianceFinding[];
}

export interface DecisionItem {
  code: "approve-budget" | "no-budget" | "review-expense-flag" | "approve-reminders" | string;
  text: string;
  referenceId: string | null;
}

export interface CommitteePack {
  origin: string;
  schemeId: number;
  schemeTitle: string;
  language: string;
  currency: string;
  asOf: string;
  meetingDate: string | null;
  generatedAtUtc: string;
  health: FinancialHealth;
  budgetVsActual: BudgetVsActual | null;
  committee: OfficeHolder[];
  decisionsRequired: DecisionItem[];
  disclaimer: string;
  rightToLeft: boolean;
}

export interface CreateBudgetInput {
  fiscalYear: number;
  name: string;
  notes?: string;
  copyFromBudgetId?: string;
}

export interface BudgetLineInput {
  categoryId?: string;
  fund: FundName;
  annualAmount: number;
  phasing?: number[] | null;
  note?: string;
}

export interface VarianceQuery {
  fiscalYear?: number;
  budgetId?: string;
  asOf?: string;
  tolerancePercent?: number;
}

type Signal = { signal?: AbortSignal };
const scheme = (id: number, path: string) => `schemes/${id}/${path}`;

const lineBody = (input: BudgetLineInput) => ({
  categoryId: input.categoryId || undefined,
  fund: FundType.toNumber(input.fund),
  annualAmount: input.annualAmount,
  phasing: input.phasing ?? null,
  note: input.note || undefined,
});

const normalise = (budget: Budget): Budget => ({
  ...budget,
  lines: asList<BudgetLine>(budget?.lines),
});

export const budgetsApi = {
  list: async (schemeId: number, fiscalYear?: number, opts: Signal = {}) =>
    asList<Budget>(
      unwrap(await apiRequest(scheme(schemeId, "budgets"), { ...opts, query: { fiscalYear } })),
    ).map(normalise),
  get: async (schemeId: number, budgetId: string, opts: Signal = {}) =>
    normalise(unwrap<Budget>(await apiRequest(scheme(schemeId, `budgets/${budgetId}`), opts))),
  create: async (schemeId: number, input: CreateBudgetInput) =>
    normalise(
      unwrap<Budget>(
        await apiRequest(scheme(schemeId, "budgets"), {
          method: "POST",
          body: {
            fiscalYear: input.fiscalYear,
            name: input.name,
            notes: input.notes || undefined,
            copyFromBudgetId: input.copyFromBudgetId || undefined,
          },
        }),
      ),
    ),
  addLine: async (schemeId: number, budgetId: string, input: BudgetLineInput) =>
    normalise(
      unwrap<Budget>(
        await apiRequest(scheme(schemeId, `budgets/${budgetId}/lines`), {
          method: "POST",
          body: lineBody(input),
        }),
      ),
    ),
  updateLine: async (schemeId: number, budgetId: string, lineId: string, input: BudgetLineInput) =>
    normalise(
      unwrap<Budget>(
        await apiRequest(scheme(schemeId, `budgets/${budgetId}/lines/${lineId}`), {
          method: "PUT",
          body: lineBody(input),
        }),
      ),
    ),
  deleteLine: async (schemeId: number, budgetId: string, lineId: string) =>
    normalise(
      unwrap<Budget>(
        await apiRequest(scheme(schemeId, `budgets/${budgetId}/lines/${lineId}`), {
          method: "DELETE",
        }),
      ),
    ),
  approve: async (schemeId: number, budgetId: string, approvalReference: string) =>
    normalise(
      unwrap<Budget>(
        await apiRequest(scheme(schemeId, `budgets/${budgetId}/approve`), {
          method: "POST",
          body: { approvalReference },
        }),
      ),
    ),
  vsActual: async (schemeId: number, query: VarianceQuery = {}, opts: Signal = {}) => {
    const result = unwrap<BudgetVsActual>(
      await apiRequest(scheme(schemeId, "budgets/vs-actual"), { ...opts, query: { ...query } }),
    );
    return { ...result, lines: asList<BudgetVarianceLine>(result?.lines) };
  },
  variance: async (schemeId: number, query: VarianceQuery = {}, opts: Signal = {}) => {
    const result = unwrap<VarianceAnalysis>(
      await apiRequest(scheme(schemeId, "budgets/variance"), { ...opts, query: { ...query } }),
    );
    return { ...result, findings: asList<VarianceFinding>(result?.findings) };
  },
};

export const committeePackApi = {
  get: async (
    schemeId: number,
    query: { asOf?: string; meetingDate?: string } = {},
    opts: Signal = {},
  ) =>
    unwrap<CommitteePack>(
      await apiRequest(scheme(schemeId, "reports/committee-pack"), { ...opts, query }),
    ),
  pdf: (schemeId: number, query: { asOf?: string; meetingDate?: string } = {}) =>
    apiDownload(scheme(schemeId, "reports/committee-pack/pdf"), {
      query,
    }) as Promise<DownloadResult>,
};
