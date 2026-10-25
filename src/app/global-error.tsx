"use client";

// Last-resort boundary for errors in the root layout itself. It renders outside the providers, so
// it cannot use translations; keep the copy bilingual and minimal.
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fa" dir="rtl">
      <body
        style={{ fontFamily: "system-ui, sans-serif", padding: "4rem 1rem", textAlign: "center" }}
      >
        <h1 style={{ fontSize: "1.5rem" }}>مشکلی پیش آمد · Something went wrong</h1>
        <button
          type="button"
          onClick={reset}
          style={{ marginTop: "1rem", padding: "0.5rem 1rem", cursor: "pointer" }}
        >
          تلاش دوباره · Try again
        </button>
      </body>
    </html>
  );
}
