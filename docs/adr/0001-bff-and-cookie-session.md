# ADR 0001: Backend-for-frontend with first-party session cookies

Status: accepted

## Context

The AloHome API signs users in with a phone number and a one-time code. On success it returns no
body; the access and refresh tokens arrive only as `Set-Cookie` headers (`alohomeAccessToken`,
`alohomeRefreshToken`) scoped to the API's own origin. The API has no CORS configuration, and the
frontend and API will normally live on different origins.

A browser SPA calling the API directly would therefore never see the session cookies, and could
not read the tokens either. Moving the tokens into JavaScript-readable storage would also expose
them to any XSS bug.

## Decision

The Next.js server acts as a thin backend-for-frontend:

- `/api/auth/*` route handlers call the API, read the token cookies from its response and re-issue
  them on the app origin as `HttpOnly`, `SameSite=Lax`, `Secure` (in production) cookies.
- `/api/backend/[...path]` relays resource calls and adds `Authorization: Bearer` plus a `Cookie`
  header, so either server-side auth style works. It only forwards an allowlist of path roots, so
  it cannot become an open proxy to the rest of the API.
- Mutating BFF requests must carry an `Origin` that matches the host (or `ALLOWED_ORIGINS`), on
  top of `SameSite=Lax`.
- `proxy.ts` gates `/dashboard` and `/admin` early, and server layouts re-check with
  `requireSession` and `requireAdmin`. A 401 from the API clears the cookies.
- The JWT payload is decoded without verifying the signature, and only to choose what to render.
  The API remains the only authority for access decisions.

## Consequences

- Tokens never reach client-side JavaScript.
- One extra network hop per API call. Acceptable here; the relay adds a timeout and body limits.
- There is no token refresh. The API exposes no refresh endpoint, so an expired access token ends
  the session and the user signs in again. If a refresh endpoint is added, it belongs in the BFF
  (`backendFetch` or the proxy), not in client code.
- The API currently registers no authentication or authorization middleware. Until it does, these
  checks protect the UI only. This must be fixed on the API side before production use.
