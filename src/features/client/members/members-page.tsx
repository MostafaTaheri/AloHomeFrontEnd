"use client";

import { InlineAlert } from "@/components/ui/states";
import { MembersManager } from "@/features/members/members-manager";
import { useI18n } from "@/i18n/provider";
import { qk } from "@/lib/api/keys";
import { schemeMembersApi } from "@/lib/api/members";
import { usePageView } from "@/lib/telemetry/client";
import { useScheme } from "../workspace/scheme-provider";

/** The building's members, managed by people with ManageMembers. Same list as the back office. */
export function MembersPage() {
  const { t, region } = useI18n();
  const { schemeId, can } = useScheme();
  usePageView("members", "list");

  if (!can("ManageMembers")) return <InlineAlert tone="warn">{t("members.readOnly")}</InlineAlert>;

  return (
    <MembersManager
      schemeId={schemeId}
      region={region}
      surface={{
        api: schemeMembersApi,
        listKey: (params) => qk.memberList(schemeId, params),
        // Owner and occupant pickers read the options; holders show member names.
        invalidate: [qk.members(schemeId), qk.property(schemeId), ["me"]],
      }}
    />
  );
}
