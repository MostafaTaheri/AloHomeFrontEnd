import { coreEn } from "./sections/core.en";
import { healthEn } from "./sections/health.en";
import { importsEn } from "./sections/imports.en";
import { expensesEn } from "./sections/expenses.en";
import { aireviewEn } from "./sections/aireview.en";
import { arrearsEn } from "./sections/arrears.en";
import { capitalEn } from "./sections/capital.en";
import { backofficeEn } from "./sections/backoffice.en";
import { workspaceEn } from "./sections/workspace.en";

/**
 * The English dictionary is the source of truth for message keys. Each feature keeps its own
 * section file (sections/<feature>.en.ts and .fa.ts) so strings stay next to the screens that use
 * them; this file only composes them. fa.ts must provide the same keys and placeholders.
 */
export const en = {
  ...coreEn,
  ...workspaceEn,
  ...backofficeEn,
  ...capitalEn,
  ...arrearsEn,
  ...aireviewEn,
  ...expensesEn,
  ...importsEn,
  ...healthEn,
} as const;

type Widen<T> = T extends string ? string : { readonly [K in keyof T]: Widen<T[K]> };
export type Dictionary = Widen<typeof en>;
