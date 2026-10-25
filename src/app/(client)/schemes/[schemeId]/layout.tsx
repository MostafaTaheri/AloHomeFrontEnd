import { notFound } from "next/navigation";
import { SchemeWorkspace } from "@/features/client/workspace/scheme-provider";
import { parseSchemeId } from "@/lib/scheme-id";

export default async function SchemeLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ schemeId: string }>;
}) {
  const { schemeId } = await params;
  const id = parseSchemeId(schemeId);
  if (id === null) notFound();
  return <SchemeWorkspace schemeId={id}>{children}</SchemeWorkspace>;
}
