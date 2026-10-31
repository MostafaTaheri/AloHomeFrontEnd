import { apiRequest } from "../client";
import { asList, unwrap } from "../envelope";
import type { CapitalWorkItem, FundingScenario } from "./types";

/**
 * Funding sources for capital works items (CAP-04) and the contribution impact of a funding
 * scenario (CAP-08). External funding reduces what the capital works fund has to pay.
 */

export type FundingSourceTypeName =
  "CapitalWorksFund" | "AdminFund" | "SpecialLevy" | "Loan" | "Grant" | "Insurance" | "Other";

export const FUNDING_SOURCE_TYPES: Record<FundingSourceTypeName, number> = {
  CapitalWorksFund: 1,
  AdminFund: 2,
  SpecialLevy: 3,
  Loan: 4,
  Grant: 5,
  Insurance: 6,
  Other: 7,
};

export interface FundingSourceInput {
  sourceType: FundingSourceTypeName;
  amount: number;
  isConfirmed: boolean;
  note?: string;
}

export interface LotContribution {
  lotId: number;
  lotNumber: string;
  entitlement: number;
  sharePercent: number;
  currentAnnualContribution: number;
  specialLevy: number;
  annualIncrease: number;
}

export interface ContributionImpact {
  origin: string;
  scenario: FundingScenario;
  currency: string;
  maximumShortfall: number;
  firstShortfallYear: number | null;
  specialLevyTotal: number;
  requiredAnnualIncrease: number;
  newAnnualContribution: number;
  endingBalanceWithIncrease: number;
  totalEntitlement: number;
  lots: LotContribution[];
  definition: string;
  disclaimer: string;
}

type Signal = { signal?: AbortSignal };
const capital = (schemeId: number, path: string) => `schemes/${schemeId}/capital-works/${path}`;

export const capitalFundingApi = {
  addSource: async (schemeId: number, itemId: string, input: FundingSourceInput) =>
    unwrap<CapitalWorkItem>(
      await apiRequest(capital(schemeId, `items/${itemId}/funding-sources`), {
        method: "POST",
        body: {
          sourceType: FUNDING_SOURCE_TYPES[input.sourceType],
          amount: input.amount,
          isConfirmed: input.isConfirmed,
          note: input.note || undefined,
        },
      }),
    ),
  removeSource: async (schemeId: number, itemId: string, sourceId: string) =>
    unwrap<CapitalWorkItem>(
      await apiRequest(capital(schemeId, `items/${itemId}/funding-sources/${sourceId}`), {
        method: "DELETE",
      }),
    ),
  contributionImpact: async (schemeId: number, scenarioId: string, opts: Signal = {}) => {
    const result = unwrap<ContributionImpact>(
      await apiRequest(capital(schemeId, `scenarios/${scenarioId}/contribution-impact`), opts),
    );
    return { ...result, lots: asList<LotContribution>(result?.lots) };
  },
};

/** Total of the item's funding sources, and what would remain after adding `extra`. */
export function fundingHeadroom(item: Pick<CapitalWorkItem, "currentEstimate" | "fundingSources">) {
  const allocated = (item.fundingSources ?? []).reduce((sum, s) => sum + s.amount, 0);
  return { allocated, remaining: Math.max(0, item.currentEstimate - allocated) };
}
