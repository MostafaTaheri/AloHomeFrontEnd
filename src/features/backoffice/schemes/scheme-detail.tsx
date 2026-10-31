"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { EnumBadge } from "@/components/finance/enum-badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { ErrorState, InlineAlert, ListSkeleton } from "@/components/ui/states";
import { useI18n } from "@/i18n/provider";
import { backofficeApi } from "@/lib/api/backoffice";
import { describeError } from "@/lib/api/error";
import { activeName } from "@/lib/api/finance/enums";
import { qk } from "@/lib/api/keys";
import { usePageView } from "@/lib/telemetry/client";
import { cn } from "@/lib/utils";
import { useBoMutation } from "../use-bo-mutation";
import { CaseStudySection } from "./case-study-section";
import { LotsSection } from "./lots-section";
import { MembersSection } from "./members-section";
import { SchemeForm } from "./scheme-form";

const TABS = ["lots", "members", "details", "case-study"] as const;
type Tab = (typeof TABS)[number];

export function SchemeDetail({ schemeId }: { schemeId: number }) {
  const { t } = useI18n();
  usePageView("backoffice", "scheme");
  const raw = useSearchParams().get("tab");
  const tab: Tab = (TABS as readonly string[]).includes(raw ?? "") ? (raw as Tab) : "lots";

  const query = useQuery({
    queryKey: qk.bo.scheme(schemeId),
    queryFn: ({ signal }) => backofficeApi.scheme(schemeId, signal),
  });

  if (query.isPending) return <ListSkeleton rows={5} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const scheme = query.data;
  const base = `/backoffice/schemes/${schemeId}`;
  const labels: Record<Tab, string> = {
    lots: t("backoffice.tabLots"),
    members: t("backoffice.tabMembers"),
    details: t("backoffice.tabDetails"),
    "case-study": t("caseStudy.tab"),
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={scheme.title}
        description={`${scheme.jurisdictionCode} · ${scheme.currencyCode} · ${scheme.timeZoneId}`}
        backHref="/backoffice/schemes"
        backLabel={t("backoffice.back")}
        actions={<EnumBadge group="active" value={activeName(scheme.status)} />}
      />
      <nav aria-label={t("backoffice.tabsLabel")} className="flex gap-1 border-b border-line">
        {TABS.map((id) => (
          <Link
            key={id}
            href={id === "lots" ? base : `${base}?tab=${id}`}
            aria-current={tab === id ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-4 py-2 text-sm font-medium",
              tab === id
                ? "border-brand text-brand"
                : "border-transparent text-muted hover:text-fg",
            )}
          >
            {labels[id]}
          </Link>
        ))}
      </nav>

      {tab === "lots" ? <LotsSection scheme={scheme} /> : null}
      {tab === "members" ? <MembersSection schemeId={schemeId} /> : null}
      {tab === "details" ? <DetailsSection scheme={scheme} /> : null}
      {tab === "case-study" ? <CaseStudySection schemeId={schemeId} /> : null}
    </div>
  );
}

function DetailsSection({ scheme }: { scheme: Awaited<ReturnType<typeof backofficeApi.scheme>> }) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const [confirmStatus, setConfirmStatus] = useState(false);
  const [confirmInvoices, setConfirmInvoices] = useState(false);
  const active = activeName(scheme.status) === "Active";

  const status = useBoMutation({
    mutationFn: () => backofficeApi.changeSchemeStatus(scheme.id, active ? "Disabled" : "Active"),
    invalidate: [["bo"]],
    success: "backoffice.statusChanged",
    silentError: true,
    onSuccess: () => setConfirmStatus(false),
  });
  const invoices = useBoMutation({
    mutationFn: () => backofficeApi.projectInvoices(scheme.id),
    invalidate: [["bo"]],
    success: "backoffice.invoicesDone",
    silentError: true,
    onSuccess: () => setConfirmInvoices(false),
  });

  const rows: [string, string][] = [
    [t("backoffice.fieldAddress"), scheme.address],
    [t("backoffice.fieldJurisdiction"), scheme.jurisdictionCode],
    [t("backoffice.fieldTimeZone"), scheme.timeZoneId],
    [t("backoffice.colCurrency"), scheme.currencyCode],
    [t("backoffice.fieldFloor"), String(scheme.floor)],
    [t("backoffice.fieldGuestParking"), String(scheme.guestParkingCount)],
    [
      `${t("backoffice.fieldLatitude")} / ${t("backoffice.fieldLongitude")}`,
      `${scheme.latitude}, ${scheme.longitude}`,
    ],
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title={t("backoffice.tabDetails")}
          actions={
            <>
              <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
                {t("common.edit")}
              </Button>
              <Button
                size="sm"
                variant={active ? "danger" : "primary"}
                onClick={() => setConfirmStatus(true)}
              >
                {active ? t("backoffice.disable") : t("backoffice.enable")}
              </Button>
            </>
          }
        />
        <CardBody>
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[14rem_1fr]">
            {rows.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-muted">{k}</dt>
                <dd dir="auto">{v}</dd>
              </div>
            ))}
          </dl>
          {status.isError ? (
            <div className="mt-3">
              <InlineAlert tone="danger">{describeError(status.error, t)}</InlineAlert>
            </div>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={t("backoffice.invoicesTitle")}
          description={t("backoffice.invoicesBody")}
        />
        <CardBody className="space-y-3">
          <Button variant="secondary" onClick={() => setConfirmInvoices(true)}>
            {t("backoffice.invoicesRun")}
          </Button>
          <p>
            <Link
              href={`/backoffice/pilot?scheme=${scheme.id}`}
              className="text-sm text-brand hover:underline"
            >
              {t("backoffice.pilotLink")}
            </Link>
          </p>
        </CardBody>
      </Card>

      <Dialog open={editing} onClose={() => setEditing(false)} title={t("common.edit")}>
        {editing ? <SchemeForm scheme={scheme} onDone={() => setEditing(false)} /> : null}
      </Dialog>
      <ConfirmDialog
        open={confirmStatus}
        title={active ? t("backoffice.disableTitle") : t("backoffice.enableTitle")}
        body={active ? t("backoffice.disableBody") : t("backoffice.enableBody")}
        confirmLabel={active ? t("backoffice.disable") : t("backoffice.enable")}
        destructive={active}
        busy={status.isPending}
        onConfirm={() => {
          if (!status.isPending) status.mutate(undefined);
        }}
        onClose={() => setConfirmStatus(false)}
      />
      <ConfirmDialog
        open={confirmInvoices}
        title={t("backoffice.invoicesConfirm")}
        body={t("backoffice.invoicesBody")}
        confirmLabel={t("backoffice.invoicesRun")}
        busy={invoices.isPending}
        onConfirm={() => {
          if (!invoices.isPending) invoices.mutate(undefined);
        }}
        onClose={() => setConfirmInvoices(false)}
      />
    </div>
  );
}
