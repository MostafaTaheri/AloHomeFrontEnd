"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { InsightPanel } from "@/components/ai/insight-panel";
import { FeedbackWidget } from "@/components/ai/feedback-widget";
import { EnumBadge } from "@/components/finance/enum-badge";
import { Money } from "@/components/finance/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Select } from "@/components/ui/field";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState, ErrorState, InlineAlert, ListSkeleton } from "@/components/ui/states";
import { useI18n } from "@/i18n/provider";
import { describeError } from "@/lib/api/error";
import { aiApi, expensesApi } from "@/lib/api/finance/endpoints";
import type { ExpenseFlag } from "@/lib/api/finance/types";
import { qk } from "@/lib/api/keys";
import { track } from "@/lib/telemetry/client";
import { useSchemeMutation } from "../use-scheme-mutation";
import { useScheme } from "../workspace/scheme-provider";

type FlagStatus = "Open" | "Confirmed" | "Dismissed" | "Investigating";
type FlagType = "Duplicate" | "UnusualSpend";

const DECISIONS: {
  value: FlagStatus;
  label:
    | "expenses.markConfirmed"
    | "expenses.markDismissed"
    | "expenses.markInvestigating"
    | "expenses.markOpen";
}[] = [
  { value: "Confirmed", label: "expenses.markConfirmed" },
  { value: "Dismissed", label: "expenses.markDismissed" },
  { value: "Investigating", label: "expenses.markInvestigating" },
  { value: "Open", label: "expenses.markOpen" },
];

export function FlagsTab() {
  const { t } = useI18n();
  const { schemeId, canWrite } = useScheme();
  const [page, setPage] = useState(1);
  const [type, setType] = useState<FlagType | "">("");
  const [status, setStatus] = useState<FlagStatus | "">("Open");
  const [reviewing, setReviewing] = useState<ExpenseFlag | null>(null);

  const params = { type: type || undefined, status: status || undefined, page, pageSize: 10 };
  const query = useQuery({
    queryKey: qk.flags(schemeId, params),
    queryFn: ({ signal }) => expensesApi.flags(schemeId, params, { signal }),
    placeholderData: (previous) => previous,
  });

  const detect = useSchemeMutation({
    mutationFn: () => expensesApi.detect(schemeId),
    invalidate: [qk.expenses(schemeId), ["scheme", schemeId, "health"]],
    success: "expenses.detected",
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">{t("expenses.flagsSubtitle")}</p>
      {!canWrite ? <InlineAlert tone="warn">{t("expenses.readOnlyFlags")}</InlineAlert> : null}

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-48">
          <Field id="flag-type" label={t("expenses.filterType")}>
            <Select
              id="flag-type"
              value={type}
              onChange={(e) => {
                setType(e.target.value as FlagType | "");
                setPage(1);
              }}
            >
              <option value="">{t("common.all")}</option>
              <option value="Duplicate">{t("enums.flagType.Duplicate")}</option>
              <option value="UnusualSpend">{t("enums.flagType.UnusualSpend")}</option>
            </Select>
          </Field>
        </div>
        <div className="w-48">
          <Field id="flag-status" label={t("expenses.filterStatus")}>
            <Select
              id="flag-status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as FlagStatus | "");
                setPage(1);
              }}
            >
              <option value="">{t("common.all")}</option>
              {(["Open", "Investigating", "Confirmed", "Dismissed"] as const).map((s) => (
                <option key={s} value={s}>
                  {t(`enums.flagStatus.${s}`)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {canWrite ? (
          <Button
            variant="secondary"
            onClick={() => detect.mutate(undefined)}
            loading={detect.isPending}
          >
            {detect.isPending ? t("expenses.detecting") : t("expenses.detect")}
          </Button>
        ) : null}
      </div>

      {query.isPending ? <ListSkeleton rows={4} /> : null}
      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : null}
      {query.data && query.data.items.length === 0 ? (
        <EmptyState title={t("expenses.flagsEmptyTitle")} body={t("expenses.flagsEmptyBody")} />
      ) : null}
      {query.data && query.data.items.length > 0 ? (
        <>
          <ul className="space-y-3">
            {query.data.items.map((flag) => (
              <li key={flag.id}>
                <FlagCard flag={flag} canWrite={canWrite} onReview={() => setReviewing(flag)} />
              </li>
            ))}
          </ul>
          <Card>
            <Pagination
              page={query.data.page}
              totalPages={query.data.totalPages}
              totalCount={query.data.totalCount}
              onPageChange={setPage}
              disabled={query.isFetching}
            />
          </Card>
        </>
      ) : null}

      <ReviewDialog flag={reviewing} onClose={() => setReviewing(null)} />
    </div>
  );
}

function FlagCard({
  flag,
  canWrite,
  onReview,
}: {
  flag: ExpenseFlag;
  canWrite: boolean;
  onReview: () => void;
}) {
  const { t, fmt } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <CardBody className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <EnumBadge group="flagType" value={flag.type} />
              <EnumBadge group="flagStatus" value={flag.status} />
              {flag.origin === "AI" ? (
                <Badge tone="ai">{t("ai.badge")}</Badge>
              ) : (
                <Badge>{t("ai.deterministicBadge")}</Badge>
              )}
            </div>
            <h3 className="font-medium" dir="auto">
              {flag.category ?? flag.supplier ?? t("common.none")}
              {flag.category && flag.supplier ? ` · ${flag.supplier}` : ""}
            </h3>
            {flag.periodLabel ? (
              <p className="text-xs text-muted">{fmt.periodLabel(flag.periodLabel)}</p>
            ) : null}
          </div>
          <div className="text-end">
            <p className="text-xs text-muted">{t("expenses.flagObserved")}</p>
            <p className="text-lg font-semibold">
              <Money amount={flag.observedAmount} currency={flag.currency} whole />
            </p>
            {flag.baselineAmount !== null ? (
              <p className="text-xs text-muted">
                {t("expenses.flagBaseline")}:{" "}
                <Money amount={flag.baselineAmount} currency={flag.currency} whole />
              </p>
            ) : null}
          </div>
        </div>

        <p className="text-sm">
          {t("expenses.flagImpact")}:{" "}
          <Money amount={flag.estimatedAnnualisedImpact} currency={flag.currency} whole />
        </p>
        {flag.reviewedBy ? (
          <p className="text-xs text-muted">
            {t("expenses.flagReviewed", {
              user: flag.reviewedBy,
              when: flag.reviewedAtUtc ? fmt.dateTime(flag.reviewedAtUtc) : t("common.none"),
            })}
            {flag.reviewNote ? ` — ${flag.reviewNote}` : ""}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {canWrite ? (
            <Button size="sm" onClick={onReview}>
              {t("expenses.review")}
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="secondary"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? t("expenses.flagHide") : t("expenses.flagDetails")}
          </Button>
        </div>

        {open ? <FlagDetails flag={flag} canWrite={canWrite} /> : null}
      </CardBody>
    </Card>
  );
}

function FlagDetails({ flag, canWrite }: { flag: ExpenseFlag; canWrite: boolean }) {
  const { t, fmt } = useI18n();
  const { schemeId } = useScheme();

  const insights = useQuery({
    queryKey: qk.insights(schemeId, { subjectId: flag.id }),
    queryFn: ({ signal }) => aiApi.insights(schemeId, { subjectId: flag.id }, { signal }),
  });
  const latest = [...(insights.data ?? [])].sort((a, b) =>
    b.generatedAtUtc.localeCompare(a.generatedAtUtc),
  )[0];

  const explain = useSchemeMutation({
    mutationFn: (regenerate: boolean) => aiApi.explainFlag(schemeId, flag.id, regenerate),
    invalidate: [qk.ai(schemeId)],
    silentError: true,
    onSuccess: (insight) => {
      track("ai_explanation_requested", { area: "ai", subject: "ExpenseFlag" });
      if (String(insight.status) === "Generated")
        track("ai_explanation_shown", { area: "ai", subject: "ExpenseFlag" });
    },
  });

  return (
    <div className="space-y-4 border-t border-line pt-3">
      <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        {flag.thresholdPercent !== null ? (
          <>
            <dt className="text-muted">
              {t("expenses.flagThreshold", { percent: fmt.percent(flag.thresholdPercent) })}
            </dt>
            <dd />
          </>
        ) : null}
        <dt className="text-muted">
          {t("expenses.flagRecords", { count: fmt.integer(flag.recordIds.length) })}
        </dt>
        <dd dir="ltr" className="text-xs text-muted">
          {t("expenses.flagRule", { version: flag.ruleVersion })}
        </dd>
      </dl>

      {insights.isPending ? <ListSkeleton rows={2} /> : null}
      {insights.isError ? <InlineAlert tone="warn">{t("data.sectionFailed")}</InlineAlert> : null}
      {latest ? <InsightPanel insight={latest} /> : null}
      {explain.isError ? (
        <InlineAlert tone="warn">
          {t("ai.failed", { reason: describeError(explain.error, t) })}
        </InlineAlert>
      ) : null}
      {canWrite ? (
        <Button
          size="sm"
          variant="secondary"
          loading={explain.isPending}
          onClick={() => explain.mutate(Boolean(latest))}
        >
          {explain.isPending ? t("ai.generating") : latest ? t("ai.regenerate") : t("ai.generate")}
        </Button>
      ) : null}

      <FeedbackWidget subjectType="ExpenseFlag" subjectId={flag.id} idPrefix={`flag-${flag.id}`} />
    </div>
  );
}

function ReviewDialog({ flag, onClose }: { flag: ExpenseFlag | null; onClose: () => void }) {
  const { t } = useI18n();
  const { schemeId } = useScheme();
  const [decision, setDecision] = useState<FlagStatus>("Confirmed");
  const [note, setNote] = useState("");

  const save = useSchemeMutation({
    mutationFn: (vars: { id: string; status: FlagStatus; note: string }) =>
      expensesApi.review(schemeId, vars.id, vars.status, vars.note),
    invalidate: [qk.expenses(schemeId), ["scheme", schemeId, "health"]],
    success: "expenses.reviewSaved",
    silentError: true,
    onSuccess: (_, vars) => {
      track("flag_reviewed", { area: "expenses", status: vars.status });
      setNote("");
      onClose();
    },
  });

  return (
    <Dialog
      open={flag !== null}
      onClose={save.isPending ? () => undefined : onClose}
      title={t("expenses.reviewTitle")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
            {t("common.cancel")}
          </Button>
          <Button
            loading={save.isPending}
            onClick={() => {
              if (flag && !save.isPending)
                save.mutate({ id: flag.id, status: decision, note: note.trim() });
            }}
          >
            {t("expenses.reviewSave")}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{t("expenses.reviewDecision")}</legend>
          {DECISIONS.map((d) => (
            <label key={d.value} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="flag-decision"
                value={d.value}
                checked={decision === d.value}
                onChange={() => setDecision(d.value)}
              />
              {t(d.label)}
            </label>
          ))}
        </fieldset>
        <Field
          id="flag-note"
          label={t("expenses.reviewNoteLabel")}
          hint={t("expenses.reviewNoteHint")}
        >
          <textarea
            id="flag-note"
            rows={3}
            maxLength={1000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="block w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-fg"
          />
        </Field>
        {save.isError ? (
          <InlineAlert tone="danger">{describeError(save.error, t)}</InlineAlert>
        ) : null}
      </div>
    </Dialog>
  );
}
