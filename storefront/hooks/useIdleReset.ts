"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Kiosk idle handling: after `idleMs` without a touch, count down `warnMs`
 * (returned as seconds left, for a gentle on-screen notice), then call onReset.
 * Any touch, key or scroll cancels the countdown.
 */
export function useIdleReset(onReset: () => void, { idleMs = 150_000, warnMs = 20_000 } = {}) {
  const last = useRef(0);
  const reset = useRef(onReset);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    reset.current = onReset;
  }, [onReset]);

  useEffect(() => {
    last.current = Date.now();
    const bump = () => {
      last.current = Date.now();
      setSecondsLeft(null);
    };
    const events = ["pointerdown", "keydown", "wheel", "touchmove"] as const;
    events.forEach((e) => window.addEventListener(e, bump, { passive: true, capture: true }));
    const t = setInterval(() => {
      const idle = Date.now() - last.current;
      if (idle >= idleMs + warnMs) {
        last.current = Date.now();
        setSecondsLeft(null);
        reset.current();
      } else if (idle >= idleMs) {
        setSecondsLeft(Math.ceil((idleMs + warnMs - idle) / 1000));
      }
    }, 1000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, bump, { capture: true }));
      clearInterval(t);
    };
  }, [idleMs, warnMs]);

  return secondsLeft;
}
