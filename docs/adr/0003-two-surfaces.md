# ADR 0003: Two surfaces, client and back office

Status: accepted

## Context

Managers, committee members and residents use the product to understand a scheme's finances.
AloHome staff use a separate console to create schemes, lots and users and to watch the pilot.
The two groups have different risk profiles. A staff action can touch every scheme.

## Decision

Serve both from one deployment as separate surfaces:

- Client: `/login`, `/schemes/...`, BFF at `/api/auth/*` and `/api/backend/*`.
- Back office: `/backoffice/login`, `/backoffice/...`, BFF at `/api/bo/auth/*` and `/api/bo/backend/*`.

Each surface has its own login page, cookie pair, relay allowlist, shell and navigation.
`proxy.ts` gates routes by surface. The back-office login accepts only accounts with the `Admin`
role; others are sent to `/backoffice/forbidden`. Old `/admin` and `/dashboard` URLs redirect.

## Consequences

- A client token never reaches back-office endpoints, and a staff sign-in does not create a client
  session. An operator can hold both in one browser.
- Two sets of cookie names and relay allowlists to keep in step. `src/lib/bff/surface.ts` is the
  single place that maps a surface to paths and cookies.
- The role check in the UI shapes what is shown. The API remains the authority.
- A separate deployment per surface stays possible later because nothing is shared except
  components and the API layer.
