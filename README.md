# AloHome Front

Web frontend for AloHome, a financial-health product for NSW strata schemes and Iranian residential buildings. It sits in front of the AloHome .NET API (`../AloHome`) and serves two separate surfaces:

- **Client** (`/login`, `/schemes`) is for strata and building managers, committee members, owners and residents. It covers financial health, imports, expenses and flags, arrears, capital works, AI review, reports and feedback.
- **Back office** (`/backoffice/login`, `/backoffice`) is for AloHome staff with the `Admin` role. It covers schemes, lots, residents, members, users, the access log, pilot metrics and demo data.

Each surface has its own login, session cookies, API relay and navigation. The app supports Persian (RTL) and English, and both markets: Iran (IRR or Toman, Jalali calendar) and Australia (AUD, Gregorian calendar).

**Stack:** Next.js 16 (App Router), React 19, TypeScript (strict), Tailwind CSS 4, TanStack Query, zod, Vitest and Playwright.

## Documentation

| Document                                   | For                                                                                                                                                                                                                                                               |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Architecture](docs/architecture.md)       | How the app is built and why: BFF, the two surfaces, request flow, i18n and regions, security, telemetry                                                                                                                                                          |
| [System overview](docs/system-overview.md) | Every screen, role, route, API call, shared component, event and setting                                                                                                                                                                                          |
| [Usage guide](docs/usage-guide.md)         | Step-by-step instructions for managers, members and staff, plus a local demo setup                                                                                                                                                                                |
| [ADRs](docs/adr)                           | Individual decisions: [BFF and cookie session](docs/adr/0001-bff-and-cookie-session.md), [Cache Components off](docs/adr/0002-cache-components-disabled.md), [two surfaces](docs/adr/0003-two-surfaces.md), [region vs locale](docs/adr/0004-region-vs-locale.md) |

## Running locally

### 1. Prerequisites

- Node.js 22 or later, and npm.
- One of the following:
  - **The bundled mock API**, for UI work and demos. Nothing else is needed.
  - **The real AloHome API** from `../AloHome`, for integration work. It has its own dependencies, including Keycloak from `../Deployments`. See `../AloHome/README.md`.

### 2. Install

```bash
cd AloHomeFront
npm install --include=dev
cp .env.example .env.local
```

If `NODE_ENV=production` is set in your shell, a plain `npm install` silently skips dev dependencies (TypeScript, ESLint, Vitest). Use `--include=dev` or unset it.

### 3a. Run against the mock API

One command starts the mock API and the app, already wired together:

```bash
npm run dev:mock               # app on http://localhost:3000, mock API on http://127.0.0.1:5099
```

It sets `API_BASE_URL` for the app itself, so whatever `.env.local` says is ignored for this run. Use `PORT=3100 MOCK_PORT=5199 npm run dev:mock` for other ports.

Stop any other `next dev` running in this folder first. Next.js allows only one dev server per project.

To run the two separately, start them in two terminals: `npm run mock`, then `API_BASE_URL=http://127.0.0.1:5099 npm run dev`. If `npm run dev` is started without `API_BASE_URL`, it uses `.env.local` and every call fails with "The service is temporarily unavailable".

| Sign in as                                 | Phone                                  | Code     | You get                                                        |
| ------------------------------------------ | -------------------------------------- | -------- | -------------------------------------------------------------- |
| Manager (client) at `/login`               | any valid number, e.g. `+989121111111` | `123456` | Two schemes: Harbour View (NSW, AUD) and Tower A (Iran, IRR)   |
| Admin (back office) at `/backoffice/login` | `+989120000000`                        | `123456` | The staff console                                              |
| Treasurer (client)                         | `+61400000002`                         | `123456` | Can change data and approve; drafted the seeded reminder batch |
| Committee member (client)                  | `+61400000004`                         | `123456` | Views data, approves budgets and reminders                     |
| Analyst (client)                           | `+61400000003`                         | `123456` | Views financials only; no audit log, no changes                |

The mock keeps its data in memory and resets when it restarts. It has 13 months of records per scheme, lots in arrears, expense flags, capital works, funding scenarios and a verified import. Uploads, reviews, reports, AI explanations and back-office changes all work against it. It is a test double that follows the API's wire format. It does not replace testing against the real API.

### 3b. Run against the real API

1. Start Keycloak (needed by the API):

   ```bash
   cd ../Deployments && cp .env.example .env && docker compose up -d
   ```

2. Start the API. With `dotnet run` it listens on `http://localhost:5248` (launch profile `http`):

   ```bash
   cd ../AloHome && dotnet run --project src/AloHome.Api --launch-profile http
   ```

3. In `AloHomeFront/.env.local`, set:

   ```dotenv
   API_BASE_URL=http://localhost:5248
   ```

   Use `http://localhost:5028` instead if the API runs from its Docker image.

4. Start the app:

   ```bash
   npm run dev                  # http://localhost:3000
   ```

5. Sign in with a phone number that exists in the API. Back-office access needs an account with the `Admin` role.

`COOKIE_SECURE` defaults to `false` outside production, so plain-HTTP localhost works without extra settings.

### 4. Check your changes

```bash
npm run typecheck && npm run lint && npm test
npx playwright install chromium   # once
npm run test:e2e                  # builds the app and runs it against the mock API
```

### 5. Run a production build locally (without Docker)

The app builds as a Next.js standalone server, the same server the Docker image runs:

```bash
npm run build
API_BASE_URL=http://localhost:5248 COOKIE_SECURE=false PORT=3000 npm run start:standalone
```

`start:standalone` copies the static assets and `public/` into `.next/standalone` before starting, because `next build` leaves them out. Without them the pages load with no CSS or JavaScript.

`NODE_ENV` is `production` here, so cookies are `Secure` by default. Keep `COOKIE_SECURE=false` only while you serve over plain HTTP.

## Configuration

| Variable                                                | Default                                         | Purpose                                                    |
| ------------------------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------- |
| `API_BASE_URL`                                          | required                                        | API origin, without `/api/v1`. Server-side only.           |
| `API_VERSION`                                           | `1`                                             | Path segment in `/api/v{version}/`                         |
| `AUTH_ACCESS_COOKIE`, `AUTH_REFRESH_COOKIE`             | `alohomeAccessToken`, `alohomeRefreshToken`     | Client session cookies. Must match the API.                |
| `BACKOFFICE_ACCESS_COOKIE`, `BACKOFFICE_REFRESH_COOKIE` | `alohomeBoAccessToken`, `alohomeBoRefreshToken` | Back-office session cookies                                |
| `COOKIE_SECURE`                                         | `true` in production                            | Set `false` only for plain-HTTP staging                    |
| `COOKIE_DOMAIN`                                         | unset                                           | Only when sharing a parent domain                          |
| `ALLOWED_ORIGINS`                                       | request host                                    | Extra origins accepted for mutating BFF calls              |
| `BACKEND_TIMEOUT_MS`                                    | `15000`                                         | Upstream timeout                                           |
| `UPLOAD_TIMEOUT_MS`                                     | `60000`                                         | Upstream timeout for imports and PDF downloads             |
| `MAX_UPLOAD_BYTES`                                      | `20971520`                                      | Import file cap (20 MB). Keep it equal to the API's limit. |

Configuration is validated at first use. A bad value fails with a readable message.

## Scripts

| Command                           | What it does                                                                                      |
| --------------------------------- | ------------------------------------------------------------------------------------------------- |
| `npm run dev` / `build`           | Standard Next.js                                                                                  |
| `npm run dev:mock`                | Mock API and dev server together                                                                  |
| `npm run mock`                    | Mock API only (port 5099)                                                                         |
| `npm run start:standalone`        | Run the production build locally, the way the Docker image does                                   |
| `npm run typecheck`               | `tsc --noEmit`                                                                                    |
| `npm run lint`                    | ESLint                                                                                            |
| `npm test`                        | Vitest unit tests                                                                                 |
| `npm run test:e2e`                | Playwright against a built app and `mock-api/`. Run `npx playwright install chromium` once first. |
| `npm run format` / `format:check` | Prettier                                                                                          |

CI (`.github/workflows/ci.yml`) runs the format check, typecheck, lint, unit tests, build, the e2e suite and a Docker build.

## Project layout

```
src/
  app/            routes: (auth), (client)/schemes, backoffice/(public|console), api/ (BFF)
  features/       client/<area> and backoffice/<area> screens and logic
  components/     ui, layout, finance, charts, forms, ai
  lib/            api (typed client), bff (server-only), auth, region, format, telemetry
  i18n/           dictionaries by section, translator, market terminology
  proxy.ts        route gating per surface, CSP nonce
mock-api/         Node mock of the API for e2e and demos
e2e/              Playwright suite
docs/             architecture, system overview, usage guide, ADRs
```

Conventions:

- Format money, dates and numbers through `fmt` from `useI18n()`, never by hand.
- Use terminology placeholders (`{scheme}`, `{lot}`, `{levy}`) in strings instead of hard-coded market words.
- Keep `app/` pages thin.
- Features don't import from each other.
- Mark anything that touches env variables or tokens with `server-only`.

## Deploying with Docker

The `Dockerfile` builds a multi-stage image:

- Node 22 Alpine with Next.js standalone output.
- Runs as a non-root `app` user on port `3000`.
- Health check on `/api/health`.

Configuration is read when the server starts, not at build time. One image therefore serves every environment, and only the environment variables differ.

### Build the image

```bash
docker build -t alohome-front:1.0.0 .
```

On an Apple Silicon Mac, build for the server's architecture when the server is x86-64:

```bash
docker buildx build --platform linux/amd64 -t registry.example.com/alohome-front:1.0.0 --push .
```

Tag images with a version or commit SHA, not only `latest`, so a rollback is a one-line change.

### Development and staging

This is for running the container on your machine or on a plain-HTTP staging host.

Against an API running on your host (`dotnet run`, port 5248):

```bash
docker run --rm -p 3000:3000 \
  -e API_BASE_URL=http://host.docker.internal:5248 \
  -e COOKIE_SECURE=false \
  alohome-front:1.0.0
```

Against the mock API, with no backend at all:

```yaml
# docker-compose.dev.yml (example)
services:
  mock-api:
    image: node:22-alpine
    command: ["node", "/mock/server.mjs"]
    environment:
      PORT: "5099"
      HOST: 0.0.0.0 # the mock binds to 127.0.0.1 unless told otherwise
    volumes:
      - ./mock-api:/mock:ro
  web:
    build: .
    ports:
      - "3000:3000"
    environment:
      API_BASE_URL: http://mock-api:5099
      COOKIE_SECURE: "false"
    depends_on:
      - mock-api
```

```bash
docker compose -f docker-compose.dev.yml up --build
```

`COOKIE_SECURE=false` is needed because the image runs with `NODE_ENV=production`, which makes cookies `Secure` by default. Browsers drop `Secure` cookies on plain HTTP, except on `localhost` in most browsers.

### Production

Run the container behind a TLS-terminating reverse proxy or load balancer (nginx, Traefik, an ingress controller, a cloud load balancer). The app itself serves plain HTTP on port 3000.

```bash
docker run -d --name alohome-front --restart unless-stopped \
  -p 127.0.0.1:3000:3000 \
  -e API_BASE_URL=https://api.alohome.example \
  -e ALLOWED_ORIGINS=https://app.alohome.example \
  registry.example.com/alohome-front:1.0.0
```

Or with Compose:

```yaml
# docker-compose.prod.yml (example)
services:
  web:
    image: registry.example.com/alohome-front:1.0.0
    restart: unless-stopped
    ports:
      - "127.0.0.1:3000:3000" # only the reverse proxy should reach it
    environment:
      API_BASE_URL: https://api.alohome.example
      ALLOWED_ORIGINS: https://app.alohome.example
      # BACKEND_TIMEOUT_MS: "15000"
      # UPLOAD_TIMEOUT_MS: "60000"
      # MAX_UPLOAD_BYTES: "20971520"
    security_opt:
      - no-new-privileges:true
```

Production checklist:

- **HTTPS only.** Leave `COOKIE_SECURE` unset (it defaults to `true`). The app sends HSTS, so serve the domain over HTTPS before the first request.
- **`ALLOWED_ORIGINS`.** Set it to the public origin(s), for example `https://app.alohome.example`. Without it, the CSRF check compares `Origin` with `X-Forwarded-Host` or `Host`, so the proxy must pass the original host through. Setting it explicitly is safer.
- **Proxy headers.** Forward `Host` or `X-Forwarded-Host`, and `X-Forwarded-Proto`. Allow request bodies of at least `MAX_UPLOAD_BYTES` (20 MB by default) on the import routes. For nginx, that is `client_max_body_size 25m;`.
- **API reachability.** `API_BASE_URL` is used only by the server, never by the browser. Point it at an internal address if the API is not public.
- **Cookie names.** The client cookie names must match the API's `Authentication:Cookie` settings. Change them only if the API uses different names.
- **Health checks.** Use `GET /api/health` for liveness and readiness (Kubernetes probes, load balancer target checks). It does not call the API.
- **Logs.** The app logs to stdout and stderr. Telemetry events are single-line JSON with `"type":"telemetry"`, ready for a log pipeline to route to analytics.
- **Scaling.** The app is stateless, because sessions live in cookies, so replicas can be added freely. The telemetry rate limit is kept in memory per replica.
- **Updates.** Pull the new tag and recreate the container. Health checks keep traffic off a container that is not ready.

## Status

Type check, lint, 167 unit tests, the production build and 20 Playwright tests pass. The Playwright suite runs against the mock API, so it checks frontend behaviour, not compatibility with the real API.

Open items:

- Some response shapes are not yet verified against the real API: certain list endpoints, `POST backoffice/users`, the feedback `subjectId` for risk signals, and the AI confidence scale.
- AI evidence is shown as record IDs, because there is no endpoint to fetch records by ID.
- There is no residents list endpoint, so the back office manages residents by user ID.

[Architecture §13](docs/architecture.md#13-known-limits-and-open-questions) has the full list.
