"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, Select } from "@/components/ui/field";
import { InlineAlert } from "@/components/ui/states";
import { useI18n } from "@/i18n/provider";
import { describeError } from "@/lib/api/error";
import { backofficeApi, type SeedDemoResult } from "@/lib/api/backoffice";
import { qk } from "@/lib/api/keys";
import { REGION_PROFILES, REGIONS, type Region } from "@/lib/region/config";
import { usePageView } from "@/lib/telemetry/client";
import { useBoMutation } from "../use-bo-mutation";

export function OverviewPage() {
  const { t, fmt } = useI18n();
  usePageView("backoffice", "overview");

  const schemes = useQuery({
    queryKey: qk.bo.schemes({ page: 1, pageSize: 1 }),
    queryFn: ({ signal }) => backofficeApi.schemes({ page: 1, pageSize: 1 }, signal),
  });

  const cards = [
    {
      href: "/backoffice/schemes",
      title: t("backoffice.cardSchemes"),
      body: schemes.data
        ? t("backoffice.cardSchemesBody", { count: fmt.integer(schemes.data.totalCount) })
        : t("common.loading"),
    },
    {
      href: "/backoffice/users",
      title: t("backoffice.cardUsers"),
      body: t("backoffice.cardUsersBody"),
    },
    {
      href: "/backoffice/access-log",
      title: t("backoffice.cardAudit"),
      body: t("backoffice.cardAuditBody"),
    },
    {
      href: "/backoffice/pilot",
      title: t("backoffice.cardPilot"),
      body: t("backoffice.cardPilotBody"),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("backoffice.overviewTitle")}
        description={t("backoffice.overviewSubtitle")}
      />
      <InlineAlert tone="warn">{t("backoffice.staffOnly")}</InlineAlert>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <li key={c.href}>
            <Link
              href={c.href}
              className="block h-full rounded-lg border border-line bg-surface p-4 hover:border-brand"
            >
              <h2 className="font-semibold">{c.title}</h2>
              <p className="mt-1 text-sm text-muted">{c.body}</p>
              <span className="mt-3 inline-block text-sm text-brand">{t("backoffice.open")}</span>
            </Link>
          </li>
        ))}
      </ul>
      <DemoCard />
    </div>
  );
}

function DemoCard() {
  const { t } = useI18n();
  const [region, setRegion] = useState<Region>("au");
  const [confirm, setConfirm] = useState(false);
  const [result, setResult] = useState<SeedDemoResult | null>(null);

  const seed = useBoMutation({
    mutationFn: () =>
      backofficeApi.seedDemo(REGION_PROFILES[region].jurisdictionCode === "AU" ? "AU-NSW" : "IR"),
    invalidate: [["bo", "schemes"]],
    success: "backoffice.demoDone",
    silentError: true,
    onSuccess: (data) => {
      setResult(data);
      setConfirm(false);
    },
  });

  return (
    <Card>
      <CardHeader title={t("backoffice.demoTitle")} description={t("backoffice.demoBody")} />
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-56">
            <Field id="demo-market" label={t("backoffice.demoJurisdiction")}>
              <Select
                id="demo-market"
                value={region}
                onChange={(e) => setRegion(e.target.value as Region)}
              >
                {REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {t(`preferences.${r}`)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Button variant="secondary" loading={seed.isPending} onClick={() => setConfirm(true)}>
            {seed.isPending ? t("backoffice.demoRunning") : t("backoffice.demoRun")}
          </Button>
        </div>
        {seed.isError ? (
          <InlineAlert tone="danger">{describeError(seed.error, t)}</InlineAlert>
        ) : null}
        {result ? (
          <InlineAlert tone="ok">
            {t("backoffice.demoResult", {
              title: result.title,
              lots: result.lots,
              records: result.financialRecords,
              works: result.capitalWorkItems,
              flags: result.expenseFlags,
            })}{" "}
            <Link href={`/backoffice/schemes/${result.schemeId}`} className="underline">
              {t("backoffice.demoOpen")}
            </Link>
          </InlineAlert>
        ) : null}
      </CardBody>
      <ConfirmDialog
        open={confirm}
        title={t("backoffice.demoConfirmTitle")}
        body={t("backoffice.demoConfirmBody", { market: t(`preferences.${region}`) })}
        confirmLabel={t("backoffice.demoRun")}
        busy={seed.isPending}
        onConfirm={() => {
          if (!seed.isPending) seed.mutate(undefined);
        }}
        onClose={() => setConfirm(false)}
      />
    </Card>
  );
}
