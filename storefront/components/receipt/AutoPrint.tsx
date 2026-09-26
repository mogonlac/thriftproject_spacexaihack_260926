"use client";

import { useEffect } from "react";

export function AutoPrint() {
  useEffect(() => {
    // Give the QR image a moment to render before opening the dialog.
    const t = setTimeout(() => window.print(), 600);
    return () => clearTimeout(t);
  }, []);
  return null;
}
