"use client";

import { Input } from "@/components/ui/field";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";

/**
 * Text input for a money amount. The person types in the unit they see on screen (rial, toman or
 * dollars); parseAmountInput converts to the stored unit on submit. A suffix shows the unit.
 */
export function MoneyInput({
  id,
  currency,
  value,
  onChange,
  invalid,
  disabled,
  className,
  placeholder,
}: {
  id: string;
  currency: string;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}) {
  const { fmt } = useI18n();
  return (
    <div className="relative">
      <Input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        dir="ltr"
        className={cn("pe-16 text-start tabular-nums", className)}
        value={value}
        invalid={invalid}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-xs text-muted"
      >
        {fmt.currencyLabel(currency)}
      </span>
    </div>
  );
}
