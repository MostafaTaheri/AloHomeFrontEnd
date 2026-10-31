"use client";

import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { confidencePercent } from "@/components/ai/confidence";
import { DateField } from "@/components/forms/date-field";
import { MoneyInput } from "@/components/forms/money-input";
import { EnumBadge } from "@/components/finance/enum-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { EmptyState, ErrorState, InlineAlert, ListSkeleton } from "@/components/ui/states";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useI18n } from "@/i18n/provider";
import type { MessageKey } from "@/i18n/translator";
import { describeError } from "@/lib/api/error";
import {
  aiDocumentsApi,
  checkExtractionFile,
  type DocumentExtraction,
} from "@/lib/api/finance/ai-documents";
import type { FundName } from "@/lib/api/finance/types";
import { qk } from "@/lib/api/keys";
import { amountToInput, parseAmountInput } from "@/lib/format/amount";
import { track } from "@/lib/telemetry/client";
import { cn } from "@/lib/utils";
import { useLookups } from "../expenses/lookups";
import { RecordHistoryButton } from "../records/record-history";
import { useSchemeMutation } from "../use-scheme-mutation";
import { useScheme } from "../workspace/scheme-provider";

/**
 * Invoice extraction (AI-02). The model proposes values from a PDF's text; a person checks them
 * against the document and accepts, which records a verified expense, or rejects. Nothing is
 * written to the books by the model.
 */
export function DocumentsTab() {
  const { t, fmt } = useI18n();
  const { schemeId, canWrite } = useScheme();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: qk.extractions(schemeId),
    queryFn: ({ signal }) => aiDocumentsApi.list(schemeId, undefined, { signal }),
  });
  const selected = query.data?.find((e) => e.id === selectedId) ?? query.data?.[0] ?? null;

  return (
    <div className="space-y-4">
      {canWrite ? <UploadCard onUploaded={(e) => setSelectedId(e.id)} /> : null}
      {query.isPending ? <ListSkeleton rows={3} /> : null}
      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : null}
      {query.data && query.data.length === 0 ? (
        <EmptyState title={t("aiDocs.emptyTitle")} body={t("aiDocs.emptyBody")} />
      ) : null}
      {query.data && query.data.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
          <ul className="space-y-2" aria-label={t("aiDocs.listLabel")}>
            {query.data.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  aria-current={selected?.id === e.id ? "true" : undefined}
                  onClick={() => setSelectedId(e.id)}
                  className={cn(
                    "w-full rounded-md border px-3 py-2 text-start text-sm",
                    selected?.id === e.id
                      ? "border-brand bg-brand-soft"
                      : "border-line bg-surface hover:bg-surface-2",
                  )}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium" dir="ltr">
                      {e.fileName}
                    </span>
                    <EnumBadge group="extractionStatus" value={e.status} />
                  </span>
                  {e.status !== "Failed" ? (
                    <span className="mt-0.5 block text-xs text-muted">
                      {t("ai.confidenceValue", {
                        value: fmt.percent(confidencePercent(e.overallConfidence)),
                      })}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
          {selected ? <ExtractionDetail key={selected.id} extraction={selected} /> : null}
        </div>
      ) : null}
    </div>
  );
}

function UploadCard({ onUploaded }: { onUploaded: (e: DocumentExtraction) => void }) {
  const { t } = useI18n();
  const { schemeId } = useScheme();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const problem = file ? checkExtractionFile(file) : null;

  const upload = useSchemeMutation({
    mutationFn: () => aiDocumentsApi.upload(schemeId, file!),
    invalidate: [qk.extractions(schemeId)],
    success: "aiDocs.uploaded",
    silentError: true,
    onSuccess: (e) => {
      track("ai_document_uploaded", { status: String(e.status) });
      setFile(null);
      if (input.current) input.current.value = "";
      onUploaded(e);
    },
  });

  return (
    <Card>
      <CardHeader title={t("aiDocs.uploadTitle")} description={t("aiDocs.uploadBody")} />
      <CardBody>
        <form
          noValidate
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!file || problem || upload.isPending) return;
            upload.mutate(undefined);
          }}
        >
          <div className="min-w-64 flex-1">
            <Field
              id="extract-file"
              label={t("aiDocs.file")}
              hint={t("aiDocs.fileHint")}
              error={problem ? t(`aiDocs.file_${problem}`) : undefined}
            >
              <input
                ref={input}
                id="extract-file"
                type="file"
                accept="application/pdf,.pdf"
                aria-invalid={problem ? true : undefined}
                className="block w-full text-sm"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </Field>
          </div>
          <Button type="submit" loading={upload.isPending} disabled={!file || Boolean(problem)}>
            {t("aiDocs.extract")}
          </Button>
        </form>
        {upload.isError ? (
          <div className="mt-3">
            <InlineAlert tone="danger">{describeError(upload.error, t)}</InlineAlert>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}

function ExtractionDetail({ extraction }: { extraction: DocumentExtraction }) {
  const { t, fmt } = useI18n();
  // Field names come from the model contract; show the raw name for any we don't translate.
  const fieldLabel = (name: string) => {
    const key = `aiDocs.fields.${name}` as MessageKey;
    const label = t(key);
    return label === key ? name : label;
  };
  const { canWrite } = useScheme();
  const [rejecting, setRejecting] = useState(false);
  const pending = extraction.status === "PendingReview";

  return (
    <Card>
      <CardHeader
        title={extraction.fileName}
        description={t("aiDocs.model", {
          model: `${extraction.modelName} ${extraction.modelVersion}`,
          prompt: `${extraction.promptTemplateId} v${extraction.promptTemplateVersion}`,
        })}
        actions={
          <>
            <Badge tone="ai">{t("ai.badge")}</Badge>
            <EnumBadge group="extractionStatus" value={extraction.status} />
          </>
        }
      />
      <CardBody className="space-y-4">
        {extraction.status === "Failed" ? (
          <InlineAlert tone="danger">
            {t("aiDocs.failed", { reason: extraction.failureReason ?? t("common.none") })}
          </InlineAlert>
        ) : (
          <>
            <Table>
              <caption className="sr-only">{t("aiDocs.fieldsCaption")}</caption>
              <THead>
                <TR>
                  <TH>{t("aiDocs.field")}</TH>
                  <TH>{t("aiDocs.value")}</TH>
                  <TH>{t("ai.confidence")}</TH>
                  <TH>{t("aiDocs.grounded")}</TH>
                </TR>
              </THead>
              <TBody>
                {extraction.fields.map((f) => (
                  <TR key={f.name}>
                    <TD>{fieldLabel(f.name)}</TD>
                    <TD dir="auto">{f.value ?? t("common.none")}</TD>
                    <TD>{fmt.percent(confidencePercent(f.confidence))}</TD>
                    <TD>
                      {f.value === null ? (
                        t("common.none")
                      ) : f.grounded ? (
                        <Badge tone="ok">{t("aiDocs.inDocument")}</Badge>
                      ) : (
                        <Badge tone="danger">{t("aiDocs.notInDocument")}</Badge>
                      )}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <p className="text-xs text-muted">{t("aiDocs.checkNotice")}</p>
          </>
        )}
        {extraction.reviewedAtUtc ? (
          <p className="text-xs text-muted">
            {t("aiDocs.reviewed", {
              user: extraction.reviewedBy ?? "",
              when: fmt.dateTime(extraction.reviewedAtUtc),
            })}
            {extraction.reviewNote ? ` — ${extraction.reviewNote}` : ""}
          </p>
        ) : null}
        {extraction.financialRecordId ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span>{t("aiDocs.recorded")}</span>
            <RecordHistoryButton
              recordId={extraction.financialRecordId}
              label={t("aiDocs.openRecord")}
            />
          </div>
        ) : null}
        {pending && canWrite ? (
          <>
            <AcceptForm extraction={extraction} onReject={() => setRejecting(true)} />
            <Dialog
              open={rejecting}
              onClose={() => setRejecting(false)}
              title={t("aiDocs.rejectTitle")}
              className="max-w-md"
            >
              {rejecting ? (
                <RejectForm extraction={extraction} onClose={() => setRejecting(false)} />
              ) : null}
            </Dialog>
          </>
        ) : null}
      </CardBody>
    </Card>
  );
}

function AcceptForm({
  extraction,
  onReject,
}: {
  extraction: DocumentExtraction;
  onReject: () => void;
}) {
  const { t, currencyUnit } = useI18n();
  const { schemeId, currency, adminFundLabel, capitalWorksFundLabel } = useScheme();
  const lookups = useLookups();
  const s = extraction.suggestion;
  const [amount, setAmount] = useState(
    s.amount !== null ? amountToInput(s.amount, currency, currencyUnit) : "",
  );
  const [date, setDate] = useState(s.transactionDate ?? "");
  const [dueDate, setDueDate] = useState(s.dueDate ?? "");
  const [supplierId, setSupplierId] = useState(s.supplierId ?? "");
  const [categoryId, setCategoryId] = useState("");
  const [fund, setFund] = useState<FundName>("Admin");
  const [reference, setReference] = useState(s.externalReference ?? "");
  const [description, setDescription] = useState(s.description ?? "");
  const [touched, setTouched] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const parsed = parseAmountInput(amount, { currency, unit: currencyUnit, allowZero: false });

  const accept = useSchemeMutation({
    mutationFn: () =>
      aiDocumentsApi.accept(schemeId, extraction.id, {
        amount: parsed.ok ? parsed.value : 0,
        transactionDate: date,
        dueDate: dueDate || undefined,
        supplierId: supplierId || undefined,
        categoryId: categoryId || undefined,
        fund,
        externalReference: reference.trim(),
        description: description.trim(),
      }),
    invalidate: [
      qk.extractions(schemeId),
      ["scheme", schemeId, "records"],
      ["scheme", schemeId, "expenses"],
      ["scheme", schemeId, "health"],
    ],
    success: "aiDocs.accepted",
    silentError: true,
    onSuccess: () => {
      track("ai_document_reviewed", { status: "accepted" });
      setConfirming(false);
    },
  });

  return (
    <form
      noValidate
      className="space-y-4 rounded-md border border-line p-4"
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if (!parsed.ok || !date) return;
        setConfirming(true);
      }}
    >
      <h3 className="text-sm font-semibold">{t("aiDocs.reviewTitle")}</h3>
      <p className="text-xs text-muted">{t("aiDocs.reviewBody")}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="acc-amount"
          label={t("common.amount")}
          error={touched && !parsed.ok ? t("aiDocs.amountInvalid") : undefined}
        >
          <MoneyInput
            id="acc-amount"
            currency={currency}
            value={amount}
            onChange={setAmount}
            invalid={touched && !parsed.ok}
          />
        </Field>
        <Field
          id="acc-date"
          label={t("aiDocs.invoiceDate")}
          error={touched && !date ? t("aiDocs.dateRequired") : undefined}
        >
          <DateField id="acc-date" value={date} onChange={setDate} invalid={touched && !date} />
        </Field>
        <Field id="acc-due" label={t("aiDocs.dueDate")} optional={t("common.optional")}>
          <DateField id="acc-due" value={dueDate} onChange={setDueDate} />
        </Field>
        <Field
          id="acc-supplier"
          label={t("common.supplier")}
          hint={s.supplierName ? t("aiDocs.readAs", { name: s.supplierName }) : undefined}
        >
          <Select
            id="acc-supplier"
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
          >
            <option value="">{t("expenses.unknownSupplier")}</option>
            {lookups.suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="acc-category" label={t("common.category")} optional={t("common.optional")}>
          <Select
            id="acc-category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">{t("expenses.uncategorised")}</option>
            {lookups.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {lookups.categoryName(c.id)}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="acc-fund" label={t("common.fund")}>
          <Select id="acc-fund" value={fund} onChange={(e) => setFund(e.target.value as FundName)}>
            <option value="Admin">{adminFundLabel}</option>
            <option value="CapitalWorks">{capitalWorksFundLabel}</option>
          </Select>
        </Field>
        <Field id="acc-ref" label={t("aiDocs.invoiceNumber")} optional={t("common.optional")}>
          <Input
            id="acc-ref"
            maxLength={100}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
        </Field>
        <Field id="acc-desc" label={t("common.description")} optional={t("common.optional")}>
          <Input
            id="acc-desc"
            maxLength={500}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
      </div>
      {accept.isError ? (
        <InlineAlert tone="danger">{describeError(accept.error, t)}</InlineAlert>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onReject} disabled={accept.isPending}>
          {t("aiDocs.reject")}
        </Button>
        <Button type="submit" loading={accept.isPending}>
          {t("aiDocs.accept")}
        </Button>
      </div>
      <ConfirmDialog
        open={confirming}
        title={t("aiDocs.acceptConfirmTitle")}
        body={t("aiDocs.acceptConfirmBody")}
        confirmLabel={t("aiDocs.accept")}
        busy={accept.isPending}
        onConfirm={() => {
          if (!accept.isPending) accept.mutate(undefined);
          setConfirming(false);
        }}
        onClose={() => setConfirming(false)}
      />
    </form>
  );
}

function RejectForm({
  extraction,
  onClose,
}: {
  extraction: DocumentExtraction;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const { schemeId } = useScheme();
  const [note, setNote] = useState("");
  const reject = useSchemeMutation({
    mutationFn: () => aiDocumentsApi.reject(schemeId, extraction.id, note.trim()),
    invalidate: [qk.extractions(schemeId)],
    success: "aiDocs.rejected",
    silentError: true,
    onSuccess: () => {
      track("ai_document_reviewed", { status: "rejected" });
      onClose();
    },
  });
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!reject.isPending) reject.mutate(undefined);
      }}
    >
      <p className="text-sm text-muted">{t("aiDocs.rejectBody")}</p>
      <Field id="rej-note" label={t("common.note")} optional={t("common.optional")}>
        <Input
          id="rej-note"
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>
      {reject.isError ? (
        <InlineAlert tone="danger">{describeError(reject.error, t)}</InlineAlert>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={reject.isPending}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" variant="danger" loading={reject.isPending}>
          {t("aiDocs.reject")}
        </Button>
      </div>
    </form>
  );
}
