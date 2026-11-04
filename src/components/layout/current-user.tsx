"use client";

import { useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/api/keys";
import { meApi } from "@/lib/api/users";
import type { Surface } from "@/lib/bff/surface";

/** Name and mobile of the signed-in user. Falls back to the session's mobile alone. */
export function CurrentUser({
  surface,
  phoneNumber,
}: {
  surface: Surface;
  phoneNumber: string | null;
}) {
  const me = useQuery({
    queryKey: qk.me(surface),
    queryFn: ({ signal }) => meApi.get(surface, signal),
    staleTime: 5 * 60_000,
    retry: false,
  });
  return (
    <CurrentUserLabel
      fullName={me.data?.fullName ?? null}
      phoneNumber={me.data?.phoneNumber || phoneNumber}
    />
  );
}

export function CurrentUserLabel({
  fullName,
  phoneNumber,
}: {
  fullName: string | null;
  phoneNumber: string | null;
}) {
  const name = fullName?.trim();
  if (!name && !phoneNumber) return null;
  return (
    <span className="flex min-w-0 items-center gap-2 text-sm" data-testid="current-user">
      {name ? (
        <span className="max-w-40 truncate font-medium text-fg sm:max-w-56">{name}</span>
      ) : null}
      {phoneNumber ? (
        <span className="hidden text-muted tabular-nums sm:inline" dir="ltr">
          {phoneNumber}
        </span>
      ) : null}
    </span>
  );
}
