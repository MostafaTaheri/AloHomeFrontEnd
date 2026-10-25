import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SchemeDetail } from "@/features/backoffice/schemes/scheme-detail";
import { parseSchemeId } from "@/lib/scheme-id";

export default async function Page({ params }: { params: Promise<{ schemeId: string }> }) {
  const { schemeId } = await params;
  const id = parseSchemeId(schemeId);
  if (id === null) notFound();
  return (
    <Suspense>
      <SchemeDetail schemeId={id} />
    </Suspense>
  );
}
