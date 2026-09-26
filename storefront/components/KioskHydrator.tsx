"use client";

import { useEffect } from "react";
import { useKiosk } from "@/lib/store";

export function KioskHydrator() {
  useEffect(() => {
    void useKiosk.persist.rehydrate();
  }, []);
  return null;
}
