import "server-only";
import { SEED_ITEMS } from "../seed";
import { searchItems } from "../search";
import type { AiLogEntry, Item, Receipt, ReceiptLine } from "../types";
import { newReceiptId, type Repo } from "./repo";

// Zero-setup fallback used when Supabase env vars are missing. State lives in
// the server process (kept on globalThis so dev hot-reloads don't wipe it).

interface StoredReceipt {
  id: string;
  created_at: string;
  status: "open" | "closed";
  total_pence: number;
  lines: Omit<ReceiptLine, "size_label" | "colour" | "photo">[];
}

interface MemoryState {
  items: Map<string, Item>;
  receipts: Map<string, StoredReceipt>;
  logs: AiLogEntry[];
}

const g = globalThis as unknown as { __thriftMemory?: MemoryState };
function state(): MemoryState {
  if (!g.__thriftMemory) {
    g.__thriftMemory = {
      items: new Map(SEED_ITEMS.map((i) => [i.id, structuredClone(i)])),
      receipts: new Map(),
      logs: [],
    };
  }
  return g.__thriftMemory;
}

function hydrate(r: StoredReceipt): Receipt {
  const { items } = state();
  return {
    ...r,
    lines: r.lines.map((l) => {
      const item = items.get(l.item_id);
      return {
        ...l,
        size_label: item?.size_label ?? item?.size_alpha ?? null,
        colour: item?.colour ?? null,
        photo: item?.photos[0] ?? null,
      };
    }),
  };
}

const now = () => new Date().toISOString();

export const memoryRepo: Repo = {
  kind: "memory",

  async listShopItems() {
    return [...state().items.values()]
      .filter((i) => i.status !== "sold")
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  },

  async listAllItems() {
    return [...state().items.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
  },

  async getItems(ids) {
    const { items } = state();
    return ids.map((id) => items.get(id)).filter((i): i is Item => !!i);
  },

  async searchItems(q) {
    return searchItems([...state().items.values()], q);
  },

  async createReceipt(itemIds) {
    const { items, receipts } = state();
    const ids = [...new Set(itemIds)];
    const unavailable = ids.filter((id) => items.get(id)?.status !== "available");
    if (unavailable.length) return { ok: false, unavailable };

    const id = newReceiptId();
    const lines = ids.map((itemId) => {
      const item = items.get(itemId)!;
      item.status = "on_receipt";
      item.receipt_id = id;
      item.updated_at = now();
      return { item_id: itemId, title: item.title, rack: item.rack, price_pence: item.price_pence, outcome: "pending" as const };
    });
    const stored: StoredReceipt = {
      id,
      created_at: now(),
      status: "open",
      total_pence: lines.reduce((s, l) => s + l.price_pence, 0),
      lines,
    };
    receipts.set(id, stored);
    return { ok: true, receipt: hydrate(stored) };
  },

  async getReceipt(id) {
    const r = state().receipts.get(id);
    return r ? hydrate(r) : null;
  },

  async listReceipts(limit = 20) {
    return [...state().receipts.values()]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit)
      .map(hydrate);
  },

  async setOutcome(receiptId, itemId, outcome) {
    const { receipts, items } = state();
    const r = receipts.get(receiptId);
    if (!r) return null;
    const line = r.lines.find((l) => l.item_id === itemId);
    if (!line) return null;
    line.outcome = outcome;
    const item = items.get(itemId);
    if (item) {
      item.status = outcome === "sold" ? "sold" : outcome === "returned" ? "available" : "on_receipt";
      item.receipt_id = outcome === "returned" ? null : receiptId;
      item.updated_at = now();
    }
    r.status = r.lines.some((l) => l.outcome === "pending") ? "open" : "closed";
    return hydrate(r);
  },

  async logAi(entry) {
    state().logs.unshift({ ...entry, id: crypto.randomUUID(), created_at: now() });
    state().logs.length = Math.min(state().logs.length, 200);
  },

  async listAiLogs(limit = 50) {
    return state().logs.slice(0, limit);
  },
};
