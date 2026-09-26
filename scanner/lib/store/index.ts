import "server-only";
import { localStore } from "./local";
import { supabaseStore, supabaseConfigured } from "./supabase";
import type { Item, NewItem } from "../types";

export interface Store {
  kind: "supabase" | "local";
  /** Saves a JPEG and returns a URL the browser/storefront can load. */
  savePhoto(name: string, jpeg: Buffer): Promise<string>;
  insertItem(item: NewItem): Promise<Item>;
  listItems(limit: number): Promise<Item[]>;
  updateItem(id: string, patch: Partial<NewItem>): Promise<Item>;
  deleteItem(id: string): Promise<void>;
}

/** Supabase when configured, otherwise a local JSON file (zero-setup demo). */
export function getStore(): Store {
  return supabaseConfigured() ? supabaseStore : localStore;
}

export { localStore };
