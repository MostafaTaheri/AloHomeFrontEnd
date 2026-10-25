/**
 * React Query keys. Every key starts with the scheme id (or "bo" for the back office) so a
 * scheme switch or a write can invalidate exactly the data it affects.
 */
export const qk = {
  schemes: ["schemes"] as const,
  scheme: (id: number) => ["scheme", id] as const,
  context: (id: number) => ["scheme", id, "context"] as const,
  lots: (id: number) => ["scheme", id, "lots"] as const,

  imports: (id: number) => ["scheme", id, "imports"] as const,
  importList: (id: number, params: object) => ["scheme", id, "imports", "list", params] as const,
  import: (id: number, importId: string) => ["scheme", id, "imports", importId] as const,
  importPreview: (id: number, importId: string) =>
    ["scheme", id, "imports", importId, "preview"] as const,
  importErrors: (id: number, importId: string, params: object) =>
    ["scheme", id, "imports", importId, "errors", params] as const,

  expenses: (id: number) => ["scheme", id, "expenses"] as const,
  spend: (id: number, params: object) => ["scheme", id, "expenses", "spend", params] as const,
  comparison: (id: number, params: object) =>
    ["scheme", id, "expenses", "comparison", params] as const,
  flags: (id: number, params: object) => ["scheme", id, "expenses", "flags", params] as const,
  records: (id: number, params: object) => ["scheme", id, "records", params] as const,
  categories: (id: number) => ["scheme", id, "categories"] as const,
  suppliers: (id: number) => ["scheme", id, "suppliers"] as const,
  periods: (id: number) => ["scheme", id, "periods"] as const,

  arrears: (id: number) => ["scheme", id, "arrears"] as const,
  arrearsSummary: (id: number, asOf?: string) =>
    ["scheme", id, "arrears", "summary", asOf ?? null] as const,
  arrearsLots: (id: number, params: object) => ["scheme", id, "arrears", "lots", params] as const,
  arrearsHistory: (id: number, lotId: number) =>
    ["scheme", id, "arrears", "history", lotId] as const,
  arrearsTrend: (id: number) => ["scheme", id, "arrears", "trend"] as const,
  riskSignals: (id: number) => ["scheme", id, "arrears", "risk"] as const,
  arrearsSettings: (id: number) => ["scheme", id, "arrears", "settings"] as const,
  arrearsActions: (id: number, params: object) =>
    ["scheme", id, "arrears", "actions", params] as const,

  capital: (id: number) => ["scheme", id, "capital"] as const,
  capitalItems: (id: number, includeClosed: boolean) =>
    ["scheme", id, "capital", "items", includeClosed] as const,
  scenarios: (id: number) => ["scheme", id, "capital", "scenarios"] as const,
  fundingGap: (id: number, scenarioId: string) =>
    ["scheme", id, "capital", "gap", scenarioId] as const,
  compare: (id: number, ids: string[]) => ["scheme", id, "capital", "compare", ids] as const,

  ai: (id: number) => ["scheme", id, "ai"] as const,
  insights: (id: number, params: object) => ["scheme", id, "ai", "insights", params] as const,
  suggestions: (id: number, status: string) => ["scheme", id, "ai", "suggestions", status] as const,

  health: (id: number, asOf?: string) => ["scheme", id, "health", asOf ?? null] as const,
  monthly: (id: number, periodDate?: string) =>
    ["scheme", id, "monthly", periodDate ?? null] as const,
  reports: (id: number, params: object) => ["scheme", id, "reports", params] as const,
  report: (id: number, reportId: string) => ["scheme", id, "reports", reportId] as const,
  feedback: (id: number, params: object) => ["scheme", id, "feedback", params] as const,

  bo: {
    schemes: (params: object) => ["bo", "schemes", params] as const,
    scheme: (id: number) => ["bo", "scheme", id] as const,
    lots: (id: number, params: object) => ["bo", "scheme", id, "lots", params] as const,
    members: (id: number, params: object) => ["bo", "scheme", id, "members", params] as const,
    audit: (params: object) => ["bo", "audit", params] as const,
    pilotMetrics: (id: number) => ["bo", "pilot", id] as const,
    pilotFeedback: (params: object) => ["bo", "pilot", "feedback", params] as const,
  },
};
