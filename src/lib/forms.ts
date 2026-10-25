import type { FieldErrors, FieldValues, Resolver } from "react-hook-form";
import type { ZodType } from "zod";
import type { MessageKey, Translator } from "@/i18n/translator";

/**
 * Minimal react-hook-form resolver for zod. The form holds raw string input; the zod schema is
 * only used to validate here, and callers run schema.parse(values) in onSubmit to obtain the typed
 * output (numbers, normalised digits).
 */
export function zodResolver<T extends FieldValues>(schema: ZodType): Resolver<T> {
  return async (values) => {
    const result = await schema.safeParseAsync(values);
    if (result.success) return { values, errors: {} };

    const errors: Record<string, { type: string; message: string }> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.join(".");
      if (path && !(path in errors)) errors[path] = { type: issue.code, message: issue.message };
    }
    return { values: {}, errors: errors as FieldErrors<T> };
  };
}

/** Resolves a validation message key stored on a field error into the user's language. */
export function fieldMessage(
  error: { message?: string } | undefined,
  t: Translator["t"],
): string | undefined {
  return error?.message ? t(error.message as MessageKey) : undefined;
}

/** First issue message of a safeParse failure as a translated string. */
export function firstIssueMessage(
  error: { issues: readonly { message: string }[] },
  t: Translator["t"],
): string {
  const message = error.issues[0]?.message;
  return message ? t(message as MessageKey) : t("validation.required");
}
