import type { Dictionary } from "./en";
import { coreFa } from "./sections/core.fa";
import { healthFa } from "./sections/health.fa";
import { importsFa } from "./sections/imports.fa";
import { expensesFa } from "./sections/expenses.fa";
import { aireviewFa } from "./sections/aireview.fa";
import { arrearsFa } from "./sections/arrears.fa";
import { capitalFa } from "./sections/capital.fa";
import { backofficeFa } from "./sections/backoffice.fa";
import { workspaceFa } from "./sections/workspace.fa";

export const fa: Dictionary = {
  ...coreFa,
  ...workspaceFa,
  ...backofficeFa,
  ...capitalFa,
  ...arrearsFa,
  ...aireviewFa,
  ...expensesFa,
  ...importsFa,
  ...healthFa,
};
