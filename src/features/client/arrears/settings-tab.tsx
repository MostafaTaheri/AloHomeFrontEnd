"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { ErrorState, InlineAlert, ListSkeleton } from "@/components/ui/states";
import { useI18n } from "@/i18n/provider";
import { arrearsApi } from "@/lib/api/finance/endpoints";
import type { AgeingSettings } from "@/lib/api/finance/types";
import { qk } from "@/lib/api/keys";
import { normalizeNumeric } from "@/lib/format/amount";
import { useSchemeMutation } from "../use-scheme-mutation";
import { useScheme } from "../workspace/scheme-provider";
import { parseBoundaries, parseTopN } from "./settings-parse";

export function SettingsTab() {
  const { schemeId } = useScheme();
  const query = useQuery({
    queryKey: qk.arrearsSettings(schemeId),
    queryFn: ({ signal }) => arrearsApi.settings(schemeId, { signal }),
  });
  if (query.isPending) return <ListSkeleton rows={3} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  return <SettingsForm settings={query.data} />;
}

function SettingsForm({ settings }: { settings: AgeingSettings }) {
  const { t, fmt } = useI18n();
  const { schemeId, canWrite } = useScheme();
  const [boundaries, setBoundaries] = useState(settings.bucketBoundaries.join(", "));
  const [topN, setTopN] = useState(String(settings.concentrationTopN));
  const [touched, setTouched] = useState(false);

  const save = useSchemeMutation({
    mutationFn: (value: { bucketBoundaries: number[]; concentrationTopN: number }) =>
      arrearsApi.saveSettings(schemeId, value),
    invalidate: [qk.arrears(schemeId)],
    success: "arrears.settingsSaved",
  });

  const parsedBoundaries = parseBoundaries(normalizeNumeric(boundaries));
  const parsedTop = parseTopN(normalizeNumeric(topN));

  return (
    <Card>
      <CardHeader title={t("arrears.settingsTitle")} description={t("arrears.settingsBody")} />
      <CardBody className="space-y-4">
        {!canWrite ? <InlineAlert tone="warn">{t("arrears.readOnly")}</InlineAlert> : null}
        <p className="text-sm text-muted">
          {t("arrears.currentBuckets", { labels: settings.bucketLabels.join(" · ") })}
        </p>
        <form
          className="grid max-w-xl gap-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            setTouched(true);
            if (save.isPending || !parsedBoundaries || parsedTop === null) return;
            save.mutate({ bucketBoundaries: parsedBoundaries, concentrationTopN: parsedTop });
          }}
        >
          <Field
            id="ageing-boundaries"
            label={t("arrears.boundaries")}
            hint={t("arrears.boundariesHint")}
            error={touched && !parsedBoundaries ? t("arrears.boundariesInvalid") : undefined}
          >
            <Input
              id="ageing-boundaries"
              dir="ltr"
              inputMode="numeric"
              value={boundaries}
              disabled={!canWrite}
              invalid={touched && !parsedBoundaries}
              onChange={(e) => setBoundaries(e.target.value)}
            />
          </Field>
          <Field
            id="ageing-topn"
            label={t("arrears.topN")}
            hint={t("arrears.topNHint")}
            error={touched && parsedTop === null ? t("arrears.topNInvalid") : undefined}
          >
            <Input
              id="ageing-topn"
              dir="ltr"
              inputMode="numeric"
              value={topN}
              disabled={!canWrite}
              invalid={touched && parsedTop === null}
              onChange={(e) => setTopN(e.target.value)}
            />
          </Field>
          {canWrite ? (
            <div>
              <Button type="submit" loading={save.isPending}>
                {t("arrears.settingsSave")}
              </Button>
            </div>
          ) : null}
        </form>
        <span className="sr-only">{fmt.integer(settings.concentrationTopN)}</span>
      </CardBody>
    </Card>
  );
}
