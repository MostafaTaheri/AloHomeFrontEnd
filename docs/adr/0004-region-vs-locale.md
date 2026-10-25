# ADR 0004: Region is separate from language

Status: accepted

## Context

The product serves Iran and Australia. Language and market do not map one to one: an Australian
manager may read Persian, and an Iranian manager may read English.

## Decision

Keep two independent settings.

- Locale (`fa` or `en`) decides text and direction.
- Region (`ir` or `au`) decides currency, calendar, time zone, phone and postal-code rules and the
  terminology (`{scheme}`, `{lot}`, `{arrears}` and so on).

Outside a scheme, region comes from the user's market setting. Inside a scheme, a nested
`I18nProvider` takes the region from the scheme's jurisdiction code (`IR`, `AU-NSW`). Toman is a
display unit over IRR, stored in a cookie. Dictionaries use placeholders for market terms and the
translator resolves them; a test requires identical placeholders in both languages.

All money, dates and numbers are formatted through `fmt` from `useI18n()`.

## Consequences

- A user with schemes in both markets sees each in its own format without switching settings.
- Adding a market means a region config entry and terminology entries, not new screens.
- Hand-formatting a number or date anywhere is a bug.
