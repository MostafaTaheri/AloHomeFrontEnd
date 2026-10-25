// Minimal stand-in for the AloHome API, used only by the Playwright suite.
// It mimics the wire format (camelCase JSON, string result enums, the { succeeded, data } envelope,
// the error envelope and the token cookies) for the endpoints the e2e tests touch. It is not a
// substitute for contract tests against the real API.
import { createServer } from "node:http";

const PORT = Number(process.env.PORT ?? 5099);
const ADMIN_PHONE = "+989120000000";
const VALID_OTP = "123456";

const b64 = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
function makeToken(phone) {
  const admin = phone === ADMIN_PHONE;
  return [
    b64({ alg: "none", typ: "JWT" }),
    b64({
      sub: admin ? "11111111-1111-4111-8111-111111111111" : "22222222-2222-4222-8222-222222222222",
      phone_number: phone,
      roles: admin ? ["Admin"] : ["Resident"],
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
    "mock",
  ].join(".");
}

const SCHEMES = [
  {
    schemeId: 1,
    title: "Harbour View",
    address: "12 Example Street, Sydney NSW 2000",
    jurisdictionCode: "AU-NSW",
    countryCode: "AU",
    currencyCode: "AUD",
    currencyMinorUnits: 2,
    timeZoneId: "Australia/Sydney",
    calendar: "Gregorian",
    fiscalYearStartMonth: 7,
    currentFiscalYear: 2026,
    currentPeriodLabel: "2026-09",
    defaultLanguage: "en",
    status: "Active",
  },
  {
    schemeId: 2,
    title: "Tower A",
    address: "1 Example Street, Tehran",
    jurisdictionCode: "IR",
    countryCode: "IR",
    currencyCode: "IRR",
    currencyMinorUnits: 0,
    timeZoneId: "Asia/Tehran",
    calendar: "Persian",
    fiscalYearStartMonth: 1,
    currentFiscalYear: 1405,
    currentPeriodLabel: "1405-06",
    defaultLanguage: "fa",
    status: "Active",
  },
];

const summaryOf = (s) => ({
  schemeId: s.schemeId,
  title: s.title,
  jurisdictionCode: s.jurisdictionCode,
  currencyCode: s.currencyCode,
  role: "Manager",
});

const contextOf = (s) => ({
  ...s,
  role: "Manager",
  adminFundLabel: s.countryCode === "AU" ? "Administrative fund" : "Operating fund",
  capitalWorksFundLabel: s.countryCode === "AU" ? "Sinking fund" : "Capital fund",
  disclaimer: "Figures are derived from verified records and are not financial advice.",
});

const healthOf = (s) => ({
  origin: "Deterministic",
  schemeId: s.schemeId,
  schemeTitle: s.title,
  jurisdictionCode: s.jurisdictionCode,
  currency: s.currencyCode,
  language: s.defaultLanguage,
  asOf: "2026-09-30",
  periodLabel: s.currentPeriodLabel,
  adminFund: { balance: 125000, openingBalance: 100000, inflow: 60000, outflow: 35000 },
  capitalWorksFund: { balance: 480000, openingBalance: 450000, inflow: 40000, outflow: 10000 },
  arrears: {
    totalOutstanding: 18000,
    totalOverdue: 12000,
    lotsInArrears: 3,
    buckets: [
      { label: "1-30", amount: 6000, lots: 2 },
      { label: "31-60", amount: 6000, lots: 1 },
    ],
    projectedNextQuarterShortfall: null,
  },
  expenseTrend: [
    { period: "2026-07", amount: 20000 },
    { period: "2026-08", amount: 22000 },
    { period: "2026-09", amount: 21000 },
  ],
  currentPeriodSpend: 21000,
  spendChangePercentMoM: -4.5,
  spendChangeNotMeaningful: false,
  capitalWorks: {
    hasBaselineScenario: false,
    baselineScenario: null,
    firstShortfallYear: null,
    maximumShortfall: 0,
    endingBalance: 0,
    plannedItems: 0,
    plannedCostNextFiveYears: 0,
  },
  abnormalExpenses: [],
  topRisks: [],
  recommendedActions: [],
  freshness: {
    latestVerifiedTransactionDate: "2026-09-28",
    latestVerifiedImportAtUtc: "2026-09-29T08:00:00Z",
    hasUnverifiedData: false,
    dataAgeDays: 2,
    noVerifiedData: false,
  },
  disclaimer: "Figures are derived from verified records and are not financial advice.",
});

const emptyPage = (url) => ({
  items: [],
  page: Number(url.searchParams.get("page") ?? 1),
  pageSize: Number(url.searchParams.get("pageSize") ?? 20),
  totalCount: 0,
  totalPages: 1,
  hasNextPage: false,
  hasPreviousPage: false,
});

const pageOf = (items, url) => {
  const size = Number(url.searchParams.get("pageSize") ?? 20);
  const current = Number(url.searchParams.get("page") ?? 1);
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
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, { "content-type": "application/json", ...headers });
  res.end(body === undefined ? "" : JSON.stringify(body));
}
const ok = (res, data) => send(res, 200, { succeeded: true, data });
const fail = (res, status, code, message, details = [message]) =>
  send(res, status, { succeeded: false, error: { code, message, details } });

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

const isAuthenticated = (req) => /^Bearer\s+\S+/.test(req.headers.authorization ?? "");
function isAdmin(req) {
  const token = (req.headers.authorization ?? "").replace(/^Bearer\s+/, "");
  try {
    const claims = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString());
    return claims.roles?.includes("Admin") === true;
  } catch {
    return false;
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const path = url.pathname.replace(/^\/api\/v1\//, "").replace(/\/+$/, "");

  try {
    if (url.pathname === "/health/live") return send(res, 200, { status: "ok" });

    if (req.method === "POST" && path === "authentication/request-otp") {
      return send(res, 200, { succeeded: true });
    }
    if (req.method === "POST" && path === "authentication/register") {
      return send(res, 200, { succeeded: true });
    }
    if (req.method === "POST" && path === "authentication/login") {
      const { phoneNumber, otp } = await readBody(req);
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
    if (req.method === "POST" && path === "authentication/logout") {
      return send(res, 200, { succeeded: true });
    }

    if (!isAuthenticated(req)) return fail(res, 401, "Unauthorized", "Unauthorized");

    if (req.method === "GET" && path === "schemes/mine") return ok(res, SCHEMES.map(summaryOf));

    const scoped = path.match(/^schemes\/(\d+)\/(.+)$/);
    if (scoped) {
      const found = SCHEMES.find((s) => s.schemeId === Number(scoped[1]));
      if (!found) return fail(res, 403, "Forbidden", "You do not have access to this scheme.");
      const rest = scoped[2];
      if (req.method === "GET") {
        if (rest === "context") return ok(res, contextOf(found));
        if (rest === "financial-health") return ok(res, healthOf(found));
        if (rest === "monthly-summary") {
          return ok(res, {
            periodLabel: found.currentPeriodLabel,
            periodStart: "2026-09-01",
            periodEnd: "2026-09-30",
            currency: found.currencyCode,
            leviesRaised: 60000,
            paymentsReceived: 52000,
            expenses: 21000,
            netCashFlow: 31000,
            overdueAtPeriodEnd: 12000,
            overdueAtPreviousPeriodEnd: 10000,
            flagsDetected: 0,
            topCategories: [{ category: "Cleaning", amount: 8000 }],
          });
        }
        if (rest === "lots") return ok(res, []);
        if (rest.startsWith("reports") || rest.startsWith("imports"))
          return ok(res, emptyPage(url));
        if (rest.startsWith("feedback")) return ok(res, emptyPage(url));
      }
      return ok(res, []);
    }

    if (path.startsWith("backoffice/")) {
      if (!isAdmin(req)) return fail(res, 403, "Forbidden", "Forbidden");
      if (req.method === "GET" && path === "backoffice/schemes") {
        const status = url.searchParams.get("status");
        const items = SCHEMES.filter((s) => !status || s.status === status).map((s) => ({
          id: s.schemeId,
          title: s.title,
          address: s.address,
          jurisdictionCode: s.jurisdictionCode,
          status: s.status,
          lotCount: 12,
        }));
        return ok(res, pageOf(items, url));
      }
      if (req.method === "GET") return ok(res, emptyPage(url));
    }

    return fail(res, 404, "NotFound", "Not found");
  } catch (error) {
    console.error("[mock-api]", error);
    return fail(res, 500, "Unexpected", "Unexpected error");
  }
});

server.listen(PORT, "127.0.0.1", () => console.log(`mock api listening on ${PORT}`));
