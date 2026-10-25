import type { Metadata, Viewport } from "next";
import "@fontsource-variable/vazirmatn";
import "./globals.css";
import { Providers } from "@/components/providers";
import { dirFor } from "@/i18n/config";
import { getCurrencyUnit, getLocale, getRegion } from "@/i18n/server";

export const metadata: Metadata = {
  title: { default: "AloHome", template: "%s · AloHome" },
  description: "Financial visibility for strata schemes and residential buildings.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7f9" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1117" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [locale, region, currencyUnit] = await Promise.all([
    getLocale(),
    getRegion(),
    getCurrencyUnit(),
  ]);
  return (
    <html lang={locale} dir={dirFor(locale)}>
      <body>
        <Providers locale={locale} region={region} currencyUnit={currencyUnit}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
