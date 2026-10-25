"use client";

import { useMemo } from "react";
import { Input, Select } from "@/components/ui/field";
import { useI18n } from "@/i18n/provider";
import {
  calendarParts,
  daysInMonth,
  firstOfMonth,
  fromCalendarParts,
  todayIso,
} from "@/lib/region/dates";
import { toGregorian } from "@/lib/region/jalali";
import { cn } from "@/lib/utils";

/**
 * Calendar-aware date input. Value in and out is always a Gregorian date-only ISO string
 * ("2026-03-31"), which is what the API stores. In the Iran market the person picks a Solar
 * Hijri year, month and day from selects; in Australia a native date input is used.
 */
export function DateField({
  id,
  value,
  onChange,
  invalid,
  disabled,
  className,
  "aria-describedby": describedBy,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
  "aria-describedby"?: string;
}) {
  const { fmt, t } = useI18n();
  const calendar = fmt.context.calendar;

  if (calendar === "gregory") {
    return (
      <Input
        id={id}
        type="date"
        dir="ltr"
        className={cn("text-start", className)}
        value={value}
        invalid={invalid}
        disabled={disabled}
        aria-describedby={describedBy}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  return (
    <Parts
      id={id}
      value={value}
      onChange={onChange}
      withDay
      invalid={invalid}
      disabled={disabled}
      className={className}
      label={t("common.date")}
    />
  );
}

/** Month picker. Emits the first day of the chosen month in the scheme's calendar. */
export function MonthField({
  id,
  value,
  onChange,
  invalid,
  disabled,
  className,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const { fmt, t } = useI18n();
  const calendar = fmt.context.calendar;

  if (calendar === "gregory") {
    return (
      <Input
        id={id}
        type="month"
        dir="ltr"
        className={cn("text-start", className)}
        value={value ? value.slice(0, 7) : ""}
        invalid={invalid}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value ? `${e.target.value}-01` : "")}
      />
    );
  }
  return (
    <Parts
      id={id}
      value={value}
      onChange={(v) => onChange(firstOfMonth(v, "persian") ?? v)}
      withDay={false}
      invalid={invalid}
      disabled={disabled}
      className={className}
      label={t("common.period")}
    />
  );
}

function Parts({
  id,
  value,
  onChange,
  withDay,
  invalid,
  disabled,
  className,
  label,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  withDay: boolean;
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
  label: string;
}) {
  const { fmt, t } = useI18n();
  const calendar = fmt.context.calendar;
  const today = todayIso(fmt.context.timeZone);
  const parts = calendarParts(value || today, calendar)!;
  const hasValue = Boolean(value);
  const nowYear = calendarParts(today, calendar)!.year;

  const monthNames = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const g = toGregorian(parts.year, i + 1, 15);
        return new Intl.DateTimeFormat(fmt.tag, { timeZone: "UTC", month: "long" }).format(
          new Date(Date.UTC(g.year, g.month - 1, g.day)),
        );
      }),
    [parts.year, fmt.tag],
  );

  const years = Array.from({ length: 21 }, (_, i) => nowYear - 15 + i);
  if (!years.includes(parts.year)) years.push(parts.year);
  years.sort((a, b) => a - b);
  const days = daysInMonth(parts.year, parts.month, calendar);

  function emit(next: Partial<typeof parts>) {
    onChange(
      fromCalendarParts(
        { ...parts, ...next, day: withDay ? (next.day ?? parts.day) : 1 },
        calendar,
      ),
    );
  }

  return (
    <div
      role="group"
      aria-label={label}
      className={cn("grid gap-2", withDay ? "grid-cols-3" : "grid-cols-2", className)}
    >
      {withDay ? (
        <Select
          id={`${id}-day`}
          aria-label={t("common.date")}
          disabled={disabled}
          invalid={invalid}
          value={hasValue ? parts.day : ""}
          onChange={(e) => emit({ day: Number(e.target.value) })}
        >
          {!hasValue ? <option value="">{t("common.selectPlaceholder")}</option> : null}
          {Array.from({ length: days }, (_, i) => i + 1).map((d) => (
            <option key={d} value={d}>
              {fmt.number(d, { useGrouping: false })}
            </option>
          ))}
        </Select>
      ) : null}
      <Select
        id={withDay ? `${id}-month` : id}
        aria-label={t("common.period")}
        disabled={disabled}
        invalid={invalid}
        value={hasValue ? parts.month : ""}
        onChange={(e) => emit({ month: Number(e.target.value) })}
      >
        {!hasValue ? <option value="">{t("common.selectPlaceholder")}</option> : null}
        {monthNames.map((name, i) => (
          <option key={name} value={i + 1}>
            {name}
          </option>
        ))}
      </Select>
      <Select
        id={`${id}-year`}
        aria-label={label}
        disabled={disabled}
        invalid={invalid}
        value={hasValue ? parts.year : ""}
        onChange={(e) => emit({ year: Number(e.target.value) })}
      >
        {!hasValue ? <option value="">{t("common.selectPlaceholder")}</option> : null}
        {years.map((y) => (
          <option key={y} value={y}>
            {fmt.number(y, { useGrouping: false })}
          </option>
        ))}
      </Select>
    </div>
  );
}
