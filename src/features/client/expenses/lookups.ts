"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useI18n } from "@/i18n/provider";
import { financeApi } from "@/lib/api/finance/endpoints";
import { useScheme } from "../workspace/scheme-provider";

/** Category and supplier names for showing record rows. Cached for the whole session. */
export function useLookups() {
  const { schemeId } = useScheme();
  const { locale } = useI18n();
  const categories = useQuery({
    queryKey: ["scheme", schemeId, "lookups", "categories"],
    queryFn: ({ signal }) => financeApi.categories(schemeId, { signal }),
    staleTime: 10 * 60_000,
  });
  const suppliers = useQuery({
    queryKey: ["scheme", schemeId, "lookups", "suppliers"],
    queryFn: ({ signal }) => financeApi.suppliers(schemeId, { signal }),
    staleTime: 10 * 60_000,
  });
  return useMemo(() => {
    const cat = new Map(
      (categories.data ?? []).map((c) => [c.id, (locale === "fa" ? c.nameFa : c.nameEn) || c.name]),
    );
    const sup = new Map((suppliers.data ?? []).map((s) => [s.id, s.name]));
    return {
      categoryName: (id: string | null) => (id ? (cat.get(id) ?? null) : null),
      supplierName: (id: string | null) => (id ? (sup.get(id) ?? null) : null),
      categories: categories.data ?? [],
    };
  }, [categories.data, suppliers.data, locale]);
}
