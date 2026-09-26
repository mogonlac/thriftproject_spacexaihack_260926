# Storefront — charity shop kiosk

The shopper-facing half of the project: an iPad kiosk where people browse the shop's real stock, ask an AI assistant for help, collect picks on a "receipt", and print a list showing which rack each item is on. The [scanner](../scanner) adds items to the same database. See the [root README](../README.md) for the monorepo.

- `/` — welcome: **Enter** → **Women / Men** → fit (height & weight, or size) + waist
- `/shop` — photo grid, category tabs, filters, search, item detail with rack; **Ask** (bottom-left) opens the assistant, **Receipt** (bottom-right) opens the cart and prints
- `/receipt/[id]` — 80mm printable receipt (`?print=1` opens the print dialog)
- `/staff` — till: scan/type a receipt code, mark items sold or returned to the rack; assistant log; stock list

## Run it

From the repo root:

```bash
npm install
cp .env.example .env.local   # one env file for both apps, everything optional
npm run dev                  # storefront :3000 + scanner :3001 (or: npm run dev:storefront)
```

With **no Supabase keys**, the app uses the shared local store in `<repo>/.data/`: JSON files seeded with the 30 demo items (`packages/shared/src/seed.ts`). The scanner writes to the same files, so new scans appear here, and receipts and statuses survive restarts. `npm run reset-demo` starts fresh. Everything except the AI assistant works without any keys.

| Variable | Needed for |
|---|---|
| `GEMINI_API_KEY` | AI assistant (server-only, never sent to the browser) |
| `ASSISTANT_MODEL` | Optional, default `gemini-flash-latest`. It's named separately from the scanner's `GEMINI_MODEL` because they share one env file |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Live updates in the browser (Realtime) |
| `SUPABASE_SERVICE_ROLE_KEY` | Using Supabase as the database (server-only) |
| `STAFF_PIN` | Optional PIN for `/staff` |
| `NEXT_PUBLIC_SHOP_NAME` | Shop name printed on receipts (default "Oxfam Shop") |
| `NEXT_PUBLIC_SCANNER_URL` | Link from `/staff` to the intake scanner (default http://localhost:3001) |

### Supabase setup

1. Create a project, open **SQL editor**, and run [`supabase/schema.sql`](supabase/schema.sql), then [`supabase/seed.sql`](supabase/seed.sql). Both are safe to re-run, and re-running `seed.sql` puts the demo items back on the rails.
2. Copy the URL, anon key and service-role key into the root `.env.local` (and into Vercel's env vars). Then run `scanner/supabase/scanner.sql` for the scanner's extra columns.
3. `schema.sql` also creates the public `item-photos` storage bucket and turns on Realtime for `items`.

### Deploy (Vercel)

Import the GitHub repo in Vercel and set **Root Directory = `storefront`**. Vercel installs the npm workspace from the repo root, including `packages/shared`. Add the env vars above and deploy. On Vercel, use Supabase: the local `.data/` store is temporary there.

## Item schema (for the scanning app)

The scanner writes one row per donated item into **`public.items`**. Use the Supabase **service-role key** from a server or script. The anon key can only read. The TypeScript version of this contract is `packages/shared/src/types.ts`, which both apps import.

| Column | Type | Required | Notes |
|---|---|---|---|
| `id` | uuid | auto | Leave out, the database generates it |
| `sku` | text, unique | no | Human code on the swing tag, e.g. `OX-0142` |
| `title` | text | **yes** | Short description shown everywhere, e.g. `Wool double-breasted coat` |
| `description` | text | no | One or two sentences |
| `department` | text | **yes** | `womens` · `mens` · `unisex` · `kids` |
| `category` | text | **yes** | `coats-jackets` · `knitwear` · `tops` · `t-shirts` · `shirts` · `dresses` · `skirts` · `trousers` · `jeans` · `shorts` · `shoes` · `bags` · `accessories` |
| `size_label` | text | no | Exactly as on the label: `12`, `M`, `W32 L30`, `UK 7` |
| `size_alpha` | text | no | Normalised size for filters: `XXS` `XS` `S` `M` `L` `XL` `XXL`. Leave null for shoes and bags |
| `waist_in` | integer | no | Waist in inches, bottoms only |
| `colour` | text | **yes** | Main colour, one of `black` `white` `grey` `navy` `blue` `green` `red` `pink` `purple` `yellow` `orange` `brown` `beige` `gold` `silver` `multi` |
| `brand` | text | no | |
| `material` | text | no | |
| `condition` | text | **yes** | `new_with_tags` · `excellent` · `good` · `fair` |
| `price_pence` | integer | **yes** | Price we charge, **in pence** (`1250` = £12.50) |
| `suggested_price_pence` | integer | no | The AI's suggested price, kept for reference |
| `rack` | text | **yes** | Where it hangs, e.g. `B3`. Printed on the receipt |
| `photos` | text[] | **yes** | Public image URLs. The first one is the main photo |
| `tags` | text[] | no | Style keywords that help search: `warm`, `vintage`, `party`, `work` |
| `status` | text | auto | `available` (default) · `on_receipt` · `sold`. The kiosk and till manage this, so the scanner should leave it out |
| `receipt_id` | text | auto | Set by the kiosk |
| `created_at` / `updated_at` | timestamptz | auto | Newest items show first |

**Photos:** upload to the public storage bucket `item-photos`, then put the public URL in `photos`. Portrait (3:4) images look best in the grid.

```ts
import { createClient } from "@supabase/supabase-js";
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const path = `${crypto.randomUUID()}.jpg`;
await supabase.storage.from("item-photos").upload(path, jpegBlob, { contentType: "image/jpeg" });
const { data: { publicUrl } } = supabase.storage.from("item-photos").getPublicUrl(path);

await supabase.from("items").insert({
  title: "Wool double-breasted coat",
  department: "womens",
  category: "coats-jackets",
  size_label: "12",
  size_alpha: "M",
  colour: "navy",
  brand: "Hobbs",
  condition: "good",
  price_pence: 1800,
  suggested_price_pence: 1800,
  rack: "A2",
  photos: [publicUrl],
  tags: ["warm", "winter", "smart"],
});
```

New rows appear on the kiosk straight away via Realtime. The database rejects values outside the lists above through check constraints, so an insert will fail loudly rather than add an item the filters can't find.

### Other tables (managed by the storefront)

- `receipts` — `id` (short code like `R7K4QX`, also in the QR), `status` (`open`/`closed`), `total_pence`
- `receipt_items` — one row per printed item with snapshot `title`/`rack`/`price_pence` and `outcome` (`pending`/`sold`/`returned`)
- `ai_logs` — every assistant turn: question, tool calls with arguments and returned ids, items shown, reply, model, latency
- `create_receipt(p_id, p_item_ids)` — claims items atomically. If any item isn't `available`, nothing is written and the unavailable ids are returned
- `set_receipt_outcome(p_receipt_id, p_item_id, p_outcome)` — till action. `sold` → item sold; `returned` → item back to `available`

## How the AI assistant stays grounded

`app/api/chat` → `lib/ai/assistant.ts` (Gemini function calling, server-side only):

1. The model has two tools: `search_inventory` (filters + keywords, returns **available** items only) and `show_items` (ends the turn).
2. The server remembers every id returned by searches in that turn. `show_items` ids are **intersected with that set** and re-read from the database, so the model can't show an item it didn't retrieve.
3. Cards are rendered from database rows, so photo, price, size and rack never come from model text. The prompt also tells it not to repeat prices or racks.
4. Every turn is written to `ai_logs` and shown on `/staff` → **Assistant log**.

## Project layout

```
app/                 routes (welcome, shop, receipt, staff, api/*)
components/          UI (shop/, receipt/, chat/, staff/)
lib/data/            repo interface + Supabase and shared-local-store implementations
lib/ai/assistant.ts  grounded Gemini tool loop
lib/search.ts        matcher shared by the browse grid and the AI search tool
lib/types.ts         re-exports the shared contract from packages/shared
supabase/            schema.sql, seed.sql
public/seed/         demo photos (see CREDITS.md); seed data is packages/shared/src/seed.ts
                     (npm run seed:sql -w storefront regenerates supabase/seed.sql)
```
