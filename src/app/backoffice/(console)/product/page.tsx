import type { Metadata } from "next";
import { ProductPage } from "@/features/backoffice/product/product-page";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("product.title") };
}

export default function Page() {
  return <ProductPage />;
}
