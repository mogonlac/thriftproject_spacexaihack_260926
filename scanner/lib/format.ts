import { CATEGORY_LABELS, type Category, type Item } from "./types";

export const gbp = (pence: number) => `£${(pence / 100).toFixed(2)}`;

export const COLOUR_SWATCH: Record<string, string> = {
  black: "#111111", white: "#ffffff", grey: "#9a9a9a", navy: "#1f2a44", blue: "#4a78b5",
  green: "#5c8a5a", red: "#c0392b", pink: "#e8a1b8", purple: "#6b3fa0", yellow: "#e9c84a",
  orange: "#d9772b", brown: "#7a4e2d", beige: "#d8c7a8",
  gold: "linear-gradient(135deg,#b8912f,#f3d98b,#b8912f)",
  silver: "linear-gradient(135deg,#9ea3a8,#eceff1,#9ea3a8)",
  multi: "conic-gradient(#c0392b,#e9c84a,#5c8a5a,#4a78b5,#6b3fa0,#c0392b)",
};

export const categoryLabel = (c: Category) => CATEGORY_LABELS[c] ?? c;

export function sizeText(item: Pick<Item, "size_label" | "size_alpha" | "waist_in">) {
  return item.size_label ?? item.size_alpha ?? (item.waist_in ? `W${item.waist_in}` : null);
}

export const PRICE_SOURCE_LABEL = { tag: "From tag", ai_suggested: "AI estimate", staff: "Staff set" } as const;
