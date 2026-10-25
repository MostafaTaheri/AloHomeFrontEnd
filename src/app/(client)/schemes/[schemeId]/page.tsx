import type { Metadata } from "next";
import { HealthDashboard } from "@/features/client/health/health-dashboard";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("health.title") };
}

export default function HealthPage() {
  return <HealthDashboard />;
}
