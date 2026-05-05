-- ============================================================
-- PromoHub — Supabase SQL Schema
-- Run this entire file in Supabase Dashboard > SQL Editor
-- ============================================================

-- TABLE 1: Promo Requests
create table promo_requests (
  id                    uuid primary key default gen_random_uuid(),
  created_at            timestamptz default now(),
  promo_request_id      text,
  week_label            text,
  date_of_entry         date default current_date,
  store                 text,
  category              text,
  brand_names           text,
  poc_name              text,
  funded_by             text,
  offer_type            text,
  promo_details         text,
  promotion_name        text,
  assortment_type       text,
  offline_online        text,
  broadway_discount_pct text,
  brand_discount_pct    text,
  broadway_discount_both text,
  brand_discount_both   text,
  date_ranges           jsonb default '[]',
  approval_email        text,
  approval_email_alt    text,
  rsp_file_link         text,
  sku_file_link         text,
  status                text default 'Pending',
  current_status        text default 'Not Live',
  shopify_promo_status  text,
  status_floor_team     text,
  ginesys_promo_id      text,
  shopify_discount_id   text,
  remark                text
);

-- Auto-generate promo_request_id (#101, #102, ...)
create sequence promo_request_seq start 101;

create or replace function set_promo_request_id()
returns trigger language plpgsql as $$
begin
  if new.promo_request_id is null or new.promo_request_id = '' then
    new.promo_request_id := '#' || nextval('promo_request_seq')::text;
  end if;
  return new;
end;
$$;

create trigger trg_promo_request_id
  before insert on promo_requests
  for each row execute function set_promo_request_id();

-- TABLE 2: SKU Items (barcode level)
create table sku_items (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz default now(),
  promo_id         uuid references promo_requests(id) on delete cascade,
  promo_request_id text,
  brand_name       text,
  barcode          text,
  sku_name         text,
  mrp              numeric,
  discount_pct     numeric,
  offer_price      numeric,
  rsp              numeric,
  store            text,
  offer_type       text
);

-- Row Level Security — fully public (no login needed)
alter table promo_requests enable row level security;
create policy "public select" on promo_requests for select using (true);
create policy "public insert" on promo_requests for insert with check (true);
create policy "public update" on promo_requests for update using (true);

alter table sku_items enable row level security;
create policy "public select" on sku_items for select using (true);
create policy "public insert" on sku_items for insert with check (true);
create policy "public update" on sku_items for update using (true);
create policy "public delete" on sku_items for delete using (true);
