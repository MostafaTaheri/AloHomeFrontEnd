# AloHome Front: System Overview

This document covers every part of the frontend: the screens, who can use them, the API calls behind them and the shared building blocks. For the structure and the reasons behind it, see [architecture.md](architecture.md). For step-by-step instructions, see [usage-guide.md](usage-guide.md).

## 1. Roles

| Role                          | Where it comes from                | Surface     | What it can do                                                                                                                                               |
| ----------------------------- | ---------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Manager                       | Scheme membership, role `Manager`  | Client      | Everything in a scheme: import data, review flags and AI output, manage arrears follow-ups and settings, plan capital works, generate reports, send feedback |
| Read-only member              | Scheme membership, role `ReadOnly` | Client      | View every screen of the scheme. Actions that change data are hidden and replaced by a short read-only notice.                                               |
| Signed-in user with no scheme | Any account                        | Client      | Sees an empty scheme picker with instructions to ask support                                                                                                 |
| Admin                         | JWT role `Admin`                   | Back office | Schemes, lots, residents, members, users, access log, pilot metrics, demo data                                                                               |

In the client, `canWrite` is true only for `Manager`. The API applies the same rule independently.

## 2. Route map

### Client

| Route                              | Screen                                             | Notes                                                   |
| ---------------------------------- | -------------------------------------------------- | ------------------------------------------------------- |
| `/`                                | Entry                                              | Sends the user to `/schemes` or `/login`                |
| `/login`, `/register`              | Phone and one-time-code sign-in, self-registration | Signed-in users are sent to `/schemes`                  |
| `/schemes`                         | Scheme picker                                      | Lists the user's schemes with market, currency and role |
| `/schemes/{id}`                    | Financial health                                   | Default page of a scheme                                |
| `/schemes/{id}/imports`            | Imports: upload and history                        |                                                         |
| `/schemes/{id}/imports/{importId}` | Import wizard                                      |                                                         |
| `/schemes/{id}/expenses`           | Expenses                                           | `?tab=flags` opens the flags tab                        |
| `/schemes/{id}/arrears`            | Arrears                                            | Tabs: overview, risk, follow-up, settings               |
| `/schemes/{id}/capital-works`      | Capital works                                      | `?tab=scenarios` opens funding scenarios                |
| `/schemes/{id}/ai-review`          | AI review                                          | Tabs: explanations, category suggestions                |
| `/schemes/{id}/reports`            | Reports list and generation                        |                                                         |
| `/schemes/{id}/reports/{reportId}` | Report detail                                      | Snapshot, commentary, PDF                               |
| `/schemes/{id}/feedback`           | Feedback                                           |                                                         |
| `/dashboard/*`                     | Redirect                                           | Permanent redirect to `/schemes`                        |

### Back office

| Route                      | Screen                                      |
| -------------------------- | ------------------------------------------- |
| `/backoffice/login`        | Staff sign-in (no registration)             |
| `/backoffice/forbidden`    | Shown to signed-in accounts without `Admin` |
| `/backoffice`              | Overview and demo data                      |
| `/backoffice/schemes`      | Scheme list, create scheme                  |
| `/backoffice/schemes/{id}` | Scheme detail: lots, members, details       |
| `/backoffice/users`        | Create users, activate and deactivate       |
| `/backoffice/access-log`   | Refused access requests                     |
| `/backoffice/pilot`        | Pilot metrics and feedback per scheme       |
| `/admin/*`                 | Permanent redirect to `/backoffice/*`       |

### Server routes

| Route                                 | Purpose                                                |
| ------------------------------------- | ------------------------------------------------------ |
| `/api/auth/*`, `/api/bo/auth/*`       | Sign-in, registration (client only), sign-out, session |
| `/api/backend/*`, `/api/bo/backend/*` | Authenticated relays to the API                        |
| `/api/telemetry`                      | Product events, logged as structured lines             |
| `/api/health`                         | Liveness for Docker and orchestrators                  |

## 3. Client surface

### 3.1 Sign-in and registration

- **Phone number:** in E.164 form. The region's example number is shown as a hint (`+989121234567` or `+61412345678`). Persian and Arabic-Indic digits are converted.
- **Code:** 6 digits, sent by SMS. A wrong or expired code shows the API's own message.
- **Registration** creates the account and then asks the user to request a new code to sign in.
- **Redirect after sign-in:** the user lands on the `next` path if it is safe, otherwise on `/schemes`.
- **Back office link:** a link points staff to the back-office sign-in.

### 3.2 Scheme picker and workspace

- **Scheme picker:** `GET schemes/mine` lists the schemes the user belongs to.
- **Workspace layout:**
  - `GET schemes/{id}/context` loads the scheme's title, address, role, jurisdiction, currency, time zone, calendar, fiscal year and fund labels.
  - It handles forbidden and not-found responses with dedicated messages.
  - It switches the region to match the scheme.
- **Workspace header:** shows the scheme title, the role badge, the fiscal year and the scheme's disclaimer.
- **Scheme navigation:** Financial health, Imports, Expenses, Arrears, Capital works, AI review, Reports, Feedback.

### 3.3 Financial health (F1)

API calls: `GET schemes/{id}/financial-health?asOf=` and `GET schemes/{id}/monthly-summary?periodDate=`.

- **Funds:** admin and capital works fund balances, using the scheme's own fund labels.
- **Arrears:** total outstanding, total overdue, lots in arrears, buckets by age, projected next-quarter shortfall.
- **Spending:** an expense trend chart, current period spend and month-on-month change (marked "not meaningful" when the base is too small).
- **Capital works:** baseline scenario, first shortfall year, maximum shortfall, planned cost for the next five years.
- **Watch lists:** unusual expenses and the lots with the highest arrears risk.
- **Recommended actions:** rule-based, ordered by priority.
- **Monthly summary:** levies raised, payments received, expenses, net cash flow, overdue now against the previous period, flags, top categories.
- **Data freshness:** latest verified transaction and import, data age, and a warning when unverified data exists or nothing is verified.
- **Feedback** on the dashboard as a whole.

### 3.4 Imports (F2)

API calls: `schemes/{id}/imports` and its sub-resources `mapping`, `preview`, `errors`, `commit`, `control-total` and `retry`.

Import kinds: Expenses, Levies, Arrears report, Capital works plan.

1. **Upload:**
   - Accepts CSV or XLSX up to 20 MB (the server limit is authoritative).
   - Type, size and empty-file checks run in the browser first.
2. **Mapping:**
   - Each required field must be matched to a column.
   - A column can serve only one field.
3. **Review:**
   - Shows a summary (rows, valid rows, rows with errors, duplicates, file total, total to import), the first rows of a preview and a problem list filterable by errors and warnings.
   - The problem list downloads as CSV, built in the browser, with formula-injection protection and a BOM for Excel.
4. **Control total:** an optional figure from the source system, checked against the import total.
5. **Commit:**
   - Needs explicit confirmation.
   - Nothing is saved before this step.
6. **Result:** shows the outcome. A failed import can be retried with a corrected file.

Other behaviour:

- Leaving the page mid-wizard prompts the user and records `wizard_abandoned`.
- The history table can be filtered by kind and shows status, valid rows against total rows, upload time and verification state.
- Read-only members see the history but not the upload form.

### 3.5 Expenses and flags (F3, F4)

**Spending tab.** API calls: `expenses/spend`, `expenses/comparison`, `financial-records`, `financial-periods`, `expense-categories`, `suppliers`.

- **Grouping:** by month, category or supplier, with fund and period filters.
- **Views:** a chart and a breakdown table.
- **Drill-down:** a row opens the records behind that figure.
- **Comparison:** against earlier periods, with change by category.

**Flags tab.** API calls: `expenses/flags`, `expenses/flags/{id}`, `expenses/flags/detect`, `expenses/flags/{id}/review`.

- **Flag types:** Duplicate and Unusual spend.
- **Statuses:** Open, Investigating, Confirmed, Dismissed.
- **Detection:** managers can run it again on demand.
- **Review:** a manager reviews each flag with a status and a note.
- **AI explanation:** "Explain this flag" calls `ai/expense-flags/{id}/explanation` and shows the result in the AI insight panel. It can be regenerated.

### 3.6 Arrears (F5)

API calls: `arrears/summary`, `arrears/lots`, `arrears/lots/{lotId}/history`, `arrears/lots/{lotId}/payment-plan`, `arrears/trend`, `arrears/risk-signals`, `arrears/settings`, `arrears/actions` and its `status` and `notes` sub-resources.

- **Overview:**
  - Totals, overdue by age bucket, concentration, cash-flow impact and an overdue trend.
  - A lot table with a ledger history dialog per lot.
  - A flag for lots on a payment plan.
- **Risk signals:** a rule-based score and level per lot, with the reasons behind it. Each signal accepts feedback.
- **Follow-up:**
  - Actions created from a lot that is behind.
  - Status changes (Open, In review, Resolved, Dismissed) and a running notes history.
- **Settings:**
  - Ageing bucket boundaries (1 to 6 boundaries) and the number of top lots to show (1 to 50).
  - Validated in the browser, then by the API.

### 3.7 Capital works (F6)

API calls: `capital-works/items` and `items/{id}/estimates`, `capital-works/scenarios`, `scenarios/{id}/funding-gap`, `scenarios/compare`.

- **Plan tab:**
  - Items with component, description, target fiscal year, priority (Low, Medium, High, Critical) and status (Planned, In progress, Completed, Deferred, Cancelled).
  - Estimates are added as new versions, not overwritten.
  - Closed items are hidden by default.
- **Funding scenarios tab:**
  - Each scenario has an opening balance, annual contribution, contribution growth, interest and cost escalation rates, start year, a horizon of 1 to 30 years, and an optional baseline flag.
  - The funding gap view shows the year-by-year balance and the first shortfall.
  - Scenarios can be compared side by side.
- **Disclaimer:** the page carries a "planning aid, not advice" notice.

### 3.8 AI review (F7)

API calls: `ai/insights`, `ai/insights/{id}/review`, `ai/category-suggestions`, `ai/category-suggestions/{id}/review`.

- **Explanations:**
  - Every AI explanation for the scheme, with its status, confidence, evidence, and review state (Unreviewed, Useful, Incorrect, Needs review).
  - Only Generated insights show text. Unavailable, Rejected and InsufficientEvidence each show their own explanation.
- **Category suggestions:**
  - A manager asks for suggestions on uncategorised records, then accepts or rejects each one.
  - Nothing changes in the records until a suggestion is accepted.

### 3.9 Reports (F8)

API calls: `reports`, `reports/{id}`, `reports/{id}/commentary`, `reports/{id}/pdf`.

- **List:** reports by period and version, with the generating user and time.
- **Generate:** pick a period and add optional commentary. A preview of the current figures shows before generating.
- **Detail:**
  - The frozen snapshot (financial health and monthly summary as at generation), so later imports do not change a published report.
  - Manager commentary can be edited.
  - PDF export.
  - Report feedback.

### 3.10 Feedback (F9)

API call: `schemes/{id}/feedback` (submit and list).

- **Widget:** appears on the dashboard, flags, AI insights, risk signals and reports.
- **Ratings:** Useful, Not useful, Incorrect, Needs review, with an optional comment.
- **Feedback page:** an overall usefulness rating and the list of feedback already sent.

## 4. Back-office surface

### 4.1 Sign-in and access

- **Sign-in:** the same phone-and-code flow as the client, on a separate page. There is no registration.
- **Non-admin accounts:** refused at login, with the upstream session revoked. If such a session already exists, the user is sent to `/backoffice/forbidden`.
- **Headers:** every console page is served with `no-store` and `noindex`.
- **Staff notice:** the header reminds staff that actions are recorded.

### 4.2 Overview

- Counts and links for schemes, users, the access log and the pilot.
- **Demo data:** pick a market (`IR` or `AU-NSW`) and create a demo scheme with sample lots, records, capital works and flags (`backoffice/demo/seed`). It needs confirmation and reports what it created.

### 4.3 Schemes

API calls: `backoffice/schemes` and its `{id}`, `{id}/status`, `{id}/lots`, `{id}/members`, `{id}/finance/project-invoices`.

- **List:** paginated, filterable by status.
- **Create:**
  - Title, address, coordinates, floors, guest parking and jurisdiction.
  - The time zone defaults from the jurisdiction and can be changed.
- **Detail, Details tab:**
  - Edit the scheme, enable or disable it (disabling keeps data but removes access), and generate project invoices.
- **Detail, Lots tab:**
  - Create, edit, enable or disable lots.
  - Lot fields: lot number, area, rooms, floor, postal code (10 digits in Iran, 4 in Australia), unit entitlement.
  - Vacate a lot, which removes its residents.
- **Residents** (per lot):
  - Assign by user ID with role Owner or Family member.
  - Change the role, move the resident to another lot, or remove them.
- **Detail, Members tab:**
  - Add a user ID as Manager or Read-only, change the role, or remove the member.

### 4.4 Users

API calls: `backoffice/users`, `{userId}/activate`, `{userId}/deactivate`.

- Create an account by phone number.
- Activate or deactivate an account by user ID. Deactivation signs the person out of every scheme.

### 4.5 Access log

API call: `backoffice/schemes/access-denied-logs`.

- Requests refused because a user lacked access to a scheme.
- Each entry shows user, scheme, resource, required access and time.
- Paginated.

### 4.6 Pilot

API calls: `backoffice/pilot/schemes/{id}/metrics` and `backoffice/pilot/feedback`.

- **Metrics per scheme:** lots, financial records, capital work items, funding scenarios and expense flags.
- **Pilot feedback:** across schemes.

## 5. Shared building blocks

| Module                 | Contents                                                                                                                                                    |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `components/ui`        | Button, Card, Badge, Field, Table, Pagination, Dialog, ConfirmDialog, Toast, state views (`Spinner`, `Skeleton`, `EmptyState`, `ErrorState`, `InlineAlert`) |
| `components/layout`    | Client and back-office shells with a skip link, language, region and currency-unit switchers, sign-out                                                      |
| `components/finance`   | `Money` (currency and Toman aware), `Stat` tiles, `Freshness` banner, `EnumBadge` with translated labels                                                    |
| `components/charts`    | Series chart and horizontal bar list in SVG, each with an accessible table fallback                                                                         |
| `components/forms`     | Date field (Jalali or Gregorian by region) and money input (locale digits, minor units)                                                                     |
| `components/ai`        | Insight panel, confidence scale, feedback widget                                                                                                            |
| `lib/format`           | Money, number, percent, date, period and fiscal-year formatting                                                                                             |
| `lib/region`           | Region profiles, Jalali conversion, time-zone-aware dates                                                                                                   |
| `lib/use-url-state.ts` | Keeps filters, pages and tabs in the URL                                                                                                                    |
| `lib/download.ts`      | Safe file downloads (report PDFs, CSV)                                                                                                                      |

### Screen states

Every data screen handles the same set of states.

| State                   | Behaviour                                                    |
| ----------------------- | ------------------------------------------------------------ |
| Loading                 | Skeleton or spinner with `aria-live`                         |
| Empty                   | Explains why it is empty and what to do next                 |
| Partial                 | Shows what loaded and marks what did not                     |
| Validation              | Field-level messages from zod, plus API details              |
| Forbidden               | A clear "no access" message, never a blank page              |
| Network or server error | A message, the correlation id when there is one, and a retry |

## 6. Telemetry events

| Event                                                                                                        | When                                          |
| ------------------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| `auth_signed_in`                                                                                             | A successful sign-in on either surface        |
| `import_started`, `import_mapped`, `import_previewed`, `import_committed`, `import_failed`, `import_retried` | Each import step                              |
| `wizard_abandoned`                                                                                           | The user leaves an unfinished import          |
| `flag_reviewed`                                                                                              | A flag review is saved                        |
| `ai_explanation_requested`, `ai_explanation_shown`                                                           | An AI explanation is requested and displayed  |
| `ai_suggestion_reviewed`                                                                                     | A category suggestion is accepted or rejected |
| `report_generated`, `report_exported`                                                                        | A report is generated or its PDF downloaded   |
| `feedback_submitted`                                                                                         | A feedback answer is sent                     |

Properties are limited to short identifiers and counts. No amounts, names, phone numbers or free text.

## 7. Configuration

| Variable                                                | Default                                         | Purpose                             |
| ------------------------------------------------------- | ----------------------------------------------- | ----------------------------------- |
| `API_BASE_URL`                                          | required                                        | API origin without `/api/v1`        |
| `API_VERSION`                                           | `1`                                             | Version segment                     |
| `AUTH_ACCESS_COOKIE`, `AUTH_REFRESH_COOKIE`             | `alohomeAccessToken`, `alohomeRefreshToken`     | Client cookies. Must match the API. |
| `BACKOFFICE_ACCESS_COOKIE`, `BACKOFFICE_REFRESH_COOKIE` | `alohomeBoAccessToken`, `alohomeBoRefreshToken` | Back-office cookies                 |
| `COOKIE_SECURE`                                         | `true` in production                            | `false` only for plain-HTTP staging |
| `COOKIE_DOMAIN`                                         | unset                                           | Shared parent domain only           |
| `ALLOWED_ORIGINS`                                       | request host                                    | Extra origins for mutating calls    |
| `BACKEND_TIMEOUT_MS`                                    | `15000`                                         | Ordinary upstream timeout           |
| `UPLOAD_TIMEOUT_MS`                                     | `60000`                                         | Upload and PDF timeout              |
| `MAX_UPLOAD_BYTES`                                      | `20971520` (20 MB, at most 100 MB)              | Upload cap                          |

User preferences are stored in cookies (one year): `alohome-locale`, `alohome-region` and `alohome-currency-unit`.

## 8. Testing assets

| Asset                  | Purpose                                                                                                                                                                                                                                                                                                     |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/**/*.test.ts`     | Vitest unit tests (141 at the time of writing)                                                                                                                                                                                                                                                              |
| `e2e/app.spec.ts`      | Playwright suite (15 tests)                                                                                                                                                                                                                                                                                 |
| `mock-api/server.mjs`  | Stateful in-memory mock of the API for e2e and demos (`npm run mock`, or `npm run dev:mock` with the app). OTP `123456`. Phone `+989120000000` gets the `Admin` role, and any other number is a manager of two seeded schemes (Harbour View, NSW and Tower A, Iran). It covers every endpoint the UI calls. |
| `playwright.config.ts` | Starts the mock on port 5099 and the built app on 3100                                                                                                                                                                                                                                                      |
