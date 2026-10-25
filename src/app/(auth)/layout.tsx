import { PreferenceBar } from "@/components/layout/preferences";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="mb-6 flex w-full max-w-md flex-wrap items-center justify-between gap-3">
        <span className="text-2xl font-bold tracking-tight text-brand">AloHome</span>
        <PreferenceBar />
      </div>
      <main className="w-full max-w-md">{children}</main>
    </div>
  );
}
