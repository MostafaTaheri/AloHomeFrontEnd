import type { PilotAgreement, PilotTransitionName } from "@/lib/api/readiness";

export type TransitionProblem =
  "notAllowed" | "dateRequired" | "endBeforeStart" | "convertBeforeStart" | "reasonRequired";

/** Which transitions the API allows from a status. */
export function allowedTransitions(status: string): PilotTransitionName[] {
  if (status === "Prospect") return ["Start", "Lose"];
  if (status === "Active") return ["Convert", "Lose"];
  return [];
}

/**
 * The API's transition rules, checked before sending: a start needs a planned end on or after
 * it, a conversion can't predate the start, and losing a pilot needs a reason.
 */
export function checkTransition(
  agreement: Pick<PilotAgreement, "status" | "startDate">,
  input: {
    transition: PilotTransitionName;
    date: string;
    plannedEndDate?: string;
    reason?: string;
  },
): TransitionProblem | null {
  if (!allowedTransitions(String(agreement.status)).includes(input.transition)) return "notAllowed";
  if (!input.date) return "dateRequired";
  if (input.transition === "Start" && (!input.plannedEndDate || input.plannedEndDate < input.date))
    return "endBeforeStart";
  if (input.transition === "Convert" && agreement.startDate && input.date < agreement.startDate)
    return "convertBeforeStart";
  if (input.transition === "Lose" && !input.reason?.trim()) return "reasonRequired";
  return null;
}
