import type { Receipt } from "./types";

// Copy shared by the on-screen receipt, the PDF and the thermal print page.
export const SHOP_NAME = process.env.NEXT_PUBLIC_SHOP_NAME || "Oxfam Shop";
export const RECEIPT_TITLE = "Your fitting-room list";
export const RECEIPT_STEPS = [
  "Find each item on the rack shown",
  "Try things on in the fitting room",
  "Bring this receipt to the till to pay",
];
export const RETURNS_TITLE = "Not for you?";
export const RETURNS_NOTE =
  "No problem. Hang it on the RETURNS RAIL by the fitting rooms and our volunteers will put it back.";
export const THANKS = "Thank you. Every purchase funds Oxfam's work.";

export function receiptDate(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function receiptItemCount(r: Receipt): string {
  return `${r.lines.length} ${r.lines.length === 1 ? "item" : "items"}`;
}

export function lineDetail(l: { size_label: string | null; colour: string | null }): string {
  return [l.size_label ? `Size ${l.size_label}` : null, l.colour].filter(Boolean).join(" · ");
}
