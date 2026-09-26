import "server-only";
import { randomUUID } from "crypto";
import { localDb, savePhoto } from "@thrift/shared/localDb";
import type { Store } from "./index";
import type { Item, NewItem } from "../types";

// Offline fallback: the shared JSON store in the repo-root .data/ folder (see
// packages/shared/src/localDb.ts). The storefront reads the same files, so a
// scan shows up on the shop floor without Supabase. Photos go to .data/photos/
// and are served by both apps at /api/photos/<name>.

export const localStore: Store = {
  kind: "local",

  savePhoto,

  insertItem(newItem) {
    const now = new Date().toISOString();
    const item: Item = { ...newItem, id: randomUUID(), receipt_id: null, created_at: now, updated_at: now };
    return localDb.mutate("items", (items) => ({ rows: [item, ...items], result: item }));
  },

  async listItems(limit) {
    const items = (await localDb.items()) as Item[];
    return items.sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit);
  },

  updateItem(id, patch) {
    return localDb.mutate("items", (items) => {
      const idx = items.findIndex((i) => i.id === id);
      if (idx < 0) throw new Error("Item not found");
      const updated = { ...items[idx], ...patch, updated_at: new Date().toISOString() } as Item;
      const next = [...items];
      next[idx] = updated;
      return { rows: next, result: updated };
    });
  },

  async deleteItem(id) {
    await localDb.mutate("items", (items) => ({ rows: items.filter((i) => i.id !== id), result: undefined }));
  },
};
