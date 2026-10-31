import { apiRequest } from "./client";
import { asList, unwrap } from "./envelope";

/**
 * Product governance catalogue (GOV-01..04): the narrative, which features are in the pilot
 * wedge, the market data dictionary and the pilot scope. Any signed-in person can read it.
 *
 * Unlike every other result, `FeatureDecision.status` is serialised as a number.
 */

export const FEATURE_STATUS: Record<number, FeatureStatusName> = {
  1: "Active",
  2: "Frozen",
  3: "Deferred",
  4: "Rejected",
};
export type FeatureStatusName = "Active" | "Frozen" | "Deferred" | "Rejected";

/** Normalises the numeric (or, from a newer API, named) feature status. */
export function featureStatusName(value: number | string): FeatureStatusName | string {
  if (typeof value === "number") return FEATURE_STATUS[value] ?? String(value);
  const n = Number(value);
  return Number.isInteger(n) && FEATURE_STATUS[n] ? FEATURE_STATUS[n] : value;
}

export interface FeatureDecision {
  key: string;
  name: string;
  status: number | string;
  reason: string;
  wedge: string;
  stories: string[];
  decidedOn: string;
}

export interface ProductNarrative {
  version: string;
  statement: string;
  statementFa: string;
  questions: string[];
  boundaries: string[];
}

export interface PilotScope {
  minimumLots: number;
  maximumLots: number;
  jurisdictions: string[];
  modules: string[];
  dataRules: string[];
  successCriteria: string[];
  exitConditions: string[];
}

export interface ProductGovernance {
  version: string;
  checksum: string;
  narrative: ProductNarrative;
  features: FeatureDecision[];
  pilot: PilotScope;
}

export interface DataDictionaryEntry {
  key: string;
  canonical: string;
  local: string;
  definition: string;
  modelReference: string;
}

export interface DataDictionary {
  version: string;
  jurisdictionCode: string;
  language: string;
  terms: DataDictionaryEntry[];
}

type Signal = { signal?: AbortSignal };

export const productApi = {
  governance: async (opts: Signal = {}) => {
    const result = unwrap<ProductGovernance>(await apiRequest("product/governance", opts));
    return { ...result, features: asList<FeatureDecision>(result?.features) };
  },
  dataDictionary: async (jurisdiction: string, opts: Signal = {}) =>
    unwrap<DataDictionary>(
      await apiRequest("product/data-dictionary", { ...opts, query: { jurisdiction } }),
    ),
  pilotScope: async (opts: Signal = {}) =>
    unwrap<PilotScope>(await apiRequest("product/pilot-scope", opts)),
};
