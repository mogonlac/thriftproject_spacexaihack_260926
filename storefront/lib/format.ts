import type { Item } from "./types";
import { CONDITION_LABELS } from "./types";

export function gbp(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

/** Zara-style "25.00 GBP". */
export function gbpCode(pence: number): string {
  return `${(pence / 100).toFixed(2)} GBP`;
}

export function sizeText(item: Pick<Item, "size_label" | "size_alpha" | "category">): string {
  if (item.size_label || item.size_alpha) return (item.size_label ?? item.size_alpha)!;
  // Scanned clothing can arrive without a legible label — don't claim it's one-size.
  return item.category === "bags" || item.category === "accessories" ? "One size" : "Size —";
}

/** "12 | BLUE | GOOD" line used under titles. */
export function metaLine(item: Item): string {
  return [sizeText(item), item.colour, CONDITION_LABELS[item.condition]].join("  |  ");
}

export function heroPhoto(item: Pick<Item, "photos">): string | null {
  return item.photos[0] ?? null;
}
