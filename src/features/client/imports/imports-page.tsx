"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { EnumBadge } from "@/components/finance/enum-badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/field";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState, ErrorState, InlineAlert, ListSkeleton } from "@/components/ui/states";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useI18n } from "@/i18n/provider";
import { importsApi } from "@/lib/api/finance/endpoints";
import type { ImportBatch, ImportKindName } from "@/lib/api/finance/types";
import { qk } from "@/lib/api/keys";
import { track, usePageView } from "@/lib/telemetry/client";
import { useSchemeMutation } from "../use-scheme-mutation";
import { useScheme } from "../workspace/scheme-provider";
import { checkFile, IMPORT_KINDS, MAX_UPLOAD_BYTES, type FileCheck } from "./constants";

const PAGE_SIZE = 20;

export function ImportsPage() {
  const { t, fmt } = useI18n();
  const { schemeId, canWrite } = useScheme();
  usePageView("imports", "list");

  const [page, setPage] = useState(1);
  const [kindFilter, setKindFilter] = useState<ImportKindName | "">("");

  const query = useQuery({
    queryKey: qk.importList(schemeId, { page, kind: kindFilter }),
    queryFn: ({ signal }) =>
      importsApi.list(
        schemeId,
        { page, pageSize: PAGE_SIZE, kind: kindFilter || undefined },
        { signal },
      ),
    placeholderData: (previous) => previous,
  });

  return (
    <div className="space-y-6">
      <PageHeader title={t("imports.title")} description={t("imports.subtitle")} />

      {canWrite ? <UploadCard /> : <InlineAlert tone="warn">{t("imports.readOnly")}</InlineAlert>}

      <Card>
        <CardHeader
          title={t("imports.historyTitle")}
          actions={
            <div className="w-48">
              <Select
                id="import-kind-filter"
                aria-label={t("imports.filterKind")}
                value={kindFilter}
                onChange={(e) => {
                  setKindFilter(e.target.value as ImportKindName | "");
                  setPage(1);
                }}
              >
                <option value="">{t("common.all")}</option>
                {IMPORT_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {t(`enums.importKind.${k}`)}
                  </option>
                ))}
              </Select>
            </div>
          }
        />
        {query.isPending ? (
          <CardBody>
            <ListSkeleton />
          </CardBody>
        ) : null}
        {query.isError ? (
          <CardBody>
            <ErrorState error={query.error} onRetry={() => void query.refetch()} />
          </CardBody>
        ) : null}
        {query.data && query.data.items.length === 0 ? (
          <CardBody>
            <EmptyState title={t("imports.emptyTitle")} body={t("imports.emptyBody")} />
          </CardBody>
        ) : null}
        {query.data && query.data.items.length > 0 ? (
          <>
            <Table>
              <THead>
                <TR>
                  <TH>{t("imports.colFile")}</TH>
                  <TH>{t("imports.colKind")}</TH>
                  <TH>{t("imports.colStatus")}</TH>
                  <TH>{t("imports.colVerification")}</TH>
                  <TH>{t("imports.colRows")}</TH>
                  <TH>{t("imports.colUploaded")}</TH>
                </TR>
              </THead>
              <TBody>
                {query.data.items.map((batch: ImportBatch) => (
                  <TR key={batch.id}>
                    <TD className="max-w-64 truncate font-medium">
                      <Link
                        href={`/schemes/${schemeId}/imports/${batch.id}`}
                        className="text-brand hover:underline"
                      >
                        {batch.fileName}
                      </Link>
                    </TD>
                    <TD>{t(`enums.importKind.${batch.kind}` as never) || batch.kind}</TD>
                    <TD>
                      <EnumBadge group="importStatus" value={batch.status} />
                    </TD>
                    <TD>
                      <EnumBadge group="verification" value={batch.verification} />
                    </TD>
                    <TD>
                      {t("imports.rowsSummary", {
                        valid: fmt.integer(batch.validRows),
                        total: fmt.integer(batch.totalRows),
                      })}
                    </TD>
                    <TD>{fmt.dateTime(batch.uploadedAtUtc)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
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
    </div>
  );
}

function UploadCard() {
  const { t, fmt } = useI18n();
  const { schemeId } = useScheme();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<ImportKindName>("Expenses");
  const [file, setFile] = useState<File | null>(null);
  const [problem, setProblem] = useState<FileCheck | "required" | null>(null);

  const upload = useSchemeMutation({
    mutationFn: (vars: { kind: ImportKindName; file: File }) =>
      importsApi.upload(schemeId, vars.kind, vars.file),
    invalidate: [qk.imports(schemeId)],
    success: "imports.uploaded",
    onSuccess: (batch) => {
      track("import_started", { area: "imports", kind: String(batch.kind) });
      router.push(`/schemes/${schemeId}/imports/${batch.id}`);
    },
  });

  function choose(next: File | null) {
    setFile(next);
    setProblem(next ? (checkFile(next) === "ok" ? null : checkFile(next)) : null);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (upload.isPending) return; // duplicate-submit guard
    if (!file) return setProblem("required");
    const check = checkFile(file);
    if (check !== "ok") return setProblem(check);
    upload.mutate({ kind, file });
  }

  const message =
    problem === "required"
      ? t("imports.fileRequired")
      : problem === "type"
        ? t("imports.fileType")
        : problem === "tooLarge"
          ? t("imports.fileTooLarge", { size: fmt.fileSize(MAX_UPLOAD_BYTES) })
          : problem === "empty"
            ? t("imports.fileEmpty")
            : undefined;

  return (
    <Card>
      <CardHeader title={t("imports.uploadTitle")} />
      <CardBody>
        <form
          onSubmit={submit}
          className="grid gap-4 sm:grid-cols-[14rem_1fr_auto] sm:items-start"
          noValidate
        >
          <Field id="import-kind" label={t("imports.kind")}>
            <Select
              id="import-kind"
              value={kind}
              disabled={upload.isPending}
              onChange={(e) => setKind(e.target.value as ImportKindName)}
            >
              {IMPORT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {t(`enums.importKind.${k}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            id="import-file"
            label={t("imports.file")}
            hint={t("imports.fileHint", { size: fmt.fileSize(MAX_UPLOAD_BYTES) })}
            error={message}
          >
            <input
              ref={inputRef}
              id="import-file"
              type="file"
              accept=".csv,.xlsx"
              disabled={upload.isPending}
              aria-invalid={message ? true : undefined}
              aria-describedby={message ? "import-file-error" : "import-file-hint"}
              onChange={(e) => choose(e.target.files?.[0] ?? null)}
              className="block w-full text-sm file:me-3 file:rounded-md file:border file:border-line file:bg-surface file:px-3 file:py-2 file:text-sm"
            />
          </Field>
          <div className="sm:pt-7">
            <Button type="submit" loading={upload.isPending}>
              {upload.isPending ? t("imports.uploading") : t("imports.upload")}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
