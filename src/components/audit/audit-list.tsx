"use client";

import { EnumBadge } from "@/components/finance/enum-badge";
import { useI18n } from "@/i18n/provider";
import { auditChanges, type AuditEntry } from "@/lib/api/audit";

/**
 * Audit entries as a timeline: who did what, when, to which record, and what changed. Values are
 * shown as recorded; the before/after diff lists only the fields that changed.
 */
export function AuditList({ entries }: { entries: AuditEntry[] }) {
  const { t, fmt } = useI18n();
  return (
    <ol className="divide-y divide-line">
      {entries.map((entry) => {
        const changes = auditChanges(entry);
        return (
          <li key={entry.id} className="space-y-2 px-5 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <EnumBadge group="auditCategory" value={entry.category} />
              <code className="text-sm font-medium" dir="ltr">
                {entry.action}
              </code>
              <span className="ms-auto text-xs text-muted">
                {fmt.dateTime(entry.occurredAtUtc)}
              </span>
            </div>
            <dl className="grid gap-x-6 gap-y-1 text-xs text-muted sm:grid-cols-3">
              <div>
                <dt className="inline">{t("audit.actor")}: </dt>
                <dd className="inline font-mono" dir="ltr">
                  {entry.actorId}
                </dd>
              </div>
              <div>
                <dt className="inline">{t("audit.entity")}: </dt>
                <dd className="inline" dir="ltr">
                  {entry.entityType} {entry.entityId}
                </dd>
              </div>
              {entry.correlationId ? (
                <div>
                  <dt className="inline">{t("audit.correlation")}: </dt>
                  <dd className="inline font-mono" dir="ltr">
                    {entry.correlationId}
                  </dd>
                </div>
              ) : null}
            </dl>
            {entry.reason ? (
              <p className="text-sm" dir="auto">
                {t("audit.reason", { reason: entry.reason })}
              </p>
            ) : null}
            {changes.length > 0 ? (
              <table className="w-full max-w-2xl text-xs">
                <caption className="sr-only">{t("audit.changesCaption")}</caption>
                <thead className="text-muted">
                  <tr>
                    <th scope="col" className="py-1 text-start font-medium">
                      {t("audit.field")}
                    </th>
                    <th scope="col" className="py-1 text-start font-medium">
                      {t("audit.before")}
                    </th>
                    <th scope="col" className="py-1 text-start font-medium">
                      {t("audit.after")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {changes.map((change) => (
                    <tr key={change.field} className="border-t border-line">
                      <th scope="row" className="py-1 pe-3 text-start font-medium" dir="ltr">
                        {change.field}
                      </th>
                      <td className="py-1 pe-3 text-muted line-through" dir="auto">
                        {change.before ?? t("common.none")}
                      </td>
                      <td className="py-1" dir="auto">
                        {change.after ?? t("common.none")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
