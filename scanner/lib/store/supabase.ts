import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Store } from "./index";
import type { Item, NewItem } from "../types";

const BUCKET = "item-photos";

// Columns that exist in storefront/supabase/schema.sql. If scanner.sql has not
// been run yet, inserts fall back to just these so scanning never breaks.
const SHARED_COLUMNS = [
  "sku", "title", "description", "department", "category", "size_label", "size_alpha",
  "waist_in", "colour", "brand", "material", "condition", "price_pence",
  "suggested_price_pence", "rack", "photos", "tags", "status",
] as const;

export function supabaseConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

let client: SupabaseClient | null = null;
function db() {
  client ??= createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  return client;
}

function pickShared(item: Partial<NewItem>) {
  return Object.fromEntries(
    Object.entries(item).filter(([k]) => (SHARED_COLUMNS as readonly string[]).includes(k)),
  );
}

// PostgREST reports an unknown column as PGRST204 ("Could not find the 'x' column").
function isMissingColumn(error: { code?: string; message?: string }) {
  return error.code === "PGRST204" || /column/i.test(error.message ?? "");
}

let warnedMissingExtension = false;
function warnMissingExtension() {
  if (warnedMissingExtension) return;
  warnedMissingExtension = true;
  console.warn("[scanner] scanner.sql columns missing — writing shared columns only. Run scanner/supabase/scanner.sql.");
}

export const supabaseStore: Store = {
  kind: "supabase",

  async savePhoto(name, jpeg) {
    const path = `scans/${name}`;
    const { error } = await db().storage.from(BUCKET).upload(path, jpeg, {
      contentType: "image/jpeg",
      upsert: true,
    });
    if (error) throw new Error(`Photo upload failed: ${error.message}`);
    return db().storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  },

  async insertItem(item) {
    let res = await db().from("items").insert(item).select().single();
    if (res.error && isMissingColumn(res.error)) {
      warnMissingExtension();
      res = await db().from("items").insert(pickShared(item)).select().single();
    }
    if (res.error) throw new Error(`Insert failed: ${res.error.message}`);
    return res.data as Item;
  },

  async listItems(limit) {
    const { data, error } = await db()
      .from("items")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return data as Item[];
  },

  async updateItem(id, patch) {
    let res = await db().from("items").update(patch).eq("id", id).select().single();
    if (res.error && isMissingColumn(res.error)) {
      warnMissingExtension();
      res = await db().from("items").update(pickShared(patch)).eq("id", id).select().single();
    }
    if (res.error) throw new Error(res.error.message);
    return res.data as Item;
  },

  async deleteItem(id) {
    const { error } = await db().from("items").delete().eq("id", id);
    if (error) throw new Error(error.message);
  },
};
