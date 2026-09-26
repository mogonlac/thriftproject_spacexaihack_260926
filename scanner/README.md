# Intake Scanner

Hands-free garment intake for the charity-shop inventory. A fixed camera watches a hook in front of a plain background:

**hang garment → it settles → auto-capture → AI catalogues it → row in `items` → remove garment → ready for the next one.**

It writes to the same Supabase `items` table the storefront (`../storefront`) reads. The scanner never touches receipts or carts.

## Run it

```bash
cd scanner
cp .env.example .env.local   # add GEMINI_API_KEY (+ Supabase keys to use the shared DB)
npm install
npm run dev                  # http://localhost:3001  (storefront uses :3000)
```

- **No Supabase keys** → items go to `scanner/data/items.json`, photos to `scanner/data/photos/`. That's enough for a standalone demo.
- **AI:** Gemini `gemini-3.5-flash-lite` when `GEMINI_API_KEY` is set (~3 s per garment); Claude if only `ANTHROPIC_API_KEY` is set. `ANALYSIS_PROVIDER` forces one.
- **No AI key** (or `ANALYSIS_PROVIDER=fallback`) → a clearly labelled fallback analyser runs. It uses the colour and shape from the camera, marks the item `needs_review`, and scanning keeps working.
- **Supabase:** run `storefront/supabase/schema.sql` first, then `scanner/supabase/scanner.sql`. The second one adds the scanner's optional columns. If you forget it, the scanner still writes the shared columns and logs a warning.
- **Deploy:** Vercel project with Root Directory = `scanner` and the same env vars. The camera needs `https://` or `localhost`.

### Station setup

Use a laptop webcam, a USB camera, or an iPhone via Continuity Camera; pick it in **Settings**. Point it at the hook against a plain wall. Keep the hanger inside the dashed **"Hang garment here"** box. On start the scanner calibrates the empty background for about 1 s, so keep the box clear.

| Key | Action |
|---|---|
| `1`–`9` | Switch rack |
| `Space` | Capture now (manual override) |
| `R` | Recalibrate the empty background |
| `D` | Show the detection mask (for tuning) |

**Racks:** tap the big rack pill once per batch, and every scan is assigned to that rack. Hands-free alternative: hold up a QR card that encodes `RACK:B3`. It switches the rack and is not saved as an item. QR reading needs Chrome/Edge (BarcodeDetector).

### How detection works (`lib/detector.ts`)

Frames are sampled at 10 fps into a 64×48 canvas.
- **presence:** the share of the hanger zone that differs from the calibrated empty background. Exposure drift is compensated using the pixels outside the zone.
- **motion:** the share of the zone that changed since the last sample.
- **Capture:** happens when a garment is present and motion stays under the stillness threshold for 1.2 s.
- **Duplicate prevention:** after a capture the scanner is disarmed until the zone has been empty for 1 s. A garment left hanging is never captured twice.
- **Tuning:** thresholds can be adjusted live in Settings.
- **Non-garments:** if the AI reports no garment (a hand, an empty hanger), no item is created.

The upload contains two images:
- a crop around the detected garment, which becomes `photos[0]`
- the untouched full frame, saved as `original_photo_url`

---

## For the storefront: integration

**Table:** `public.items` (defined in `storefront/supabase/schema.sql`). The scanner inserts one row per garment with `status = 'available'`, using the service-role key server-side.

**Shared columns the scanner fills:**

| column | type | notes |
|---|---|---|
| `id` | uuid | generated |
| `title` | text | e.g. `"Black denim jacket"` |
| `description` | text \| null | AI description + visible condition notes |
| `department` | `womens`\|`mens`\|`unisex`\|`kids` | `unisex` when unsure |
| `category` | storefront enum | `coats-jackets`, `knitwear`, `tops`, … |
| `size_label` | text \| **null** | only if a size label is legible |
| `size_alpha` | `XXS`…`XXL` \| **null** | only if derivable from a visible size |
| `waist_in` | int \| **null** | bottoms, only if printed |
| `colour` | storefront enum | dominant colour |
| `brand` | text \| **null** | only if a label/logo is legible; never guessed |
| `material` | text \| **null** | likely material |
| `condition` | `new_with_tags`\|`excellent`\|`good`\|`fair` | from visible cues |
| `price_pence` | int, not null | see `price_source` |
| `suggested_price_pence` | int | AI estimate, always filled |
| `rack` | text | session rack, e.g. `B3` |
| `photos` | text[] | `[0]` = public URL of the garment crop (Supabase Storage bucket `item-photos`, path `scans/<id>.jpg`) |
| `tags` | text[] | lowercase search keywords |
| `status` | `available`\|`on_receipt`\|`sold` | scanner always writes `available`; the storefront owns later changes |
| `sku`, `receipt_id` | null | not set by the scanner |

**Scanner extension columns** (optional, from `scanner/supabase/scanner.sql`; safe to ignore):

| column | notes |
|---|---|
| `price_source` | `tag` (read from swing tag), `ai_suggested` (AI guess used because no tag was legible), `staff` (confirmed on the scanner's review screen). **Show "est." or hide items when `ai_suggested`** if you want to be strict. |
| `needs_review` | true for AI-priced, low-confidence or fallback items |
| `original_photo_url` | full untouched frame |
| `subcategory`, `secondary_colours`, `pattern`, `barcode` | extra AI metadata |
| `ai_confidence` | jsonb `{overall, category, colour, size, brand, condition, price_tag}`, each 0–1 |
| `ai_model`, `scan_source` | provenance (e.g. `gemini-3.5-flash-lite`, `fallback`) |
| `silhouette`, `three_d_template_type`, `three_d_asset_url` | future 3D mannequin hooks (template filled from category, asset URL null) |

**Query available stock:**

```ts
const { data } = await supabase
  .from("items")
  .select("*")
  .eq("status", "available")
  .order("created_at", { ascending: false });
```

**Live updates:** `items` is already in the `supabase_realtime` publication, so new scans arrive as `INSERT` events:

```ts
supabase
  .channel("items")
  .on("postgres_changes", { event: "*", schema: "public", table: "items" }, (p) => {
    /* p.eventType === "INSERT" → new garment from the scanner */
  })
  .subscribe();
```

**HTTP (no Supabase needed):** `GET <scanner>/api/items?limit=60` returns `{ items: Item[] }` in the same shape. Useful for the local demo.

---

## Code map

| path | what |
|---|---|
| `components/Scanner.tsx` | camera, state machine, kiosk UI |
| `lib/detector.ts` | presence / motion / bbox / colour from 64×48 frames |
| `lib/client/capture.ts` | full-res capture + crop, BarcodeDetector, rack QR parsing |
| `app/api/scan/route.ts` | upload photos ∥ analyse → insert item |
| `lib/analysis/gemini.ts` | Gemini vision call (JSON schema output) — default |
| `lib/analysis/claude.ts` | Claude vision call (alternative provider) |
| `lib/analysis/prompt.ts` | cataloguing instructions shared by both |
| `lib/analysis/fallback.ts` | **fallback analyser**, used only when AI is unavailable |
| `lib/analysis/toItem.ts` | analysis → `items` row (price rules, review flag) |
| `lib/store/{supabase,local}.ts` | Supabase or local JSON storage |
| `app/inventory/page.tsx` | internal review screen: confirm AI prices, edit, delete |
