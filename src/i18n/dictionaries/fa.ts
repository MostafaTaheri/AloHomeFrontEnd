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
import { governanceFa } from "./sections/governance.fa";
import { propertyFa } from "./sections/property.fa";
import { organisationsFa } from "./sections/organisations.fa";
import { readinessFa } from "./sections/readiness.fa";
import { recordsFa } from "./sections/records.fa";
import { budgetsFa } from "./sections/budgets.fa";
import { planningFa } from "./sections/planning.fa";
import { aidocsFa } from "./sections/aidocs.fa";

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
  ...governanceFa,
  ...propertyFa,
  ...organisationsFa,
  ...readinessFa,
  ...recordsFa,
  ...budgetsFa,
  ...planningFa,
  ...aidocsFa,
};
