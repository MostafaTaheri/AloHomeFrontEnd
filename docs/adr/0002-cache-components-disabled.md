# ADR 0002: Cache Components and partial prefetching stay off

Status: accepted

## Context

Next.js 16 offers Cache Components and partial prefetching. Both work best for pages that mix a
cacheable shell with a small amount of dynamic data.

Every page in this application depends on the signed-in user (cookies are read in layouts and in
`requireSession`) and on a per-request CSP nonce set in `proxy.ts`. There is no meaningful static
or shared-cache content.

## Decision

Leave `cacheComponents` and `partialPrefetching` disabled. All routes render dynamically. Data
fetching happens in client components through React Query, with URL search params as the source of
truth for list state (page, filter, sort).

## Consequences

- No accidental caching of user-specific output.
- The CSP nonce works on every response.
- Revisit if public, cacheable pages are added (a marketing page, say). Those should be isolated
  in their own route group with caching enabled explicitly.
