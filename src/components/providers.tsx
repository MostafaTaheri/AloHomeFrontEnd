"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import type { Locale } from "@/i18n/config";
import type { CurrencyUnit, Region } from "@/lib/region/config";
import { I18nProvider } from "@/i18n/provider";
import { ApiError, isRetryable } from "@/lib/api/error";
import { ToastProvider } from "./ui/toast";

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // Only transient failures are worth retrying; a 4xx will not fix itself.
        retry: (failureCount, error) =>
          failureCount < 2 &&
          isRetryable(error) &&
          !(error instanceof ApiError && error.status === 0 && failureCount >= 1),
      },
      mutations: { retry: false },
    },
  });
}

export function Providers({
  locale,
  region,
  currencyUnit,
  children,
}: {
  locale: Locale;
  region: Region;
  currencyUnit: CurrencyUnit;
  children: ReactNode;
}) {
  const [queryClient] = useState(makeQueryClient);
  return (
    <I18nProvider locale={locale} region={region} currencyUnit={currencyUnit}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>{children}</ToastProvider>
      </QueryClientProvider>
    </I18nProvider>
  );
}
