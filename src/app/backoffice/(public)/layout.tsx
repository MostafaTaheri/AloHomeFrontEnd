import { PreferenceBar } from "@/components/layout/preferences";
import { getI18n } from "@/i18n/server";

export default async function BackofficePublicLayout({ children }: { children: React.ReactNode }) {
  const { t } = await getI18n();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-surface-2 px-4 py-10">
      <div className="mb-6 flex w-full max-w-md flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-2xl font-bold tracking-tight text-brand">
          AloHome
          <span className="rounded bg-brand px-2 py-0.5 text-xs font-semibold text-brand-fg">
            {t("nav.backoffice")}
          </span>
        </span>
        <PreferenceBar withRegion={false} />
      </div>
      <main className="w-full max-w-md">{children}</main>
    </div>
  );
}
