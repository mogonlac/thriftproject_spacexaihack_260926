import type { Profile } from "@/lib/store";
import type { AlphaSize, Category, Colour, Condition, Department, ItemQuery } from "@/lib/types";

export interface Filters {
  department: "womens" | "mens" | null;
  category: Category | null;
  sizes: AlphaSize[];
  waists: number[];
  colours: Colour[];
  conditions: Condition[];
  maxPricePence: number | null;
  text: string;
}

export const EMPTY_FILTERS: Filters = {
  department: null,
  category: null,
  sizes: [],
  waists: [],
  colours: [],
  conditions: [],
  maxPricePence: null,
  text: "",
};

export const PRICE_CAPS = [500, 1000, 1500, 2000, 3000];

export function filtersFromProfile(p: Profile): Filters {
  return {
    ...EMPTY_FILTERS,
    department: p.department,
    sizes: p.size ? [p.size] : [],
    waists: p.waist ? [p.waist] : [],
  };
}

export function departmentsFor(d: Filters["department"]): Department[] | undefined {
  // Unisex stock shows for everyone.
  return d ? [d, "unisex"] : undefined;
}

export function toQuery(f: Filters, withCategory = true): ItemQuery {
  return {
    text: f.text || undefined,
    departments: departmentsFor(f.department),
    categories: withCategory && f.category ? [f.category] : undefined,
    sizes: f.sizes,
    waist_in: f.waists,
    colours: f.colours,
    conditions: f.conditions,
    max_price_pence: f.maxPricePence ?? undefined,
    statuses: ["available", "on_receipt"],
  };
}

/** Number of filters set in the side sheet (not department/category/search). */
export function sheetFilterCount(f: Filters) {
  return f.sizes.length + f.waists.length + f.colours.length + f.conditions.length + (f.maxPricePence ? 1 : 0);
}
