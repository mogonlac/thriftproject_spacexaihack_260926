import "server-only";
import type { AiLogEntry, Item, ItemQuery, Receipt, ReceiptOutcome } from "../types";

export type CreateReceiptResult =
  | { ok: true; receipt: Receipt }
  | { ok: false; unavailable: string[] };

export interface Repo {
  kind: "supabase" | "memory";
  /** Everything a shopper can see: available + on_receipt (sold items are hidden). */
  listShopItems(): Promise<Item[]>;
  /** Staff inventory view, including sold. */
  listAllItems(): Promise<Item[]>;
  getItems(ids: string[]): Promise<Item[]>;
  searchItems(q: ItemQuery): Promise<Item[]>;
  createReceipt(itemIds: string[]): Promise<CreateReceiptResult>;
  getReceipt(id: string): Promise<Receipt | null>;
  listReceipts(limit?: number): Promise<Receipt[]>;
  setOutcome(receiptId: string, itemId: string, outcome: ReceiptOutcome): Promise<Receipt | null>;
  logAi(entry: Omit<AiLogEntry, "id" | "created_at">): Promise<void>;
  listAiLogs(limit?: number): Promise<AiLogEntry[]>;
}

// Short, unambiguous receipt codes (no 0/O, 1/I/L) — easy to read aloud or type at the till.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export function newReceiptId(): string {
  let s = "R";
  for (let i = 0; i < 5; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return s;
}

export function normaliseReceiptId(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}
