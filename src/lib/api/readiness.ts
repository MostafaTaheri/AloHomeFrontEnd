import { apiRequest } from "./client";
import { asList, unwrap } from "./envelope";

/**
 * Funding readiness (GTM-04, 06..10): the multi-scheme portfolio and onboarding checklist on the
 * client, and the evidence pack, case study, pilot agreements and investor demo for staff.
 */

// ----------------------------------------------------------------- client

export interface PortfolioCurrencyTotal {
  currency: string;
  schemes: number;
  adminFund: number;
  capitalWorksFund: number;
  totalOutstanding: number;
  totalOverdue: number;
  maximumShortfall: number;
}

export interface PortfolioSchemeRow {
  schemeId: number;
  title: string;
  jurisdictionCode: string;
  currency: string;
  role: string;
  accessSource: string;
  adminFund: number;
  capitalWorksFund: number;
  totalOutstanding: number;
  totalOverdue: number;
  lotsInArrears: number;
  openExpenseFlags: number;
  firstShortfallYear: number | null;
  maximumShortfall: number;
  latestVerifiedDate: string | null;
  hasUnverifiedData: boolean;
  /** 0 (nothing to look at) to 5 (needs attention now). */
  attentionScore: number;
}

export interface Portfolio {
  origin: string;
  schemeCount: number;
  totals: PortfolioCurrencyTotal[];
  schemes: PortfolioSchemeRow[];
}

export interface OnboardingStep {
  order: number;
  code: string;
  title: string;
  done: boolean;
  evidence: string | null;
}

export interface OnboardingChecklist {
  schemeId: number;
  completedSteps: number;
  totalSteps: number;
  percentComplete: number;
  nextStep: string | null;
  steps: OnboardingStep[];
}

type Signal = { signal?: AbortSignal };

export const portfolioApi = {
  get: async (organisationId?: number, opts: Signal = {}) => {
    const result = unwrap<Portfolio>(
      await apiRequest("portfolio", { ...opts, query: { organisationId } }),
    );
    return {
      ...result,
      totals: asList<PortfolioCurrencyTotal>(result?.totals),
      schemes: asList<PortfolioSchemeRow>(result?.schemes),
    };
  },
  onboarding: async (schemeId: number, opts: Signal = {}) => {
    const result = unwrap<OnboardingChecklist>(
      await apiRequest(`schemes/${schemeId}/onboarding/checklist`, opts),
    );
    return { ...result, steps: asList<OnboardingStep>(result?.steps) };
  },
};

/** The workspace page that completes each onboarding step, relative to the scheme. */
export const ONBOARDING_LINKS: Record<string, string> = {
  lots: "property",
  members: "property?tab=committee",
  "office-holders": "property?tab=committee",
  "first-import": "imports",
  "first-verified": "imports",
  "first-dashboard": "",
  budget: "budgets",
  "capital-plan": "capital-works",
  "first-report": "reports",
  feedback: "feedback",
};

// ----------------------------------------------------------------- back office

export interface SecurityEvidence {
  generatedAtUtc: string;
  fromUtc: string;
  toUtc: string;
  productVersion: string;
  governanceChecksum: string;
  organisations: number;
  schemes: number;
  accessDeniedEventsAllTime: number;
  auditEntriesByCategory: Record<string, number>;
  controls: { area: string; control: string; evidence: string }[];
}

export interface CaseStudy {
  schemeId: number;
  displayName: string;
  publishable: boolean;
  jurisdictionCode: string;
  currency: string;
  lots: number;
  baselineHoursPerMonth: number | null;
  hoursSavedReported: number;
  hoursToFirstVerifiedDashboard: number | null;
  anomaliesFound: number;
  anomaliesConfirmed: number;
  moneyFlaggedConfirmed: number;
  reportsGenerated: number;
  pilotStatus: string | null;
  paidPilot: boolean;
  statements: string[];
}

export type PilotStatusName = "Prospect" | "Active" | "Converted" | "Lost";

export interface PilotAgreement {
  id: string;
  schemeId: number;
  status: PilotStatusName | string;
  pricePerLotMonthly: number;
  currency: string;
  lotCount: number;
  monthlyValue: number;
  isPaidPilot: boolean;
  startDate: string | null;
  plannedEndDate: string | null;
  convertedOn: string | null;
  lostOn: string | null;
  lostReason: string | null;
  baselineHoursPerMonth: number | null;
  caseStudyConsent: boolean;
  notes: string | null;
}

export interface PilotAgreementInput {
  pricePerLotMonthly: number;
  lotCount?: number;
  isPaidPilot: boolean;
  baselineHoursPerMonth?: number;
  caseStudyConsent: boolean;
  notes?: string;
}

export type PilotTransitionName = "Start" | "Convert" | "Lose";
export const PILOT_TRANSITIONS: Record<PilotTransitionName, number> = {
  Start: 1,
  Convert: 2,
  Lose: 3,
};

export interface PilotTransitionInput {
  transition: PilotTransitionName;
  date: string;
  plannedEndDate?: string;
  reason?: string;
}

export interface ConversionMetrics {
  byStatus: Record<string, number>;
  paidPilots: number;
  conversionRatePercent: number | null;
  averageDaysToConvert: number | null;
  monthlyRecurringRevenue: Record<string, number>;
  pipeline: Record<string, number>;
  lostReasons: Record<string, number>;
}

export interface InvestorFlow {
  schemeId: number;
  jurisdictionCode: string;
  currency: string;
  steps: { order: number; title: string; endpoint: string; highlight: string }[];
}

const bo = <T>(path: string, options: Parameters<typeof apiRequest>[1] = {}) =>
  apiRequest<T>(`backoffice/${path}`, { ...options, surface: "backoffice" });

export const boReadinessApi = {
  evidence: async (range: { fromUtc?: string; toUtc?: string } = {}, signal?: AbortSignal) =>
    unwrap<SecurityEvidence>(
      await bo("evidence/security", {
        signal,
        query: {
          fromUtc: range.fromUtc ? `${range.fromUtc}T00:00:00Z` : undefined,
          toUtc: range.toUtc ? `${range.toUtc}T23:59:59Z` : undefined,
        },
      }),
    ),
  caseStudy: async (schemeId: number, signal?: AbortSignal) =>
    unwrap<CaseStudy>(await bo(`schemes/${schemeId}/case-study`, { signal })),
  agreements: async (status?: PilotStatusName, signal?: AbortSignal) =>
    asList<PilotAgreement>(unwrap(await bo("pilot-agreements", { signal, query: { status } }))),
  metrics: async (signal?: AbortSignal) =>
    unwrap<ConversionMetrics>(await bo("pilot-agreements/metrics", { signal })),
  createAgreement: async (schemeId: number, input: PilotAgreementInput) =>
    unwrap<PilotAgreement>(
      await bo(`schemes/${schemeId}/pilot-agreement`, { method: "POST", body: input }),
    ),
  updateAgreement: async (id: string, input: PilotAgreementInput) =>
    unwrap<PilotAgreement>(await bo(`pilot-agreements/${id}`, { method: "PUT", body: input })),
  transition: async (id: string, input: PilotTransitionInput) =>
    unwrap<PilotAgreement>(
      await bo(`pilot-agreements/${id}/transition`, {
        method: "POST",
        body: {
          transition: PILOT_TRANSITIONS[input.transition],
          date: input.date,
          plannedEndDate: input.plannedEndDate || undefined,
          reason: input.reason || undefined,
        },
      }),
    ),
  investorFlow: async (jurisdiction: "AU-NSW" | "IR") =>
    unwrap<InvestorFlow>(
      await bo("demo/investor-flow", { method: "POST", query: { jurisdiction } }),
    ),
};

/** Maps an API path from the investor walkthrough to the screen that shows it, if any. */
export function screenForEndpoint(endpoint: string): string | null {
  const match = /\/schemes\/(\d+)\/([a-z-]+)(?:\/([a-z-]+))?/i.exec(endpoint);
  if (!match) return endpoint.includes("/portfolio") ? "/portfolio" : null;
  const [, id, area, sub] = match;
  const base = `/schemes/${id}`;
  switch (area) {
    case "financial-health":
    case "monthly-summary":
      return base;
    case "expenses":
      return sub === "flags" ? `${base}/expenses?tab=flags` : `${base}/expenses`;
    case "arrears":
      return sub === "risk-signals" ? `${base}/arrears?tab=risk` : `${base}/arrears`;
    case "capital-works":
      return sub === "scenarios" ? `${base}/capital-works?tab=scenarios` : `${base}/capital-works`;
    case "budgets":
      return `${base}/budgets?tab=actual`;
    case "ai":
      return sub === "questions" ? `${base}/ai-review?tab=ask` : `${base}/ai-review`;
    case "reports":
      return `${base}/reports`;
    default:
      return base;
  }
}
