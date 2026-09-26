-- Charity shop storefront schema. Run this once in the Supabase SQL editor,
-- then run seed.sql for demo data. Safe to re-run.


-- ---------------------------------------------------------------------------
-- receipts (created by the kiosk when a shopper prints their list)
-- ---------------------------------------------------------------------------
create table if not exists public.receipts (
  id           text primary key,                       -- short code, e.g. 'R7K4QX' (also encoded in the QR)
  created_at   timestamptz not null default now(),
  status       text not null default 'open' check (status in ('open', 'closed')),
  total_pence  integer not null default 0
);

-- ---------------------------------------------------------------------------
-- items (written by the scanning / intake app)
-- ---------------------------------------------------------------------------
create table if not exists public.items (
  id                     uuid primary key default gen_random_uuid(),
  sku                    text unique,                  -- human code on the swing tag, e.g. 'OX-0142' (optional)
  title                  text not null,                -- short description: 'Wool double-breasted coat'
  description            text,
  department             text not null default 'unisex'
                           check (department in ('womens', 'mens', 'unisex', 'kids')),
  category               text not null
                           check (category in ('coats-jackets','knitwear','tops','t-shirts','shirts','dresses',
                                               'skirts','trousers','jeans','shorts','shoes','bags','accessories')),
  size_label             text,                         -- exactly as on the label: '12', 'M', 'W32 L30', 'UK 7'
  size_alpha             text check (size_alpha in ('XXS','XS','S','M','L','XL','XXL')),  -- normalised; null for shoes/bags
  waist_in               integer,                      -- bottoms only
  colour                 text not null
                           check (colour in ('black','white','grey','navy','blue','green','red','pink','purple',
                                             'yellow','orange','brown','beige','gold','silver','multi')),
  brand                  text,
  material               text,
  condition              text not null default 'good'
                           check (condition in ('new_with_tags','excellent','good','fair')),
  price_pence            integer not null check (price_pence >= 0),
  suggested_price_pence  integer,                      -- AI suggestion from the scanner (price_pence is what we charge)
  rack                   text not null,                -- where it hangs, e.g. 'B3'
  photos                 text[] not null default '{}', -- public URLs; the first one is the hero image
  tags                   text[] not null default '{}', -- style keywords: 'warm', 'vintage', 'party'
  status                 text not null default 'available'
                           check (status in ('available', 'on_receipt', 'sold')),
  receipt_id             text references public.receipts(id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists items_status_idx on public.items (status);
create index if not exists items_category_idx on public.items (category);

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists items_touch on public.items;
create trigger items_touch before update on public.items
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- receipt lines (snapshot of what was printed)
-- ---------------------------------------------------------------------------
create table if not exists public.receipt_items (
  receipt_id   text not null references public.receipts(id) on delete cascade,
  item_id      uuid not null references public.items(id) on delete cascade,
  title        text not null,
  rack         text not null,
  price_pence  integer not null,
  outcome      text not null default 'pending' check (outcome in ('pending', 'sold', 'returned')),
  primary key (receipt_id, item_id)
);

-- ---------------------------------------------------------------------------
-- AI assistant log (observability: what was asked, searched and shown)
-- ---------------------------------------------------------------------------
create table if not exists public.ai_logs (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  session_id    text,
  user_message  text not null,
  tool_calls    jsonb not null default '[]',
  item_ids      text[] not null default '{}',
  reply         text not null default '',
  model         text not null default '',
  latency_ms    integer not null default 0
);

-- ---------------------------------------------------------------------------
-- create_receipt: atomically claim items. If any item is not available
-- nothing is written, so two shoppers can never print the same item.
-- ---------------------------------------------------------------------------
create or replace function public.create_receipt(p_id text, p_item_ids uuid[])
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_unavailable uuid[];
  v_total integer;
begin
  -- lock the rows so concurrent checkouts serialise
  perform 1 from items where id = any(p_item_ids) for update;

  select coalesce(array_agg(x), '{}') into v_unavailable
  from unnest(p_item_ids) as x
  where not exists (select 1 from items i where i.id = x and i.status = 'available');

  if coalesce(array_length(v_unavailable, 1), 0) > 0 then
    return jsonb_build_object('ok', false, 'unavailable', to_jsonb(v_unavailable));
  end if;

  select coalesce(sum(price_pence), 0) into v_total from items where id = any(p_item_ids);

  insert into receipts (id, total_pence) values (p_id, v_total);
  insert into receipt_items (receipt_id, item_id, title, rack, price_pence)
    select p_id, i.id, i.title, i.rack, i.price_pence from items i where i.id = any(p_item_ids);
  update items set status = 'on_receipt', receipt_id = p_id where id = any(p_item_ids);

  return jsonb_build_object('ok', true, 'id', p_id);
end $$;

-- ---------------------------------------------------------------------------
-- set_receipt_outcome: staff marks a line sold / returned to rack.
-- ---------------------------------------------------------------------------
create or replace function public.set_receipt_outcome(p_receipt_id text, p_item_id uuid, p_outcome text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_outcome not in ('pending', 'sold', 'returned') then
    raise exception 'bad outcome %', p_outcome;
  end if;

  update receipt_items set outcome = p_outcome
   where receipt_id = p_receipt_id and item_id = p_item_id;

  update items set
    status = case p_outcome when 'sold' then 'sold' when 'returned' then 'available' else 'on_receipt' end,
    receipt_id = case p_outcome when 'returned' then null else p_receipt_id end
  where id = p_item_id;

  update receipts set status = case
      when exists (select 1 from receipt_items where receipt_id = p_receipt_id and outcome = 'pending') then 'open'
      else 'closed' end
   where id = p_receipt_id;
end $$;

-- ---------------------------------------------------------------------------
-- Row level security: the public (anon key) can read items — the browser uses
-- this for live updates. Everything else goes through server routes that use
-- the service-role key, which bypasses RLS.
-- ---------------------------------------------------------------------------
alter table public.items enable row level security;
alter table public.receipts enable row level security;
alter table public.receipt_items enable row level security;
alter table public.ai_logs enable row level security;

drop policy if exists "items are publicly readable" on public.items;
create policy "items are publicly readable" on public.items for select using (true);

-- Realtime: broadcast item changes (status flips, new stock from the scanner).
do $$ begin
  alter publication supabase_realtime add table public.items;
exception when duplicate_object then null; when undefined_object then null;
end $$;

-- Storage bucket for item photos (public read).
insert into storage.buckets (id, name, public)
values ('item-photos', 'item-photos', true)
on conflict (id) do nothing;
