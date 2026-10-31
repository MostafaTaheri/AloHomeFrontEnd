"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, Select } from "@/components/ui/field";
import { InlineAlert } from "@/components/ui/states";
import { useI18n } from "@/i18n/provider";
import { describeError } from "@/lib/api/error";
import { boReadinessApi, screenForEndpoint, type InvestorFlow } from "@/lib/api/readiness";
import { track } from "@/lib/telemetry/client";
import { useBoMutation } from "../use-bo-mutation";

/**
 * Investor demo (GTM-10): seeds a synthetic scheme and lists the walkthrough steps, each linked
 * to the screen that shows it. Uses synthetic data only.
 */
export function InvestorFlowCard() {
  const { t } = useI18n();
  const [market, setMarket] = useState<"AU-NSW" | "IR">("AU-NSW");
  const [confirm, setConfirm] = useState(false);
  const [flow, setFlow] = useState<InvestorFlow | null>(null);

  const seed = useBoMutation({
    mutationFn: () => boReadinessApi.investorFlow(market),
    invalidate: [["bo", "schemes"]],
    success: "investor.done",
    silentError: true,
    onSuccess: (result) => {
      track("investor_flow_seeded", { kind: market });
      setFlow(result);
      setConfirm(false);
    },
  });

  return (
    <Card>
      <CardHeader title={t("investor.title")} description={t("investor.subtitle")} />
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-48">
            <Field id="investor-market" label={t("backoffice.demoJurisdiction")}>
              <Select
                id="investor-market"
                value={market}
                onChange={(e) => setMarket(e.target.value as "AU-NSW" | "IR")}
              >
                <option value="AU-NSW">{t("preferences.au")}</option>
                <option value="IR">{t("preferences.ir")}</option>
              </Select>
            </Field>
          </div>
          <Button variant="secondary" loading={seed.isPending} onClick={() => setConfirm(true)}>
            {t("investor.run")}
          </Button>
        </div>
        {seed.isError ? (
          <InlineAlert tone="danger">{describeError(seed.error, t)}</InlineAlert>
        ) : null}
        {flow ? (
          <ol className="space-y-2">
            {flow.steps
              .slice()
              .sort((a, b) => a.order - b.order)
              .map((step) => {
                const screen = screenForEndpoint(step.endpoint);
                return (
                  <li key={step.order} className="rounded-md border border-line px-3 py-2 text-sm">
                    <span className="font-medium">
                      {step.order}. {step.title}
                    </span>
                    <span className="block text-muted" dir="auto">
                      {step.highlight}
                    </span>
                    {screen ? (
                      <Link
                        href={screen}
                        className="text-brand hover:underline"
                        target="_blank"
                        rel="noopener"
                      >
                        {t("investor.openScreen")}
                      </Link>
                    ) : null}
                  </li>
                );
              })}
          </ol>
        ) : null}
        {flow ? <p className="text-xs text-muted">{t("investor.clientNote")}</p> : null}
      </CardBody>
      <ConfirmDialog
        open={confirm}
        title={t("investor.confirmTitle")}
        body={t("investor.confirmBody")}
        confirmLabel={t("investor.run")}
        busy={seed.isPending}
        onConfirm={() => {
          if (!seed.isPending) seed.mutate(undefined);
        }}
        onClose={() => setConfirm(false)}
      />
    </Card>
  );
}
