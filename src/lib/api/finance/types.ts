/**
 * Response shapes of the AloHome finance API (camelCase JSON). Money is a plain number in the
 * scheme currency's major unit; dates are ISO strings ("2026-03-31" for date-only values and a
 * full instant for *Utc fields). Enum values arrive as strings. The unions list the values the
 * API defines today, and every label lookup falls back to the raw string so a new server value
 * degrades gracefully instead of breaking a screen.
 */

import type { Page } from "../envelope";

export type SchemeRoleName = "Manager" | "ReadOnly";
export type FundName = "Admin" | "CapitalWorks";

export interface SchemeSummary {
  schemeId: number;
  title: string;
  jurisdictionCode: string;
  currencyCode: string;
  role: SchemeRoleName | string;
}

export interface SchemeContext {
  schemeId: number;
  title: string;
  address: string;
  role: SchemeRoleName | string;
  jurisdictionCode: string;
  countryCode: string;
  currencyCode: string;
  currencyMinorUnits: number;
  timeZoneId: string;
  calendar: string;
  fiscalYearStartMonth: number;
  currentFiscalYear: number;
  currentPeriodLabel: string;
  defaultLanguage: string;
  adminFundLabel: string;
  capitalWorksFundLabel: string;
  disclaimer: string;
}

export interface LotSummary {
  id: number;
  status: string | number;
  lotNumber: string;
  area: number;
  rooms: number;
  floor: number;
  postalCode: string;
  vacateAt: string | null;
  role?: string;
}

export interface DataFreshness {
  latestVerifiedTransactionDate: string | null;
  latestVerifiedImportAtUtc: string | null;
  hasUnverifiedData: boolean;
  dataAgeDays: number | null;
  noVerifiedData: boolean;
}

// ---------------------------------------------------------------- imports

export type ImportKindName = "Expenses" | "Levies" | "ArrearsReport" | "CapitalWorksPlan";
export type ImportStatusName =
  "Uploaded" | "Mapped" | "Validated" | "Committed" | "Failed" | "Superseded";
export type ImportVerificationName = "Unverified" | "Verified" | "Mismatch";

export interface ImportBatch {
  id: string;
  kind: ImportKindName | string;
  fileName: string;
  fileHash: string;
  status: ImportStatusName | string;
  verification: ImportVerificationName | string;
  isVerified: boolean;
  headers: string[];
  mapping: Record<string, string>;
  requiredFields: string[];
  optionalFields: string[];
  missingRequiredFields: string[];
  totalRows: number;
  validRows: number;
  errorRows: number;
  duplicateRows: number;
  fileTotal: number;
  importedTotal: number;
  controlTotal: number | null;
  difference: number | null;
  currency: string;
  retryOfBatchId: string | null;
  supersededByBatchId: string | null;
  uploadedBy: string | null;
  uploadedAtUtc: string;
  committedAtUtc: string | null;
  verifiedAtUtc: string | null;
  failureReason: string | null;
}

export interface ImportIssue {
  rowNumber: number;
  field: string | null;
  value: string | null;
  reason: string;
  suggestedFix: string | null;
  severity: "Error" | "Warning" | string;
}

export interface ImportRowPreview {
  rowNumber: number;
  status: string;
  values: Record<string, string>;
  amount: number;
  lot: string | null;
  category: string | null;
  issues: ImportIssue[];
}

export interface ImportPreview {
  import: ImportBatch;
  rows: ImportRowPreview[];
  mappingIssues: ImportIssue[];
  canCommit: boolean;
}

// ---------------------------------------------------------------- expenses

export interface SpendBreakdownItem {
  key: string;
  label: string;
  amount: number;
  recordCount: number;
  sharePercent: number;
  periodStart: string | null;
  periodEnd: string | null;
}

export interface SpendBreakdown {
  groupBy: string;
  from: string;
  to: string;
  currency: string;
  total: number;
  recordCount: number;
  items: SpendBreakdownItem[];
  freshness: DataFreshness | null;
  definition: string;
}

export interface Comparison {
  current: number;
  previous: number;
  change: number;
  changePercent: number | null;
  notMeaningful: boolean;
  notMeaningfulReason: string | null;
}

export interface CategoryComparison {
  categoryId: string | null;
  category: string;
  monthOverMonth: Comparison;
  yearOverYear: Comparison;
}

export interface SpendComparison {
  currency: string;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  previousPeriodLabel: string;
  samePeriodLastYearLabel: string;
  monthOverMonth: Comparison;
  yearOverYear: Comparison;
  byCategory: CategoryComparison[];
  freshness: DataFreshness | null;
  monthOverMonthDefinition: string;
  yearOverYearDefinition: string;
}

export type ExpenseFlagTypeName = "Duplicate" | "UnusualSpend";
export type ExpenseFlagStatusName = "Open" | "Confirmed" | "Dismissed" | "Investigating";

export interface ExpenseFlag {
  id: string;
  type: ExpenseFlagTypeName | string;
  status: ExpenseFlagStatusName | string;
  dimension: string | null;
  categoryId: string | null;
  category: string | null;
  supplierId: string | null;
  supplier: string | null;
  periodLabel: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  observedAmount: number;
  baselineAmount: number | null;
  baselinePeriods: number | null;
  thresholdPercent: number | null;
  thresholdAmount: number | null;
  estimatedAnnualisedImpact: number;
  currency: string;
  ruleVersion: string;
  recordIds: string[];
  detectedAtUtc: string;
  reviewNote: string | null;
  reviewedBy: string | null;
  reviewedAtUtc: string | null;
  origin: string;
}

export interface FinancialRecord {
  id: string;
  schemeId: number;
  lotId: number | null;
  financialPeriodId: string;
  recordType: string;
  direction: string;
  fund: FundName | string;
  amount: number;
  currency: string;
  transactionDate: string;
  dueDate: string | null;
  supplierId: string | null;
  categoryId: string | null;
  status: string;
  sourceDocumentId: string;
  importBatchId: string | null;
  sourceRowNumber: number | null;
  externalReference: string | null;
  description: string | null;
}

export interface FinancialRecordList {
  records: Page<FinancialRecord>;
  total: number;
  currency: string;
}

export interface Supplier {
  id: string;
  name: string;
  taxIdentifier: string | null;
  isActive: boolean;
}

export interface ExpenseCategory {
  id: string;
  code: string;
  name: string;
  nameEn: string;
  nameFa: string;
  fund: FundName | string;
  synonyms: string[];
  isSystem: boolean;
  isActive: boolean;
}

export interface FinancialPeriod {
  id: string;
  fiscalYear: number;
  periodNumber: number;
  label: string;
  startDate: string;
  endDate: string;
  status: string;
}

// ---------------------------------------------------------------- arrears

export interface Bucket {
  label: string;
  amount: number;
}

export interface ConcentrationItem {
  lotId: number;
  lot: string;
  overdue: number;
  sharePercent: number;
  cumulativeSharePercent: number;
}

export interface CashFlowImpact {
  basisPeriods: string;
  leviesRaised: number;
  paymentsReceived: number;
  collectionRatePercent: number | null;
  expectedNextQuarterLevies: number;
  projectedNextQuarterCollections: number | null;
  projectedShortfall: number | null;
  notMeaningful: boolean;
  definition: string;
}

export interface ArrearsSummary {
  asOf: string;
  currency: string;
  totalOutstanding: number;
  totalOverdue: number;
  totalNotYetDue: number;
  totalCredit: number;
  lotsInArrears: number;
  lotsTotal: number;
  buckets: Bucket[];
  concentration: ConcentrationItem[];
  cashFlowImpact: CashFlowImpact | null;
  freshness: DataFreshness | null;
  incompleteOrEstimatedData: boolean;
  definition: string;
  disclaimer: string;
}

export interface LotBalance {
  lotId: number;
  lot: string;
  levies: number;
  payments: number;
  credits: number;
  increasingAdjustments: number;
  decreasingAdjustments: number;
  balance: number;
  overdue: number;
  notYetDue: number;
  buckets: Bucket[];
  oldestUnpaidDueDate: string | null;
  daysOverdue: number;
  hasPaymentPlan: boolean;
  recordCount: number;
}

export interface LotLedgerLine {
  record: FinancialRecord;
  effect: number;
  runningBalance: number;
}

export interface LotHistory {
  lotId: number;
  lot: string;
  currency: string;
  openingBalance: number;
  closingBalance: number;
  hasPaymentPlan: boolean;
  paymentPlanNote: string | null;
  position: LotBalance;
  lines: LotLedgerLine[];
}

export interface ArrearsTrendPoint {
  periodLabel: string;
  periodEnd: string;
  totalOutstanding: number;
  totalOverdue: number;
  lotsInArrears: number;
  buckets: Bucket[];
}

export interface ArrearsTrend {
  currency: string;
  points: ArrearsTrendPoint[];
}

export interface RiskFactor {
  code: string;
  description: string;
  value: number;
  points: number;
}

export interface RiskSignal {
  lotId: number;
  lot: string;
  overdue: number;
  daysOverdue: number;
  score: number;
  level: string;
  hasPaymentPlan: boolean;
  factors: RiskFactor[];
}

export interface RiskSignals {
  asOf: string;
  currency: string;
  modelVersion: string;
  signals: RiskSignal[];
  freshness: DataFreshness | null;
  disclaimer: string;
}

export interface AgeingSettings {
  bucketBoundaries: number[];
  bucketLabels: string[];
  concentrationTopN: number;
}

export interface ArrearsNote {
  id: string;
  text: string;
  authorId: string;
  createdAtUtc: string;
}

export type ArrearsActionStatusName = "Open" | "InReview" | "Resolved" | "Dismissed";

export interface ArrearsAction {
  id: string;
  lotId: number;
  lot: string;
  reason: string;
  status: ArrearsActionStatusName | string;
  overdueAtCreation: number;
  currency: string;
  createdBy: string;
  createdAtUtc: string;
  statusChangedBy: string | null;
  statusChangedAtUtc: string | null;
  notes: ArrearsNote[];
}

// ---------------------------------------------------------------- capital works

export interface CapitalWorkEstimate {
  id: string;
  amount: number;
  estimateDate: string;
  source: string | null;
  note: string | null;
  createdBy: string;
  createdAtUtc: string;
}

export type CapitalWorkPriorityName = "Low" | "Medium" | "High" | "Critical";
export type CapitalWorkStatusName =
  "Planned" | "InProgress" | "Completed" | "Deferred" | "Cancelled";

export interface CapitalWorkItem {
  id: string;
  title: string;
  component: string | null;
  description: string | null;
  targetFiscalYear: number;
  priority: CapitalWorkPriorityName | string;
  status: CapitalWorkStatusName | string;
  currentEstimate: number;
  currency: string;
  importBatchId: string | null;
  estimates: CapitalWorkEstimate[];
}

export interface FundingScenario {
  id: string;
  name: string;
  openingBalance: number;
  annualContribution: number;
  contributionGrowthPercent: number;
  interestPercent: number;
  costEscalationPercent: number;
  startFiscalYear: number;
  horizonYears: number;
  isBaseline: boolean;
  notes: string | null;
  currency: string;
}

export interface FundingYear {
  fiscalYear: number;
  opening: number;
  contribution: number;
  interest: number;
  plannedCost: number;
  closing: number;
  shortfall: number;
  itemIds: string[];
}

export interface FundingProjection {
  scenario: FundingScenario;
  years: FundingYear[];
  totalContributions: number;
  totalPlannedCost: number;
  endingBalance: number;
  firstShortfallYear: number | null;
  maximumShortfall: number;
  hasShortfall: boolean;
  definition: string;
  disclaimer: string;
}

export interface FundingComparison {
  currency: string;
  scenarios: FundingProjection[];
  lowestContributionWithoutShortfallId: string | null;
  disclaimer: string;
}

// ---------------------------------------------------------------- AI

export type AiReviewStatusName = "Unreviewed" | "Useful" | "Incorrect" | "NeedsReview";

export interface AiInsight {
  id: string;
  origin: string;
  subjectType: string;
  subjectId: string;
  status: string;
  content: string | null;
  language: string;
  evidenceRecordIds: string[];
  metrics: Record<string, string>;
  modelName: string | null;
  modelVersion: string | null;
  promptTemplateId: string | null;
  promptTemplateVersion: string | null;
  confidence: number;
  reviewStatus: AiReviewStatusName | string;
  reviewNote: string | null;
  reviewedBy: string | null;
  reviewedAtUtc: string | null;
  failureReason: string | null;
  generatedAtUtc: string;
}

export interface CategorySuggestion {
  id: string;
  origin: string;
  financialRecordId: string;
  suggestedCategoryId: string;
  suggestedCategory: string;
  confidence: number;
  rationale: string | null;
  modelName: string | null;
  modelVersion: string | null;
  promptTemplateId: string | null;
  promptTemplateVersion: string | null;
  status: "Pending" | "Accepted" | "Rejected" | string;
  reviewedBy: string | null;
  reviewedAtUtc: string | null;
}

export interface SuggestCategoriesResult {
  recordsConsidered: number;
  suggestionsCreated: number;
  aiAvailable: boolean;
  unavailableReason: string | null;
  suggestions: CategorySuggestion[];
}

// ---------------------------------------------------------------- health and reports

export interface FundBalance {
  label: string;
  balance: number;
}

export interface TrendPoint {
  periodLabel: string;
  amount: number;
}

export interface AbnormalExpenseItem {
  flagId: string;
  type: string;
  label: string;
  periodLabel: string;
  observedAmount: number;
  estimatedAnnualisedImpact: number;
  status: string;
}

export interface TopRiskItem {
  lotId: number;
  lot: string;
  score: number;
  level: string;
  overdue: number;
  daysOverdue: number;
}

export interface RecommendedAction {
  code: string;
  text: string;
  priority: number;
}

export interface FinancialHealth {
  origin: string;
  schemeId: number;
  schemeTitle: string;
  jurisdictionCode: string;
  currency: string;
  language: string;
  asOf: string;
  periodLabel: string;
  adminFund: FundBalance;
  capitalWorksFund: FundBalance;
  arrears: {
    totalOutstanding: number;
    totalOverdue: number;
    lotsInArrears: number;
    buckets: Bucket[];
    projectedNextQuarterShortfall: number | null;
  };
  expenseTrend: TrendPoint[];
  currentPeriodSpend: number;
  spendChangePercentMoM: number | null;
  spendChangeNotMeaningful: boolean;
  capitalWorks: {
    hasBaselineScenario: boolean;
    baselineScenario: string | null;
    firstShortfallYear: number | null;
    maximumShortfall: number;
    endingBalance: number;
    plannedItems: number;
    plannedCostNextFiveYears: number;
  };
  abnormalExpenses: AbnormalExpenseItem[];
  topRisks: TopRiskItem[];
  recommendedActions: RecommendedAction[];
  freshness: DataFreshness | null;
  disclaimer: string;
}

export interface MonthlySummary {
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  currency: string;
  leviesRaised: number;
  paymentsReceived: number;
  expenses: number;
  netCashFlow: number;
  overdueAtPeriodEnd: number;
  overdueAtPreviousPeriodEnd: number;
  flagsDetected: number;
  topCategories: { category: string; amount: number }[];
}

export interface ReportSnapshot {
  health: FinancialHealth;
  monthly: MonthlySummary;
}

export interface HealthReport {
  id: string;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  version: number;
  language: string;
  generatedBy: string;
  generatedAtUtc: string;
  managerCommentary: string | null;
  commentaryBy: string | null;
  commentaryAtUtc: string | null;
  snapshot: ReportSnapshot | null;
}

// ---------------------------------------------------------------- feedback and pilot

export interface InsightFeedback {
  id: string;
  schemeId: number;
  subjectType: string;
  subjectId: string;
  rating: string;
  note: string | null;
  actionTaken: string | null;
  hoursSavedEstimate: number | null;
  userId: string;
  createdAtUtc: string;
}

export interface PilotMetrics {
  schemeId: number;
  schemeTitle: string;
  jurisdictionCode: string;
  currency: string;
  milestones: Record<string, string>;
  hoursToFirstVerifiedDashboard: number | null;
  importsUploaded: number;
  importsVerified: number;
  anomaliesFound: number;
  anomaliesConfirmed: number;
  anomaliesDismissed: number;
  moneyFlaggedConfirmed: number;
  moneyFlaggedOpen: number;
  hoursSavedReported: number;
  feedbackByRating: Record<string, number>;
  aiReviewByStatus: Record<string, number>;
  reportsGenerated: number;
}
