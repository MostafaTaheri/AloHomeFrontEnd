# AloHome: Usage Guide

This guide explains how to use AloHome day to day. Part A is for scheme managers and members. Part B is for AloHome staff using the back office. Part C covers running the app locally for demos and testing.

Words like "scheme", "lot" and "levy" change with the market. An Australian strata scheme has lots and levies. An Iranian building has units and service charges (in Persian: ساختمان، واحد، شارژ). The screens use the right word automatically, and this guide uses the Australian terms.

---

## Part A: Managers and members

### A1. Sign in

1. Open the AloHome address and choose **Sign in**.
2. Enter your mobile number in international form, for example `+61412345678` or `+989121234567`. Persian digits are fine.
3. Select **Send code** and enter the 6-digit code from the SMS.
4. Select **Sign in**.

If you don't have an account yet, use **Create an account**, confirm your number with a code, then sign in. A new account sees no schemes until AloHome support adds you to one.

**Language and market.** Use the switchers in the header:

- **Language** changes the text between فارسی and English.
- **Region** sets the formats used outside a scheme.
- **Currency unit** (Iran only) shows amounts in Rial or Toman.

Inside a scheme, dates, currency and terms always follow that scheme's market.

### A2. Choose a scheme

After sign-in you see your schemes, each with its market, currency and your role.

- **Manager** can change data.
- **Read-only** can see everything but cannot import, review or edit. Where an action would be, you see a short note instead.

Open a scheme to reach its workspace. The tabs along the top are: Financial health, Imports, Expenses, Arrears, Capital works, AI review, Reports, Feedback.

### A3. Read the financial health dashboard

This is the scheme's home page. It uses verified records only.

- **Fund balances** for the admin fund and the capital works (sinking) fund.
- **Arrears:** how much is owed and overdue, how many lots are behind, and how old the debt is.
- **Spending:** the monthly trend and the change from last month.
- **Capital works:** whether the baseline plan runs short, and when.
- **Unusual expenses** and **lots to watch**.
- **Recommended actions**, ordered by priority.
- **Monthly summary:** levies raised, payments received, expenses and net cash flow.

Check the **data freshness** note at the top. It tells you how recent the verified data is and warns you if some data is not yet verified. If the figures look stale, import the latest records first (A4).

### A4. Import records

Use **Imports** to bring data in from a spreadsheet. Nothing is saved until the last step.

1. Choose what you are importing: **Expenses**, **Levies**, **Arrears report** or **Capital works plan**.
2. Pick a CSV or XLSX file (up to 20 MB) and select **Upload and continue**.
3. **Mapping:** for each field, choose the column in your file that holds it. Required fields must be matched, and each column can be used once. Select **Save mapping and check file**.
4. **Review:**
   - Check the totals and the preview.
   - Under **Problems found**, filter by errors or warnings. Each row shows the field, the value, the problem and a suggested fix. Use **Download problems (CSV)** to fix the file in Excel.
   - If anything looks wrong, fix the file and upload it again.
5. **Control total (optional):** enter the total from your accounting system. AloHome compares it with the import.
6. **Import:** confirm. The result page shows what was imported.

If an import fails, open it from **Import history** and use **Upload corrected file**. Your column mapping and control total are carried over. If you leave the wizard halfway, AloHome asks first; the unfinished import stays in the history.

### A5. Review spending and flags

**Expenses → Spending**

- Group spending by **month**, **category** or **supplier**, and filter by fund and period.
- Select a row to see the records behind the number.
- **Compared with earlier periods** shows which categories went up or down.

**Expenses → Flags**

AloHome flags possible **duplicates** and **unusual spend**.

1. Open a flag to see the records involved.
2. Optionally select **Explain this flag** for an AI explanation (see A8).
3. Set the outcome:
   - **Investigating** while you check.
   - **Confirmed** if it is a real problem.
   - **Dismissed** if it is fine.
4. Add a note so the committee knows why.

Managers can run **detection** again after a new import.

### A6. Manage arrears

**Overview**

- Totals, overdue amounts by age, how concentrated the debt is, and its effect on cash flow.
- The lot table lists who is behind. Open a lot to see its ledger. Mark a lot as being **on a payment plan** with a note.

**Risk signals**

- A rule-based score per lot, with the reasons behind it.
- Use **Was this useful?** to tell us if a signal is wrong.

**Follow-up**

1. Create a follow-up from a lot that is behind and give the reason.
2. Move it through **Open → In review → Resolved**, or **Dismissed**.
3. Add notes as you go. The history is kept.

**Settings**

- Set the ageing buckets (for example 30, 60 and 90 days; 1 to 6 boundaries).
- Set how many top lots the dashboard shows (1 to 50).

### A7. Plan capital works

**Plan**

1. Add an item:
   - title, component and description
   - target fiscal year
   - priority (Low to Critical)
   - cost estimate
2. When a quote changes, **add a new estimate**. Earlier estimates are kept.
3. Update the status as work progresses (Planned, In progress, Completed, Deferred, Cancelled). Turn on **Show completed and cancelled** to see closed items.

**Funding scenarios**

1. Create a scenario with these inputs:
   - opening balance
   - annual contribution and its yearly growth
   - interest rate
   - cost escalation
   - start year and horizon (1 to 30 years)
2. Mark one scenario as the **baseline**. The dashboard uses it.
3. Open **Funding gap** to see the balance year by year and the first year the fund runs short.
4. Use **Compare scenarios** to weigh options, for example a levy increase against a deferred project.

This is a planning aid, not financial advice.

### A8. Work with AI explanations and suggestions

AI content always looks different from the regular figures and carries an **AI-generated** label. Treat it as a second opinion.

- **Confidence** shows how sure the model is.
- **Evidence** lists the records it relied on.
- If the model has too little to go on, you see **Insufficient evidence** or **Unavailable** instead of text.

On the **AI review** page:

- **Explanations:** every AI explanation for the scheme. Mark each one **Useful**, **Incorrect** or **Needs review**.
- **Category suggestions:** ask for suggestions on uncategorised records, then **Accept** or **Reject** each one. Records change only when you accept.

### A9. Generate and share a report

1. Open **Reports** and choose **Generate a report**.
2. Pick the period. Check the preview of the current figures.
3. Optionally add **manager commentary** for the committee.
4. Generate. The report keeps a snapshot of the figures, so later imports don't change it.
5. Open the report to edit the commentary or select **Download PDF** to share it.

Generate after the month's data is imported and verified.

### A10. Send feedback

Most panels have a **Was this useful?** box. Choose **Useful**, **Not useful**, **Incorrect** or **Needs review** and add a comment if you like. The **Feedback** page has an overall rating and lists what you have sent.

### A11. Sign out

Use **Sign out** in the header. Signing out of the client app doesn't sign you out of the back office, and the other way round.

---

## Part B: AloHome staff (back office)

### B1. Sign in

Go to `/backoffice/login` (or follow **Back-office sign-in** from the client login page). Sign in with your staff phone number and code. Only accounts with the Admin role get in. Other accounts see **This account doesn't have back-office access.**

Every action in the back office is recorded. Pages are not cached and not indexed.

### B2. Set up a new pilot scheme

1. **Create user accounts** (Users → Create a user) for each person, using their phone number. Note the user ID.
2. **Create the scheme** (Schemes → New scheme):
   - title and address
   - location
   - floors and guest parking
   - market (`IR` or `AU-NSW`), which sets the default time zone
3. **Add lots** (scheme → Lots):
   - lot number, area, rooms, floor
   - postal code (10 digits in Iran, 4 in Australia)
   - unit entitlement
4. **Add residents** to each lot by user ID as **Owner** or **Family member**.
5. **Add members** (scheme → Members) by user ID: **Manager** for people who will import and review, **Read-only** for committee members who only view.
6. If the scheme needs finance records for project invoices, run **Generate project invoices** once from the Details tab.

### B3. Day-to-day changes

| Task                                                              | Where                                            |
| ----------------------------------------------------------------- | ------------------------------------------------ |
| Edit scheme details                                               | Scheme → Details                                 |
| Disable or enable a scheme (data is kept)                         | Scheme → Details → Disable or Enable             |
| Change a lot, disable it, or mark it vacated                      | Scheme → Lots                                    |
| Move a resident to another lot, change their role, or remove them | Scheme → Lots → Residents                        |
| Change a member between Manager and Read-only, or remove them     | Scheme → Members                                 |
| Block a person from signing in                                    | Users → Switch an account on or off → Deactivate |

Deactivating a user signs them out of every scheme until the account is activated again.

### B4. Investigate access problems

**Access log** lists requests that were refused because the person lacked access. Each entry shows the user, the scheme, the resource and the access level required. If a manager reports "No access", check here first, then check their membership role on the scheme.

### B5. Watch the pilot

**Pilot** shows, per scheme, how many lots, financial records, capital work items, funding scenarios and expense flags exist, plus feedback from pilot users. Use it to spot schemes that stopped importing or have unresolved flags.

### B6. Demo data

On the back-office overview, **Demo data** creates a separate demo scheme for a chosen market with sample lots, records, capital works and flags. Use it for demos and training. Never use it in a live pilot scheme.

---

## Part C: Running locally for demos and testing

Full setup and configuration are in the [README](../README.md). The short version for a demo without the real API:

```bash
npm install --include=dev
npm run dev:mock          # app on http://localhost:3000, mock API on http://127.0.0.1:5099
```

With the mock API:

| Sign in as | Phone                                  | Code     | Result                                                       |
| ---------- | -------------------------------------- | -------- | ------------------------------------------------------------ |
| Manager    | any valid number, e.g. `+989121111111` | `123456` | Two schemes: Harbour View (NSW, AUD) and Tower A (Iran, IRR) |
| Admin      | `+989120000000`                        | `123456` | Back office at `/backoffice`                                 |

The mock API keeps sample data in memory, including 13 months of records, arrears, flags, capital works and a verified import. Every screen and action in this guide works against it. Restarting it resets the data. It is a test double, not a full backend.

---

## Troubleshooting

| Symptom                                 | What to do                                                                                                                   |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| "Your session expired"                  | Sign in again. Sessions on the client and back office are separate.                                                          |
| "No access to this scheme"              | Ask AloHome support to check your membership. Staff: see the access log (B4).                                                |
| Upload refused                          | Use CSV or XLSX under 20 MB. Remove empty sheets and make sure the file has a header row.                                    |
| Many rows with errors at review         | Download the problem list, fix the file and upload again. Check the mapping first. A wrong column choice is the usual cause. |
| Dashboard shows "No figures yet"        | Nothing verified has been imported. Complete an import (A4).                                                                 |
| Amounts show in Rial but you want Toman | Use the currency-unit switcher in the header.                                                                                |
| An error shows a "Reference" code       | Send the code to support. It identifies the exact request in the logs.                                                       |
