"use client";

import { useCallback, useEffect, useState } from "react";

/** Counts down once per second from `seconds`. restart() begins a new countdown. */
export function useCountdown(seconds: number) {
  const [state, setState] = useState<{ deadline: number; now: number } | null>(null);
  const deadline = state?.deadline ?? null;

  useEffect(() => {
    if (deadline === null) return;
    const timer = setInterval(() => {
      const now = Date.now();
      setState({ deadline, now });
      if (now >= deadline) clearInterval(timer);
    }, 500);
    return () => clearInterval(timer);
  }, [deadline]);

  const restart = useCallback(() => {
    const now = Date.now();
    setState({ deadline: now + seconds * 1000, now });
  }, [seconds]);

  const remaining = state ? Math.max(0, Math.ceil((state.deadline - state.now) / 1000)) : 0;
  return { remaining, restart };
}
