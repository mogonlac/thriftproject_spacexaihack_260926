import { ALPHA_SIZES, type AlphaSize, type Category, type Item } from "./types";

// Size question shown after each scan. The options depend on what the garment is,
// and every answer is normalised into the shared columns the storefront filters on
// (size_label as written, size_alpha XXS–XXL, waist_in for bottoms).

export type SizeKind = "alpha" | "dress" | "waist" | "shoe";

export interface SizeChoice {
  kind: SizeKind;
  label: string; // what the button says
}

export interface SizePatch {
  size_label: string | null;
  size_alpha: AlphaSize | null;
  waist_in: number | null;
}

const BOTTOMS: Category[] = ["jeans", "trousers", "shorts"];
const ONE_SIZE: Category[] = ["bags", "accessories"];

export const DRESS_SIZES = [4, 6, 8, 10, 12, 14, 16, 18, 20, 22];
export const WAIST_SIZES = [24, 26, 28, 30, 32, 34, 36, 38, 40];
export const SHOE_SIZES = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

// Same conversion the AI uses (lib/analysis/schema.ts): UK 8→S, 10/12→M, 14→L, 16→XL.
const DRESS_TO_ALPHA: Record<number, AlphaSize> = {
  4: "XXS", 6: "XS", 8: "S", 10: "M", 12: "M", 14: "L", 16: "XL", 18: "XXL", 20: "XXL", 22: "XXL",
};
const waistToAlpha = (w: number): AlphaSize =>
  w <= 24 ? "XXS" : w <= 26 ? "XS" : w <= 29 ? "S" : w <= 32 ? "M" : w <= 34 ? "L" : w <= 36 ? "XL" : "XXL";

/** Which rows of buttons to show for this item. Empty = don't ask (bags, accessories). */
export function sizeRows(item: Pick<Item, "category" | "department">): { title: string; choices: SizeChoice[] }[] {
  if (ONE_SIZE.includes(item.category)) return [];
  if (item.category === "shoes") {
    return [{ title: "UK shoe size", choices: SHOE_SIZES.map((n) => ({ kind: "shoe", label: String(n) })) }];
  }
  if (BOTTOMS.includes(item.category)) {
    return [
      { title: "Waist (inches)", choices: WAIST_SIZES.map((n) => ({ kind: "waist", label: String(n) })) },
      { title: "Or letter size", choices: ALPHA_SIZES.map((s) => ({ kind: "alpha", label: s })) },
    ];
  }
  const rows = [{ title: "Letter size", choices: ALPHA_SIZES.map((s): SizeChoice => ({ kind: "alpha", label: s })) }];
  if (item.department !== "mens") {
    rows.push({ title: "UK dress size", choices: DRESS_SIZES.map((n) => ({ kind: "dress", label: String(n) })) });
  }
  return rows;
}

/** Turn a tapped button into the column values to save. */
export function sizePatch(choice: SizeChoice): SizePatch {
  const n = Number(choice.label);
  switch (choice.kind) {
    case "alpha":
      return { size_label: choice.label, size_alpha: choice.label as AlphaSize, waist_in: null };
    case "dress":
      return { size_label: choice.label, size_alpha: DRESS_TO_ALPHA[n] ?? null, waist_in: null };
    case "waist":
      return { size_label: `W${n}`, size_alpha: waistToAlpha(n), waist_in: n };
    case "shoe":
      return { size_label: `UK ${n}`, size_alpha: null, waist_in: null };
  }
}

/** Is this button the item's current size? (pre-selects what the AI read off the label) */
export function isCurrentSize(item: Pick<Item, "size_label" | "size_alpha" | "waist_in">, choice: SizeChoice): boolean {
  const label = (item.size_label ?? "").toUpperCase().replace(/\s+/g, "");
  switch (choice.kind) {
    case "alpha":
      return label === choice.label || (!label && item.size_alpha === choice.label);
    case "dress":
      return label === choice.label || label === `UK${choice.label}`;
    case "waist":
      return item.waist_in === Number(choice.label) || label.startsWith(`W${choice.label}`);
    case "shoe":
      return label === `UK${choice.label}` || label === choice.label;
  }
}
