"use client";

import { useSyncExternalStore } from "react";
import { useKiosk } from "@/lib/store";

/** True once the persisted kiosk session has been restored from sessionStorage. */
export function useHydrated() {
  return useSyncExternalStore(
    (onChange) => useKiosk.persist.onFinishHydration(onChange),
    () => useKiosk.persist.hasHydrated(),
    () => false,
  );
}
