// Item contract. The first block mirrors storefront/supabase/schema.sql
// exactly (copied from storefront/lib/types.ts — keep in sync). The second
// block is scanner-owned metadata added by scanner/supabase/scanner.sql;
// the storefront can ignore it.

export const DEPARTMENTS = ["womens", "mens", "unisex", "kids"] as const;
export type Department = (typeof DEPARTMENTS)[number];

export const CATEGORIES = [
  "coats-jackets",
  "knitwear",
  "tops",
  "t-shirts",
  "shirts",
  "dresses",
  "skirts",
  "trousers",
  "jeans",
  "shorts",
  "shoes",
  "bags",
  "accessories",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  "coats-jackets": "Coats & Jackets",
  knitwear: "Knitwear",
  tops: "Tops",
  "t-shirts": "T-Shirts",
  shirts: "Shirts",
  dresses: "Dresses",
  skirts: "Skirts",
  trousers: "Trousers",
  jeans: "Jeans",
  shorts: "Shorts",
  shoes: "Shoes",
  bags: "Bags",
  accessories: "Accessories",
};

export const ALPHA_SIZES = ["XXS", "XS", "S", "M", "L", "XL", "XXL"] as const;
export type AlphaSize = (typeof ALPHA_SIZES)[number];

export const COLOURS = [
  "black",
  "white",
  "grey",
  "navy",
  "blue",
  "green",
  "red",
  "pink",
  "purple",
  "yellow",
  "orange",
  "brown",
  "beige",
  "gold",
  "silver",
  "multi",
] as const;
export type Colour = (typeof COLOURS)[number];

export const CONDITIONS = ["new_with_tags", "excellent", "good", "fair"] as const;
export type Condition = (typeof CONDITIONS)[number];

export const CONDITION_LABELS: Record<Condition, string> = {
  new_with_tags: "New with tags",
  excellent: "Excellent",
  good: "Good",
  fair: "Fair",
};

export const ITEM_STATUSES = ["available", "on_receipt", "sold"] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

/** Where price_pence came from. Only 'tag' and 'staff' are confirmed prices. */
export const PRICE_SOURCES = ["tag", "ai_suggested", "staff"] as const;
export type PriceSource = (typeof PRICE_SOURCES)[number];

export interface Item {
  // --- shared contract (storefront/supabase/schema.sql) ---
  id: string;
  sku: string | null;
  title: string;
  description: string | null;
  department: Department;
  category: Category;
  size_label: string | null;
  size_alpha: AlphaSize | null;
  waist_in: number | null;
  colour: Colour;
  brand: string | null;
  material: string | null;
  condition: Condition;
  price_pence: number;
  suggested_price_pence: number | null;
  rack: string;
  photos: string[];
  tags: string[];
  status: ItemStatus;
  receipt_id: string | null;
  created_at: string;
  updated_at: string;

  // --- scanner extension (scanner/supabase/scanner.sql) ---
  price_source: PriceSource;
  needs_review: boolean;
  original_photo_url: string | null;
  subcategory: string | null;
  secondary_colours: string[];
  pattern: string | null;
  barcode: string | null;
  ai_confidence: AiConfidence | null;
  ai_model: string | null;
  scan_source: string | null;
  silhouette: string | null;
  three_d_template_type: string | null;
  three_d_asset_url: string | null;
}

/** 0..1 per field. Low values mean "treat as a guess". */
export interface AiConfidence {
  overall: number;
  category: number;
  colour: number;
  size: number;
  brand: number;
  condition: number;
  price_tag: number;
}

export type NewItem = Omit<Item, "id" | "created_at" | "updated_at" | "receipt_id">;
