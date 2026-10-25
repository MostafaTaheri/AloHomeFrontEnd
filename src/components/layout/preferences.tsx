"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setCurrencyUnitAction, setRegionAction } from "@/i18n/actions";
import { useI18n } from "@/i18n/provider";
import { REGIONS, type CurrencyUnit, type Region } from "@/lib/region/config";
import { cn } from "@/lib/utils";
import { LocaleSwitcher } from "./locale-switcher";

function Segmented<T extends string>({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  disabled?: boolean;
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex rounded-md border border-line p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          disabled={disabled}
          aria-pressed={option.value === value}
          onClick={() => option.value !== value && onChange(option.value)}
          className={cn(
            "rounded px-2.5 py-1 text-xs font-medium transition-colors",
            option.value === value ? "bg-brand text-brand-fg" : "text-muted hover:text-fg",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** Market switch (Iran / Australia). Used outside a scheme, where there is no jurisdiction to follow. */
export function RegionSwitcher() {
  const { region, t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Segmented<Region>
      label={t("preferences.region")}
      value={region}
      disabled={pending}
      options={REGIONS.map((r) => ({ value: r, label: t(`preferences.${r}`) }))}
      onChange={(next) =>
        startTransition(async () => {
          await setRegionAction(next);
          router.refresh();
        })
      }
    />
  );
}

/** Rial / toman display switch. Only meaningful in the Iran market. */
export function CurrencyUnitSwitcher() {
  const { region, currencyUnit, t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  if (region !== "ir") return null;
  return (
    <Segmented<CurrencyUnit>
      label={t("preferences.currencyUnit")}
      value={currencyUnit}
      disabled={pending}
      options={[
        { value: "rial", label: t("preferences.rial") },
        { value: "toman", label: t("preferences.toman") },
      ]}
      onChange={(next) =>
        startTransition(async () => {
          await setCurrencyUnitAction(next);
          router.refresh();
        })
      }
    />
  );
}

/** Language plus market plus currency unit, for headers and login pages. */
export function PreferenceBar({ withRegion = true }: { withRegion?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <LocaleSwitcher />
      {withRegion ? <RegionSwitcher /> : null}
      {withRegion ? <CurrencyUnitSwitcher /> : null}
    </div>
  );
}
