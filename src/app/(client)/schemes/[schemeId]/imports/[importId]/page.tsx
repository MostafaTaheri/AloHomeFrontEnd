import { notFound } from "next/navigation";
import { ImportWizard } from "@/features/client/imports/import-wizard";
import { isGuid } from "@/lib/scheme-id";

export default async function Page({ params }: { params: Promise<{ importId: string }> }) {
  const { importId } = await params;
  if (!isGuid(importId)) notFound();
  return <ImportWizard importId={importId} />;
}
