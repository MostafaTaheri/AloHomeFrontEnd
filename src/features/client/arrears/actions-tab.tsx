"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { EnumBadge } from "@/components/finance/enum-badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Select } from "@/components/ui/field";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState, ErrorState, InlineAlert, ListSkeleton } from "@/components/ui/states";
import { useI18n } from "@/i18n/provider";
import { describeError } from "@/lib/api/error";
import { arrearsApi } from "@/lib/api/finance/endpoints";
import type { ArrearsAction } from "@/lib/api/finance/types";
import { qk } from "@/lib/api/keys";
import { useSchemeMutation } from "../use-scheme-mutation";
import { useScheme } from "../workspace/scheme-provider";

type Status = "Open" | "InReview" | "Resolved" | "Dismissed";
const STATUSES: Status[] = ["Open", "InReview", "Resolved", "Dismissed"];

export function ActionsTab() {
  const { t } = useI18n();
  const { schemeId, canWrite } = useScheme();
  const [status, setStatus] = useState<Status | "">("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);

  const params = { status: status || undefined, page, pageSize: 10 };
  const query = useQuery({
    queryKey: qk.arrearsActions(schemeId, params),
    queryFn: ({ signal }) => arrearsApi.actions(schemeId, params, { signal }),
    placeholderData: (previous) => previous,
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{t("arrears.actionsTitle")}</h2>
        <p className="text-sm text-muted">{t("arrears.actionsSubtitle")}</p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-48">
          <Field id="action-status" label={t("arrears.actionStatusFilter")}>
            <Select
              id="action-status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as Status | "");
                setPage(1);
              }}
            >
              <option value="">{t("common.all")}</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`enums.arrearsStatus.${s}`)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {canWrite ? (
          <Button onClick={() => setCreating(true)}>{t("arrears.newAction")}</Button>
        ) : null}
      </div>

      {query.isPending ? <ListSkeleton rows={4} /> : null}
      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : null}
      {query.data && query.data.items.length === 0 ? (
        <EmptyState title={t("arrears.actionsEmptyTitle")} body={t("arrears.actionsEmptyBody")} />
      ) : null}
      {query.data && query.data.items.length > 0 ? (
        <>
          <ul className="space-y-3">
            {query.data.items.map((a) => (
              <li key={a.id}>
                <ActionCard action={a} canWrite={canWrite} />
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

      <CreateDialog open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}

function ActionCard({ action, canWrite }: { action: ArrearsAction; canWrite: boolean }) {
  const { t, fmt } = useI18n();
  const { schemeId } = useScheme();
  const [next, setNext] = useState<Status>(
    (STATUSES.find((s) => s !== action.status) ?? "Resolved") as Status,
  );
  const [statusNote, setStatusNote] = useState("");
  const [noteText, setNoteText] = useState("");

  const change = useSchemeMutation({
    mutationFn: () => arrearsApi.changeActionStatus(schemeId, action.id, next, statusNote.trim()),
    invalidate: [qk.arrears(schemeId)],
    success: "arrears.statusSaved",
    onSuccess: () => setStatusNote(""),
  });
  const addNote = useSchemeMutation({
    mutationFn: () => arrearsApi.addNote(schemeId, action.id, noteText.trim()),
    invalidate: [qk.arrears(schemeId)],
    success: "arrears.noteSaved",
    onSuccess: () => setNoteText(""),
  });

  return (
    <Card>
      <CardBody className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium">{action.lot}</h3>
            <EnumBadge group="arrearsStatus" value={action.status} />
          </div>
          <p className="text-xs text-muted">
            {t("arrears.overdueAtCreation", {
              amount: fmt.money(action.overdueAtCreation, action.currency, { whole: true }),
            })}
          </p>
        </div>
        <p className="text-sm" dir="auto">
          {action.reason}
        </p>
        <p className="text-xs text-muted">
          {t("arrears.createdBy", {
            user: action.createdBy,
            when: fmt.dateTime(action.createdAtUtc),
          })}
          {action.statusChangedBy && action.statusChangedAtUtc
            ? ` · ${t("arrears.changedBy", { user: action.statusChangedBy, when: fmt.dateTime(action.statusChangedAtUtc) })}`
            : ""}
        </p>

        <details className="text-sm">
          <summary className="cursor-pointer select-none font-medium">
            {t("arrears.notesTitle")} ({fmt.integer(action.notes.length)})
          </summary>
          <div className="mt-2 space-y-2">
            {action.notes.length === 0 ? (
              <p className="text-muted">{t("arrears.noNotes")}</p>
            ) : null}
            <ul className="space-y-2">
              {action.notes.map((n) => (
                <li key={n.id} className="rounded-md bg-surface-2 p-2">
                  <p dir="auto">{n.text}</p>
                  <p className="text-xs text-muted">{fmt.dateTime(n.createdAtUtc)}</p>
                </li>
              ))}
            </ul>
            {canWrite ? (
              <form
                className="space-y-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (noteText.trim() && !addNote.isPending) addNote.mutate(undefined);
                }}
              >
                <Field id={`note-${action.id}`} label={t("arrears.noteLabel")}>
                  <textarea
                    id={`note-${action.id}`}
                    rows={2}
                    maxLength={1000}
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    className="block w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-fg"
                  />
                </Field>
                <Button
                  type="submit"
                  size="sm"
                  variant="secondary"
                  loading={addNote.isPending}
                  disabled={!noteText.trim()}
                >
                  {t("arrears.noteAdd")}
                </Button>
              </form>
            ) : null}
          </div>
        </details>

        {canWrite ? (
          <form
            className="flex flex-wrap items-end gap-2 border-t border-line pt-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!change.isPending) change.mutate(undefined);
            }}
          >
            <div className="w-44">
              <Field id={`status-${action.id}`} label={t("arrears.setStatus")}>
                <Select
                  id={`status-${action.id}`}
                  value={next}
                  onChange={(e) => setNext(e.target.value as Status)}
                >
                  {STATUSES.filter((s) => s !== action.status).map((s) => (
                    <option key={s} value={s}>
                      {t(`enums.arrearsStatus.${s}`)}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="min-w-48 flex-1">
              <Field id={`status-note-${action.id}`} label={t("arrears.statusNote")}>
                <input
                  id={`status-note-${action.id}`}
                  maxLength={500}
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  className="block h-10 w-full rounded-md border border-line bg-surface px-3 text-sm text-fg"
                />
              </Field>
            </div>
            <Button type="submit" size="sm" loading={change.isPending}>
              {t("arrears.statusSave")}
            </Button>
          </form>
        ) : null}
      </CardBody>
    </Card>
  );
}

function CreateDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const { schemeId } = useScheme();
  const [lotId, setLotId] = useState("");
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);

  const lots = useQuery({
    queryKey: qk.arrearsLots(schemeId, { onlyInArrears: true }),
    queryFn: ({ signal }) => arrearsApi.lots(schemeId, { onlyInArrears: true }, { signal }),
    enabled: open,
  });

  const create = useSchemeMutation({
    mutationFn: (input: { lotId: number; reason: string }) =>
      arrearsApi.createAction(schemeId, input),
    invalidate: [qk.arrears(schemeId)],
    success: "arrears.actionCreated",
    silentError: true,
    onSuccess: () => {
      setLotId("");
      setReason("");
      setTouched(false);
      onClose();
    },
  });

  const lotError = touched && !lotId ? t("arrears.actionLotChoose") : undefined;
  const reasonError = touched && !reason.trim() ? t("validation.required") : undefined;

  return (
    <Dialog
      open={open}
      onClose={create.isPending ? () => undefined : onClose}
      title={t("arrears.newAction")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={create.isPending}>
            {t("common.cancel")}
          </Button>
          <Button
            loading={create.isPending}
            onClick={() => {
              setTouched(true);
              if (!lotId || !reason.trim() || create.isPending) return;
              create.mutate({ lotId: Number(lotId), reason: reason.trim() });
            }}
          >
            {t("arrears.actionCreate")}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field id="action-lot" label={t("arrears.actionLot")} error={lotError}>
          <Select
            id="action-lot"
            value={lotId}
            invalid={Boolean(lotError)}
            onChange={(e) => setLotId(e.target.value)}
          >
            <option value="">{t("arrears.actionLotChoose")}</option>
            {(lots.data ?? []).map((l) => (
              <option key={l.lotId} value={l.lotId}>
                {l.lot}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          id="action-reason"
          label={t("arrears.actionReason")}
          hint={t("arrears.actionReasonHint")}
          error={reasonError}
        >
          <textarea
            id="action-reason"
            rows={3}
            maxLength={500}
            value={reason}
            aria-invalid={Boolean(reasonError) || undefined}
            onChange={(e) => setReason(e.target.value)}
            className="block w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-fg"
          />
        </Field>
        {lots.isError ? <InlineAlert tone="warn">{t("data.sectionFailed")}</InlineAlert> : null}
        {create.isError ? (
          <InlineAlert tone="danger">{describeError(create.error, t)}</InlineAlert>
        ) : null}
      </div>
    </Dialog>
  );
}
