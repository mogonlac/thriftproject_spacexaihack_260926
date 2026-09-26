import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { Store } from "./index";
import type { Item, NewItem } from "../types";

// Offline fallback: items in data/items.json, photos in data/photos/.
// On Vercel only /tmp is writable, so data there is ephemeral.
const DATA_DIR = process.env.VERCEL ? "/tmp/scanner-data" : path.join(process.cwd(), "data");
const ITEMS_FILE = path.join(DATA_DIR, "items.json");
export const PHOTO_DIR = path.join(DATA_DIR, "photos");

async function readAll(): Promise<Item[]> {
  try {
    return JSON.parse(await fs.readFile(ITEMS_FILE, "utf8")) as Item[];
  } catch {
    return [];
  }
}

// Serialise writes so two quick scans can't clobber each other.
let queue: Promise<unknown> = Promise.resolve();
function mutate<T>(fn: (items: Item[]) => { items: Item[]; result: T }): Promise<T> {
  const run = queue.then(async () => {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const { items, result } = fn(await readAll());
    const tmp = `${ITEMS_FILE}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(items, null, 2));
    await fs.rename(tmp, ITEMS_FILE);
    return result;
  });
  queue = run.catch(() => undefined);
  return run;
}

export const localStore: Store = {
  kind: "local",

  async savePhoto(name, jpeg) {
    await fs.mkdir(PHOTO_DIR, { recursive: true });
    await fs.writeFile(path.join(PHOTO_DIR, name), jpeg);
    return `/api/photos/${name}`;
  },

  insertItem(newItem) {
    const now = new Date().toISOString();
    const item: Item = { ...newItem, id: randomUUID(), receipt_id: null, created_at: now, updated_at: now };
    return mutate((items) => ({ items: [item, ...items], result: item }));
  },

  async listItems(limit) {
    return (await readAll()).slice(0, limit);
  },

  updateItem(id, patch) {
    return mutate((items) => {
      const idx = items.findIndex((i) => i.id === id);
      if (idx < 0) throw new Error("Item not found");
      const updated = { ...items[idx], ...patch, updated_at: new Date().toISOString() };
      const next = [...items];
      next[idx] = updated;
      return { items: next, result: updated };
    });
  },

  async deleteItem(id) {
    await mutate((items) => ({ items: items.filter((i) => i.id !== id), result: undefined }));
  },
};
