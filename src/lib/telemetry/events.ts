import { z } from "zod";

/**
 * Product telemetry contract. Events carry only enumerated names and short identifier-like
 * values (an area, a step, a status). Free text, amounts, names, phone numbers, file names and
 * scheme titles are rejected by construction, so a call site cannot leak them by accident.
 * Scheme ids are numeric and stay out of the payload; the server joins them to the session.
 */
export const TELEMETRY_EVENTS = [
  "page_view",
  "auth_signed_in",
  "scheme_switched",
  "import_started",
  "import_mapped",
  "import_previewed",
  "import_committed",
  "import_failed",
  "import_retried",
  "wizard_abandoned",
  "flag_reviewed",
  "ai_explanation_requested",
  "ai_explanation_shown",
  "ai_suggestion_reviewed",
  "report_generated",
  "report_exported",
  "feedback_submitted",
  "filter_changed",
  "error_shown",
] as const;

export type TelemetryEvent = (typeof TELEMETRY_EVENTS)[number];

const SAFE_VALUE = /^[A-Za-z0-9_.:-]{1,40}$/;
const safeString = z.string().regex(SAFE_VALUE);

/** Only these property names are accepted. */
export const telemetryPropsSchema = z
  .object({
    area: safeString.optional(),
    page: safeString.optional(),
    step: safeString.optional(),
    kind: safeString.optional(),
    status: safeString.optional(),
    rating: safeString.optional(),
    subject: safeString.optional(),
    code: safeString.optional(),
    surface: safeString.optional(),
    count: z.number().int().min(0).max(1_000_000).optional(),
    durationMs: z.number().int().min(0).max(86_400_000).optional(),
  })
  .strict();

export type TelemetryProps = z.infer<typeof telemetryPropsSchema>;

export const telemetryBodySchema = z.object({
  event: z.enum(TELEMETRY_EVENTS),
  props: telemetryPropsSchema.default({}),
});

export type TelemetryBody = z.infer<typeof telemetryBodySchema>;
