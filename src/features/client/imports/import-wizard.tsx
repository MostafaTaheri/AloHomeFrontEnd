"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { MoneyInput } from "@/components/forms/money-input";
import { EnumBadge } from "@/components/finance/enum-badge";
import { Money } from "@/components/finance/money";
import { StatBox, StatGrid } from "@/components/finance/stat";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, Select } from "@/components/ui/field";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState, ErrorState, InlineAlert, ListSkeleton } from "@/components/ui/states";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/provider";
import { ApiError, describeError } from "@/lib/api/error";
import { importsApi } from "@/lib/api/finance/endpoints";
import type { ImportBatch, ImportIssue } from "@/lib/api/finance/types";
import { qk } from "@/lib/api/keys";
import { saveBlob } from "@/lib/download";
import { amountToInput, parseAmountInput } from "@/lib/format/amount";
import { track, usePageView } from "@/lib/telemetry/client";
import { cn } from "@/lib/utils";
import { useSchemeMutation } from "../use-scheme-mutation";
import { useScheme } from "../workspace/scheme-provider";
import { checkFile, isDraft, MAX_UPLOAD_BYTES, stepFor, toCsv, type WizardStep } from "./constants";

const STEPS: {
  id: WizardStep | "upload";
  label:
    | "imports.stepUpload"
    | "imports.stepMapping"
    | "imports.stepReview"
    | "imports.stepCommit"
    | "imports.stepResult";
}[] = [
  { id: "upload", label: "imports.stepUpload" },
  { id: "mapping", label: "imports.stepMapping" },
  { id: "review", label: "imports.stepReview" },
  { id: "commit", label: "imports.stepCommit" },
  { id: "result", label: "imports.stepResult" },
];

export function ImportWizard({ importId }: { importId: string }) {
  const { t } = useI18n();
  const { schemeId } = useScheme();
  usePageView("imports", "wizard");

  const query = useQuery({
    queryKey: qk.import(schemeId, importId),
    queryFn: ({ signal }) => importsApi.get(schemeId, importId, { signal }),
  });

  if (query.isPending) return <ListSkeleton rows={6} />;
  if (query.isError) {
    if (query.error instanceof ApiError && query.error.status === 404) {
      return (
        <EmptyState
          title={t("imports.batchGone")}
          action={
            <Link href={`/schemes/${schemeId}/imports`} className="text-brand hover:underline">
              {t("imports.back")}
            </Link>
          }
        />
      );
    }
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  }
  return <WizardBody batch={query.data} />;
}

function WizardBody({ batch }: { batch: ImportBatch }) {
  const { t } = useI18n();
  const { schemeId, canWrite } = useScheme();
  const step = stepFor(String(batch.status));
  const [busy, setBusy] = useState(false);

  // Warn before leaving while the import is unfinished or a request is in flight.
  const active = busy || isDraft(String(batch.status));
  const status = String(batch.status);
  const activeRef = useRef(active);
  const statusRef = useRef(status);
  useEffect(() => {
    activeRef.current = active;
    statusRef.current = status;
  }, [active, status]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!activeRef.current) return;
      event.preventDefault();
      event.returnValue = t("imports.leaveWarning");
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      if (isDraft(statusRef.current))
        track("wizard_abandoned", { area: "imports", step: stepFor(statusRef.current) });
    };
  }, [t]);

  const currentIndex = step === "mapping" ? 1 : step === "review" ? 2 : step === "commit" ? 3 : 4;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("imports.wizardTitle", { file: batch.fileName })}
        description={t(`enums.importKind.${batch.kind}` as never)}
        backHref={`/schemes/${schemeId}/imports`}
        backLabel={t("imports.back")}
        actions={<EnumBadge group="importStatus" value={batch.status} />}
      />

      <ol aria-label={t("imports.stepsLabel")} className="flex flex-wrap gap-2">
        {STEPS.map((s, index) => {
          const state = index < currentIndex ? "done" : index === currentIndex ? "current" : "todo";
          return (
            <li
              key={s.id}
              aria-current={state === "current" ? "step" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-full border px-3 py-1 text-sm",
                state === "current" && "border-brand bg-brand-soft font-medium text-brand",
                state === "done" && "border-ok/40 text-ok",
                state === "todo" && "border-line text-muted",
              )}
            >
              <span aria-hidden="true">{state === "done" ? "✓" : index + 1}</span>
              <span>{t(s.label)}</span>
              <span className="sr-only">
                {state === "current"
                  ? t("imports.stepCurrent")
                  : state === "done"
                    ? t("imports.stepDone")
                    : ""}
              </span>
            </li>
          );
        })}
      </ol>

      {step === "mapping" ? (
        <MappingStep batch={batch} canWrite={canWrite} onBusy={setBusy} />
      ) : null}
      {step === "review" || step === "commit" ? (
        <ReviewStep batch={batch} canWrite={canWrite} step={step} onBusy={setBusy} />
      ) : null}
      {step === "result" ? <ResultStep batch={batch} canWrite={canWrite} /> : null}
    </div>
  );
}

// ------------------------------------------------------------------ mapping

function fieldLabel(field: string): string {
  return field.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ");
}

function MappingStep({
  batch,
  canWrite,
  onBusy,
}: {
  batch: ImportBatch;
  canWrite: boolean;
  onBusy: (busy: boolean) => void;
}) {
  const { t } = useI18n();
  const { schemeId } = useScheme();
  const [mapping, setMapping] = useState<Record<string, string>>(batch.mapping ?? {});
  const [touched, setTouched] = useState(false);

  const save = useSchemeMutation({
    mutationFn: (value: Record<string, string>) =>
      importsApi.saveMapping(schemeId, batch.id, value),
    invalidate: [qk.imports(schemeId)],
    success: "imports.mappingSaved",
    onSuccess: (updated) => track("import_mapped", { area: "imports", kind: String(updated.kind) }),
  });
  useEffect(() => onBusy(save.isPending), [save.isPending, onBusy]);

  const fields = [...batch.requiredFields, ...batch.optionalFields];
  const missing = batch.requiredFields.filter((f) => !mapping[f]);
  const used = Object.values(mapping).filter(Boolean);
  const duplicate = used.find((column, i) => used.indexOf(column) !== i);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (save.isPending || missing.length > 0 || duplicate) return;
    const clean = Object.fromEntries(Object.entries(mapping).filter(([, v]) => v));
    save.mutate(clean);
  }

  return (
    <Card>
      <CardHeader title={t("imports.mappingTitle")} description={t("imports.mappingBody")} />
      <CardBody>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map((field) => {
              const required = batch.requiredFields.includes(field);
              const error =
                touched && required && !mapping[field] ? t("imports.required") : undefined;
              return (
                <Field
                  key={field}
                  id={`map-${field}`}
                  label={fieldLabel(field)}
                  optional={required ? undefined : t("common.optional")}
                  error={error}
                >
                  <Select
                    id={`map-${field}`}
                    invalid={Boolean(error)}
                    disabled={!canWrite || save.isPending}
                    value={mapping[field] ?? ""}
                    onChange={(e) => setMapping((m) => ({ ...m, [field]: e.target.value }))}
                  >
                    <option value="">
                      {required ? t("imports.chooseColumn") : t("imports.notMapped")}
                    </option>
                    {batch.headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </Select>
                </Field>
              );
            })}
          </div>
          {touched && missing.length > 0 ? (
            <InlineAlert tone="danger">
              {t("imports.mappingMissing", { fields: missing.map(fieldLabel).join(", ") })}
            </InlineAlert>
          ) : null}
          {touched && duplicate ? (
            <InlineAlert tone="danger">
              {t("imports.mappingDuplicate", { column: duplicate })}
            </InlineAlert>
          ) : null}
          {canWrite ? (
            <Button type="submit" loading={save.isPending}>
              {save.isPending ? t("imports.savingMapping") : t("imports.saveMapping")}
            </Button>
          ) : null}
        </form>
      </CardBody>
    </Card>
  );
}

// ------------------------------------------------------------------- review

function ReviewStep({
  batch,
  canWrite,
  step,
  onBusy,
}: {
  batch: ImportBatch;
  canWrite: boolean;
  step: WizardStep;
  onBusy: (busy: boolean) => void;
}) {
  const { t, fmt } = useI18n();
  const { schemeId } = useScheme();
  const [confirm, setConfirm] = useState(false);
  const previewTracked = useRef(false);

  const preview = useQuery({
    queryKey: qk.importPreview(schemeId, batch.id),
    queryFn: ({ signal }) => importsApi.preview(schemeId, batch.id, 50, { signal }),
  });
  useEffect(() => {
    if (preview.data && !previewTracked.current) {
      previewTracked.current = true;
      track("import_previewed", { area: "imports", count: preview.data.rows.length });
    }
  }, [preview.data]);

  const commit = useSchemeMutation({
    mutationFn: () => importsApi.commit(schemeId, batch.id),
    invalidate: [qk.imports(schemeId), ["scheme", schemeId]],
    success: "imports.committed",
    silentError: true,
    onSuccess: (done) => {
      setConfirm(false);
      track(done.status === "Failed" ? "import_failed" : "import_committed", {
        area: "imports",
        kind: String(done.kind),
        count: done.validRows,
      });
    },
  });
  useEffect(() => onBusy(commit.isPending), [commit.isPending, onBusy]);

  const canCommit = canWrite && step === "commit" && preview.data?.canCommit === true;
  const skipped = Math.max(0, batch.totalRows - batch.validRows);
  const mismatch = batch.difference !== null && batch.difference !== 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title={t("imports.reviewTitle")}
          description={t("imports.reviewBody", { count: fmt.integer(50) })}
        />
        <CardBody className="space-y-4">
          <StatGrid>
            <StatBox label={t("imports.summaryTotal")} value={fmt.integer(batch.totalRows)} />
            <StatBox label={t("imports.summaryValid")} value={fmt.integer(batch.validRows)} />
            <StatBox label={t("imports.summaryErrors")} value={fmt.integer(batch.errorRows)} />
            <StatBox
              label={t("imports.summaryDuplicates")}
              value={fmt.integer(batch.duplicateRows)}
            />
          </StatGrid>

          {preview.data && preview.data.mappingIssues.length > 0 ? (
            <div>
              <h3 className="mb-2 text-sm font-semibold">{t("imports.mappingIssuesTitle")}</h3>
              <ul className="list-disc space-y-1 ps-5 text-sm text-danger">
                {preview.data.mappingIssues.map((issue, i) => (
                  <li key={i}>
                    {issue.field ? `${fieldLabel(issue.field)}: ` : ""}
                    {issue.reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {preview.isPending ? <ListSkeleton rows={4} /> : null}
          {preview.isError ? (
            <ErrorState error={preview.error} onRetry={() => void preview.refetch()} />
          ) : null}
          {preview.data ? <PreviewTable preview={preview.data} currency={batch.currency} /> : null}
        </CardBody>
      </Card>

      {batch.errorRows > 0 || batch.duplicateRows > 0 ? <IssuesCard batch={batch} /> : null}

      <ControlTotalCard batch={batch} canWrite={canWrite} />

      <Card>
        <CardHeader title={t("imports.commitTitle")} />
        <CardBody className="space-y-3">
          <p className="text-sm">
            {t("imports.commitBody", { valid: fmt.integer(batch.validRows) })}
          </p>
          {step !== "commit" ? (
            <InlineAlert tone="warn">{t("imports.commitNeedsMapping")}</InlineAlert>
          ) : null}
          {step === "commit" && preview.data && !preview.data.canCommit ? (
            <InlineAlert tone="danger">{t("imports.commitBlocked")}</InlineAlert>
          ) : null}
          {commit.isError ? (
            <InlineAlert tone="danger">{describeError(commit.error, t)}</InlineAlert>
          ) : null}
          {canWrite ? (
            <Button disabled={!canCommit || commit.isPending} onClick={() => setConfirm(true)}>
              {commit.isPending
                ? t("imports.committing")
                : t("imports.commit", { count: fmt.integer(batch.validRows) })}
            </Button>
          ) : null}
        </CardBody>
      </Card>

      <RetryCard batch={batch} canWrite={canWrite} />

      <ConfirmDialog
        open={confirm}
        title={t("imports.commitConfirmTitle")}
        body={`${t("imports.commitConfirmBody", {
          valid: fmt.integer(batch.validRows),
          skipped: fmt.integer(skipped),
        })}${
          mismatch
            ? ` ${t("imports.commitConfirmMismatch", { amount: fmt.money(Math.abs(batch.difference ?? 0), batch.currency) })}`
            : ""
        }`}
        confirmLabel={t("imports.commit", { count: fmt.integer(batch.validRows) })}
        busy={commit.isPending}
        onConfirm={() => {
          if (!commit.isPending) commit.mutate(undefined);
        }}
        onClose={() => setConfirm(false)}
      />
    </div>
  );
}

function PreviewTable({
  preview,
  currency,
}: {
  preview: NonNullable<ReturnType<typeof importsApi.preview> extends Promise<infer R> ? R : never>;
  currency: string;
}) {
  const { t } = useI18n();
  if (preview.rows.length === 0)
    return <p className="text-sm text-muted">{t("imports.previewEmpty")}</p>;
  return (
    <div className="overflow-x-auto">
      <Table>
        <THead>
          <TR>
            <TH>{t("imports.colRow")}</TH>
            <TH>{t("imports.colRowStatus")}</TH>
            <TH>{t("imports.colAmount")}</TH>
            <TH>{t("imports.colLot")}</TH>
            <TH>{t("imports.colCategory")}</TH>
            <TH>{t("imports.colIssues")}</TH>
          </TR>
        </THead>
        <TBody>
          {preview.rows.map((row) => (
            <TR key={row.rowNumber}>
              <TD>{row.rowNumber}</TD>
              <TD>
                <EnumBadge group="rowStatus" value={row.status} />
              </TD>
              <TD>
                <Money amount={row.amount} currency={currency} />
              </TD>
              <TD>{row.lot ?? t("common.none")}</TD>
              <TD>{row.category ?? t("common.none")}</TD>
              <TD className="text-sm text-danger">{row.issues.map((i) => i.reason).join("; ")}</TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}

function IssuesCard({ batch }: { batch: ImportBatch }) {
  const { t } = useI18n();
  const { schemeId } = useScheme();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [severity, setSeverity] = useState<"" | "Error" | "Warning">("");
  const [downloading, setDownloading] = useState(false);

  const params = { severity: severity || undefined, page, pageSize: 20 };
  const query = useQuery({
    queryKey: qk.importErrors(schemeId, batch.id, params),
    queryFn: ({ signal }) => importsApi.errors(schemeId, batch.id, params, { signal }),
    placeholderData: (previous) => previous,
  });

  async function download() {
    setDownloading(true);
    try {
      const rows: unknown[][] = [["Row", "Severity", "Field", "Value", "Problem", "Suggested fix"]];
      let current = 1;
      for (;;) {
        const result = await importsApi.errors(schemeId, batch.id, {
          page: current,
          pageSize: 200,
        });
        for (const i of result.items as ImportIssue[]) {
          rows.push([i.rowNumber, i.severity, i.field, i.value, i.reason, i.suggestedFix]);
        }
        if (!result.hasNextPage || current >= 50) break;
        current += 1;
      }
      const base = batch.fileName.replace(/\.[^.]+$/, "").replace(/[^\w.-]+/g, "_") || "import";
      saveBlob(new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" }), `${base}-problems.csv`);
      toast.success(t("imports.errorsDownloaded"));
    } catch {
      toast.error(t("imports.downloadFailed"));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title={t("imports.errorsTitle")}
        actions={
          <>
            <div className="w-40">
              <Select
                id="issue-severity"
                aria-label={t("imports.colStatus")}
                value={severity}
                onChange={(e) => {
                  setSeverity(e.target.value as "" | "Error" | "Warning");
                  setPage(1);
                }}
              >
                <option value="">{t("imports.errorsFilterAll")}</option>
                <option value="Error">{t("imports.errorsFilterErrors")}</option>
                <option value="Warning">{t("imports.errorsFilterWarnings")}</option>
              </Select>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void download()}
              loading={downloading}
            >
              {downloading ? t("imports.downloadingErrors") : t("imports.downloadErrors")}
            </Button>
          </>
        }
      />
      {query.isPending ? (
        <CardBody>
          <ListSkeleton rows={3} />
        </CardBody>
      ) : null}
      {query.isError ? (
        <CardBody>
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        </CardBody>
      ) : null}
      {query.data && query.data.items.length === 0 ? (
        <CardBody>
          <p className="text-sm text-muted">{t("imports.errorsNone")}</p>
        </CardBody>
      ) : null}
      {query.data && query.data.items.length > 0 ? (
        <>
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TR>
                  <TH>{t("imports.colRow")}</TH>
                  <TH>{t("imports.colRowStatus")}</TH>
                  <TH>{t("imports.colField")}</TH>
                  <TH>{t("imports.colValue")}</TH>
                  <TH>{t("imports.colReason")}</TH>
                  <TH>{t("imports.colFix")}</TH>
                </TR>
              </THead>
              <TBody>
                {query.data.items.map((issue, i) => (
                  <TR key={`${issue.rowNumber}-${issue.field}-${i}`}>
                    <TD>{issue.rowNumber}</TD>
                    <TD>
                      <EnumBadge group="severity" value={issue.severity} />
                    </TD>
                    <TD>{issue.field ? fieldLabel(issue.field) : t("common.none")}</TD>
                    <TD dir="auto" className="max-w-48 truncate">
                      {issue.value ?? t("common.none")}
                    </TD>
                    <TD>{issue.reason}</TD>
                    <TD className="text-muted">{issue.suggestedFix ?? t("common.none")}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
          <Pagination
            page={query.data.page}
            totalPages={query.data.totalPages}
            totalCount={query.data.totalCount}
            onPageChange={setPage}
            disabled={query.isFetching}
          />
        </>
      ) : null}
    </Card>
  );
}

function ControlTotalCard({ batch, canWrite }: { batch: ImportBatch; canWrite: boolean }) {
  const { t, fmt, currencyUnit } = useI18n();
  const { schemeId } = useScheme();
  const [value, setValue] = useState(
    batch.controlTotal === null
      ? ""
      : amountToInput(batch.controlTotal, batch.currency, currencyUnit),
  );
  const [error, setError] = useState<string | null>(null);

  const save = useSchemeMutation({
    mutationFn: (total: number | null) => importsApi.controlTotal(schemeId, batch.id, total),
    invalidate: [qk.imports(schemeId)],
    success: "imports.controlSaved",
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (save.isPending) return;
    const trimmed = value.trim();
    if (!trimmed) return save.mutate(null);
    const parsed = parseAmountInput(trimmed, {
      currency: batch.currency,
      unit: currencyUnit,
      allowZero: true,
    });
    if (!parsed.ok) return setError(t("imports.controlInvalid"));
    setError(null);
    save.mutate(parsed.value);
  }

  const hasTotal = batch.controlTotal !== null;
  const mismatch = hasTotal && batch.difference !== null && batch.difference !== 0;

  return (
    <Card>
      <CardHeader title={t("imports.controlTitle")} description={t("imports.controlBody")} />
      <CardBody className="space-y-4">
        <form onSubmit={submit} className="flex flex-wrap items-end gap-3" noValidate>
          <div className="w-64">
            <Field
              id="control-total"
              label={t("imports.controlLabel")}
              hint={t("imports.controlHint", { currency: fmt.currencyLabel(batch.currency) })}
              error={error ?? undefined}
            >
              <MoneyInput
                id="control-total"
                currency={batch.currency}
                value={value}
                onChange={setValue}
                invalid={Boolean(error)}
                disabled={!canWrite || save.isPending}
              />
            </Field>
          </div>
          {canWrite ? (
            <Button type="submit" variant="secondary" loading={save.isPending}>
              {t("imports.controlSave")}
            </Button>
          ) : null}
        </form>
        <StatGrid>
          <StatBox
            label={t("imports.controlFile")}
            value={<Money amount={batch.fileTotal} currency={batch.currency} />}
          />
          <StatBox
            label={t("imports.controlEntered")}
            value={
              hasTotal ? (
                <Money amount={batch.controlTotal} currency={batch.currency} />
              ) : (
                t("common.none")
              )
            }
          />
          <StatBox
            label={t("imports.controlDifference")}
            value={
              batch.difference === null ? (
                t("common.none")
              ) : (
                <Money amount={batch.difference} currency={batch.currency} signed />
              )
            }
          />
        </StatGrid>
        {!hasTotal ? (
          <InlineAlert tone="warn">{t("imports.controlNone")}</InlineAlert>
        ) : mismatch ? (
          <InlineAlert tone="danger">
            {t("imports.controlMismatch", {
              amount: fmt.money(Math.abs(batch.difference ?? 0), batch.currency),
            })}
          </InlineAlert>
        ) : (
          <InlineAlert tone="ok">{t("imports.controlMatch")}</InlineAlert>
        )}
      </CardBody>
    </Card>
  );
}

// -------------------------------------------------------------------- retry

function RetryCard({ batch, canWrite }: { batch: ImportBatch; canWrite: boolean }) {
  const { t, fmt } = useI18n();
  const { schemeId } = useScheme();
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [navigating, setNavigating] = useState(false);

  const retry = useSchemeMutation({
    mutationFn: (next: File) =>
      importsApi.retry(schemeId, batch.id, next, {
        mapping: batch.mapping,
        controlTotal: batch.controlTotal,
      }),
    invalidate: [qk.imports(schemeId)],
    success: "imports.retried",
    onSuccess: (created) => {
      track("import_retried", { area: "imports", kind: String(created.kind) });
      setNavigating(true);
      router.push(`/schemes/${schemeId}/imports/${created.id}`);
    },
  });

  if (!canWrite) return null;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (retry.isPending || navigating) return;
    if (!file) return setProblem(t("imports.fileRequired"));
    const check = checkFile(file);
    if (check !== "ok") {
      return setProblem(
        check === "type"
          ? t("imports.fileType")
          : check === "empty"
            ? t("imports.fileEmpty")
            : t("imports.fileTooLarge", { size: fmt.fileSize(MAX_UPLOAD_BYTES) }),
      );
    }
    setProblem(null);
    retry.mutate(file);
  }

  return (
    <Card>
      <CardHeader title={t("imports.retryTitle")} description={t("imports.retryBody")} />
      <CardBody>
        <form onSubmit={submit} className="flex flex-wrap items-end gap-3" noValidate>
          <div className="min-w-64 flex-1">
            <Field
              id="retry-file"
              label={t("imports.file")}
              hint={t("imports.fileHint", { size: fmt.fileSize(MAX_UPLOAD_BYTES) })}
              error={problem ?? undefined}
            >
              <input
                id="retry-file"
                type="file"
                accept=".csv,.xlsx"
                disabled={retry.isPending || navigating}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm file:me-3 file:rounded-md file:border file:border-line file:bg-surface file:px-3 file:py-2 file:text-sm"
              />
            </Field>
          </div>
          <Button type="submit" variant="secondary" loading={retry.isPending || navigating}>
            {retry.isPending ? t("imports.retrying") : t("imports.retryUpload")}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

// ------------------------------------------------------------------- result

function ResultStep({ batch, canWrite }: { batch: ImportBatch; canWrite: boolean }) {
  const { t, fmt } = useI18n();
  const { schemeId } = useScheme();
  const status = String(batch.status);
  const kind = String(batch.kind);

  const nextLinks: { href: string; label: string }[] = [];
  if (status === "Committed") {
    if (kind === "Expenses") nextLinks.push({ href: "expenses", label: t("imports.goExpenses") });
    if (kind === "Levies" || kind === "ArrearsReport")
      nextLinks.push({ href: "arrears", label: t("imports.goArrears") });
    if (kind === "CapitalWorksPlan")
      nextLinks.push({ href: "capital-works", label: t("imports.goCapital") });
    nextLinks.push({ href: "", label: t("imports.goHealth") });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title={
            status === "Committed"
              ? t("imports.resultCommittedTitle")
              : status === "Failed"
                ? t("imports.resultFailedTitle")
                : t("imports.resultSuperseded")
          }
          actions={<EnumBadge group="verification" value={batch.verification} />}
        />
        <CardBody className="space-y-4">
          {status === "Committed" ? (
            <p className="text-sm">
              {t("imports.resultCommittedBody", { count: fmt.integer(batch.validRows) })}
            </p>
          ) : null}
          {status === "Failed" ? (
            <InlineAlert tone="danger">
              {batch.failureReason ?? t("imports.resultFailedBody")}
            </InlineAlert>
          ) : null}
          {status === "Superseded" && batch.supersededByBatchId ? (
            <Link
              href={`/schemes/${schemeId}/imports/${batch.supersededByBatchId}`}
              className="text-sm text-brand hover:underline"
            >
              {t("imports.resultSupersededLink")}
            </Link>
          ) : null}
          {batch.retryOfBatchId ? (
            <p className="text-sm text-muted">{t("imports.resultRetryOf")}</p>
          ) : null}

          <StatGrid>
            <StatBox label={t("imports.summaryTotal")} value={fmt.integer(batch.totalRows)} />
            <StatBox label={t("imports.summaryValid")} value={fmt.integer(batch.validRows)} />
            <StatBox label={t("imports.summaryErrors")} value={fmt.integer(batch.errorRows)} />
            <StatBox
              label={t("imports.resultImported")}
              value={<Money amount={batch.importedTotal} currency={batch.currency} />}
            />
          </StatGrid>

          {batch.controlTotal !== null ? (
            batch.difference !== null && batch.difference !== 0 ? (
              <InlineAlert tone="danger">
                {t("imports.controlMismatch", {
                  amount: fmt.money(Math.abs(batch.difference), batch.currency),
                })}
              </InlineAlert>
            ) : (
              <InlineAlert tone="ok">{t("imports.controlMatch")}</InlineAlert>
            )
          ) : null}

          <p className="text-xs text-muted">
            {t("imports.resultUploadedBy", {
              who: batch.uploadedBy ?? t("common.none"),
              when: fmt.dateTime(batch.uploadedAtUtc),
            })}
            {batch.committedAtUtc
              ? ` · ${t("imports.resultCommittedAt", { when: fmt.dateTime(batch.committedAtUtc) })}`
              : ""}
          </p>

          {nextLinks.length > 0 ? (
            <div>
              <h3 className="mb-2 text-sm font-semibold">{t("imports.nextSteps")}</h3>
              <div className="flex flex-wrap gap-3 text-sm">
                {nextLinks.map((l) => (
                  <Link
                    key={l.label}
                    href={`/schemes/${schemeId}${l.href ? `/${l.href}` : ""}`}
                    className="text-brand hover:underline"
                  >
                    {l.label}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </CardBody>
      </Card>

      {status === "Failed" || (status === "Committed" && batch.errorRows > 0) ? (
        <IssuesCard batch={batch} />
      ) : null}
      {status === "Failed" ? <RetryCard batch={batch} canWrite={canWrite} /> : null}
    </div>
  );
}
