"use client";

import { useState } from "react";
import { confidencePercent } from "@/components/ai/confidence";
import { FeedbackWidget } from "@/components/ai/feedback-widget";
import { FreshnessBanner } from "@/components/finance/freshness";
import { EnumBadge } from "@/components/finance/enum-badge";
import { Money } from "@/components/finance/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { InlineAlert } from "@/components/ui/states";
import { useI18n } from "@/i18n/provider";
import { describeError } from "@/lib/api/error";
import {
  aiQuestionsApi,
  MAX_QUESTION_LENGTH,
  type QuestionAnswer,
} from "@/lib/api/finance/ai-documents";
import { track } from "@/lib/telemetry/client";
import { SourceRecordsButton } from "../records/records-dialog";
import { useSchemeMutation } from "../use-scheme-mutation";
import { useScheme } from "../workspace/scheme-provider";

/**
 * Contextual questions (AI-07). The model only picks which of a fixed set of calculations to
 * run; every figure in the answer is computed from verified records. The question text never
 * leaves this screen in telemetry.
 */
export function AskTab() {
  const { t } = useI18n();
  const { schemeId } = useScheme();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<QuestionAnswer | null>(null);
  const trimmed = question.trim();
  const tooLong = trimmed.length > MAX_QUESTION_LENGTH;

  const ask = useSchemeMutation({
    mutationFn: (text: string) => aiQuestionsApi.ask(schemeId, text),
    silentError: true,
    onSuccess: (result) => {
      track("ai_question_asked", { status: String(result.status), kind: result.intent ?? "none" });
      setAnswer(result);
    },
  });

  const submit = (text: string) => {
    const value = text.trim();
    if (!value || value.length > MAX_QUESTION_LENGTH || ask.isPending) return;
    setQuestion(value);
    ask.mutate(value);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title={t("ask.title")} description={t("ask.subtitle")} />
        <CardBody>
          <form
            noValidate
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              submit(question);
            }}
          >
            <Field
              id="ask-question"
              label={t("ask.question")}
              hint={t("ask.counter", { used: trimmed.length, max: MAX_QUESTION_LENGTH })}
              error={tooLong ? t("ask.tooLong", { max: MAX_QUESTION_LENGTH }) : undefined}
            >
              <textarea
                id="ask-question"
                rows={2}
                value={question}
                aria-invalid={tooLong || undefined}
                onChange={(e) => setQuestion(e.target.value)}
                className="block w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-fg"
                dir="auto"
              />
            </Field>
            <div className="flex justify-end">
              <Button type="submit" loading={ask.isPending} disabled={!trimmed || tooLong}>
                {t("ask.submit")}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      {ask.isError ? <InlineAlert tone="danger">{describeError(ask.error, t)}</InlineAlert> : null}
      <div aria-live="polite">{answer ? <AnswerCard answer={answer} onAsk={submit} /> : null}</div>
    </div>
  );
}

function AnswerCard({ answer, onAsk }: { answer: QuestionAnswer; onAsk: (q: string) => void }) {
  const { t, fmt } = useI18n();
  const answered = answer.status === "Answered";

  return (
    <section
      aria-label={t("ask.answer")}
      className="space-y-3 rounded-lg border border-ai/40 bg-ai-soft p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="ai">{t("ask.origin")}</Badge>
        <EnumBadge group="answerStatus" value={answer.status} />
        {answered ? (
          <span className="text-xs text-muted">
            {t("ai.confidenceValue", { value: fmt.percent(confidencePercent(answer.confidence)) })}
          </span>
        ) : null}
      </div>
      <p className="text-sm font-medium" dir="auto">
        {answer.question}
      </p>
      <p className="text-sm leading-6" dir="auto">
        {answer.answer}
      </p>
      {answered && answer.figures.length > 0 ? (
        <dl className="grid gap-2 sm:grid-cols-2">
          {answer.figures.map((f) => (
            <div
              key={f.label}
              className="flex justify-between gap-3 rounded-md bg-surface px-3 py-2 text-sm"
            >
              <dt dir="auto">{f.label}</dt>
              <dd className="font-semibold">
                <Money amount={f.amount} currency={answer.currency} whole />
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      {answered && (answer.from || answer.to) ? (
        <p className="text-xs text-muted">
          {t("ask.range", {
            from: answer.from ? fmt.date(answer.from) : t("common.none"),
            to: answer.to ? fmt.date(answer.to) : t("common.none"),
          })}
        </p>
      ) : null}
      {answered ? <FreshnessBanner freshness={answer.freshness} /> : null}
      {answered ? (
        <div className="flex flex-wrap items-center gap-2">
          <SourceRecordsButton
            recordIds={answer.evidenceRecordIds}
            title={t("ask.evidenceTitle")}
            label={t("ask.evidence", { count: answer.evidenceRecordIds.length })}
          />
          <span className="text-xs text-muted" dir="ltr">
            {answer.intent} · {answer.modelName} {answer.modelVersion}
          </span>
        </div>
      ) : null}
      {!answered && answer.supportedQuestions.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm">{t("ask.tryThese")}</p>
          <ul className="flex flex-wrap gap-2">
            {answer.supportedQuestions.map((q) => (
              <li key={q}>
                <Button size="sm" variant="secondary" onClick={() => onAsk(q)}>
                  <span dir="auto">{q}</span>
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {answer.disclaimer ? <p className="text-xs text-muted">{answer.disclaimer}</p> : null}
      {answered && answer.insightId ? (
        <FeedbackWidget
          subjectType="AiInsight"
          subjectId={answer.insightId}
          idPrefix={`ask-${answer.insightId}`}
        />
      ) : null}
    </section>
  );
}
