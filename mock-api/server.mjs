// In-memory stand-in for the AloHome API, for local demos and the Playwright suite.
//
// It follows the real wire format: everything under /api/v1, success wrapped in
// { succeeded, data }, numeric enums in requests and string enums in results, paginated lists,
// the { succeeded:false, error:{ code, message, details } } error envelope and the token cookies.
// Import fields, ageing bucket labels and import status transitions mirror the backend source.
//
// State lives in memory and resets on restart. It is a test double, not a contract test.
//
//   node mock-api/server.mjs            (PORT=5099, HOST=127.0.0.1)
//   Sign-in code: 123456. +989120000000 is an Admin; any other number manages every scheme.
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

const PORT = Number(process.env.PORT ?? 5099);
// 127.0.0.1 by default; set HOST=0.0.0.0 when the mock runs in a container.
const HOST = process.env.HOST ?? "127.0.0.1";
const ADMIN_PHONE = "+989120000000";
const VALID_OTP = "123456";
const ADMIN_ID = "11111111-1111-4111-8111-111111111111";
const MANAGER_ID = "22222222-2222-4222-8222-222222222222";

// ------------------------------------------------------------------ enums (request numbers)

const enumMap = (names) => Object.fromEntries(Object.entries(names).map(([k, v]) => [v, k]));
const E = {
  importKind: enumMap({ Expenses: 1, Levies: 2, ArrearsReport: 3, CapitalWorksPlan: 4 }),
  flagStatus: enumMap({ Open: 1, Confirmed: 2, Dismissed: 3, Investigating: 4 }),
  flagType: enumMap({ Duplicate: 1, UnusualSpend: 2 }),
  actionStatus: enumMap({ Open: 1, InReview: 2, Resolved: 3, Dismissed: 4 }),
  aiReview: enumMap({ Unreviewed: 1, Useful: 2, Incorrect: 3, NeedsReview: 4 }),
  suggestion: enumMap({ Pending: 1, Accepted: 2, Rejected: 3 }),
  rating: enumMap({ Useful: 1, NotUseful: 2, Incorrect: 3, NeedsReview: 4 }),
  subject: enumMap({
    ExpenseFlag: 1,
    AiInsight: 2,
    RiskSignal: 3,
    Report: 4,
    Dashboard: 5,
    Metric: 6,
  }),
  priority: enumMap({ Low: 1, Medium: 2, High: 3, Critical: 4 }),
  workStatus: enumMap({ Planned: 1, InProgress: 2, Completed: 3, Deferred: 4, Cancelled: 5 }),
  grouping: enumMap({ Month: 1, Category: 2, Supplier: 3 }),
  fund: enumMap({ Admin: 1, CapitalWorks: 2 }),
  schemeRole: enumMap({ Manager: 1, ReadOnly: 2 }),
  lotRole: enumMap({ Owner: 1, FamilyMember: 2 }),
  active: enumMap({ Disabled: 0, Active: 1 }),
  recordType: enumMap({ Expense: 1, Levy: 2, Payment: 3 }),
};
const fromEnum = (map, value) =>
  value === undefined || value === null || value === "" ? undefined : (map[Number(value)] ?? value);

// ------------------------------------------------------------------ small utils

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (date, days) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return iso(d);
};
const daysBetween = (a, b) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
const pad = (n) => String(n).padStart(2, "0");
const sum = (list, pick = (x) => x) => list.reduce((acc, x) => acc + pick(x), 0);
const nowUtc = () => new Date().toISOString();

// ------------------------------------------------------------------ calendars and periods

// Farvardin 1 in the Gregorian calendar for the Solar Hijri years the mock uses.
const NOWRUZ = { 1403: "2024-03-20", 1404: "2025-03-21", 1405: "2026-03-21", 1406: "2027-03-21" };
const jalaliMonthLength = (m) => (m <= 6 ? 31 : m <= 11 ? 30 : 29);

function jalaliPeriod(year, month) {
  let start = NOWRUZ[year];
  for (let m = 1; m < month; m++) start = addDays(start, jalaliMonthLength(m));
  return {
    label: `${year}-${pad(month)}`,
    start,
    end: addDays(start, jalaliMonthLength(month) - 1),
  };
}
function gregorianPeriod(year, month) {
  const start = `${year}-${pad(month)}-01`;
  const end = iso(new Date(Date.UTC(year, month, 0)));
  return { label: `${year}-${pad(month)}`, start, end };
}

/** The last `count` monthly periods ending with (year, month), oldest first. */
function periodsEnding(calendar, year, month, count) {
  const out = [];
  let y = year;
  let m = month;
  for (let i = 0; i < count; i++) {
    out.unshift(calendar === "persian" ? jalaliPeriod(y, m) : gregorianPeriod(y, m));
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
  }
  return out;
}

// ------------------------------------------------------------------ text (Accept-Language)

const TEXT = {
  en: {
    disclaimer:
      "These figures come from verified records in AloHome. They are a management aid, not financial, legal or accounting advice.",
    spendDefinition: "Sum of verified expense records in the selected range, by transaction date.",
    momDefinition: "This period compared with the previous period.",
    yoyDefinition: "This period compared with the same period last year.",
    arrearsDefinition:
      "Overdue means unpaid levies past their due date. Payments are applied to the oldest levy first.",
    cashDefinition: "Collections over the last three periods, applied to next quarter's levies.",
    fundingDefinition:
      "Opening balance plus contributions and interest, minus planned works escalated to their target year.",
    planningDisclaimer: "A planning aid only. Get professional advice before changing levies.",
    riskDisclaimer:
      "Rule-based signals, not a credit assessment. Use them to prioritise follow-up.",
    actions: {
      arrears: "Follow up the lots that are more than 60 days overdue.",
      flags: "Review the open expense flags before the next committee meeting.",
      capital:
        "The capital works plan runs short. Review contributions or defer low-priority work.",
      import: "Import this month's bank and levy records to keep the dashboard current.",
    },
    openingArrears: "Opening arrears balance",
  },
  fa: {
    disclaimer:
      "این ارقام از سوابق تأییدشده در آلوهوم محاسبه شده‌اند و ابزار کمکی مدیریت هستند، نه مشاوره مالی، حقوقی یا حسابداری.",
    spendDefinition: "جمع هزینه‌های تأییدشده در بازه انتخابی بر اساس تاریخ تراکنش.",
    momDefinition: "این دوره در مقایسه با دوره قبل.",
    yoyDefinition: "این دوره در مقایسه با همین دوره در سال گذشته.",
    arrearsDefinition:
      "معوق یعنی شارژ پرداخت‌نشده‌ای که از سررسیدش گذشته است. پرداخت‌ها ابتدا به قدیمی‌ترین شارژ اعمال می‌شوند.",
    cashDefinition: "وصولی سه دوره اخیر، اعمال‌شده بر شارژ فصل آینده.",
    fundingDefinition:
      "مانده اول دوره به‌علاوه سهم‌ها و سود، منهای کارهای برنامه‌ریزی‌شده با تعدیل تورم.",
    planningDisclaimer: "فقط ابزار برنامه‌ریزی است. پیش از تغییر شارژ با متخصص مشورت کنید.",
    riskDisclaimer:
      "این‌ها نشانه‌های قاعده‌محور هستند، نه ارزیابی اعتباری. برای اولویت‌بندی پیگیری از آن‌ها استفاده کنید.",
    actions: {
      arrears: "واحدهایی را که بیش از ۶۰ روز بدهی معوق دارند پیگیری کنید.",
      flags: "هشدارهای هزینه باز را پیش از جلسه بعدی هیئت مدیره بررسی کنید.",
      capital:
        "برنامه کارهای عمرانی با کسری روبه‌رو است. سهم‌ها را بازبینی کنید یا کارهای کم‌اولویت را به تعویق بیندازید.",
      import: "سوابق بانکی و شارژ این ماه را وارد کنید تا داشبورد به‌روز بماند.",
    },
    openingArrears: "مانده بدهی ابتدای دوره",
  },
};

// ------------------------------------------------------------------ scheme seed data

const MARKETS = {
  "AU-NSW": {
    countryCode: "AU",
    currency: "AUD",
    minor: 2,
    timeZone: "Australia/Sydney",
    calendar: "Gregorian",
    cal: "gregory",
    fiscalStartMonth: 7,
    language: "en",
    current: { year: 2026, month: 9 },
    asOf: "2026-09-30",
    fiscalYear: 2027,
    scale: 1,
    fundLabels: ["Administrative fund", "Capital works fund"],
    lotNumber: (i) => String(i + 1),
    postal: "2000",
    categories: [
      ["cleaning", "Cleaning", "نظافت", 2400],
      ["insurance", "Building insurance", "بیمه ساختمان", 3800],
      ["electricity", "Common area electricity", "برق مشاعات", 1600],
      ["water", "Water", "آب", 900],
      ["repairs", "Repairs and maintenance", "تعمیر و نگهداری", 2100],
      ["lift", "Lift maintenance", "سرویس آسانسور", 1300],
      ["gardening", "Gardening", "فضای سبز", 700],
      ["management", "Strata management fees", "حق‌الزحمه مدیریت", 2600],
    ],
    suppliers: [
      ["sparkle", "Sparkle Cleaning Co"],
      ["harbour-ins", "Harbour Mutual Insurance"],
      ["citypower", "City Power"],
      ["sydwater", "Metro Water"],
      ["fixit", "FixIt Building Services"],
      ["liftco", "Coastal Lift Services"],
      ["greenleaf", "GreenLeaf Gardens"],
      ["strata-partners", "Strata Partners"],
    ],
    levy: 1450,
    works: [
      ["Roof membrane replacement", "Roof", 2028, "High", 185000],
      ["Lift modernisation", "Lift", 2030, "Critical", 240000],
      ["External repaint", "Facade", 2029, "Medium", 96000],
      ["Fire panel upgrade", "Fire safety", 2027, "High", 38000],
      ["Car park resurfacing", "Car park", 2032, "Low", 54000],
    ],
    scenario: { opening: 210000, contribution: 52000 },
  },
  IR: {
    countryCode: "IR",
    currency: "IRR",
    minor: 0,
    timeZone: "Asia/Tehran",
    calendar: "Persian",
    cal: "persian",
    fiscalStartMonth: 1,
    language: "fa",
    current: { year: 1405, month: 6 },
    asOf: "2026-09-22",
    fiscalYear: 1405,
    scale: 20000,
    fundLabels: ["صندوق جاری", "صندوق عمرانی"],
    lotNumber: (i) => String(101 + Math.floor(i / 3) * 100 + (i % 3)),
    postal: "1458765432",
    categories: [
      ["cleaning", "Cleaning", "نظافت", 2400],
      ["insurance", "Building insurance", "بیمه ساختمان", 1500],
      ["electricity", "Common area electricity", "برق مشاعات", 1900],
      ["water", "Water", "آب", 1100],
      ["gas", "Gas", "گاز", 1700],
      ["repairs", "Repairs and maintenance", "تعمیر و نگهداری", 2300],
      ["lift", "Lift maintenance", "سرویس آسانسور", 1200],
      ["caretaker", "Caretaker salary", "حقوق سرایدار", 3200],
    ],
    suppliers: [
      ["pakan", "خدمات نظافتی پاکان"],
      ["bimeh", "بیمه نمونه"],
      ["bargh", "برق منطقه‌ای"],
      ["ab", "آب و فاضلاب"],
      ["gaz", "گاز استان"],
      ["fanni", "خدمات فنی ساختمان"],
      ["asansor", "آسانسور نوین"],
      ["staff", "حقوق و دستمزد"],
    ],
    levy: 1650,
    works: [
      ["تعویض موتورخانه", "موتورخانه", 1406, "High", 160000],
      ["نوسازی آسانسور", "آسانسور", 1408, "Critical", 210000],
      ["عایق‌کاری بام", "بام", 1407, "Medium", 70000],
      ["سیستم اعلام حریق", "ایمنی", 1406, "High", 30000],
      ["بازسازی نما", "نما", 1410, "Low", 120000],
    ],
    scenario: { opening: 150000, contribution: 45000 },
  },
};

const schemes = new Map();
let nextSchemeId = 1;

function createScheme({ title, address, jurisdictionCode, seed, demo = false, withData = true }) {
  const market = MARKETS[jurisdictionCode] ?? MARKETS["AU-NSW"];
  const id = nextSchemeId++;
  const random = rng(seed ?? id * 7919);
  const money = (n) =>
    Math.round(n * market.scale * (market.minor ? 100 : 1)) / (market.minor ? 100 : 1);
  const periods = periodsEnding(market.cal, market.current.year, market.current.month, 13);

  const s = {
    id,
    title,
    address,
    jurisdictionCode,
    market,
    status: "Active",
    latitude: market.countryCode === "AU" ? -33.86 : 35.72,
    longitude: market.countryCode === "AU" ? 151.2 : 51.39,
    floor: 6,
    guestParkingCount: 4,
    demo,
    periods,
    asOf: market.asOf,
    categories: market.categories.map(([code, en, fa]) => ({
      id: `cat-${id}-${code}`,
      code,
      name: market.language === "fa" ? fa : en,
      nameEn: en,
      nameFa: fa,
      fund: "Admin",
      synonyms: [],
      isSystem: true,
      isActive: true,
    })),
    suppliers: market.suppliers.map(([code, name]) => ({
      id: `sup-${id}-${code}`,
      name,
      taxIdentifier: null,
      isActive: true,
    })),
    lots: [],
    records: [],
    flags: [],
    imports: [],
    actions: [],
    paymentPlans: new Map(),
    settings: { bucketBoundaries: [30, 60, 90], concentrationTopN: 5 },
    works: [],
    scenarios: [],
    insights: [],
    suggestions: [],
    reports: [],
    feedback: [],
    members: [
      {
        id: 1,
        schemeId: id,
        userId: MANAGER_ID,
        role: "Manager",
        status: "Active",
        createdAt: "2026-07-01T09:00:00Z",
      },
    ],
    residents: new Map(),
  };

  for (let i = 0; i < 12; i++) {
    s.lots.push({
      id: id * 100 + i + 1,
      lotNumber: market.lotNumber(i),
      status: "Active",
      area: 70 + Math.round(random() * 60),
      rooms: 1 + Math.floor(random() * 3),
      floor: 1 + Math.floor(i / 3),
      postalCode: market.postal,
      entitlement: 8 + Math.round(random() * 4),
      vacateAt: null,
    });
  }
  s.residents.set(s.lots[0].id, [{ userId: MANAGER_ID, role: "Owner" }]);

  if (!withData) return register(s);

  const record = (fields) => {
    const r = {
      id: randomUUID(),
      schemeId: id,
      lotId: null,
      financialPeriodId: fields.period.label,
      recordType: "Expense",
      direction: "Outflow",
      fund: "Admin",
      currency: market.currency,
      dueDate: null,
      supplierId: null,
      categoryId: null,
      status: "Verified",
      sourceDocumentId: randomUUID(),
      importBatchId: null,
      sourceRowNumber: null,
      externalReference: null,
      description: null,
      ...fields,
    };
    delete r.period;
    s.records.push(r);
    return r;
  };

  // Expenses: one per category per period, with a spike and a duplicate in the latest period.
  periods.forEach((period, pi) => {
    market.categories.forEach(([, en], ci) => {
      const base = market.categories[ci][3];
      let amount = base * (0.9 + random() * 0.2);
      if (pi === periods.length - 1 && ci === 4) amount = base * 2.6; // repairs spike
      record({
        period,
        transactionDate: addDays(period.start, 3 + ci * 2),
        amount: money(amount),
        categoryId: s.categories[ci].id,
        supplierId: s.suppliers[ci].id,
        description: en,
      });
    });
    // Capital works fund spend now and then.
    if (pi % 4 === 1) {
      record({
        period,
        transactionDate: addDays(period.start, 20),
        amount: money(4000 + random() * 3000),
        fund: "CapitalWorks",
        categoryId: s.categories[4].id,
        supplierId: s.suppliers[4].id,
        description: "Capital works",
      });
    }
  });
  const last = periods[periods.length - 1];
  const cleaning = s.records.find(
    (r) => r.financialPeriodId === last.label && r.categoryId === s.categories[0].id,
  );
  const duplicate = record({
    period: last,
    transactionDate: cleaning.transactionDate,
    amount: cleaning.amount,
    categoryId: cleaning.categoryId,
    supplierId: cleaning.supplierId,
    description: cleaning.description,
  });
  // Records without a category, for AI category suggestions.
  for (let i = 0; i < 3; i++) {
    record({
      period: last,
      transactionDate: addDays(last.start, 10 + i),
      amount: money(150 + random() * 300),
      supplierId: s.suppliers[[0, 5, 6][i]].id,
      description: ["Pressure washing, lobby", "Lift call-out", "Hedge trimming"][i],
    });
  }

  // Levies and payments. A few lots fall behind; one is on a payment plan.
  const behind = { 3: 1, 5: 2, 7: 3, 10: 5 }; // lot index -> latest periods unpaid
  s.lots.forEach((lot, li) => {
    const levy = money(market.levy * (lot.entitlement / 10));
    periods.forEach((period, pi) => {
      record({
        period,
        lotId: lot.id,
        recordType: "Levy",
        direction: "Inflow",
        transactionDate: period.start,
        dueDate: addDays(period.start, 14),
        amount: levy,
        description: "Levy",
      });
      const missed = behind[li] ?? 0;
      if (pi < periods.length - missed) {
        record({
          period,
          lotId: lot.id,
          recordType: "Payment",
          direction: "Inflow",
          transactionDate: addDays(period.start, 10 + Math.floor(random() * 4)),
          amount: levy,
          description: "Payment",
        });
      }
    });
  });
  s.paymentPlans.set(s.lots[5].id, "Agreed to clear the balance over three months.");

  // Flags.
  const repairs = s.records.find(
    (r) =>
      r.financialPeriodId === last.label &&
      r.categoryId === s.categories[4].id &&
      r.fund === "Admin",
  );
  const repairsBaseline = money(market.categories[4][3]);
  s.flags.push(
    flag(s, {
      type: "UnusualSpend",
      dimension: "Category",
      categoryId: repairs.categoryId,
      category: s.categories[4].name,
      supplierId: repairs.supplierId,
      supplier: s.suppliers[4].name,
      period: last,
      observedAmount: repairs.amount,
      baselineAmount: repairsBaseline,
      baselinePeriods: 6,
      thresholdPercent: 50,
      estimatedAnnualisedImpact: Math.round((repairs.amount - repairsBaseline) * 4 * 100) / 100,
      recordIds: [repairs.id],
    }),
    flag(s, {
      type: "Duplicate",
      dimension: "Supplier",
      categoryId: cleaning.categoryId,
      category: s.categories[0].name,
      supplierId: cleaning.supplierId,
      supplier: s.suppliers[0].name,
      period: last,
      observedAmount: duplicate.amount,
      estimatedAnnualisedImpact: duplicate.amount,
      recordIds: [cleaning.id, duplicate.id],
    }),
  );

  // Arrears follow-up.
  s.actions.push({
    id: randomUUID(),
    lotId: s.lots[10].id,
    lot: s.lots[10].lotNumber,
    reason: "Five months unpaid. Reminder letter sent.",
    status: "Open",
    overdueAtCreation: money(market.levy * 4),
    currency: market.currency,
    createdBy: MANAGER_ID,
    createdAtUtc: "2026-09-15T08:30:00Z",
    statusChangedBy: null,
    statusChangedAtUtc: null,
    notes: [
      {
        id: randomUUID(),
        text: "Called the owner, no answer.",
        authorId: MANAGER_ID,
        createdAtUtc: "2026-09-16T10:00:00Z",
      },
    ],
  });

  // Capital works and scenarios.
  for (const [titleText, component, year, priority, estimate] of market.works) {
    s.works.push({
      id: randomUUID(),
      title: titleText,
      component,
      description: null,
      targetFiscalYear: year,
      priority,
      status: "Planned",
      currentEstimate: money(estimate),
      currency: market.currency,
      importBatchId: null,
      estimates: [
        {
          id: randomUUID(),
          amount: money(estimate),
          estimateDate: "2026-02-10",
          source: "Building condition report",
          note: null,
          createdBy: MANAGER_ID,
          createdAtUtc: "2026-02-10T09:00:00Z",
        },
      ],
    });
  }
  s.scenarios.push(
    scenario(s, {
      name: "Current contributions",
      openingBalance: money(market.scenario.opening),
      annualContribution: money(market.scenario.contribution),
      contributionGrowthPercent: 0,
      isBaseline: true,
    }),
    scenario(s, {
      name: "10% higher contributions",
      openingBalance: money(market.scenario.opening),
      annualContribution: money(market.scenario.contribution * 1.1),
      contributionGrowthPercent: 3,
      isBaseline: false,
    }),
  );

  // One committed, verified import in the history.
  s.imports.push({
    ...newBatch(s, "Expenses", "expenses-previous-month.csv", [
      "Date",
      "Amount",
      "Supplier",
      "Category",
    ]),
    status: "Committed",
    verification: "Verified",
    isVerified: true,
    mapping: { date: "Date", amount: "Amount", supplier: "Supplier", category: "Category" },
    missingRequiredFields: [],
    totalRows: 9,
    validRows: 9,
    fileTotal: money(15200),
    importedTotal: money(15200),
    controlTotal: money(15200),
    difference: 0,
    uploadedAtUtc: "2026-09-02T07:10:00Z",
    committedAtUtc: "2026-09-02T07:14:00Z",
    verifiedAtUtc: "2026-09-02T07:15:00Z",
  });

  return register(s);
}

function register(s) {
  schemes.set(s.id, s);
  return s;
}

function flag(s, f) {
  return {
    id: randomUUID(),
    type: f.type,
    status: "Open",
    dimension: f.dimension ?? null,
    categoryId: f.categoryId ?? null,
    category: f.category ?? null,
    supplierId: f.supplierId ?? null,
    supplier: f.supplier ?? null,
    periodLabel: f.period.label,
    periodStart: f.period.start,
    periodEnd: f.period.end,
    observedAmount: f.observedAmount,
    baselineAmount: f.baselineAmount ?? null,
    baselinePeriods: f.baselinePeriods ?? null,
    thresholdPercent: f.thresholdPercent ?? null,
    thresholdAmount: null,
    estimatedAnnualisedImpact: f.estimatedAnnualisedImpact,
    currency: s.market.currency,
    ruleVersion: "2026.1",
    recordIds: f.recordIds,
    detectedAtUtc: "2026-09-30T20:00:00Z",
    reviewNote: null,
    reviewedBy: null,
    reviewedAtUtc: null,
    origin: "Deterministic",
  };
}

function scenario(s, input) {
  return {
    id: randomUUID(),
    name: input.name,
    openingBalance: input.openingBalance,
    annualContribution: input.annualContribution,
    contributionGrowthPercent: input.contributionGrowthPercent ?? 0,
    interestPercent: input.interestPercent ?? 3,
    costEscalationPercent: input.costEscalationPercent ?? 4,
    startFiscalYear: input.startFiscalYear ?? s.market.fiscalYear,
    horizonYears: input.horizonYears ?? 10,
    isBaseline: input.isBaseline ?? false,
    notes: input.notes ?? null,
    currency: s.market.currency,
  };
}

const IMPORT_FIELDS = {
  Expenses: {
    required: ["date", "amount"],
    optional: ["supplier", "category", "description", "reference", "fund", "dueDate"],
  },
  Levies: {
    required: ["date", "amount", "lot"],
    optional: ["type", "dueDate", "reference", "description", "fund"],
  },
  ArrearsReport: {
    required: ["lot"],
    optional: [
      "amount",
      "date",
      "dueDate",
      "current",
      "days30",
      "days60",
      "days90",
      "description",
      "fund",
    ],
  },
  CapitalWorksPlan: {
    required: ["title", "targetYear", "amount"],
    optional: ["component", "priority", "description", "date"],
  },
};

function newBatch(s, kind, fileName, headers) {
  const fields = IMPORT_FIELDS[kind] ?? IMPORT_FIELDS.Expenses;
  return {
    id: randomUUID(),
    kind,
    fileName,
    fileHash: randomUUID().replace(/-/g, ""),
    status: "Uploaded",
    verification: "Unverified",
    isVerified: false,
    headers,
    mapping: {},
    requiredFields: fields.required,
    optionalFields: fields.optional,
    missingRequiredFields: [...fields.required],
    totalRows: 0,
    validRows: 0,
    errorRows: 0,
    duplicateRows: 0,
    fileTotal: 0,
    importedTotal: 0,
    controlTotal: null,
    difference: null,
    currency: s.market.currency,
    retryOfBatchId: null,
    supersededByBatchId: null,
    uploadedBy: MANAGER_ID,
    uploadedAtUtc: nowUtc(),
    committedAtUtc: null,
    verifiedAtUtc: null,
    failureReason: null,
    rows: [],
  };
}

createScheme({
  title: "Harbour View",
  address: "12 Example Street, Sydney NSW 2000",
  jurisdictionCode: "AU-NSW",
  seed: 11,
});
createScheme({
  title: "Tower A",
  address: "1 Example Street, Tehran",
  jurisdictionCode: "IR",
  seed: 23,
});

const accessDenied = [
  {
    id: randomUUID(),
    userId: "33333333-3333-4333-8333-333333333333",
    schemeId: 1,
    resource: "schemes/1/financial-health",
    requiredAccess: "ReadOnly",
    occurredAt: "2026-09-28T11:02:00Z",
  },
  {
    id: randomUUID(),
    userId: "33333333-3333-4333-8333-333333333333",
    schemeId: 2,
    resource: "schemes/2/imports",
    requiredAccess: "Manager",
    occurredAt: "2026-09-29T06:45:00Z",
  },
];

// ------------------------------------------------------------------ calculations

const visibleRecords = (s, asOf = s.asOf) =>
  s.records.filter((r) => r.status === "Verified" && r.transactionDate <= asOf);
const expenses = (s, asOf) => visibleRecords(s, asOf).filter((r) => r.recordType === "Expense");
const periodOf = (s, date) => s.periods.find((p) => date >= p.start && date <= p.end);
const bucketLabels = (boundaries) => {
  const labels = [];
  let lower = 0;
  for (const upper of boundaries) {
    labels.push(lower === 0 ? `0-${upper}` : `${lower + 1}-${upper}`);
    lower = upper;
  }
  labels.push(`${lower}+`);
  return labels;
};

function lotBalance(s, lot, asOf = s.asOf) {
  const records = visibleRecords(s, asOf).filter((r) => r.lotId === lot.id);
  const levies = records
    .filter((r) => r.recordType === "Levy")
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const paid = sum(
    records.filter((r) => r.recordType === "Payment"),
    (r) => r.amount,
  );
  let remaining = paid;
  const unpaid = [];
  for (const levy of levies) {
    const applied = Math.min(remaining, levy.amount);
    remaining -= applied;
    if (levy.amount - applied > 0.004)
      unpaid.push({ due: levy.dueDate, amount: levy.amount - applied });
  }
  const boundaries = s.settings.bucketBoundaries;
  const buckets = new Array(boundaries.length + 1).fill(0);
  let overdue = 0;
  let notYetDue = 0;
  let oldest = null;
  for (const item of unpaid) {
    const days = daysBetween(item.due, asOf);
    if (days <= 0) {
      notYetDue += item.amount;
      continue;
    }
    overdue += item.amount;
    oldest = oldest && oldest < item.due ? oldest : item.due;
    const index = boundaries.findIndex((b) => days <= b);
    buckets[index === -1 ? boundaries.length : index] += item.amount;
  }
  const labels = bucketLabels(boundaries);
  const leviesTotal = sum(levies, (r) => r.amount);
  return {
    lotId: lot.id,
    lot: lot.lotNumber,
    levies: leviesTotal,
    payments: paid,
    credits: 0,
    increasingAdjustments: 0,
    decreasingAdjustments: 0,
    balance: leviesTotal - paid,
    overdue,
    notYetDue,
    buckets: labels.map((label, i) => ({ label, amount: buckets[i] })),
    oldestUnpaidDueDate: oldest,
    daysOverdue: oldest ? daysBetween(oldest, asOf) : 0,
    hasPaymentPlan: s.paymentPlans.has(lot.id),
    recordCount: records.length,
  };
}

function arrearsSummary(s, lang, asOf = s.asOf) {
  const balances = s.lots.map((l) => lotBalance(s, l, asOf));
  const overdueTotal = sum(balances, (b) => b.overdue);
  const labels = bucketLabels(s.settings.bucketBoundaries);
  const inArrears = balances.filter((b) => b.overdue > 0).sort((a, b) => b.overdue - a.overdue);
  let cumulative = 0;
  const concentration = inArrears.slice(0, s.settings.concentrationTopN).map((b) => {
    const share = overdueTotal ? (b.overdue / overdueTotal) * 100 : 0;
    cumulative += share;
    return {
      lotId: b.lotId,
      lot: b.lot,
      overdue: b.overdue,
      sharePercent: share,
      cumulativeSharePercent: cumulative,
    };
  });
  const recent = s.periods.slice(-3);
  const inRecent = (r) =>
    recent.some((p) => r.transactionDate >= p.start && r.transactionDate <= p.end);
  const recentRecords = visibleRecords(s, asOf).filter(inRecent);
  const leviesRaised = sum(
    recentRecords.filter((r) => r.recordType === "Levy"),
    (r) => r.amount,
  );
  const paymentsReceived = sum(
    recentRecords.filter((r) => r.recordType === "Payment"),
    (r) => r.amount,
  );
  const rate = leviesRaised ? (paymentsReceived / leviesRaised) * 100 : null;
  const expected = leviesRaised;
  const projected = rate === null ? null : (expected * rate) / 100;
  return {
    asOf,
    currency: s.market.currency,
    totalOutstanding: sum(balances, (b) => Math.max(0, b.balance)),
    totalOverdue: overdueTotal,
    totalNotYetDue: sum(balances, (b) => b.notYetDue),
    totalCredit: 0,
    lotsInArrears: inArrears.length,
    lotsTotal: s.lots.length,
    buckets: labels.map((label, i) => ({
      label,
      amount: sum(balances, (b) => b.buckets[i].amount),
    })),
    concentration,
    cashFlowImpact: {
      basisPeriods: `${recent[0].label} – ${recent[recent.length - 1].label}`,
      leviesRaised,
      paymentsReceived,
      collectionRatePercent: rate,
      expectedNextQuarterLevies: expected,
      projectedNextQuarterCollections: projected,
      projectedShortfall: projected === null ? null : expected - projected,
      notMeaningful: false,
      definition: TEXT[lang].cashDefinition,
    },
    freshness: freshness(s),
    incompleteOrEstimatedData: false,
    definition: TEXT[lang].arrearsDefinition,
    disclaimer: TEXT[lang].disclaimer,
  };
}

function riskSignals(s, lang) {
  const levy = s.market.levy * s.market.scale;
  const signals = s.lots
    .map((l) => lotBalance(s, l))
    .filter((b) => b.overdue > 0)
    .map((b) => {
      const ageing = Math.min(60, Math.round(b.daysOverdue / 2));
      const size = Math.min(30, Math.round((b.overdue / levy) * 6));
      const plan = b.hasPaymentPlan ? -15 : 0;
      const score = Math.max(0, Math.min(100, ageing + size + plan + 10));
      const level =
        score >= 75 ? "Critical" : score >= 50 ? "High" : score >= 25 ? "Medium" : "Low";
      const factors = [
        {
          code: "DaysOverdue",
          description: lang === "fa" ? "روزهای معوق" : "Days overdue",
          value: b.daysOverdue,
          points: ageing,
        },
        {
          code: "OverdueAmount",
          description: lang === "fa" ? "مبلغ معوق نسبت به شارژ" : "Overdue amount against the levy",
          value: Math.round((b.overdue / levy) * 10) / 10,
          points: size,
        },
      ];
      if (b.hasPaymentPlan) {
        factors.push({
          code: "PaymentPlan",
          description: lang === "fa" ? "برنامه پرداخت توافق‌شده" : "Agreed payment plan",
          value: 1,
          points: plan,
        });
      }
      return {
        lotId: b.lotId,
        lot: b.lot,
        overdue: b.overdue,
        daysOverdue: b.daysOverdue,
        score,
        level,
        hasPaymentPlan: b.hasPaymentPlan,
        factors,
      };
    })
    .sort((a, b) => b.score - a.score);
  return {
    asOf: s.asOf,
    currency: s.market.currency,
    modelVersion: "rules-2026.1",
    signals,
    freshness: freshness(s),
    disclaimer: TEXT[lang].riskDisclaimer,
  };
}

function freshness(s) {
  const verified = s.records.filter((r) => r.status === "Verified");
  const latest = verified.reduce((m, r) => (r.transactionDate > m ? r.transactionDate : m), "");
  const lastImport = s.imports
    .filter((b) => b.status === "Committed")
    .reduce((m, b) => (b.committedAtUtc > m ? b.committedAtUtc : m), "");
  return {
    latestVerifiedTransactionDate: latest || null,
    latestVerifiedImportAtUtc: lastImport || null,
    hasUnverifiedData: s.imports.some((b) => b.status === "Committed" && !b.isVerified),
    dataAgeDays: latest ? Math.max(0, daysBetween(latest, s.asOf)) : null,
    noVerifiedData: verified.length === 0,
  };
}

function projection(s, sc, lang) {
  const years = [];
  let opening = sc.openingBalance;
  let contribution = sc.annualContribution;
  let firstShortfallYear = null;
  let maximumShortfall = 0;
  for (let i = 0; i < sc.horizonYears; i++) {
    const fiscalYear = sc.startFiscalYear + i;
    const items = s.works.filter(
      (w) => w.targetFiscalYear === fiscalYear && !["Completed", "Cancelled"].includes(w.status),
    );
    const plannedCost =
      sum(items, (w) => w.currentEstimate) * Math.pow(1 + sc.costEscalationPercent / 100, i);
    const interest = Math.max(0, opening) * (sc.interestPercent / 100);
    const closing = opening + contribution + interest - plannedCost;
    const shortfall = closing < 0 ? -closing : 0;
    if (shortfall > 0 && firstShortfallYear === null) firstShortfallYear = fiscalYear;
    maximumShortfall = Math.max(maximumShortfall, shortfall);
    years.push({
      fiscalYear,
      opening,
      contribution,
      interest,
      plannedCost,
      closing,
      shortfall,
      itemIds: items.map((w) => w.id),
    });
    opening = closing;
    contribution *= 1 + sc.contributionGrowthPercent / 100;
  }
  return {
    scenario: sc,
    years,
    totalContributions: sum(years, (y) => y.contribution),
    totalPlannedCost: sum(years, (y) => y.plannedCost),
    endingBalance: years.length ? years[years.length - 1].closing : sc.openingBalance,
    firstShortfallYear,
    maximumShortfall,
    hasShortfall: firstShortfallYear !== null,
    definition: TEXT[lang].fundingDefinition,
    disclaimer: TEXT[lang].planningDisclaimer,
  };
}

function monthlySummary(s, periodDate) {
  const period = (periodDate && periodOf(s, periodDate)) || s.periods[s.periods.length - 1];
  const index = s.periods.indexOf(period);
  const inPeriod = (r) => r.transactionDate >= period.start && r.transactionDate <= period.end;
  const records = visibleRecords(s).filter(inPeriod);
  const leviesRaised = sum(
    records.filter((r) => r.recordType === "Levy"),
    (r) => r.amount,
  );
  const paymentsReceived = sum(
    records.filter((r) => r.recordType === "Payment"),
    (r) => r.amount,
  );
  const spent = records.filter((r) => r.recordType === "Expense");
  const byCategory = new Map();
  for (const r of spent) {
    const name = s.categories.find((c) => c.id === r.categoryId)?.name ?? "—";
    byCategory.set(name, (byCategory.get(name) ?? 0) + r.amount);
  }
  const previous = s.periods[index - 1];
  return {
    periodLabel: period.label,
    periodStart: period.start,
    periodEnd: period.end,
    currency: s.market.currency,
    leviesRaised,
    paymentsReceived,
    expenses: sum(spent, (r) => r.amount),
    netCashFlow: paymentsReceived - sum(spent, (r) => r.amount),
    overdueAtPeriodEnd: arrearsSummary(s, "en", period.end).totalOverdue,
    overdueAtPreviousPeriodEnd: previous ? arrearsSummary(s, "en", previous.end).totalOverdue : 0,
    flagsDetected: s.flags.filter((f) => f.periodLabel === period.label).length,
    topCategories: [...byCategory.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([category, amount]) => ({ category, amount })),
  };
}

function financialHealth(s, lang) {
  const spendByPeriod = s.periods.map((p) => ({
    periodLabel: p.label,
    amount: sum(
      expenses(s).filter(
        (r) => r.fund === "Admin" && r.transactionDate >= p.start && r.transactionDate <= p.end,
      ),
      (r) => r.amount,
    ),
  }));
  const trend = spendByPeriod.slice(-12);
  const current = trend[trend.length - 1].amount;
  const previous = trend[trend.length - 2].amount;
  const visible = visibleRecords(s);
  const income = sum(
    visible.filter((r) => r.recordType === "Payment"),
    (r) => r.amount,
  );
  const adminSpend = sum(
    visible.filter((r) => r.recordType === "Expense" && r.fund === "Admin"),
    (r) => r.amount,
  );
  const capitalSpend = sum(
    visible.filter((r) => r.recordType === "Expense" && r.fund === "CapitalWorks"),
    (r) => r.amount,
  );
  const arrears = arrearsSummary(s, lang);
  const risks = riskSignals(s, lang).signals;
  const baseline = s.scenarios.find((x) => x.isBaseline);
  const plan = baseline ? projection(s, baseline, lang) : null;
  const openFlags = s.flags.filter((f) => f.status === "Open" || f.status === "Investigating");
  const actions = [];
  if (risks.some((r) => r.daysOverdue > 60))
    actions.push({ code: "ARREARS_FOLLOW_UP", text: TEXT[lang].actions.arrears, priority: 1 });
  if (openFlags.length)
    actions.push({ code: "REVIEW_FLAGS", text: TEXT[lang].actions.flags, priority: 2 });
  if (plan?.hasShortfall)
    actions.push({ code: "CAPITAL_SHORTFALL", text: TEXT[lang].actions.capital, priority: 3 });
  actions.push({ code: "IMPORT_CURRENT", text: TEXT[lang].actions.import, priority: 4 });
  const fiveYearEnd = s.market.fiscalYear + 4;
  const last = s.periods[s.periods.length - 1];
  return {
    origin: "Deterministic",
    schemeId: s.id,
    schemeTitle: s.title,
    jurisdictionCode: s.jurisdictionCode,
    currency: s.market.currency,
    language: lang,
    asOf: s.asOf,
    periodLabel: last.label,
    adminFund: {
      label: s.market.fundLabels[0],
      balance: Math.round(income * 0.82 - adminSpend * 0.7),
    },
    capitalWorksFund: {
      label: s.market.fundLabels[1],
      balance: (baseline?.openingBalance ?? 0) - capitalSpend,
    },
    arrears: {
      totalOutstanding: arrears.totalOutstanding,
      totalOverdue: arrears.totalOverdue,
      lotsInArrears: arrears.lotsInArrears,
      buckets: arrears.buckets,
      projectedNextQuarterShortfall: arrears.cashFlowImpact?.projectedShortfall ?? null,
    },
    expenseTrend: trend,
    currentPeriodSpend: current,
    spendChangePercentMoM: previous ? ((current - previous) / previous) * 100 : null,
    spendChangeNotMeaningful: !previous,
    capitalWorks: {
      hasBaselineScenario: Boolean(plan),
      baselineScenario: baseline?.name ?? null,
      firstShortfallYear: plan?.firstShortfallYear ?? null,
      maximumShortfall: plan?.maximumShortfall ?? 0,
      endingBalance: plan?.endingBalance ?? 0,
      plannedItems: s.works.filter((w) => !["Completed", "Cancelled"].includes(w.status)).length,
      plannedCostNextFiveYears: sum(
        s.works.filter(
          (w) =>
            w.targetFiscalYear <= fiveYearEnd && !["Completed", "Cancelled"].includes(w.status),
        ),
        (w) => w.currentEstimate,
      ),
    },
    abnormalExpenses: openFlags.map((f) => ({
      flagId: f.id,
      type: f.type,
      label: [f.category, f.supplier].filter(Boolean).join(" · "),
      periodLabel: f.periodLabel,
      observedAmount: f.observedAmount,
      estimatedAnnualisedImpact: f.estimatedAnnualisedImpact,
      status: f.status,
    })),
    topRisks: risks.slice(0, 3).map(({ lotId, lot, score, level, overdue, daysOverdue }) => ({
      lotId,
      lot,
      score,
      level,
      overdue,
      daysOverdue,
    })),
    recommendedActions: actions,
    freshness: freshness(s),
    disclaimer: TEXT[lang].disclaimer,
  };
}

function spend(s, q, lang) {
  const groupBy = fromEnum(E.grouping, q.get("groupBy")) ?? "Month";
  const fund = fromEnum(E.fund, q.get("fund"));
  const from = q.get("from") ?? s.periods[s.periods.length - 12].start;
  const to = q.get("to") ?? s.asOf;
  const list = expenses(s).filter(
    (r) => r.transactionDate >= from && r.transactionDate <= to && (!fund || r.fund === fund),
  );
  const total = sum(list, (r) => r.amount);
  const groups = new Map();
  for (const r of list) {
    let key;
    let label;
    let period = null;
    if (groupBy === "Category") {
      key = r.categoryId ?? "uncategorised";
      label =
        s.categories.find((c) => c.id === r.categoryId)?.name ??
        (lang === "fa" ? "بدون دسته" : "Uncategorised");
    } else if (groupBy === "Supplier") {
      key = r.supplierId ?? "none";
      label = s.suppliers.find((x) => x.id === r.supplierId)?.name ?? "—";
    } else {
      period = periodOf(s, r.transactionDate);
      key = period?.label ?? r.transactionDate.slice(0, 7);
      label = key;
    }
    const g = groups.get(key) ?? {
      key,
      label,
      amount: 0,
      recordCount: 0,
      periodStart: period?.start ?? null,
      periodEnd: period?.end ?? null,
    };
    g.amount += r.amount;
    g.recordCount += 1;
    groups.set(key, g);
  }
  let items = [...groups.values()].map((g) => ({
    ...g,
    sharePercent: total ? (g.amount / total) * 100 : 0,
  }));
  items =
    groupBy === "Month"
      ? items.sort((a, b) => a.key.localeCompare(b.key))
      : items.sort((a, b) => b.amount - a.amount);
  return {
    groupBy,
    from,
    to,
    currency: s.market.currency,
    total,
    recordCount: list.length,
    items,
    freshness: freshness(s),
    definition: TEXT[lang].spendDefinition,
  };
}

function compare(current, previous) {
  const change = current - previous;
  const notMeaningful = previous === 0;
  return {
    current,
    previous,
    change,
    changePercent: notMeaningful ? null : (change / previous) * 100,
    notMeaningful,
    notMeaningfulReason: notMeaningful ? "NoBaseline" : null,
  };
}

function spendComparison(s, q, lang) {
  const fund = fromEnum(E.fund, q.get("fund"));
  const period =
    (q.get("periodDate") && periodOf(s, q.get("periodDate"))) || s.periods[s.periods.length - 1];
  const i = s.periods.indexOf(period);
  const prev = s.periods[i - 1];
  const lastYear = s.periods[i - 12];
  const total = (p, categoryId) =>
    p
      ? sum(
          expenses(s).filter(
            (r) =>
              r.transactionDate >= p.start &&
              r.transactionDate <= p.end &&
              (!fund || r.fund === fund) &&
              (categoryId === undefined || r.categoryId === categoryId),
          ),
          (r) => r.amount,
        )
      : 0;
  return {
    currency: s.market.currency,
    periodLabel: period.label,
    periodStart: period.start,
    periodEnd: period.end,
    previousPeriodLabel: prev?.label ?? "",
    samePeriodLastYearLabel: lastYear?.label ?? "",
    monthOverMonth: compare(total(period), total(prev)),
    yearOverYear: compare(total(period), total(lastYear)),
    byCategory: s.categories.map((c) => ({
      categoryId: c.id,
      category: c.name,
      monthOverMonth: compare(total(period, c.id), total(prev, c.id)),
      yearOverYear: compare(total(period, c.id), total(lastYear, c.id)),
    })),
    freshness: freshness(s),
    monthOverMonthDefinition: TEXT[lang].momDefinition,
    yearOverYearDefinition: TEXT[lang].yoyDefinition,
  };
}

function lotHistory(s, lot) {
  const position = lotBalance(s, lot);
  const records = visibleRecords(s)
    .filter((r) => r.lotId === lot.id)
    .sort((a, b) => a.transactionDate.localeCompare(b.transactionDate));
  let running = 0;
  const lines = records.map((record) => {
    const effect = record.recordType === "Levy" ? record.amount : -record.amount;
    running += effect;
    return { record, effect, runningBalance: running };
  });
  return {
    lotId: lot.id,
    lot: lot.lotNumber,
    currency: s.market.currency,
    openingBalance: 0,
    closingBalance: running,
    hasPaymentPlan: s.paymentPlans.has(lot.id),
    paymentPlanNote: s.paymentPlans.get(lot.id) ?? null,
    position,
    lines,
  };
}

// ------------------------------------------------------------------ imports

function parseCsv(text) {
  const rows = [];
  for (const line of text.replace(/^﻿/, "").split(/\r?\n/)) {
    if (!line.trim()) continue;
    const cells = [];
    let cell = "";
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (quoted) {
        if (ch === '"' && line[i + 1] === '"') {
          cell += '"';
          i++;
        } else if (ch === '"') quoted = false;
        else cell += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === ",") {
        cells.push(cell.trim());
        cell = "";
      } else cell += ch;
    }
    cells.push(cell.trim());
    rows.push(cells);
  }
  return rows;
}

const SYNONYMS = {
  date: ["date", "transaction date", "paid on", "تاریخ"],
  amount: ["amount", "total", "value", "مبلغ"],
  supplier: ["supplier", "vendor", "payee", "تامین کننده", "تأمین‌کننده"],
  category: ["category", "account", "دسته", "دسته‌بندی"],
  description: ["description", "details", "memo", "شرح"],
  reference: ["reference", "ref", "invoice", "شماره"],
  lot: ["lot", "unit", "واحد"],
  dueDate: ["due date", "due", "سررسید"],
  title: ["title", "item", "عنوان"],
  targetYear: ["target year", "year", "سال"],
  fund: ["fund", "صندوق"],
  type: ["type", "نوع"],
  component: ["component", "جزء"],
  priority: ["priority", "اولویت"],
};
function autoMap(headers, fields) {
  const mapping = {};
  for (const field of fields) {
    const names = SYNONYMS[field] ?? [field.toLowerCase()];
    const match = headers.find(
      (h) => names.includes(h.toLowerCase()) || h.toLowerCase() === field.toLowerCase(),
    );
    if (match && !Object.values(mapping).includes(match)) mapping[field] = match;
  }
  return mapping;
}

function parseDate(value) {
  if (!value) return null;
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value);
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  if (m) return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
  return null;
}
const parseAmount = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(String(value).replace(/[,\s$]/g, ""));
  return Number.isFinite(n) ? n : null;
};

function sampleRows(s, kind) {
  const last = s.periods[s.periods.length - 1];
  if (kind === "Levies") {
    return [
      ["Lot", "Date", "Amount"],
      ...s.lots
        .slice(0, 6)
        .map((l) => [l.lotNumber, last.start, String(s.market.levy * s.market.scale)]),
    ];
  }
  if (kind === "CapitalWorksPlan") {
    return [
      ["Title", "Target year", "Amount"],
      ["Balcony waterproofing", String(s.market.fiscalYear + 2), String(42000 * s.market.scale)],
    ];
  }
  if (kind === "ArrearsReport") {
    return [["Lot", "Amount"], ...s.lots.slice(0, 4).map((l) => [l.lotNumber, "0"])];
  }
  return [
    ["Date", "Amount", "Supplier", "Category", "Description"],
    [
      last.start,
      String(1200 * s.market.scale),
      s.suppliers[0].name,
      s.categories[0].name,
      "Cleaning",
    ],
    [
      addDays(last.start, 2),
      String(640 * s.market.scale),
      s.suppliers[2].name,
      s.categories[2].name,
      "Electricity",
    ],
    [addDays(last.start, 5), "abc", s.suppliers[4].name, s.categories[4].name, "Repairs"],
  ];
}

function validate(s, batch) {
  const [header, ...data] = batch.rows;
  const col = (field) => header.indexOf(batch.mapping[field]);
  const issues = [];
  const seen = new Set();
  const rows = data.map((cells, i) => {
    const rowNumber = i + 2;
    const values = Object.fromEntries(
      Object.entries(batch.mapping).map(([f, c]) => [f, cells[header.indexOf(c)] ?? ""]),
    );
    const rowIssues = [];
    const amount = parseAmount(cells[col("amount")]);
    if (batch.requiredFields.includes("amount") && amount === null) {
      rowIssues.push({
        rowNumber,
        field: "amount",
        value: cells[col("amount")] ?? "",
        reason: "Amount is not a number.",
        suggestedFix: "Use digits only, for example 1250.50.",
        severity: "Error",
      });
    }
    if (batch.requiredFields.includes("date") && !parseDate(cells[col("date")])) {
      rowIssues.push({
        rowNumber,
        field: "date",
        value: cells[col("date")] ?? "",
        reason: "Date is not recognised.",
        suggestedFix: "Use YYYY-MM-DD.",
        severity: "Error",
      });
    }
    let lot = null;
    if (col("lot") >= 0) {
      lot = s.lots.find((l) => l.lotNumber === cells[col("lot")]) ?? null;
      if (!lot)
        rowIssues.push({
          rowNumber,
          field: "lot",
          value: cells[col("lot")] ?? "",
          reason: "No lot with this number.",
          suggestedFix: "Check the lot number against the scheme.",
          severity: "Error",
        });
    }
    const key = cells.join("|");
    const duplicate = seen.has(key);
    seen.add(key);
    if (duplicate)
      rowIssues.push({
        rowNumber,
        field: null,
        value: null,
        reason: "Same as an earlier row in this file.",
        suggestedFix: "Remove the repeated row.",
        severity: "Warning",
      });
    if (
      col("category") >= 0 &&
      cells[col("category")] &&
      !s.categories.some((c) => [c.name, c.nameEn, c.nameFa].includes(cells[col("category")]))
    ) {
      rowIssues.push({
        rowNumber,
        field: "category",
        value: cells[col("category")],
        reason: "Unknown category; the record will be imported without one.",
        suggestedFix: null,
        severity: "Warning",
      });
    }
    issues.push(...rowIssues);
    const status = rowIssues.some((x) => x.severity === "Error")
      ? "Invalid"
      : duplicate
        ? "Duplicate"
        : "Valid";
    return {
      rowNumber,
      status,
      values,
      amount: amount ?? 0,
      lot: lot?.lotNumber ?? null,
      category: values.category || null,
      issues: rowIssues,
      cells,
      date: parseDate(cells[col("date")]),
      lotId: lot?.id ?? null,
    };
  });
  return { rows, issues };
}

function applyValidation(s, batch) {
  const { rows, issues } = validate(s, batch);
  batch.parsed = rows;
  batch.issues = issues;
  batch.totalRows = rows.length;
  batch.validRows = rows.filter((r) => r.status === "Valid").length;
  batch.errorRows = rows.filter((r) => r.status === "Invalid").length;
  batch.duplicateRows = rows.filter((r) => r.status === "Duplicate").length;
  batch.fileTotal = sum(rows, (r) => r.amount);
  batch.importedTotal = sum(
    rows.filter((r) => r.status === "Valid"),
    (r) => r.amount,
  );
}

const publicBatch = (b) => {
  const { rows, parsed, issues, ...rest } = b;
  return rest;
};

function commitBatch(s, batch) {
  for (const row of batch.parsed.filter((r) => r.status === "Valid")) {
    const date = row.date ?? s.asOf;
    const period = periodOf(s, date) ?? s.periods[s.periods.length - 1];
    const category = s.categories.find((c) =>
      [c.name, c.nameEn, c.nameFa].includes(row.values.category),
    );
    const supplier = s.suppliers.find((x) => x.name === row.values.supplier);
    if (batch.kind === "Expenses" || batch.kind === "Levies") {
      s.records.push({
        id: randomUUID(),
        schemeId: s.id,
        lotId: row.lotId,
        financialPeriodId: period.label,
        recordType: batch.kind === "Levies" ? "Levy" : "Expense",
        direction: batch.kind === "Levies" ? "Inflow" : "Outflow",
        fund: "Admin",
        amount: row.amount,
        currency: s.market.currency,
        transactionDate: date,
        dueDate: batch.kind === "Levies" ? addDays(date, 14) : null,
        supplierId: supplier?.id ?? null,
        categoryId: category?.id ?? null,
        status: "Verified",
        sourceDocumentId: randomUUID(),
        importBatchId: batch.id,
        sourceRowNumber: row.rowNumber,
        externalReference: row.values.reference || null,
        description: row.values.description || null,
      });
    } else if (batch.kind === "CapitalWorksPlan") {
      s.works.push({
        id: randomUUID(),
        title: row.values.title || "Imported item",
        component: row.values.component || null,
        description: row.values.description || null,
        targetFiscalYear: Number(row.values.targetYear) || s.market.fiscalYear,
        priority: "Medium",
        status: "Planned",
        currentEstimate: row.amount,
        currency: s.market.currency,
        importBatchId: batch.id,
        estimates: [],
      });
    }
  }
}

/** Minimal multipart/form-data reader for the upload endpoints. */
function parseMultipart(buffer, contentType) {
  const boundary = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType ?? "");
  if (!boundary) return { fields: {}, file: null };
  const marker = Buffer.from(`--${boundary[1] ?? boundary[2]}`);
  const fields = {};
  let file = null;
  let start = buffer.indexOf(marker);
  while (start !== -1) {
    const next = buffer.indexOf(marker, start + marker.length);
    if (next === -1) break;
    const part = buffer.subarray(start + marker.length + 2, next - 2);
    const split = part.indexOf("\r\n\r\n");
    if (split !== -1) {
      const head = part.subarray(0, split).toString("utf8");
      const body = part.subarray(split + 4);
      const name = /name="([^"]+)"/.exec(head)?.[1];
      const filename = /filename="([^"]*)"/.exec(head)?.[1];
      if (filename !== undefined) file = { name: name ?? "File", filename, body };
      else if (name) fields[name] = body.toString("utf8");
    }
    start = next;
  }
  return { fields, file };
}

function rowsFromFile(s, kind, file) {
  if (file && /\.csv$/i.test(file.filename)) {
    const rows = parseCsv(file.body.toString("utf8"));
    if (rows.length > 0) return rows;
  }
  // XLSX (or an unreadable file): the mock cannot parse spreadsheets, so it uses sample rows.
  return sampleRows(s, kind);
}

// ------------------------------------------------------------------ AI

function explain(s, f, lang) {
  const content =
    lang === "fa"
      ? f.type === "Duplicate"
        ? `دو پرداخت با مبلغ یکسان به «${f.supplier}» در همین دوره ثبت شده است. اگر فقط یک فاکتور وجود دارد، یکی از آن‌ها احتمالاً تکراری است.`
        : `هزینه «${f.category}» در این دوره حدود ${Math.round((f.observedAmount / (f.baselineAmount || 1)) * 10) / 10} برابر میانگین شش دوره قبل است. فاکتورهای «${f.supplier}» را بررسی کنید که آیا کار یک‌باره‌ای انجام شده است.`
      : f.type === "Duplicate"
        ? `Two payments of the same amount to ${f.supplier} were recorded in this period. If there is only one invoice, one of them is likely a duplicate.`
        : `${f.category} spending this period is about ${Math.round((f.observedAmount / (f.baselineAmount || 1)) * 10) / 10} times the six-period average. Check the ${f.supplier} invoices for one-off work that explains the jump.`;
  return {
    id: randomUUID(),
    origin: "AI",
    subjectType: "ExpenseFlag",
    subjectId: f.id,
    status: "Generated",
    content,
    language: lang,
    evidenceRecordIds: f.recordIds,
    metrics: {
      observedAmount: String(f.observedAmount),
      baselineAmount: String(f.baselineAmount ?? ""),
    },
    modelName: "mock-model",
    modelVersion: "1",
    promptTemplateId: "flag-explanation",
    promptTemplateVersion: "1",
    confidence: f.type === "Duplicate" ? 0.86 : 0.72,
    reviewStatus: "Unreviewed",
    reviewNote: null,
    reviewedBy: null,
    reviewedAtUtc: null,
    failureReason: null,
    generatedAtUtc: nowUtc(),
  };
}

// ------------------------------------------------------------------ HTTP plumbing

const b64 = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
function makeToken(phone) {
  const admin = phone === ADMIN_PHONE;
  return [
    b64({ alg: "none", typ: "JWT" }),
    b64({
      sub: admin ? ADMIN_ID : MANAGER_ID,
      phone_number: phone,
      roles: admin ? ["Admin"] : ["Resident"],
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
    "mock",
  ].join(".");
}

function pageOf(items, q) {
  const size = Math.max(1, Number(q.get("pageSize") ?? 20));
  const current = Math.max(1, Number(q.get("page") ?? 1));
  const totalPages = Math.max(1, Math.ceil(items.length / size));
  return {
    items: items.slice((current - 1) * size, current * size),
    page: current,
    pageSize: size,
    totalCount: items.length,
    totalPages,
    hasNextPage: current < totalPages,
    hasPreviousPage: current > 1,
  };
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { "content-type": "application/json", ...headers });
  res.end(body === undefined ? "" : JSON.stringify(body));
}
const ok = (res, data = null) => send(res, 200, { succeeded: true, data });
const fail = (res, status, code, message, details = [message]) =>
  send(res, status, { succeeded: false, data: null, error: { code, message, details } });
const notFound = (res, what = "Resource") => fail(res, 404, "NotFound", `${what} not found.`);

async function readRaw(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}
async function readJson(req) {
  const text = (await readRaw(req)).toString("utf8");
  return text ? JSON.parse(text) : {};
}

function claims(req) {
  const token = (req.headers.authorization ?? "").replace(/^Bearer\s+/, "");
  try {
    return JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString());
  } catch {
    return null;
  }
}

function minimalPdf(title) {
  const text = title.replace(/[()\\]/g, " ").slice(0, 80);
  const stream = `BT /F1 18 Tf 72 720 Td (${text}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets = [];
  objects.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) out += `${String(o).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(out, "latin1");
}

// ------------------------------------------------------------------ client routes

async function schemeRoutes(req, res, s, rest, q, lang, user) {
  const m = req.method;
  let match;

  if (m === "GET" && rest === "context") {
    const mk = s.market;
    return ok(res, {
      schemeId: s.id,
      title: s.title,
      address: s.address,
      role: "Manager",
      jurisdictionCode: s.jurisdictionCode,
      countryCode: mk.countryCode,
      currencyCode: mk.currency,
      currencyMinorUnits: mk.minor,
      timeZoneId: mk.timeZone,
      calendar: mk.calendar,
      fiscalYearStartMonth: mk.fiscalStartMonth,
      currentFiscalYear: mk.fiscalYear,
      currentPeriodLabel: s.periods[s.periods.length - 1].label,
      defaultLanguage: mk.language,
      adminFundLabel: mk.fundLabels[0],
      capitalWorksFundLabel: mk.fundLabels[1],
      disclaimer: TEXT[lang].disclaimer,
    });
  }
  if (m === "GET" && rest === "lots") {
    return ok(
      res,
      s.lots.map((l) => ({ ...l, role: "Owner" })),
    );
  }
  if (m === "GET" && rest === "financial-health") return ok(res, financialHealth(s, lang));
  if (m === "GET" && rest === "monthly-summary")
    return ok(res, monthlySummary(s, q.get("periodDate")));
  if (m === "GET" && rest === "financial-periods") {
    return ok(
      res,
      s.periods.map((p, i) => ({
        id: p.label,
        fiscalYear: s.market.fiscalYear,
        periodNumber: i + 1,
        label: p.label,
        startDate: p.start,
        endDate: p.end,
        status: i === s.periods.length - 1 ? "Open" : "Closed",
      })),
    );
  }
  if (m === "GET" && rest === "expense-categories") return ok(res, s.categories);
  if (m === "GET" && rest === "suppliers") return ok(res, pageOf(s.suppliers, q));
  if (m === "GET" && rest === "financial-records") {
    const types = q.getAll("recordTypes").map((t) => fromEnum(E.recordType, t));
    const fund = fromEnum(E.fund, q.get("fund"));
    const list = visibleRecords(s, "9999-12-31")
      .filter((r) => !types.length || types.includes(r.recordType))
      .filter((r) => !fund || r.fund === fund)
      .filter((r) => !q.get("from") || r.transactionDate >= q.get("from"))
      .filter((r) => !q.get("to") || r.transactionDate <= q.get("to"))
      .filter((r) => !q.get("categoryId") || r.categoryId === q.get("categoryId"))
      .filter((r) => !q.get("supplierId") || r.supplierId === q.get("supplierId"))
      .filter((r) => !q.get("lotId") || r.lotId === Number(q.get("lotId")))
      .filter((r) => !q.get("importBatchId") || r.importBatchId === q.get("importBatchId"))
      .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
    return ok(res, {
      records: pageOf(list, q),
      total: sum(list, (r) => r.amount),
      currency: s.market.currency,
    });
  }

  // ---- imports
  if (rest === "imports" && m === "GET") {
    const kind = fromEnum(E.importKind, q.get("kind"));
    const list = s.imports
      .filter((b) => !kind || b.kind === kind)
      .sort((a, b) => b.uploadedAtUtc.localeCompare(a.uploadedAtUtc));
    return ok(res, pageOf(list.map(publicBatch), q));
  }
  if (rest === "imports" && m === "POST") {
    const { fields, file } = parseMultipart(await readRaw(req), req.headers["content-type"]);
    const kind = fromEnum(E.importKind, fields.Kind) ?? "Expenses";
    if (!file) return fail(res, 400, "Validation", "A file is required.");
    const rows = rowsFromFile(s, kind, file);
    const batch = newBatch(s, kind, file.filename, rows[0]);
    batch.rows = rows;
    batch.totalRows = rows.length - 1;
    batch.mapping = autoMap(rows[0], [...batch.requiredFields, ...batch.optionalFields]);
    batch.missingRequiredFields = batch.requiredFields.filter((f) => !batch.mapping[f]);
    s.imports.push(batch);
    return ok(res, publicBatch(batch));
  }
  if ((match = /^imports\/([0-9a-f-]{36})(?:\/(.+))?$/.exec(rest))) {
    const batch = s.imports.find((b) => b.id === match[1]);
    if (!batch) return notFound(res, "Import");
    const action = match[2];
    if (!action && m === "GET") return ok(res, publicBatch(batch));
    if (action === "mapping" && m === "PUT") {
      const { mapping = {} } = await readJson(req);
      batch.mapping = Object.fromEntries(Object.entries(mapping).filter(([, c]) => c));
      batch.missingRequiredFields = batch.requiredFields.filter((f) => !batch.mapping[f]);
      batch.status = batch.missingRequiredFields.length ? "Uploaded" : "Mapped";
      return ok(res, publicBatch(batch));
    }
    if (action === "preview" && m === "GET") {
      if (batch.status === "Mapped" || batch.status === "Validated") {
        applyValidation(s, batch);
        batch.status = "Validated";
      } else if (!batch.parsed) applyValidation(s, batch);
      const take = Number(q.get("take") ?? 50);
      const mappingIssues = batch.missingRequiredFields.map((f) => ({
        rowNumber: 0,
        field: f,
        value: null,
        reason: "Required field is not mapped.",
        suggestedFix: "Choose a column for it.",
        severity: "Error",
      }));
      return ok(res, {
        import: publicBatch(batch),
        rows: batch.parsed.slice(0, take).map(({ cells, date, lotId, ...r }) => r),
        mappingIssues,
        canCommit: batch.status === "Validated" && batch.validRows > 0,
      });
    }
    if (action === "errors" && m === "GET") {
      if (!batch.issues) applyValidation(s, batch);
      const severity =
        q.get("severity") === "1" ? "Error" : q.get("severity") === "2" ? "Warning" : null;
      return ok(
        res,
        pageOf(
          batch.issues.filter((i) => !severity || i.severity === severity),
          q,
        ),
      );
    }
    if (action === "commit" && m === "POST") {
      if (batch.status !== "Validated")
        return fail(res, 409, "Conflict", "Only validated imports can be committed.");
      commitBatch(s, batch);
      batch.status = "Committed";
      batch.committedAtUtc = nowUtc();
      return ok(res, publicBatch(batch));
    }
    if (action === "control-total" && m === "POST") {
      if (batch.status !== "Committed")
        return fail(
          res,
          409,
          "Conflict",
          "Control totals can only be applied to committed imports.",
        );
      const { controlTotal } = await readJson(req);
      if (controlTotal === null || controlTotal === undefined) {
        Object.assign(batch, {
          controlTotal: null,
          difference: null,
          verification: "Unverified",
          isVerified: false,
          verifiedAtUtc: null,
        });
      } else {
        const difference = Math.round((batch.fileTotal - Number(controlTotal)) * 100) / 100;
        const verified = Math.abs(difference) <= (s.market.minor ? 0.01 : 1);
        Object.assign(batch, {
          controlTotal: Number(controlTotal),
          difference,
          verification: verified ? "Verified" : "Mismatch",
          isVerified: verified,
          verifiedAtUtc: verified ? nowUtc() : null,
        });
      }
      return ok(res, publicBatch(batch));
    }
    if (action === "retry" && m === "POST") {
      const { fields, file } = parseMultipart(await readRaw(req), req.headers["content-type"]);
      if (!file) return fail(res, 400, "Validation", "A file is required.");
      const rows = rowsFromFile(s, batch.kind, file);
      const next = newBatch(s, batch.kind, file.filename, rows[0]);
      next.rows = rows;
      next.totalRows = rows.length - 1;
      const carried = Object.fromEntries(
        Object.entries(fields)
          .filter(([k]) => k.startsWith("Mapping["))
          .map(([k, v]) => [k.slice(8, -1), v])
          .filter(([, c]) => rows[0].includes(c)),
      );
      next.mapping = Object.keys(carried).length
        ? carried
        : autoMap(rows[0], [...next.requiredFields, ...next.optionalFields]);
      next.missingRequiredFields = next.requiredFields.filter((f) => !next.mapping[f]);
      next.status = next.missingRequiredFields.length ? "Uploaded" : "Mapped";
      next.retryOfBatchId = batch.id;
      batch.status = "Superseded";
      batch.supersededByBatchId = next.id;
      s.imports.push(next);
      return ok(res, publicBatch(next));
    }
  }

  // ---- expenses
  if (m === "GET" && rest === "expenses/spend") return ok(res, spend(s, q, lang));
  if (m === "GET" && rest === "expenses/comparison") return ok(res, spendComparison(s, q, lang));
  if (m === "GET" && rest === "expenses/flags") {
    const type = fromEnum(E.flagType, q.get("type"));
    const status = fromEnum(E.flagStatus, q.get("status"));
    const list = s.flags.filter(
      (f) => (!type || f.type === type) && (!status || f.status === status),
    );
    return ok(res, pageOf(list, q));
  }
  if (m === "POST" && rest === "expenses/flags/detect") {
    return ok(res, {
      flagsCreated: 0,
      flagsOpen: s.flags.filter((f) => f.status === "Open").length,
    });
  }
  if ((match = /^expenses\/flags\/([0-9a-f-]{36})(\/review)?$/.exec(rest))) {
    const f = s.flags.find((x) => x.id === match[1]);
    if (!f) return notFound(res, "Flag");
    if (!match[2] && m === "GET") return ok(res, f);
    if (match[2] && m === "POST") {
      const body = await readJson(req);
      Object.assign(f, {
        status: fromEnum(E.flagStatus, body.status) ?? f.status,
        reviewNote: body.note ?? null,
        reviewedBy: user,
        reviewedAtUtc: nowUtc(),
      });
      return ok(res, f);
    }
  }

  // ---- arrears
  if (m === "GET" && rest === "arrears/summary")
    return ok(res, arrearsSummary(s, lang, q.get("asOf") ?? s.asOf));
  if (m === "GET" && rest === "arrears/lots") {
    const only = q.get("onlyInArrears") === "true";
    return ok(
      res,
      s.lots.map((l) => lotBalance(s, l)).filter((b) => !only || b.overdue > 0),
    );
  }
  if ((match = /^arrears\/lots\/(\d+)\/(history|payment-plan)$/.exec(rest))) {
    const lot = s.lots.find((l) => l.id === Number(match[1]));
    if (!lot) return notFound(res, "Lot");
    if (match[2] === "history" && m === "GET") return ok(res, lotHistory(s, lot));
    if (match[2] === "payment-plan" && m === "PUT") {
      const body = await readJson(req);
      if (body.hasPaymentPlan) s.paymentPlans.set(lot.id, body.note ?? "");
      else s.paymentPlans.delete(lot.id);
      return ok(res, lotBalance(s, lot));
    }
  }
  if (m === "GET" && rest === "arrears/trend") {
    const count = Math.min(Number(q.get("periods") ?? 12), s.periods.length);
    return ok(res, {
      currency: s.market.currency,
      points: s.periods.slice(-count).map((p) => {
        const a = arrearsSummary(s, lang, p.end);
        return {
          periodLabel: p.label,
          periodEnd: p.end,
          totalOutstanding: a.totalOutstanding,
          totalOverdue: a.totalOverdue,
          lotsInArrears: a.lotsInArrears,
          buckets: a.buckets,
        };
      }),
    });
  }
  if (m === "GET" && rest === "arrears/risk-signals") return ok(res, riskSignals(s, lang));
  if (rest === "arrears/settings") {
    if (m === "PUT") {
      const body = await readJson(req);
      const b = body.bucketBoundaries;
      if (
        !Array.isArray(b) ||
        b.length < 1 ||
        b.length > 6 ||
        b.some((x, i) => !Number.isInteger(x) || x <= 0 || (i > 0 && x <= b[i - 1]))
      ) {
        return fail(res, 400, "Validation", "Invalid bucket boundaries.", [
          "Boundaries must be 1 to 6 increasing whole numbers of days.",
        ]);
      }
      s.settings = { bucketBoundaries: b, concentrationTopN: Number(body.concentrationTopN) || 5 };
    }
    return ok(res, { ...s.settings, bucketLabels: bucketLabels(s.settings.bucketBoundaries) });
  }
  if (rest === "arrears/actions" && m === "GET") {
    const status = fromEnum(E.actionStatus, q.get("status"));
    const lotId = q.get("lotId") ? Number(q.get("lotId")) : null;
    const list = s.actions.filter(
      (a) => (!status || a.status === status) && (!lotId || a.lotId === lotId),
    );
    return ok(res, pageOf([...list].reverse(), q));
  }
  if (rest === "arrears/actions" && m === "POST") {
    const body = await readJson(req);
    const lot = s.lots.find((l) => l.id === Number(body.lotId));
    if (!lot) return fail(res, 400, "Validation", "Unknown lot.");
    const action = {
      id: randomUUID(),
      lotId: lot.id,
      lot: lot.lotNumber,
      reason: String(body.reason ?? ""),
      status: "Open",
      overdueAtCreation: lotBalance(s, lot).overdue,
      currency: s.market.currency,
      createdBy: user,
      createdAtUtc: nowUtc(),
      statusChangedBy: null,
      statusChangedAtUtc: null,
      notes: [],
    };
    s.actions.push(action);
    return ok(res, action);
  }
  if ((match = /^arrears\/actions\/([0-9a-f-]{36})\/(status|notes)$/.exec(rest)) && m === "POST") {
    const action = s.actions.find((a) => a.id === match[1]);
    if (!action) return notFound(res, "Action");
    const body = await readJson(req);
    if (match[2] === "status") {
      Object.assign(action, {
        status: fromEnum(E.actionStatus, body.status) ?? action.status,
        statusChangedBy: user,
        statusChangedAtUtc: nowUtc(),
      });
      if (body.note)
        action.notes.push({
          id: randomUUID(),
          text: body.note,
          authorId: user,
          createdAtUtc: nowUtc(),
        });
    } else {
      action.notes.push({
        id: randomUUID(),
        text: String(body.text ?? ""),
        authorId: user,
        createdAtUtc: nowUtc(),
      });
    }
    return ok(res, action);
  }

  // ---- capital works
  if (rest === "capital-works/items" && m === "GET") {
    const all = q.get("includeClosed") === "true";
    return ok(
      res,
      s.works.filter((w) => all || !["Completed", "Cancelled"].includes(w.status)),
    );
  }
  if (rest === "capital-works/items" && m === "POST") {
    const body = await readJson(req);
    const item = {
      id: randomUUID(),
      title: body.title,
      component: body.component,
      description: body.description,
      targetFiscalYear: Number(body.targetFiscalYear),
      priority: fromEnum(E.priority, body.priority) ?? "Medium",
      status: "Planned",
      currentEstimate: Number(body.estimate),
      currency: s.market.currency,
      importBatchId: null,
      estimates: [
        {
          id: randomUUID(),
          amount: Number(body.estimate),
          estimateDate: body.estimateDate ?? s.asOf,
          source: body.estimateSource,
          note: null,
          createdBy: user,
          createdAtUtc: nowUtc(),
        },
      ],
    };
    s.works.push(item);
    return ok(res, item);
  }
  if ((match = /^capital-works\/items\/([0-9a-f-]{36})(\/estimates)?$/.exec(rest))) {
    const item = s.works.find((w) => w.id === match[1]);
    if (!item) return notFound(res, "Item");
    const body = await readJson(req);
    if (!match[2] && m === "PUT") {
      Object.assign(item, {
        title: body.title,
        component: body.component,
        description: body.description,
        targetFiscalYear: Number(body.targetFiscalYear),
        priority: fromEnum(E.priority, body.priority) ?? item.priority,
        status: fromEnum(E.workStatus, body.status) ?? item.status,
      });
      return ok(res, item);
    }
    if (match[2] && m === "POST") {
      item.estimates.unshift({
        id: randomUUID(),
        amount: Number(body.amount),
        estimateDate: body.estimateDate ?? s.asOf,
        source: body.source,
        note: body.note,
        createdBy: user,
        createdAtUtc: nowUtc(),
      });
      item.currentEstimate = Number(body.amount);
      return ok(res, item);
    }
  }
  if (rest === "capital-works/scenarios" && m === "GET") return ok(res, s.scenarios);
  if (rest === "capital-works/scenarios" && m === "POST") {
    const body = await readJson(req);
    const sc = scenario(s, {
      ...body,
      openingBalance: body.openingBalance ?? s.scenarios[0]?.openingBalance ?? 0,
    });
    if (sc.isBaseline) s.scenarios.forEach((x) => (x.isBaseline = false));
    s.scenarios.push(sc);
    return ok(res, sc);
  }
  if (rest === "capital-works/scenarios/compare" && m === "POST") {
    const { scenarioIds = [] } = await readJson(req);
    const list = s.scenarios
      .filter((x) => scenarioIds.includes(x.id))
      .map((x) => projection(s, x, lang));
    const clean = list
      .filter((p) => !p.hasShortfall)
      .sort((a, b) => a.scenario.annualContribution - b.scenario.annualContribution);
    return ok(res, {
      currency: s.market.currency,
      scenarios: list,
      lowestContributionWithoutShortfallId: clean[0]?.scenario.id ?? null,
      disclaimer: TEXT[lang].planningDisclaimer,
    });
  }
  if ((match = /^capital-works\/scenarios\/([0-9a-f-]{36})(\/funding-gap)?$/.exec(rest))) {
    const sc = s.scenarios.find((x) => x.id === match[1]);
    if (!sc) return notFound(res, "Scenario");
    if (match[2] && m === "GET") return ok(res, projection(s, sc, lang));
    if (!match[2] && m === "PUT") {
      const body = await readJson(req);
      Object.assign(sc, body, { notes: body.notes ?? null });
      if (sc.isBaseline) s.scenarios.forEach((x) => x !== sc && (x.isBaseline = false));
      return ok(res, sc);
    }
  }

  // ---- AI
  if ((match = /^ai\/expense-flags\/([0-9a-f-]{36})\/explanation$/.exec(rest)) && m === "POST") {
    const f = s.flags.find((x) => x.id === match[1]);
    if (!f) return notFound(res, "Flag");
    const existing = s.insights.find((i) => i.subjectId === f.id);
    if (existing && q.get("regenerate") !== "true") return ok(res, existing);
    const insight = explain(s, f, lang);
    s.insights = s.insights.filter((i) => i.subjectId !== f.id);
    s.insights.push(insight);
    return ok(res, insight);
  }
  if (rest === "ai/insights" && m === "GET") {
    const subjectId = q.get("subjectId");
    return ok(
      res,
      s.insights.filter((i) => !subjectId || i.subjectId === subjectId),
    );
  }
  if ((match = /^ai\/insights\/([0-9a-f-]{36})\/review$/.exec(rest)) && m === "POST") {
    const insight = s.insights.find((i) => i.id === match[1]);
    if (!insight) return notFound(res, "Insight");
    const body = await readJson(req);
    Object.assign(insight, {
      reviewStatus: fromEnum(E.aiReview, body.reviewStatus) ?? insight.reviewStatus,
      reviewNote: body.note ?? null,
      reviewedBy: user,
      reviewedAtUtc: nowUtc(),
    });
    return ok(res, insight);
  }
  if (rest === "ai/category-suggestions" && m === "POST") {
    const pending = new Set(
      s.suggestions.filter((x) => x.status === "Pending").map((x) => x.financialRecordId),
    );
    const targets = s.records.filter(
      (r) => r.recordType === "Expense" && !r.categoryId && !pending.has(r.id),
    );
    const guess = (r) => {
      const d = (r.description ?? "").toLowerCase();
      return d.includes("lift")
        ? s.categories.find((c) => c.code === "lift")
        : d.includes("hedge")
          ? (s.categories.find((c) => c.code === "gardening") ?? s.categories[0])
          : s.categories[0];
    };
    const created = targets.map((r) => {
      const c = guess(r) ?? s.categories[0];
      return {
        id: randomUUID(),
        origin: "AI",
        financialRecordId: r.id,
        suggestedCategoryId: c.id,
        suggestedCategory: c.name,
        confidence: 0.81,
        rationale: `${r.description}: ${c.nameEn}`,
        modelName: "mock-model",
        modelVersion: "1",
        promptTemplateId: "category-suggestion",
        promptTemplateVersion: "1",
        status: "Pending",
        reviewedBy: null,
        reviewedAtUtc: null,
      };
    });
    s.suggestions.push(...created);
    return ok(res, {
      recordsConsidered: targets.length,
      suggestionsCreated: created.length,
      aiAvailable: true,
      unavailableReason: null,
      suggestions: created,
    });
  }
  if (rest === "ai/category-suggestions" && m === "GET") {
    const status = fromEnum(E.suggestion, q.get("status")) ?? "Pending";
    return ok(
      res,
      s.suggestions.filter((x) => x.status === status),
    );
  }
  if ((match = /^ai\/category-suggestions\/([0-9a-f-]{36})\/review$/.exec(rest)) && m === "POST") {
    const suggestion = s.suggestions.find((x) => x.id === match[1]);
    if (!suggestion) return notFound(res, "Suggestion");
    const { accept } = await readJson(req);
    Object.assign(suggestion, {
      status: accept ? "Accepted" : "Rejected",
      reviewedBy: user,
      reviewedAtUtc: nowUtc(),
    });
    if (accept) {
      const record = s.records.find((r) => r.id === suggestion.financialRecordId);
      if (record) record.categoryId = suggestion.suggestedCategoryId;
    }
    return ok(res, suggestion);
  }

  // ---- reports
  if (rest === "reports" && m === "GET")
    return ok(
      res,
      pageOf(
        [...s.reports].reverse().map(({ snapshot, ...r }) => ({ ...r, snapshot: null })),
        q,
      ),
    );
  if (rest === "reports" && m === "POST") {
    const body = await readJson(req);
    const monthly = monthlySummary(s, body.periodDate);
    const version = s.reports.filter((r) => r.periodLabel === monthly.periodLabel).length + 1;
    const report = {
      id: randomUUID(),
      periodLabel: monthly.periodLabel,
      periodStart: monthly.periodStart,
      periodEnd: monthly.periodEnd,
      version,
      language: lang,
      generatedBy: user,
      generatedAtUtc: nowUtc(),
      managerCommentary: body.commentary ?? null,
      commentaryBy: body.commentary ? user : null,
      commentaryAtUtc: body.commentary ? nowUtc() : null,
      snapshot: { health: financialHealth(s, lang), monthly },
    };
    s.reports.push(report);
    return ok(res, report);
  }
  if ((match = /^reports\/([0-9a-f-]{36})(?:\/(commentary|pdf))?$/.exec(rest))) {
    const report = s.reports.find((r) => r.id === match[1]);
    if (!report) return notFound(res, "Report");
    if (!match[2] && m === "GET") return ok(res, report);
    if (match[2] === "commentary" && m === "PUT") {
      const { commentary } = await readJson(req);
      Object.assign(report, {
        managerCommentary: commentary || null,
        commentaryBy: user,
        commentaryAtUtc: nowUtc(),
      });
      return ok(res, report);
    }
    if (match[2] === "pdf" && m === "GET") {
      const pdf = minimalPdf(`${s.title} - ${report.periodLabel} - v${report.version}`);
      res.writeHead(200, {
        "content-type": "application/pdf",
        "content-length": pdf.length,
        "content-disposition": `attachment; filename="report-${report.periodLabel}-v${report.version}.pdf"`,
      });
      return res.end(pdf);
    }
  }

  // ---- feedback
  if (rest === "feedback" && m === "GET") {
    const type = fromEnum(E.subject, q.get("subjectType"));
    return ok(
      res,
      pageOf(
        [...s.feedback].reverse().filter((f) => !type || f.subjectType === type),
        q,
      ),
    );
  }
  if (rest === "feedback" && m === "POST") {
    const body = await readJson(req);
    if (!body.subjectId || String(body.subjectId).length > 64)
      return fail(res, 400, "Validation", "subjectId is required (max 64 characters).");
    const item = {
      id: randomUUID(),
      schemeId: s.id,
      subjectType: fromEnum(E.subject, body.subjectType),
      subjectId: String(body.subjectId),
      rating: fromEnum(E.rating, body.rating),
      note: body.note ?? null,
      actionTaken: body.actionTaken ?? null,
      hoursSavedEstimate: body.hoursSavedEstimate ?? null,
      userId: user,
      createdAtUtc: nowUtc(),
    };
    s.feedback.push(item);
    return ok(res, item);
  }

  return notFound(res, "Endpoint");
}

// ------------------------------------------------------------------ back-office routes

const boScheme = (s) => ({
  id: s.id,
  title: s.title,
  status: s.status,
  address: s.address,
  latitude: s.latitude,
  longitude: s.longitude,
  floor: s.floor,
  guestParkingCount: s.guestParkingCount,
  jurisdictionCode: s.jurisdictionCode,
  currencyCode: s.market.currency,
  timeZoneId: s.market.timeZone,
});
const boLot = (s, l) => ({ ...l, schemeId: s.id, parkingSpots: [] });

function pilotMetrics(s) {
  const committed = s.imports.filter((b) => b.status === "Committed");
  const byRating = {};
  for (const f of s.feedback) byRating[f.rating] = (byRating[f.rating] ?? 0) + 1;
  const byReview = {};
  for (const i of s.insights) byReview[i.reviewStatus] = (byReview[i.reviewStatus] ?? 0) + 1;
  return {
    schemeId: s.id,
    schemeTitle: s.title,
    jurisdictionCode: s.jurisdictionCode,
    currency: s.market.currency,
    milestones: {
      onboarded: "2026-07-01",
      firstImport: "2026-07-03",
      firstVerifiedDashboard: "2026-07-04",
    },
    hoursToFirstVerifiedDashboard: 26,
    importsUploaded: s.imports.length,
    importsVerified: committed.filter((b) => b.isVerified).length,
    anomaliesFound: s.flags.length,
    anomaliesConfirmed: s.flags.filter((f) => f.status === "Confirmed").length,
    anomaliesDismissed: s.flags.filter((f) => f.status === "Dismissed").length,
    moneyFlaggedConfirmed: sum(
      s.flags.filter((f) => f.status === "Confirmed"),
      (f) => f.estimatedAnnualisedImpact,
    ),
    moneyFlaggedOpen: sum(
      s.flags.filter((f) => f.status === "Open"),
      (f) => f.estimatedAnnualisedImpact,
    ),
    hoursSavedReported: sum(s.feedback, (f) => f.hoursSavedEstimate ?? 0),
    feedbackByRating: byRating,
    aiReviewByStatus: byReview,
    reportsGenerated: s.reports.length,
  };
}

async function backofficeRoutes(req, res, path, q) {
  const m = req.method;
  let match;

  if (path === "backoffice/schemes" && m === "GET") {
    const status = fromEnum(E.active, q.get("status"));
    return ok(
      res,
      pageOf([...schemes.values()].filter((s) => !status || s.status === status).map(boScheme), q),
    );
  }
  if (path === "backoffice/schemes" && m === "POST") {
    const body = await readJson(req);
    if (!body.title || !body.address)
      return fail(res, 400, "Validation", "Title and address are required.");
    const s = createScheme({
      title: body.title,
      address: body.address,
      jurisdictionCode: body.jurisdictionCode,
      withData: false,
    });
    s.lots = [];
    s.members = [];
    s.status = fromEnum(E.active, body.status) ?? "Active";
    Object.assign(s, {
      latitude: body.latitude ?? s.latitude,
      longitude: body.longitude ?? s.longitude,
      floor: body.floor ?? s.floor,
      guestParkingCount: body.guestParkingCount ?? 0,
    });
    return ok(res, { id: s.id });
  }
  if (path === "backoffice/schemes/access-denied-logs" && m === "GET") {
    const schemeId = q.get("schemeId") ? Number(q.get("schemeId")) : null;
    const userId = q.get("userId");
    return ok(
      res,
      pageOf(
        accessDenied.filter(
          (a) => (!schemeId || a.schemeId === schemeId) && (!userId || a.userId === userId),
        ),
        q,
      ),
    );
  }
  if ((match = /^backoffice\/schemes\/(\d+)(?:\/(.+))?$/.exec(path))) {
    const s = schemes.get(Number(match[1]));
    if (!s) return notFound(res, "Scheme");
    const sub = match[2];
    if (!sub && m === "GET")
      return ok(res, { ...boScheme(s), lotSchemeResultItems: s.lots.map((l) => boLot(s, l)) });
    if (!sub && m === "PUT") {
      const body = await readJson(req);
      Object.assign(s, {
        title: body.title ?? s.title,
        address: body.address ?? s.address,
        latitude: body.latitude ?? s.latitude,
        longitude: body.longitude ?? s.longitude,
        floor: body.floor ?? s.floor,
        guestParkingCount: body.guestParkingCount ?? s.guestParkingCount,
      });
      return ok(res);
    }
    if (sub === "status" && m === "POST") {
      s.status = fromEnum(E.active, (await readJson(req)).schemeStatus) ?? s.status;
      return ok(res);
    }
    if (sub === "finance/project-invoices" && m === "POST")
      return ok(res, { invoicesCreated: s.lots.length });
    if (sub === "lots" && m === "GET")
      return ok(
        res,
        pageOf(
          s.lots.map((l) => boLot(s, l)),
          q,
        ),
      );
    if (sub === "lots" && m === "POST") {
      const body = await readJson(req);
      if (s.lots.some((l) => l.lotNumber === body.lotNumber))
        return fail(res, 409, "Conflict", "A lot with this number already exists.");
      const lot = {
        id: s.id * 100 + s.lots.length + 1 + Math.floor(Math.random() * 50),
        lotNumber: String(body.lotNumber),
        status: fromEnum(E.active, body.status) ?? "Active",
        area: Number(body.area),
        rooms: Number(body.rooms),
        floor: Number(body.floor),
        postalCode: String(body.postalCode ?? ""),
        entitlement: Number(body.entitlement ?? 1),
        vacateAt: null,
      };
      s.lots.push(lot);
      return ok(res, { id: lot.id });
    }
    if (sub === "members" && m === "GET") return ok(res, pageOf(s.members, q));
    if (sub === "members" && m === "POST") {
      const body = await readJson(req);
      if (s.members.some((x) => x.userId === body.userId))
        return fail(res, 409, "Conflict", "This user is already a member.");
      const member = {
        id: s.members.length + 1,
        schemeId: s.id,
        userId: String(body.userId),
        role: fromEnum(E.schemeRole, body.role) ?? "ReadOnly",
        status: "Active",
        createdAt: nowUtc(),
      };
      s.members.push(member);
      return ok(res, member);
    }
    if ((match = /^members\/([^/]+)(\/role)?$/.exec(sub ?? ""))) {
      const member = s.members.find((x) => x.userId === match[1]);
      if (!member) return notFound(res, "Member");
      if (match[2] && m === "PUT") {
        member.role = fromEnum(E.schemeRole, (await readJson(req)).role) ?? member.role;
        return ok(res, member);
      }
      if (!match[2] && m === "DELETE") {
        s.members = s.members.filter((x) => x !== member);
        return ok(res);
      }
    }
    if ((match = /^lots\/(\d+)(?:\/(.+))?$/.exec(sub ?? ""))) {
      const lot = s.lots.find((l) => l.id === Number(match[1]));
      if (!lot) return notFound(res, "Lot");
      const action = match[2];
      if (!action && m === "PUT") {
        const body = await readJson(req);
        Object.assign(lot, {
          lotNumber: String(body.lotNumber),
          area: Number(body.area),
          rooms: Number(body.rooms),
          floor: Number(body.floor),
          postalCode: String(body.postalCode ?? ""),
          entitlement: Number(body.entitlement ?? lot.entitlement),
        });
        return ok(res);
      }
      if (action === "status" && m === "POST") {
        lot.status = fromEnum(E.active, (await readJson(req)).lotStatus) ?? lot.status;
        return ok(res);
      }
      if (action === "vacate" && m === "POST") {
        lot.vacateAt = nowUtc();
        s.residents.set(lot.id, []);
        return ok(res);
      }
      const residents = s.residents.get(lot.id) ?? [];
      if (action === "residents" && m === "GET") return ok(res, residents);
      if (action === "residents" && m === "POST") {
        const body = await readJson(req);
        if (residents.some((r) => r.userId === body.userId))
          return fail(res, 409, "Conflict", "This user already lives in this lot.");
        s.residents.set(lot.id, [
          ...residents,
          { userId: String(body.userId), role: fromEnum(E.lotRole, body.role) ?? "Owner" },
        ]);
        return ok(res);
      }
      if ((match = /^residents\/([^/]+)(?:\/(role|move))?$/.exec(action ?? ""))) {
        const resident = residents.find((r) => r.userId === match[1]);
        if (!resident) return notFound(res, "Resident");
        const body = m === "DELETE" ? {} : await readJson(req);
        if (!match[2] && m === "DELETE") {
          s.residents.set(
            lot.id,
            residents.filter((r) => r !== resident),
          );
          return ok(res);
        }
        if (match[2] === "role" && m === "POST") {
          resident.role = fromEnum(E.lotRole, body.newRole) ?? resident.role;
          return ok(res);
        }
        if (match[2] === "move" && m === "POST") {
          const target = s.lots.find((l) => l.id === Number(body.toLotId));
          if (!target) return fail(res, 400, "Validation", "Unknown target lot.");
          s.residents.set(
            lot.id,
            residents.filter((r) => r !== resident),
          );
          s.residents.set(target.id, [
            ...(s.residents.get(target.id) ?? []),
            { userId: resident.userId, role: fromEnum(E.lotRole, body.newRole) ?? resident.role },
          ]);
          return ok(res);
        }
      }
    }
    return notFound(res, "Endpoint");
  }

  if (path === "backoffice/users" && m === "POST") {
    const { phoneNumber } = await readJson(req);
    if (!/^\+\d{11,12}$/.test(phoneNumber ?? ""))
      return fail(res, 400, "Validation", "Invalid phone number.");
    return ok(res, { id: randomUUID(), phoneNumber, status: "Active" });
  }
  if ((match = /^backoffice\/users\/([^/]+)\/(activate|deactivate)$/.exec(path)) && m === "POST")
    return ok(res);

  if ((match = /^backoffice\/pilot\/schemes\/(\d+)\/metrics$/.exec(path)) && m === "GET") {
    const s = schemes.get(Number(match[1]));
    return s ? ok(res, pilotMetrics(s)) : notFound(res, "Scheme");
  }
  if (path === "backoffice/pilot/feedback" && m === "GET") {
    const schemeId = q.get("schemeId") ? Number(q.get("schemeId")) : null;
    const all = [...schemes.values()]
      .filter((s) => !schemeId || s.id === schemeId)
      .flatMap((s) => s.feedback);
    return ok(
      res,
      pageOf(
        all.sort((a, b) => b.createdAtUtc.localeCompare(a.createdAtUtc)),
        q,
      ),
    );
  }
  if (path === "backoffice/demo/seed" && m === "POST") {
    const jurisdiction = q.get("jurisdiction") === "IR" ? "IR" : "AU-NSW";
    const s = createScheme({
      title:
        jurisdiction === "IR" ? `ساختمان نمونه ${nextSchemeId}` : `Demo Scheme ${nextSchemeId}`,
      address: jurisdiction === "IR" ? "تهران، خیابان نمونه" : "1 Demo Street, Sydney NSW 2000",
      jurisdictionCode: jurisdiction,
      demo: true,
    });
    return ok(res, {
      schemeId: s.id,
      title: s.title,
      jurisdictionCode: s.jurisdictionCode,
      currency: s.market.currency,
      lots: s.lots.length,
      financialRecords: s.records.length,
      capitalWorkItems: s.works.length,
      fundingScenarios: s.scenarios.length,
      expenseFlags: s.flags.length,
    });
  }
  return notFound(res, "Endpoint");
}

// ------------------------------------------------------------------ server

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const path = url.pathname.replace(/^\/api\/v1\//, "").replace(/\/+$/, "");
  const q = url.searchParams;
  const lang = /^fa/i.test(req.headers["accept-language"] ?? "") ? "fa" : "en";

  try {
    if (url.pathname === "/health/live") return send(res, 200, { status: "ok" });

    if (req.method === "POST" && path === "authentication/request-otp")
      return send(res, 200, { succeeded: true });
    if (req.method === "POST" && path === "authentication/register")
      return send(res, 200, { succeeded: true });
    if (req.method === "POST" && path === "authentication/login") {
      const { phoneNumber, otp } = await readJson(req);
      if (otp !== VALID_OTP) {
        return fail(res, 400, "InvalidOtp", "Invalid code", [
          "The code is invalid or has expired.",
        ]);
      }
      // The BFF stores these under the surface's own cookie names.
      return send(res, 200, undefined, {
        "set-cookie": [
          `alohomeAccessToken=${makeToken(phoneNumber)}; Path=/; HttpOnly; Max-Age=3600`,
          `alohomeRefreshToken=refresh-${Date.now()}; Path=/; HttpOnly; Max-Age=86400`,
        ],
      });
    }
    if (req.method === "POST" && path === "authentication/logout")
      return send(res, 200, { succeeded: true });

    const user = claims(req);
    if (!user) return fail(res, 401, "Unauthorized", "Unauthorized");

    if (req.method === "GET" && path === "schemes/mine") {
      return ok(
        res,
        [...schemes.values()]
          .filter((s) => s.status === "Active")
          .map((s) => ({
            schemeId: s.id,
            title: s.title,
            jurisdictionCode: s.jurisdictionCode,
            currencyCode: s.market.currency,
            role: "Manager",
          })),
      );
    }
    const scoped = /^schemes\/(\d+)\/(.+)$/.exec(path);
    if (scoped) {
      const s = schemes.get(Number(scoped[1]));
      if (!s) return fail(res, 404, "NotFound", "Scheme not found.");
      if (s.status !== "Active")
        return fail(res, 403, "Forbidden", "You do not have access to this scheme.");
      return await schemeRoutes(req, res, s, scoped[2], q, lang, user.sub);
    }

    if (path.startsWith("backoffice/")) {
      if (!user.roles?.includes("Admin")) return fail(res, 403, "Forbidden", "Forbidden");
      return await backofficeRoutes(req, res, path, q);
    }

    return notFound(res, "Endpoint");
  } catch (error) {
    console.error("[mock-api]", error);
    return fail(res, 500, "Unexpected", "Unexpected error");
  }
});

server.listen(PORT, HOST, () => console.log(`mock api listening on ${HOST}:${PORT}`));
