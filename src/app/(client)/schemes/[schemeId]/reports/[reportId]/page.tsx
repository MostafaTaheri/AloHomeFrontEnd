import { notFound } from "next/navigation";
import { ReportDetail } from "@/features/client/reports/report-detail";
import { isGuid } from "@/lib/scheme-id";

export default async function Page({ params }: { params: Promise<{ reportId: string }> }) {
  const { reportId } = await params;
  if (!isGuid(reportId)) notFound();
  return <ReportDetail reportId={reportId} />;
}
