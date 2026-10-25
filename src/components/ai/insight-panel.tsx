"use client";

import { useState } from "react";
import { EnumBadge } from "@/components/finance/enum-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { InlineAlert } from "@/components/ui/states";
import { confidencePercent } from "./confidence";
import { useSchemeMutation } from "@/features/client/use-scheme-mutation";
import { useScheme } from "@/features/client/workspace/scheme-provider";
import { useI18n } from "@/i18n/provider";
import { aiApi } from "@/lib/api/finance/endpoints";
import type { AiInsight } from "@/lib/api/finance/types";
import { qk } from "@/lib/api/keys";
import { track } from "@/lib/telemetry/client";

type Decision = "Useful" | "Incorrect" | "NeedsReview";

/**
 * An AI-written explanation. It is deliberately styled apart from rule-based figures (AI tone,
 * badge, notice), shows how sure the model was and which records it relied on, and has to be
 * reviewed by a person. When the service is unavailable or the output failed the guardrails the
 * panel says so and nothing else on the screen changes.
 */
export function InsightPanel({ insight }: { insight: AiInsight }) {
  const { t, fmt } = useI18n();
  const { schemeId, canWrite } = useScheme();
  const [note, setNote] = useState("");
  const [noting, setNoting] = useState<Decision | null>(null);

  const review = useSchemeMutation({
    mutationFn: (vars: { status: Decision; note: string }) =>
      aiApi.reviewInsight(schemeId, insight.id, vars.status, vars.note),
    invalidate: [qk.ai(schemeId)],
    success: "ai.reviewSaved",
    onSuccess: (_, vars) => {
      track("ai_suggestion_reviewed", { area: "ai", rating: vars.status, subject: "AiInsight" });
      setNoting(null);
      setNote("");
    },
  });

  const status = String(insight.status);
  const generated = status === "Generated" && Boolean(insight.content);
  const reviewed =
    String(insight.reviewStatus) !== "Unreviewed" && String(insight.reviewStatus) !== "1";

  return (
    <section
      aria-label={t("ai.badge")}
      className="space-y-3 rounded-lg border border-ai/40 bg-ai-soft p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="ai">{t("ai.badge")}</Badge>
        {generated ? (
          <span className="text-xs text-muted">
            {t("ai.confidenceValue", { value: fmt.percent(confidencePercent(insight.confidence)) })}
          </span>
        ) : null}
        <EnumBadge group="aiReview" value={insight.reviewStatus} />
      </div>

      {generated ? (
        <>
          <p className="whitespace-pre-wrap text-sm leading-6" dir="auto">
            {insight.content}
          </p>
          <p className="text-xs text-muted">{t("ai.notice")}</p>
          {!reviewed ? <p className="text-xs font-medium">{t("ai.reviewRequired")}</p> : null}
        </>
      ) : status === "Rejected" ? (
        <InlineAlert tone="warn">{t("aiReview.panelRejected")}</InlineAlert>
      ) : status === "InsufficientEvidence" ? (
        <InlineAlert tone="warn">{t("aiReview.panelInsufficient")}</InlineAlert>
      ) : (
        <InlineAlert tone="warn">
          <strong className="block">{t("ai.unavailableTitle")}</strong>
          {t("ai.unavailable")}
        </InlineAlert>
      )}

      {generated ? (
        <details className="text-xs text-muted">
          <summary className="cursor-pointer select-none hover:underline">
            {t("ai.evidence")}:{" "}
            {t("ai.evidenceCount", { count: fmt.integer(insight.evidenceRecordIds.length) })}
          </summary>
          <div className="mt-2 space-y-1">
            {insight.evidenceRecordIds.length === 0 ? (
              <p>{t("ai.noEvidence")}</p>
            ) : (
              <>
                <p>{t("aiReview.evidenceIds")}</p>
                <ul className="space-y-0.5 font-mono" dir="ltr">
                  {insight.evidenceRecordIds.map((id) => (
                    <li key={id}>{id}</li>
                  ))}
                </ul>
              </>
            )}
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
              <dt>{t("ai.model")}</dt>
              <dd dir="ltr">
                {insight.modelName ?? t("common.none")} {insight.modelVersion ?? ""}
              </dd>
              <dt>{t("ai.template")}</dt>
              <dd dir="ltr">
                {insight.promptTemplateId ?? t("common.none")} {insight.promptTemplateVersion ?? ""}
              </dd>
            </dl>
            <p>{t("ai.generatedAt", { when: fmt.dateTime(insight.generatedAtUtc) })}</p>
          </div>
        </details>
      ) : null}

      {reviewed && insight.reviewedBy ? (
        <p className="text-xs text-muted">
          {t("ai.reviewedAs", {
            status: t(`enums.aiReview.${insight.reviewStatus}` as never),
            user: insight.reviewedBy,
            when: insight.reviewedAtUtc ? fmt.dateTime(insight.reviewedAtUtc) : t("common.none"),
          })}
          {insight.reviewNote ? ` — ${insight.reviewNote}` : ""}
        </p>
      ) : null}

      {generated && canWrite ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["Useful", "ai.markUseful"],
                ["Incorrect", "ai.markIncorrect"],
                ["NeedsReview", "ai.markNeedsReview"],
              ] as const
            ).map(([value, label]) => (
              <Button
                key={value}
                size="sm"
                variant="secondary"
                aria-pressed={noting === value}
                disabled={review.isPending}
                onClick={() => setNoting(noting === value ? null : value)}
              >
                {t(label)}
              </Button>
            ))}
          </div>
          {noting ? (
            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!review.isPending) review.mutate({ status: noting, note: note.trim() });
              }}
            >
              <Field id={`ai-note-${insight.id}`} label={t("ai.reviewNote")}>
                <textarea
                  id={`ai-note-${insight.id}`}
                  rows={2}
                  maxLength={1000}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="block w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-fg"
                />
              </Field>
              <Button type="submit" size="sm" loading={review.isPending}>
                {t("common.save")}
              </Button>
            </form>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
