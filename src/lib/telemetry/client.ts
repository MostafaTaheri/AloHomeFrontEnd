"use client";

import { useEffect, useRef } from "react";
import { telemetryPropsSchema, type TelemetryEvent, type TelemetryProps } from "./events";

/**
 * Fire-and-forget product telemetry. It never throws, never blocks the UI, and drops anything
 * that does not match the allowlist in ./events (so a bad call site fails in tests, not in
 * production). Do not pass amounts, names or free text.
 */
export function track(event: TelemetryEvent, props: TelemetryProps = {}): void {
  if (typeof window === "undefined") return;
  const parsed = telemetryPropsSchema.safeParse(props);
  if (!parsed.success) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[telemetry] "${event}" dropped: properties are not allowed`, parsed.error);
    }
    return;
  }
  try {
    void fetch("/api/telemetry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, props: parsed.data }),
      credentials: "same-origin",
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Telemetry must never affect the page.
  }
}

/** Records one `page_view` per mount. */
export function usePageView(area: string, page: string): void {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    track("page_view", { area, page });
  }, [area, page]);
}

/** Measures how long a flow took, for `durationMs`. */
export function useStopwatch(): () => number {
  const start = useRef<number>(0);
  useEffect(() => {
    start.current = Date.now();
  }, []);
  return () => Math.max(0, Date.now() - start.current);
}
