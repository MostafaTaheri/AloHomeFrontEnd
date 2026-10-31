import { notFound } from "next/navigation";
import { OrganisationDetail } from "@/features/backoffice/organisations/organisation-detail";
import { parseSchemeId } from "@/lib/scheme-id";

export default async function Page({ params }: { params: Promise<{ organisationId: string }> }) {
  const { organisationId } = await params;
  // Organisation ids share the positive-integer format of scheme ids.
  const id = parseSchemeId(organisationId);
  if (id === null) notFound();
  return <OrganisationDetail organisationId={id} />;
}
