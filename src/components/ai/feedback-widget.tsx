"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { InlineAlert } from "@/components/ui/states";
import { useSchemeMutation } from "@/features/client/use-scheme-mutation";
import { useScheme } from "@/features/client/workspace/scheme-provider";
import { useI18n } from "@/i18n/provider";
import { describeError } from "@/lib/api/error";
import { feedbackApi, type FeedbackInput } from "@/lib/api/finance/endpoints";
import { normalizeNumeric } from "@/lib/format/amount";
import { track } from "@/lib/telemetry/client";
import { cn } from "@/lib/utils";

const RATINGS = [
  { value: "Useful", label: "feedback.useful" },
  { value: "NotUseful", label: "feedback.notUseful" },
  { value: "Incorrect", label: "feedback.incorrect" },
  { value: "NeedsReview", label: "feedback.needsReview" },
] as const;

/**
 * "Was this useful?" control attached to a dashboard, a flag, an AI insight or a report. It
 * records a rating plus optional context so the pilot can measure which insights earn their
 * place. Telemetry carries only the subject type and rating, never the note.
 */
export function FeedbackWidget({
  subjectType,
  subjectId,
  idPrefix,
}: {
  subjectType: FeedbackInput["subjectType"];
  subjectId: string;
  idPrefix: string;
}) {
  const { t } = useI18n();
  const { schemeId } = useScheme();
  const [rating, setRating] = useState<FeedbackInput["rating"] | null>(null);
  const [note, setNote] = useState("");
  const [action, setAction] = useState("");
  const [hours, setHours] = useState("");
  const [done, setDone] = useState(false);

  const mutation = useSchemeMutation({
    mutationFn: (input: FeedbackInput) => feedbackApi.submit(schemeId, input),
    invalidate: [["scheme", schemeId, "feedback"]],
    silentError: true,
    onSuccess: (_data, vars) => {
      track("feedback_submitted", { subject: vars.subjectType, rating: vars.rating });
      setDone(true);
    },
  });

  if (done) return <InlineAlert tone="ok">{t("feedback.thanks")}</InlineAlert>;

  const parsedHours = hours.trim() === "" ? null : Number(normalizeNumeric(hours));
  const hoursInvalid =
    parsedHours !== null &&
    (!Number.isFinite(parsedHours) || parsedHours < 0 || parsedHours > 1000);

  return (
    <section
      aria-labelledby={`${idPrefix}-title`}
      className="space-y-3 rounded-lg border border-line bg-surface-2/50 px-4 py-3"
    >
      <p id={`${idPrefix}-title`} className="text-sm font-medium">
        {t("feedback.title")}
      </p>
      <div role="radiogroup" aria-labelledby={`${idPrefix}-title`} className="flex flex-wrap gap-2">
        {RATINGS.map((r) => (
          <button
            key={r.value}
            type="button"
            role="radio"
            aria-checked={rating === r.value}
            onClick={() => setRating(r.value)}
            className={cn(
              "h-8 rounded-md border px-3 text-sm transition-colors",
              rating === r.value
                ? "border-brand bg-brand-soft text-brand"
                : "border-line bg-surface text-fg hover:bg-surface-2",
            )}
          >
            {t(r.label)}
          </button>
        ))}
      </div>

      {rating ? (
        <form
          className="space-y-3"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (hoursInvalid) return;
            mutation.mutate({
              subjectType,
              subjectId,
              rating,
              note: note.trim(),
              actionTaken: action.trim(),
              hoursSavedEstimate: parsedHours,
            });
          }}
        >
          <Field id={`${idPrefix}-note`} label={t("feedback.note")} hint={t("feedback.noteHint")}>
            <Input
              id={`${idPrefix}-note`}
              hasHint
              maxLength={1000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
          <Field id={`${idPrefix}-action`} label={t("feedback.action")}>
            <Input
              id={`${idPrefix}-action`}
              maxLength={500}
              value={action}
              onChange={(e) => setAction(e.target.value)}
            />
          </Field>
          <Field
            id={`${idPrefix}-hours`}
            label={t("feedback.hours")}
            error={hoursInvalid ? t("validation.positiveNumber") : undefined}
          >
            <Input
              id={`${idPrefix}-hours`}
              inputMode="decimal"
              dir="ltr"
              className="max-w-32 text-start"
              invalid={hoursInvalid}
              value={hours}
              onChange={(e) => setHours(e.target.value)}
            />
          </Field>
          {mutation.isError ? (
            <InlineAlert tone="danger">{describeError(mutation.error, t)}</InlineAlert>
          ) : null}
          <Button type="submit" size="sm" loading={mutation.isPending}>
            {mutation.isPending ? t("feedback.sending") : t("feedback.submit")}
          </Button>
        </form>
      ) : null}
    </section>
  );
}
