import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { searchItems } from "../search";
import type { AiLogEntry, Item, Receipt, ReceiptOutcome } from "../types";
import { newReceiptId, type Repo } from "./repo";

let client: SupabaseClient | null = null;
function db(): SupabaseClient {
  if (!client) {
    client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });
  }
  return client;
}

function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

interface ReceiptRow {
  id: string;
  created_at: string;
  status: "open" | "closed";
  total_pence: number;
  receipt_items: {
    item_id: string;
    title: string;
    rack: string;
    price_pence: number;
    outcome: ReceiptOutcome;
    items: Pick<Item, "size_label" | "size_alpha" | "colour" | "photos"> | null;
  }[];
}

const RECEIPT_SELECT =
  "id, created_at, status, total_pence, receipt_items(item_id, title, rack, price_pence, outcome, items(size_label, size_alpha, colour, photos))";

function toReceipt(r: ReceiptRow): Receipt {
  return {
    id: r.id,
    created_at: r.created_at,
    status: r.status,
    total_pence: r.total_pence,
    lines: r.receipt_items.map((l) => ({
      item_id: l.item_id,
      title: l.title,
      rack: l.rack,
      price_pence: l.price_pence,
      outcome: l.outcome,
      size_label: l.items?.size_label ?? l.items?.size_alpha ?? null,
      colour: l.items?.colour ?? null,
      photo: l.items?.photos?.[0] ?? null,
    })),
  };
}

export const supabaseRepo: Repo = {
  kind: "supabase",

  async listShopItems() {
    return must(
      await db().from("items").select("*").neq("status", "sold").order("created_at", { ascending: false }).limit(2000),
    ) as Item[];
  },

  async listAllItems() {
    return must(await db().from("items").select("*").order("created_at", { ascending: false }).limit(2000)) as Item[];
  },

  async getItems(ids) {
    if (ids.length === 0) return [];
    const rows = must(await db().from("items").select("*").in("id", ids)) as Item[];
    const byId = new Map(rows.map((r) => [r.id, r]));
    return ids.map((id) => byId.get(id)).filter((i): i is Item => !!i);
  },

  async searchItems(q) {
    // Inventory is small (hundreds of rails items), so fetch candidates and rank
    // in-process with the same matcher the browse grid uses.
    let query = db().from("items").select("*");
    if (q.statuses?.length) query = query.in("status", q.statuses);
    if (q.categories?.length) query = query.in("category", q.categories);
    if (q.departments?.length) query = query.in("department", q.departments);
    if (q.max_price_pence != null) query = query.lte("price_pence", q.max_price_pence);
    if (q.min_price_pence != null) query = query.gte("price_pence", q.min_price_pence);
    const rows = must(await query.limit(2000)) as Item[];
    return searchItems(rows, q);
  },

  async createReceipt(itemIds) {
    const ids = [...new Set(itemIds)];
    for (let attempt = 0; attempt < 3; attempt++) {
      const id = newReceiptId();
      const { data, error } = await db().rpc("create_receipt", { p_id: id, p_item_ids: ids });
      if (error) {
        if (/duplicate key/.test(error.message)) continue; // receipt code collision — retry
        throw new Error(error.message);
      }
      const res = data as { ok: boolean; unavailable?: string[] };
      if (!res.ok) return { ok: false, unavailable: res.unavailable ?? [] };
      const receipt = await this.getReceipt(id);
      if (!receipt) throw new Error("Receipt vanished after creation");
      return { ok: true, receipt };
    }
    throw new Error("Could not allocate a receipt id");
  },

  async getReceipt(id) {
    const { data, error } = await db().from("receipts").select(RECEIPT_SELECT).eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? toReceipt(data as unknown as ReceiptRow) : null;
  },

  async listReceipts(limit = 20) {
    const rows = must(
      await db().from("receipts").select(RECEIPT_SELECT).order("created_at", { ascending: false }).limit(limit),
    );
    return (rows as unknown as ReceiptRow[]).map(toReceipt);
  },

  async setOutcome(receiptId, itemId, outcome) {
    const { error } = await db().rpc("set_receipt_outcome", {
      p_receipt_id: receiptId,
      p_item_id: itemId,
      p_outcome: outcome,
    });
    if (error) throw new Error(error.message);
    return this.getReceipt(receiptId);
  },

  async logAi(entry) {
    const { error } = await db().from("ai_logs").insert(entry);
    if (error) console.error("ai_logs insert failed", error.message);
  },

  async listAiLogs(limit = 50) {
    return must(
      await db().from("ai_logs").select("*").order("created_at", { ascending: false }).limit(limit),
    ) as AiLogEntry[];
  },
};
