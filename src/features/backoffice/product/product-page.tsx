"use client";

import { EnumBadge } from "@/components/finance/enum-badge";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/card";
import { ErrorState, ListSkeleton } from "@/components/ui/states";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useI18n } from "@/i18n/provider";
import { featureStatusName } from "@/lib/api/governance";
import { useGovernance } from "@/lib/query/use-governance";
import { usePageView } from "@/lib/telemetry/client";

/** The product catalogue (GOV-01..04): narrative, feature decisions and pilot scope. */
export function ProductPage() {
  const { t, fmt, locale } = useI18n();
  usePageView("backoffice", "product");
  const query = useGovernance();

  if (query.isPending) return <ListSkeleton rows={5} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const g = query.data;

  const list = (title: string, items: string[]) => (
    <div>
      <h3 className="text-xs font-medium text-muted">{title}</h3>
      <ul className="mt-1 list-disc space-y-0.5 ps-5 text-sm">
        {items.map((item) => (
          <li key={item} dir="auto">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("product.title")}
        description={t("product.subtitle")}
        actions={
          <span className="text-sm text-muted">{t("product.version", { version: g.version })}</span>
        }
      />
      <Card>
        <CardHeader title={t("product.narrative")} />
        <CardBody className="space-y-4">
          <p className="text-base" dir="auto">
            {locale === "fa" && g.narrative.statementFa
              ? g.narrative.statementFa
              : g.narrative.statement}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {list(t("product.questions"), g.narrative.questions)}
            {list(t("product.boundaries"), g.narrative.boundaries)}
          </div>
          <p className="text-xs text-muted">
            {t("product.checksum")}:{" "}
            <code dir="ltr" className="break-all">
              {g.checksum}
            </code>
          </p>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title={t("product.features")} />
        <Table>
          <THead>
            <TR>
              <TH>{t("product.feature")}</TH>
              <TH>{t("product.decision")}</TH>
              <TH>{t("product.reason")}</TH>
              <TH>{t("product.stories")}</TH>
              <TH>{t("product.decidedOn")}</TH>
            </TR>
          </THead>
          <TBody>
            {g.features.map((f) => (
              <TR key={f.key}>
                <TD>
                  <span className="font-medium">{f.name}</span>
                  <span className="block font-mono text-xs text-muted" dir="ltr">
                    {f.key}
                  </span>
                </TD>
                <TD>
                  <EnumBadge group="featureStatus" value={featureStatusName(f.status)} />
                </TD>
                <TD dir="auto">{f.reason}</TD>
                <TD dir="ltr" className="text-xs">
                  {f.stories.length ? f.stories.join(", ") : t("common.none")}
                </TD>
                <TD>{fmt.date(f.decidedOn)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
      <Card>
        <CardHeader title={t("product.pilot")} />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <div>
            <h3 className="text-xs font-medium text-muted">{t("product.lots")}</h3>
            <p className="text-sm">
              {t("product.lotRange", {
                min: fmt.integer(g.pilot.minimumLots),
                max: fmt.integer(g.pilot.maximumLots),
              })}
            </p>
          </div>
          {list(t("product.jurisdictions"), g.pilot.jurisdictions)}
          {list(t("product.modules"), g.pilot.modules)}
          {list(t("product.dataRules"), g.pilot.dataRules)}
          {list(t("product.successCriteria"), g.pilot.successCriteria)}
          {list(t("product.exitConditions"), g.pilot.exitConditions)}
        </CardBody>
      </Card>
    </div>
  );
}
