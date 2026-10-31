"use client";

import { useQuery } from "@tanstack/react-query";
import { productApi } from "@/lib/api/governance";
import { qk } from "@/lib/api/keys";

/**
 * The product catalogue changes only with a release, so it is fetched once per session and
 * never retried aggressively. Screens treat a failed load as "everything in scope".
 */
export function useGovernance() {
  return useQuery({
    queryKey: qk.governance,
    queryFn: ({ signal }) => productApi.governance({ signal }),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
  });
}
