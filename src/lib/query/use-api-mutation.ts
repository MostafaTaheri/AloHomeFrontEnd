"use client";

import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/provider";
import type { MessageKey } from "@/i18n/translator";
import { describeError } from "@/lib/api/error";

/**
 * Mutation wrapper used by every write (client app and back office): invalidates the data the write
 * affects, confirms success with a toast, and reports failures in the person's language.
 */
export function useApiMutation<TVars, TData>({
  mutationFn,
  invalidate,
  success,
  onSuccess,
  silentError = false,
}: {
  mutationFn: (vars: TVars) => Promise<TData>;
  invalidate?: QueryKey[];
  success?: MessageKey;
  onSuccess?: (data: TData, vars: TVars) => void;
  /** Let the caller show the error itself (inside a dialog, say). */
  silentError?: boolean;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { t } = useI18n();

  return useMutation<TData, unknown, TVars>({
    mutationFn,
    onSuccess: (data, vars) => {
      for (const key of invalidate ?? []) void queryClient.invalidateQueries({ queryKey: key });
      if (success) toast.success(t(success));
      onSuccess?.(data, vars);
    },
    onError: (error) => {
      if (!silentError) toast.error(describeError(error, t));
    },
  });
}
