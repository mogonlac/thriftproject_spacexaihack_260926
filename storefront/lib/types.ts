// Shared item/receipt types. These mirror supabase/schema.sql exactly —
// the scanning app writes rows in this shape (see README "Item schema").

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

export const COLOUR_SWATCH: Record<Colour, string> = {
  black: "#111111",
  white: "#ffffff",
  grey: "#9a9a9a",
  navy: "#1f2a44",
  blue: "#4a78b5",
  green: "#5c8a5a",
  red: "#c0392b",
  pink: "#e8a1b8",
  purple: "#6b3fa0",
  yellow: "#e9c84a",
  orange: "#d9772b",
  brown: "#7a4e2d",
  beige: "#d8c7a8",
  gold: "linear-gradient(135deg,#b8912f,#f3d98b,#b8912f)",
  silver: "linear-gradient(135deg,#9ea3a8,#eceff1,#9ea3a8)",
  multi: "conic-gradient(#c0392b,#e9c84a,#5c8a5a,#4a78b5,#6b3fa0,#c0392b)",
};

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

export interface Item {
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
}

export type ReceiptOutcome = "pending" | "sold" | "returned";

export interface ReceiptLine {
  item_id: string;
  title: string;
  rack: string;
  price_pence: number;
  size_label: string | null;
  colour: string | null;
  outcome: ReceiptOutcome;
  photo: string | null;
}

export interface Receipt {
  id: string;
  created_at: string;
  status: "open" | "closed";
  total_pence: number;
  lines: ReceiptLine[];
}

export interface AiLogEntry {
  id: string;
  created_at: string;
  session_id: string | null;
  user_message: string;
  tool_calls: { name: string; args: unknown; result_ids?: string[] }[];
  item_ids: string[];
  reply: string;
  model: string;
  latency_ms: number;
}

/** Filters shared by the browse grid and the AI search tool. */
export interface ItemQuery {
  text?: string;
  departments?: Department[];
  categories?: Category[];
  sizes?: AlphaSize[];
  waist_in?: number[];
  colours?: Colour[];
  conditions?: Condition[];
  min_price_pence?: number;
  max_price_pence?: number;
  statuses?: ItemStatus[];
  limit?: number;
}
