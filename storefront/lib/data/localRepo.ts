import "server-only";
import { localDb, type StoredReceipt } from "@thrift/shared/localDb";
import { searchItems } from "../search";
import type { Item, Receipt } from "../types";
import { newReceiptId, type Repo } from "./repo";

// Zero-setup fallback used when Supabase env vars are missing. Reads and writes
// the shared JSON store in the repo-root .data/ folder — the same one the
// scanner writes to — so new scans appear on the shop floor straight away.

function hydrate(r: StoredReceipt, items: Item[]): Receipt {
  const byId = new Map(items.map((i) => [i.id, i]));
  return {
    ...r,
    lines: r.lines.map((l) => {
      const item = byId.get(l.item_id);
      return {
        ...l,
        size_label: item?.size_label ?? item?.size_alpha ?? null,
        colour: item?.colour ?? null,
        photo: item?.photos[0] ?? null,
      };
    }),
  };
}

type Claim = { ok: false; unavailable: string[] } | { ok: true; items: Item[] };

const now = () => new Date().toISOString();
const newestFirst = (a: Item, b: Item) => b.created_at.localeCompare(a.created_at);

export const localRepo: Repo = {
  kind: "local",

  async listShopItems() {
    return (await localDb.items()).filter((i) => i.status !== "sold").sort(newestFirst);
  },

  async listAllItems() {
    return (await localDb.items()).sort(newestFirst);
  },

  async getItems(ids) {
    const byId = new Map((await localDb.items()).map((i) => [i.id, i]));
    return ids.map((id) => byId.get(id)).filter((i): i is Item => !!i);
  },

  async searchItems(q) {
    return searchItems(await localDb.items(), q);
  },

  async createReceipt(itemIds) {
    const ids = [...new Set(itemIds)];
    const id = newReceiptId();
    const at = now();

    // Claim the items first (under the store's lock) so two kiosks can't both get one.
    const claimed = await localDb.mutate<"items", Claim>("items", (items) => {
      const byId = new Map(items.map((i) => [i.id, i]));
      const unavailable = ids.filter((x) => byId.get(x)?.status !== "available");
      if (unavailable.length) return { rows: items, result: { ok: false, unavailable } };
      const rows = items.map((i) => (ids.includes(i.id) ? { ...i, status: "on_receipt" as const, receipt_id: id, updated_at: at } : i));
      return { rows, result: { ok: true, items: ids.map((x) => byId.get(x)!) } };
    });
    if (!claimed.ok) return claimed;

    const lines = claimed.items.map((item) => ({
      item_id: item.id,
      title: item.title,
      rack: item.rack,
      price_pence: item.price_pence,
      outcome: "pending" as const,
    }));
    const stored: StoredReceipt = {
      id,
      created_at: at,
      status: "open",
      total_pence: lines.reduce((s, l) => s + l.price_pence, 0),
      lines,
    };
    await localDb.mutate("receipts", (rows) => ({ rows: [stored, ...rows], result: null }));
    return { ok: true, receipt: hydrate(stored, await localDb.items()) };
  },

  async getReceipt(id) {
    const r = (await localDb.receipts()).find((x) => x.id === id);
    return r ? hydrate(r, await localDb.items()) : null;
  },

  async listReceipts(limit = 20) {
    const [receipts, items] = await Promise.all([localDb.receipts(), localDb.items()]);
    return receipts
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit)
      .map((r) => hydrate(r, items));
  },

  async setOutcome(receiptId, itemId, outcome) {
    const updated = await localDb.mutate("receipts", (rows) => {
      const r = rows.find((x) => x.id === receiptId);
      const line = r?.lines.find((l) => l.item_id === itemId);
      if (!r || !line) return { rows, result: null };
      line.outcome = outcome;
      r.status = r.lines.some((l) => l.outcome === "pending") ? "open" : "closed";
      return { rows, result: r };
    });
    if (!updated) return null;

    await localDb.mutate("items", (items) => ({
      rows: items.map((i) =>
        i.id === itemId
          ? {
              ...i,
              status: outcome === "sold" ? ("sold" as const) : outcome === "returned" ? ("available" as const) : ("on_receipt" as const),
              receipt_id: outcome === "returned" ? null : receiptId,
              updated_at: now(),
            }
          : i,
      ),
      result: null,
    }));
    return hydrate(updated, await localDb.items());
  },

  async logAi(entry) {
    await localDb.mutate("logs", (rows) => ({
      rows: [{ ...entry, id: crypto.randomUUID(), created_at: now() }, ...rows].slice(0, 200),
      result: null,
    }));
  },

  async listAiLogs(limit = 50) {
    return (await localDb.logs()).slice(0, limit);
  },
};
