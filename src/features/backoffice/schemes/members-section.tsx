"use client";

import { useI18n } from "@/i18n/provider";
import type { BoSchemeDetail } from "@/lib/api/backoffice";
import { qk } from "@/lib/api/keys";
import { boMembersApi } from "@/lib/api/members";
import { regionForJurisdiction } from "@/lib/region/config";
import { MembersManager } from "@/features/members/members-manager";

/** Back office: the building's members (the same list the building panel manages). */
export function MembersSection({ scheme }: { scheme: BoSchemeDetail }) {
  const { region } = useI18n();
  return (
    <MembersManager
      schemeId={scheme.id}
      region={regionForJurisdiction(scheme.jurisdictionCode) ?? region}
      surface={{
        api: boMembersApi,
        listKey: (params) => qk.bo.members(scheme.id, params),
        invalidate: [["bo", "scheme", scheme.id], ["me"]],
      }}
    />
  );
}
