"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { SeriesChart } from "@/components/charts/series-chart";
import { MoneyInput } from "@/components/forms/money-input";
import { Definition } from "@/components/finance/freshness";
import { Money } from "@/components/finance/money";
import { StatBox, StatGrid } from "@/components/finance/stat";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { EmptyState, ErrorState, InlineAlert, ListSkeleton } from "@/components/ui/states";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useI18n } from "@/i18n/provider";
import { describeError } from "@/lib/api/error";
import { capitalWorksApi } from "@/lib/api/finance/endpoints";
import type { FundingProjection, FundingScenario } from "@/lib/api/finance/types";
import { qk } from "@/lib/api/keys";
import { amountToInput, parseAmountInput } from "@/lib/format/amount";
import { useSchemeMutation } from "../use-scheme-mutation";
import { useScheme } from "../workspace/scheme-provider";
import { parseHorizon, parsePercent, parseYear, yearBounds } from "./parse";

export function ScenariosTab() {
  const { t, fmt } = useI18n();
  const { schemeId, canWrite } = useScheme();
  const [editing, setEditing] = useState<FundingScenario | "new" | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);

  const query = useQuery({
    queryKey: qk.scenarios(schemeId),
    queryFn: ({ signal }) => capitalWorksApi.scenarios(schemeId, { signal }),
  });

  const activeId =
    selected ?? query.data?.find((s) => s.isBaseline)?.id ?? query.data?.[0]?.id ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t("capital.scenariosTitle")}</h2>
          <p className="text-sm text-muted">{t("capital.scenariosBody")}</p>
        </div>
        {canWrite ? (
          <Button onClick={() => setEditing("new")}>{t("capital.newScenario")}</Button>
        ) : null}
      </div>

      {query.isPending ? <ListSkeleton rows={3} /> : null}
      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : null}
      {query.data && query.data.length === 0 ? (
        <EmptyState
          title={t("capital.scenariosEmptyTitle")}
          body={t("capital.scenariosEmptyBody")}
        />
      ) : null}

      {query.data && query.data.length > 0 ? (
        <>
          <Card>
            <Table>
              <THead>
                <TR>
                  <TH>
                    <span className="sr-only">{t("capital.compareTitle")}</span>
                  </TH>
                  <TH>{t("capital.scenarioName")}</TH>
                  <TH>{t("capital.scenarioContribution")}</TH>
                  <TH>{t("capital.scenarioHorizon")}</TH>
                  <TH>
                    <span className="sr-only">{t("common.actions")}</span>
                  </TH>
                </TR>
              </THead>
              <TBody>
                {query.data.map((s) => (
                  <TR key={s.id}>
                    <TD>
                      <input
                        type="checkbox"
                        aria-label={`${t("capital.compareTitle")}: ${s.name}`}
                        checked={compareIds.includes(s.id)}
                        onChange={(e) =>
                          setCompareIds((ids) =>
                            e.target.checked ? [...ids, s.id] : ids.filter((id) => id !== s.id),
                          )
                        }
                      />
                    </TD>
                    <TD className="font-medium">
                      {s.name}{" "}
                      {s.isBaseline ? <Badge tone="ok">{t("capital.baseline")}</Badge> : null}
                    </TD>
                    <TD>
                      <Money amount={s.annualContribution} currency={s.currency} whole />
                    </TD>
                    <TD>{fmt.integer(s.horizonYears)}</TD>
                    <TD>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant={activeId === s.id ? "primary" : "secondary"}
                          aria-pressed={activeId === s.id}
                          onClick={() => setSelected(s.id)}
                        >
                          {t("capital.view")}
                        </Button>
                        {canWrite ? (
                          <Button size="sm" variant="secondary" onClick={() => setEditing(s)}>
                            {t("capital.editScenario")}
                          </Button>
                        ) : null}
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </Card>

          {activeId ? <GapCard scenarioId={activeId} /> : null}
          <CompareCard ids={compareIds} scenarios={query.data} />
        </>
      ) : null}

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? t("capital.newScenario") : t("capital.editScenario")}
        className="max-w-xl"
      >
        {editing !== null ? (
          <ScenarioForm
            key={editing === "new" ? "new" : editing.id}
            target={editing}
            onClose={() => setEditing(null)}
          />
        ) : null}
      </Dialog>
    </div>
  );
}

function GapCard({ scenarioId }: { scenarioId: string }) {
  const { t, fmt } = useI18n();
  const { schemeId } = useScheme();
  const query = useQuery({
    queryKey: qk.fundingGap(schemeId, scenarioId),
    queryFn: ({ signal }) => capitalWorksApi.fundingGap(schemeId, scenarioId, { signal }),
  });

  if (query.isPending) return <ListSkeleton rows={4} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const p = query.data;
  const cur = p.scenario.currency;

  return (
    <Card>
      <CardHeader title={t("capital.gapTitle", { name: p.scenario.name })} />
      <CardBody className="space-y-4">
        <InlineAlert tone="warn">
          <strong className="block">{t("capital.disclaimerTitle")}</strong>
          {p.disclaimer}
        </InlineAlert>
        <StatGrid>
          <StatBox
            label={t("capital.totalContributions")}
            value={<Money amount={p.totalContributions} currency={cur} whole />}
          />
          <StatBox
            label={t("capital.totalCost")}
            value={<Money amount={p.totalPlannedCost} currency={cur} whole />}
          />
          <StatBox
            label={t("capital.gapEnding")}
            value={<Money amount={p.endingBalance} currency={cur} whole tone="balance" />}
          />
          <StatBox
            label={t("capital.colShortfall")}
            tone={p.hasShortfall ? "danger" : "ok"}
            value={
              p.hasShortfall ? (
                <Money amount={p.maximumShortfall} currency={cur} whole />
              ) : (
                t("capital.gapNone")
              )
            }
            hint={
              p.firstShortfallYear !== null
                ? t("capital.gapFirst", { year: fmt.fiscalYear(p.firstShortfallYear) })
                : undefined
            }
          />
        </StatGrid>
        <SeriesChart
          kind="line"
          title={t("capital.gapChart")}
          labels={p.years.map((y) => String(y.fiscalYear))}
          formatLabel={(l) => fmt.fiscalYear(Number(l))}
          series={[
            { name: t("capital.seriesClosing"), values: p.years.map((y) => y.closing) },
            { name: t("capital.seriesCost"), values: p.years.map((y) => y.plannedCost) },
          ]}
          formatValue={(v) => fmt.money(v, cur, { whole: true })}
        />
        <div className="overflow-x-auto">
          <Table>
            <THead>
              <TR>
                <TH>{t("capital.colYear")}</TH>
                <TH>{t("capital.colOpening")}</TH>
                <TH>{t("capital.colContribution")}</TH>
                <TH>{t("capital.colInterest")}</TH>
                <TH>{t("capital.colCost")}</TH>
                <TH>{t("capital.colClosing")}</TH>
                <TH>{t("capital.colShortfall")}</TH>
              </TR>
            </THead>
            <TBody>
              {p.years.map((y) => (
                <TR key={y.fiscalYear}>
                  <TD>{fmt.fiscalYear(y.fiscalYear)}</TD>
                  <TD>
                    <Money amount={y.opening} currency={cur} whole />
                  </TD>
                  <TD>
                    <Money amount={y.contribution} currency={cur} whole />
                  </TD>
                  <TD>
                    <Money amount={y.interest} currency={cur} whole />
                  </TD>
                  <TD>
                    <Money amount={y.plannedCost} currency={cur} whole />
                  </TD>
                  <TD>
                    <Money amount={y.closing} currency={cur} whole tone="balance" />
                  </TD>
                  <TD className={y.shortfall > 0 ? "font-medium text-danger" : undefined}>
                    {y.shortfall > 0 ? (
                      <Money amount={y.shortfall} currency={cur} whole />
                    ) : (
                      t("common.none")
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
        <Definition text={p.definition} />
      </CardBody>
    </Card>
  );
}

function CompareCard({ ids, scenarios }: { ids: string[]; scenarios: FundingScenario[] }) {
  const { t, fmt } = useI18n();
  const { schemeId } = useScheme();
  const [requested, setRequested] = useState<string[] | null>(null);

  const query = useQuery({
    queryKey: qk.compare(schemeId, requested ?? []),
    queryFn: () => capitalWorksApi.compare(schemeId, requested ?? []),
    enabled: requested !== null && requested.length >= 2,
  });

  const message =
    ids.length < 2 ? t("capital.compareNeed") : ids.length > 4 ? t("capital.compareMax") : null;

  return (
    <Card>
      <CardHeader
        title={t("capital.compareTitle")}
        description={t("capital.compareHint")}
        actions={
          <Button
            variant="secondary"
            size="sm"
            disabled={message !== null}
            onClick={() => setRequested([...ids])}
          >
            {t("capital.compareRun")}
          </Button>
        }
      />
      <CardBody className="space-y-3">
        {message ? <p className="text-sm text-muted">{message}</p> : null}
        {query.isFetching ? <ListSkeleton rows={2} /> : null}
        {query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : null}
        {query.data && !query.isFetching ? (
          <>
            <div className="overflow-x-auto">
              <Table>
                <THead>
                  <TR>
                    <TH>{t("capital.colScenario")}</TH>
                    <TH>{t("capital.scenarioContribution")}</TH>
                    <TH>{t("capital.colEnding")}</TH>
                    <TH>{t("capital.colFirstShortfall")}</TH>
                    <TH>{t("capital.colMaxShortfall")}</TH>
                  </TR>
                </THead>
                <TBody>
                  {query.data.scenarios.map((p: FundingProjection) => (
                    <TR key={p.scenario.id}>
                      <TD className="font-medium">{p.scenario.name}</TD>
                      <TD>
                        <Money
                          amount={p.scenario.annualContribution}
                          currency={query.data.currency}
                          whole
                        />
                      </TD>
                      <TD>
                        <Money
                          amount={p.endingBalance}
                          currency={query.data.currency}
                          whole
                          tone="balance"
                        />
                      </TD>
                      <TD>
                        {p.firstShortfallYear === null
                          ? t("capital.gapNone")
                          : fmt.fiscalYear(p.firstShortfallYear)}
                      </TD>
                      <TD>
                        {p.hasShortfall ? (
                          <Money amount={p.maximumShortfall} currency={query.data.currency} whole />
                        ) : (
                          t("common.none")
                        )}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
            <p className="text-sm">
              {query.data.lowestContributionWithoutShortfallId
                ? `${t("capital.compareLowest")}: ${scenarios.find((s) => s.id === query.data.lowestContributionWithoutShortfallId)?.name ?? t("common.none")}`
                : t("capital.compareNoneAvoid")}
            </p>
            <p className="text-xs text-muted">{query.data.disclaimer}</p>
          </>
        ) : null}
      </CardBody>
    </Card>
  );
}

function ScenarioForm({
  target,
  onClose,
}: {
  target: FundingScenario | "new";
  onClose: () => void;
}) {
  const { t, fmt, currencyUnit } = useI18n();
  const { schemeId, currency } = useScheme();
  const bounds = yearBounds(fmt.context.calendar);
  const existing = target === "new" ? null : target;
  const unitText = (n: number) => amountToInput(n, currency, currencyUnit);

  const [name, setName] = useState(existing?.name ?? "");
  const [opening, setOpening] = useState(existing ? unitText(existing.openingBalance) : "");
  const [contribution, setContribution] = useState(
    existing ? unitText(existing.annualContribution) : "",
  );
  const [growth, setGrowth] = useState(String(existing?.contributionGrowthPercent ?? 0));
  const [interest, setInterest] = useState(String(existing?.interestPercent ?? 0));
  const [escalation, setEscalation] = useState(String(existing?.costEscalationPercent ?? 0));
  const [start, setStart] = useState(existing ? String(existing.startFiscalYear) : "");
  const [horizon, setHorizon] = useState(String(existing?.horizonYears ?? 10));
  const [baseline, setBaseline] = useState(existing?.isBaseline ?? false);
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [touched, setTouched] = useState(false);

  const contributionP = parseAmountInput(contribution, {
    currency,
    unit: currencyUnit,
    allowZero: true,
  });
  const openingP = opening.trim()
    ? parseAmountInput(opening, {
        currency,
        unit: currencyUnit,
        allowZero: true,
        allowNegative: true,
      })
    : null;
  const startYear = start.trim() ? parseYear(start, bounds) : null;
  const g = parsePercent(growth);
  const i = parsePercent(interest);
  const e = parsePercent(escalation);
  const h = parseHorizon(horizon);

  const valid =
    name.trim() !== "" &&
    contributionP.ok &&
    (openingP === null || openingP.ok) &&
    (!start.trim() || startYear !== null) &&
    g !== null &&
    i !== null &&
    e !== null &&
    h !== null;

  const save = useSchemeMutation({
    mutationFn: async () => {
      const base = {
        name: name.trim(),
        annualContribution: contributionP.ok ? contributionP.value : 0,
        contributionGrowthPercent: g ?? 0,
        interestPercent: i ?? 0,
        costEscalationPercent: e ?? 0,
        horizonYears: h ?? 10,
        isBaseline: baseline,
        notes: notes.trim(),
      };
      if (existing) {
        // The update endpoint needs a concrete opening balance and start year.
        return capitalWorksApi.updateScenario(schemeId, existing.id, {
          ...base,
          openingBalance: openingP?.ok ? openingP.value : existing.openingBalance,
          startFiscalYear: startYear ?? existing.startFiscalYear,
        });
      }
      return capitalWorksApi.createScenario(schemeId, {
        ...base,
        openingBalance: openingP?.ok ? openingP.value : null,
        startFiscalYear: startYear,
      });
    },
    invalidate: [qk.capital(schemeId), ["scheme", schemeId, "health"]],
    success: existing ? "capital.scenarioUpdated" : "capital.scenarioCreated",
    silentError: true,
    onSuccess: onClose,
  });

  const err = (bad: boolean, message: string) => (touched && bad ? message : undefined);
  const pct = t("capital.scenarioPercentInvalid");

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(ev) => {
        ev.preventDefault();
        setTouched(true);
        if (!valid || save.isPending) return;
        save.mutate(undefined);
      }}
    >
      <Field
        id="sc-name"
        label={t("capital.scenarioName")}
        error={err(!name.trim(), t("capital.scenarioNameRequired"))}
      >
        <Input
          id="sc-name"
          maxLength={120}
          value={name}
          invalid={touched && !name.trim()}
          onChange={(x) => setName(x.target.value)}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="sc-opening"
          label={t("capital.scenarioOpening")}
          hint={t("capital.scenarioOpeningHint")}
          optional={t("common.optional")}
          error={err(openingP !== null && !openingP.ok, t("capital.amountInvalid"))}
        >
          <MoneyInput id="sc-opening" currency={currency} value={opening} onChange={setOpening} />
        </Field>
        <Field
          id="sc-contribution"
          label={t("capital.scenarioContribution")}
          error={err(!contributionP.ok, t("capital.amountInvalid"))}
        >
          <MoneyInput
            id="sc-contribution"
            currency={currency}
            value={contribution}
            onChange={setContribution}
            invalid={touched && !contributionP.ok}
          />
        </Field>
        <Field id="sc-growth" label={t("capital.scenarioGrowth")} error={err(g === null, pct)}>
          <Input
            id="sc-growth"
            dir="ltr"
            inputMode="decimal"
            value={growth}
            invalid={touched && g === null}
            onChange={(x) => setGrowth(x.target.value)}
          />
        </Field>
        <Field id="sc-interest" label={t("capital.scenarioInterest")} error={err(i === null, pct)}>
          <Input
            id="sc-interest"
            dir="ltr"
            inputMode="decimal"
            value={interest}
            invalid={touched && i === null}
            onChange={(x) => setInterest(x.target.value)}
          />
        </Field>
        <Field
          id="sc-escalation"
          label={t("capital.scenarioEscalation")}
          error={err(e === null, pct)}
        >
          <Input
            id="sc-escalation"
            dir="ltr"
            inputMode="decimal"
            value={escalation}
            invalid={touched && e === null}
            onChange={(x) => setEscalation(x.target.value)}
          />
        </Field>
        <Field
          id="sc-horizon"
          label={t("capital.scenarioHorizon")}
          error={err(h === null, t("capital.scenarioHorizonInvalid"))}
        >
          <Input
            id="sc-horizon"
            dir="ltr"
            inputMode="numeric"
            value={horizon}
            invalid={touched && h === null}
            onChange={(x) => setHorizon(x.target.value)}
          />
        </Field>
        <Field
          id="sc-start"
          label={t("capital.scenarioStart")}
          hint={t("capital.scenarioStartHint")}
          optional={t("common.optional")}
          error={err(
            Boolean(start.trim()) && startYear === null,
            t("capital.itemYearInvalid", {
              min: fmt.integer(bounds.min),
              max: fmt.integer(bounds.max),
            }),
          )}
        >
          <Input
            id="sc-start"
            dir="ltr"
            inputMode="numeric"
            value={start}
            onChange={(x) => setStart(x.target.value)}
          />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={baseline} onChange={(x) => setBaseline(x.target.checked)} />
        {t("capital.scenarioBaseline")}
      </label>
      <Field id="sc-notes" label={t("capital.scenarioNotes")} optional={t("common.optional")}>
        <textarea
          id="sc-notes"
          rows={2}
          maxLength={1000}
          value={notes}
          onChange={(x) => setNotes(x.target.value)}
          className="block w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-fg"
        />
      </Field>
      {save.isError ? (
        <InlineAlert tone="danger">{describeError(save.error, t)}</InlineAlert>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" loading={save.isPending}>
          {t("capital.scenarioSave")}
        </Button>
      </div>
    </form>
  );
}
