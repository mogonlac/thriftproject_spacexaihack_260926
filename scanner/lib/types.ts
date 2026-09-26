// Item contract, shared with the storefront via packages/shared (one source of
// truth for both apps). The scanner works with the full row: the shared core
// columns plus its own extension columns from scanner/supabase/scanner.sql.

import type { ScannedItem } from "@thrift/shared/types";

export {
  ALPHA_SIZES,
  CATEGORIES,
  CATEGORY_LABELS,
  COLOURS,
  CONDITIONS,
  CONDITION_LABELS,
  DEPARTMENTS,
  ITEM_STATUSES,
  PRICE_SOURCES,
} from "@thrift/shared/types";
export type {
  AiConfidence,
  AlphaSize,
  Category,
  Colour,
  Condition,
  Department,
  ItemStatus,
  ItemValuation,
  PriceSource,
} from "@thrift/shared/types";

/** A full items row as the scanner reads and writes it. */
export type Item = ScannedItem;

export type NewItem = Omit<Item, "id" | "created_at" | "updated_at" | "receipt_id">;
