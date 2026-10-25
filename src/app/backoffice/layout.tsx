import type { Metadata } from "next";

// Staff area: never indexed, never cached by shared proxies (see src/proxy.ts for the headers).
export const metadata: Metadata = {
  title: { default: "AloHome back office", template: "%s · AloHome back office" },
  robots: { index: false, follow: false },
};

export default function BackofficeRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
