// Regenerates supabase/seed.sql from lib/seed.ts.  Run: npm run seed:sql
import { writeFileSync } from "node:fs";
import { SEED_ITEMS } from "../lib/seed.ts";

const q = (v: unknown): string => {
  if (v === null || v === undefined) return "null";
  if (typeof v === "number") return String(v);
  if (Array.isArray(v)) return `array[${v.map(q).join(", ")}]::text[]`;
  return `'${String(v).replace(/'/g, "''")}'`;
};

const cols = [
  "id", "sku", "title", "description", "department", "category", "size_label", "size_alpha", "waist_in",
  "colour", "brand", "material", "condition", "price_pence", "suggested_price_pence", "rack", "photos", "tags",
  "status", "created_at",
] as const;

const rows = SEED_ITEMS.map((item) => `  (${cols.map((c) => q(item[c])).join(", ")})`);

const sql = `-- Demo inventory (generated from lib/seed.ts — do not edit by hand).
-- Photo paths are relative (/seed/*.jpg) and served by the storefront itself.
insert into public.items (${cols.join(", ")}) values
${rows.join(",\n")}
on conflict (id) do update set
${cols.filter((c) => c !== "id").map((c) => `  ${c} = excluded.${c}`).join(",\n")},
  receipt_id = null;
`;

writeFileSync(new URL("../supabase/seed.sql", import.meta.url), sql);
console.log(`wrote ${SEED_ITEMS.length} items to supabase/seed.sql`);
