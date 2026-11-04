"use client";

import { useMemo, useState } from "react";
import { Input, Select } from "@/components/ui/field";
import { useI18n } from "@/i18n/provider";
import { labelOf, SchemeRole } from "@/lib/api/finance/enums";
import { memberLabel, NOT_A_MEMBER, type MemberOption } from "@/lib/api/members";

export { NOT_A_MEMBER };

/** Above this many members, a filter box narrows the list. */
const FILTER_FROM = 8;

/**
 * Pick one of the building's active members. With `allowNotMember`, the last entry lets the
 * caller switch to a free name for someone without an account (owners and occupants only).
 */
export function MemberSelect({
  id,
  options,
  value,
  onChange,
  loading = false,
  invalid,
  hasHint,
  disabled,
  allowNotMember = false,
  exclude,
}: {
  id: string;
  options: MemberOption[] | undefined;
  value: string;
  onChange: (value: string) => void;
  loading?: boolean;
  invalid?: boolean;
  hasHint?: boolean;
  disabled?: boolean;
  allowNotMember?: boolean;
  /** Members already chosen elsewhere in the same form. */
  exclude?: readonly string[];
}) {
  const { t } = useI18n();
  const [filter, setFilter] = useState("");
  const all = useMemo(() => options ?? [], [options]);

  const visible = useMemo(() => {
    const needle = filter.trim().toLocaleLowerCase();
    return all.filter((o) => {
      if (o.userId === value) return true;
      if (exclude?.includes(o.userId)) return false;
      if (!needle) return true;
      return (
        o.displayName.toLocaleLowerCase().includes(needle) ||
        (o.phoneNumber ?? "").includes(needle.replace(/\s/g, ""))
      );
    });
  }, [all, filter, value, exclude]);

  const label = (o: MemberOption) =>
    [memberLabel(o), o.phoneNumber && o.phoneNumber !== o.displayName ? o.phoneNumber : null]
      .concat(labelOf("enums.schemeRole", o.role, t, SchemeRole))
      .filter(Boolean)
      .join(" · ");

  return (
    <div className="space-y-2">
      {all.length > FILTER_FROM ? (
        <Input
          id={`${id}-filter`}
          type="search"
          aria-label={t("members.pickFilter")}
          placeholder={t("members.pickFilter")}
          value={filter}
          disabled={disabled}
          onChange={(e) => setFilter(e.target.value)}
        />
      ) : null}
      <Select
        id={id}
        value={value}
        invalid={invalid}
        hasHint={hasHint}
        disabled={disabled || loading}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">
          {loading
            ? t("members.pickLoading")
            : all.length === 0
              ? t("members.pickEmpty")
              : t("members.pick")}
        </option>
        {visible.map((o) => (
          <option key={o.userId} value={o.userId}>
            {label(o)}
          </option>
        ))}
        {allowNotMember ? <option value={NOT_A_MEMBER}>{t("members.notMember")}</option> : null}
      </Select>
    </div>
  );
}
