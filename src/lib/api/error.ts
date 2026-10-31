import type { Translator } from "@/i18n/translator";

export class ApiError extends Error {
  constructor(
    /** HTTP status, or 0 when the server could not be reached at all. */
    readonly status: number,
    readonly code: string | null,
    message: string,
    /** Messages from the API, already localised via Accept-Language. */
    readonly details: string[] = [],
    readonly correlationId: string | null = null,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface ErrorEnvelope {
  error?: { code?: unknown; message?: unknown; details?: unknown } | null;
}

const CORRELATION_LINE = /correlationId/i;
const CORRELATION_ID = /\[([^\]]+)\]\s*$/;

/** Turns an API error body (GeneralResponseDto) into an ApiError. Tolerates any other shape. */
export function parseErrorBody(
  status: number,
  body: unknown,
  headerCorrelationId?: string | null,
): ApiError {
  const envelope = (body && typeof body === "object" ? body : {}) as ErrorEnvelope;
  const error = envelope.error ?? undefined;
  const code = typeof error?.code === "string" && error.code ? error.code : null;
  const message = typeof error?.message === "string" ? error.message : `HTTP ${status}`;
  const rawDetails = Array.isArray(error?.details) ? error.details : [];

  let correlationId = headerCorrelationId ?? null;
  const details: string[] = [];
  for (const entry of rawDetails) {
    if (typeof entry !== "string" || entry.trim() === "") continue;
    if (CORRELATION_LINE.test(entry)) {
      correlationId ??= CORRELATION_ID.exec(entry)?.[1] ?? null;
      continue;
    }
    // "Code: X, Message: Y" lines are developer-facing duplicates of the first message.
    if (/^Code:\s/.test(entry)) continue;
    details.push(entry);
  }
  return new ApiError(status, code, message, details, correlationId);
}

/** A message that is safe to show to the user for any thrown value. */
export function describeError(error: unknown, t: Translator["t"]): string {
  if (!(error instanceof ApiError)) return t("errors.generic");
  switch (true) {
    case error.status === 0:
      return t("errors.network");
    case error.status === 401:
      return t("errors.unauthorized");
    case error.status === 403:
      return t("errors.forbidden");
    case error.status === 409:
      return error.details[0] ?? t("errors.conflict");
    case error.status === 413:
      return t("errors.payloadTooLarge");
    case error.status === 415:
      return t("errors.unsupportedMedia");
    case error.status === 429:
      return t("errors.tooManyRequests");
    case error.status === 502 || error.status === 503 || error.status === 504:
      return t("errors.unavailable");
    case error.status >= 500:
      return t("errors.server");
    default:
      // 4xx: the API's own message is specific ("code already used", "user is locked", ...).
      return (
        error.details[0] ??
        (error.status === 404
          ? t("errors.notFound")
          : error.status === 400 || error.status === 422
            ? t("errors.validation")
            : t("errors.generic"))
      );
  }
}

export function isRetryable(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  return error.status === 0 || error.status >= 500;
}

/**
 * Whether an API error carries a numeric business code, e.g. 430010 for "no approved budget".
 * The API sends it as "App_AloHome_430010" or as the bare number, so match the suffix.
 */
export function hasErrorCode(error: unknown, code: number): boolean {
  if (!(error instanceof ApiError) || !error.code) return false;
  return new RegExp(`(^|_)${code}$`).test(error.code);
}
