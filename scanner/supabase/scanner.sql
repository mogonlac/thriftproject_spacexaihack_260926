-- Scanner extension to the shared items table.
-- Run AFTER storefront/supabase/schema.sql. Safe to re-run.
-- Every column is optional/defaulted, so the storefront keeps working unchanged.

alter table public.items
  -- price_pence is NOT NULL in the shared schema. When no price tag could be read,
  -- the scanner writes the AI suggestion there and marks it here so it is never
  -- mistaken for a staff-confirmed price.
  add column if not exists price_source text not null default 'tag'
    check (price_source in ('tag', 'ai_suggested', 'staff')),
  add column if not exists needs_review boolean not null default false,

  add column if not exists original_photo_url text,           -- untouched full camera frame
  add column if not exists subcategory text,                  -- 'Denim jacket', 'Midi dress'
  add column if not exists secondary_colours text[] not null default '{}',
  add column if not exists pattern text,                      -- 'solid', 'striped', 'floral', ...
  add column if not exists barcode text,                      -- barcode / QR / printed code on the tag
  add column if not exists ai_confidence jsonb,               -- {"overall":0.8,"category":0.9,...}
  add column if not exists ai_model text,                     -- 'claude-opus-5' or 'fallback'
  add column if not exists scan_source text,                  -- which scanning station

  -- Future 3D mannequin hooks (null for now)
  add column if not exists silhouette text,                   -- 'boxy', 'fitted', 'a-line', ...
  add column if not exists three_d_template_type text,        -- generic template id, e.g. 'jacket_denim'
  add column if not exists three_d_asset_url text,

  -- Market evidence behind suggested_price_pence (UK resale listings via Tavily web search):
  -- {"resale_low_gbp":30,"resale_typical_gbp":45,"resale_high_gbp":80,"suggested_gbp":24.5,
  --  "summary":"...","sources":[{"title":"...","url":"..."}],"confidence":0.8,...}
  add column if not exists valuation jsonb;

create index if not exists items_needs_review_idx on public.items (needs_review) where needs_review;
