# AloHome Front

Web frontend for the AloHome strata and building finance API (`../AloHome`). Next.js 16 (App Router), React 19, TypeScript (strict), Tailwind CSS 4. Persian (RTL) and English, for Iran and Australia.

The app serves two separate surfaces from one deployment:

| Surface         | Entry                | Who                                            | Cookies                                         |
| --------------- | -------------------- | ---------------------------------------------- | ----------------------------------------------- |
| **Client**      | `/login`, `/schemes` | Managers, committee members, owners, residents | `alohomeAccessToken`, `alohomeRefreshToken`     |
| **Back office** | `/backoffice/login`  | AloHome staff with the `Admin` role            | `alohomeBoAccessToken`, `alohomeBoRefreshToken` |

Each surface has its own login page, session, BFF routes (`/api/*` and `/api/bo/*`), shell and navigation. A back-office sign-in never creates a client session and the reverse. `/admin` redirects to `/backoffice` and `/dashboard` to `/schemes` for old links.

## Getting started

Requirements: Node 22+, a running AloHome API.

```bash
cp .env.example .env.local     # set API_BASE_URL
npm install --include=dev      # see the note below
npm run dev                    # http://localhost:3000
```

If `NODE_ENV=production` is set in your shell, a plain `npm install` silently skips dev dependencies (TypeScript, ESLint, Vitest). Use `--include=dev` or unset it.

### Configuration

| Variable                                                | Default                                         | Purpose                                                                                    |
| ------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `API_BASE_URL`                                          | required                                        | API origin, without `/api/v1`. Server-side only.                                           |
| `API_VERSION`                                           | `1`                                             | Path segment in `/api/v{version}/`.                                                        |
| `AUTH_ACCESS_COOKIE`, `AUTH_REFRESH_COOKIE`             | `alohomeAccessToken`, `alohomeRefreshToken`     | Client session cookies. Must match the API's cookie names.                                 |
| `BACKOFFICE_ACCESS_COOKIE`, `BACKOFFICE_REFRESH_COOKIE` | `alohomeBoAccessToken`, `alohomeBoRefreshToken` | Back-office session cookies. Local to this app.                                            |
| `COOKIE_SECURE`                                         | `true` in production                            | Set `false` only for plain-http staging.                                                   |
| `COOKIE_DOMAIN`                                         | unset                                           | Only when sharing a parent domain.                                                         |
| `ALLOWED_ORIGINS`                                       | unset                                           | Origins accepted for mutating BFF calls. When unset, `Origin` must match the request host. |
| `BACKEND_TIMEOUT_MS`                                    | `15000`                                         | Upstream timeout.                                                                          |
| `UPLOAD_TIMEOUT_MS`                                     | see `.env.example`                              | Upstream timeout for file imports.                                                         |
| `MAX_UPLOAD_BYTES`                                      | 20 MB                                           | Upload size cap enforced by the relay. Keep it equal to the API's limit.                   |

Configuration is validated at first use; a bad value fails with a readable message.

## Scripts

| Command                           | What it does                                                                                 |
| --------------------------------- | -------------------------------------------------------------------------------------------- |
| `npm run dev` / `build` / `start` | Standard Next.js.                                                                            |
| `npm run typecheck`               | `tsc --noEmit`.                                                                              |
| `npm run lint`                    | ESLint (Next core-web-vitals + TypeScript).                                                  |
| `npm test`                        | Vitest unit tests.                                                                           |
| `npm run test:e2e`                | Playwright against a built app and `mock-api/` (run `npx playwright install chromium` once). |
| `npm run format` / `format:check` | Prettier.                                                                                    |

## Architecture

```
Browser ──► Next.js (this app) ──► AloHome API
            ├─ proxy.ts              route gating per surface, CSP nonce, stale-cookie cleanup
            ├─ /api/auth/*           client login, register, OTP, logout
            ├─ /api/backend/*        allowlisted relay with the client token
            ├─ /api/bo/auth/*        back-office login (Admin only), logout
            └─ /api/bo/backend/*     allowlisted relay with the back-office token
```

- `src/app`: routes. `(auth)` client login and register, `(client)/schemes/[schemeId]/...` the client workspace, `backoffice/(public)` staff login and forbidden page, `backoffice/(console)` the staff console.
- `src/features/client`: health dashboard, reports, imports, expenses and flags, AI review, arrears, capital works, feedback.
- `src/features/backoffice`: overview and demo data, schemes (lots, members, residents), users, access log, pilot metrics.
- `src/components`: `ui` (buttons, fields, tables, dialogs, toasts), `layout` (client and back-office shells), `charts` (SVG with table fallback), `ai` (insight panel, confidence).
- `src/lib/api`: typed client and finance endpoints, response envelope helpers, error parsing, query keys.
- `src/lib/region`: Gregorian and Jalali calendars and region config.
- `src/lib/bff`: server-only helpers for the route handlers (surface, cookies, relay, path allowlist).
- `src/lib/telemetry`: strict event allowlist, no free text or amounts.
- `src/i18n`: typed dictionaries composed from `dictionaries/sections/*`, terminology resolver, formatters.

Decisions are recorded in [`docs/adr`](docs/adr):

1. [BFF with first-party session cookies](docs/adr/0001-bff-and-cookie-session.md)
2. [Cache Components stay off](docs/adr/0002-cache-components-disabled.md)
3. [Two surfaces: client and back office](docs/adr/0003-two-surfaces.md)
4. [Region is separate from language](docs/adr/0004-region-vs-locale.md)

### Iran and Australia

Region (`ir` or `au`) and language (`fa` or `en`) are independent. Region decides currency, calendar, time zone, phone and postal-code rules and the terminology (for example, "scheme" and "lot" in Australia). Language decides the text and direction. Inside a scheme the region comes from the scheme's jurisdiction code (`IR`, `AU-NSW`), so a manager of both sees each in its own market format.

|                     | Iran                          | Australia                   |
| ------------------- | ----------------------------- | --------------------------- |
| Currency            | IRR (Toman as a display unit) | AUD                         |
| Calendar, time zone | Jalali, Asia/Tehran           | Gregorian, Australia/Sydney |
| Phone, postal code  | +98, 10 digits                | +61, 4 digits               |

All money, dates and numbers go through `fmt` from `useI18n()`. Do not format them by hand.

### Behaviour worth knowing

- Tokens live in `HttpOnly` cookies and never reach client JavaScript. The JWT is decoded (not verified) only to decide what to render. The back office checks the `Admin` role on every console page.
- Forms hold raw strings and parse with zod on submit. Persian and Arabic-Indic digits are normalised. Server validation stays authoritative.
- Validation messages are translation keys resolved at render, so they follow the language switch.
- List and tab state lives in the URL, so pages can be linked and reloaded.
- AI-generated content is always labelled and visually distinct, with a confidence indicator, evidence and a feedback control. It is never the only source for a figure.
- A 401 from the API clears the session and sends the user to that surface's login with `?next=`.

## Security

- Strict CSP with a per-request nonce (no `unsafe-eval`), plus `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` and HSTS.
- CSRF: `SameSite=Lax` cookies and an `Origin` check on every mutating BFF request, on both surfaces.
- The relays forward only allowlisted path prefixes, with segment validation, body and query size limits, timeouts and no redirect following. The back-office relay is unreachable with a client token.
- CSV exports neutralise formula injection.
- `server-only` guards keep environment access and token handling out of client bundles.

## Docker

```bash
docker build -t alohome-front .
docker run -p 3000:3000 -e API_BASE_URL=https://api.example.com alohome-front
```

Multi-stage, standalone output, non-root user, health check on `/api/health`.

## Status and known gaps

Type check, lint, unit tests, a production build and the Playwright suite pass. The Playwright suite runs against `mock-api/`, not the real API, so it checks frontend behaviour and not API compatibility. A contract test against a running API is the next useful addition.

Not yet verified against the real API:

- Exact JSON shapes of some list endpoints (the client accepts a bare array or a paginated result) and of `POST backoffice/users`.
- Whether feedback on a risk signal accepts a lot id as `subjectId`.
- The AI confidence scale (0 to 1 assumed, 0 to 100 tolerated).

Known limitations:

- AI evidence is shown as record IDs only, because there is no by-id records filter.
- There is no residents list endpoint, so back-office resident management works by user ID.
- Client-side limits (20 MB upload, year ranges, ageing buckets, scenario horizon) are UX guards. The API remains authoritative.
