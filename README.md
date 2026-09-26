# Thrift kiosk — a searchable, AI-assisted charity shop

Charity shops are full of good, one-of-a-kind clothes that are hard to find. This project turns a shop into a searchable store with no reorganising:

1. **Scanner** (stockroom): volunteers hang each donation on a hook in front of a camera. AI catalogues it (category, size, colour, brand, condition) and prices it from the tag or UK resale listings. The item is saved with the rack it's going to.
2. **Storefront** (iPad on the shop floor): shoppers browse or search the live stock, or ask the AI assistant. They collect picks on a receipt and print it. The receipt lists each item's rack, so they can find things, try them on and pay at the till.
3. **Till** (`/staff`): staff scan the receipt's QR code and mark items sold, or returned to the rack.

## Monorepo layout

```
packages/shared/   item contract (types), seed stock, local demo store, design tokens, logo
storefront/        shopper kiosk + staff till       → http://localhost:3000
scanner/           hands-free intake station        → http://localhost:3001
```

npm workspaces with one lockfile. Both apps use the same design language (`packages/shared/src/theme.css`, the same fonts and the same Oxfam mark) and the same `items` table.

## Run it

```bash
npm install
cp .env.example .env.local     # add GEMINI_API_KEY (+ TAVILY_API_KEY for market pricing)
npm run dev                    # starts both apps
```

| Command | What it does |
|---|---|
| `npm run dev` | Storefront on :3000 and scanner on :3001 together |
| `npm run dev:storefront` / `npm run dev:scanner` | Just one app |
| `npm run build` | Production build of both |
| `npm run typecheck` | Type-checks both |
| `npm run reset-demo` | Wipes the local demo store: seed stock back on the rails, scans and receipts cleared |

**No database needed for a demo.** Without Supabase keys, both apps share a JSON store in `.data/` (git-ignored). Garments scanned on :3001 appear on the storefront at :3000 within a few seconds, photos included. Printing a receipt reserves items for both apps.

**With Supabase:** run `storefront/supabase/schema.sql`, `storefront/supabase/seed.sql`, then `scanner/supabase/scanner.sql`. Then set the three Supabase variables in `.env.local`. New scans reach the kiosk instantly via Realtime.

One `.env.local` at the repo root configures both apps (see `.env.example`). An app-level `storefront/.env.local` or `scanner/.env.local` overrides it if present.

## Deploy (Vercel)

Create two Vercel projects from this repo:
- one with Root Directory `storefront`
- one with Root Directory `scanner`

Vercel installs the workspace from the repo root automatically. Give both the same env vars, including Supabase: on Vercel the local `.data/` store is per-instance and temporary, so the apps need a real database to share data. Set `NEXT_PUBLIC_STOREFRONT_URL` / `NEXT_PUBLIC_SCANNER_URL` to the deployed URLs so the cross-links work. The scanner's camera needs `https://`.

More detail: [storefront/README.md](storefront/README.md) · [scanner/README.md](scanner/README.md)
