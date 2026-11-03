-- Bakasana katalog veritabanı
-- Supabase panelinde: SQL Editor > New query > bu dosyayı yapıştırıp "Run" deyin.
-- Ardından seed.sql dosyasını çalıştırarak mevcut ürünleri yükleyin.

-- Kategoriler
create table if not exists public.categories (
  id          text primary key,              -- adreste görünür: mutfak, askilar...
  name        text not null,
  description text,
  sort        int  not null default 0
);

-- Ürünler
create table if not exists public.products (
  id              uuid primary key default gen_random_uuid(),
  slug            text unique not null,      -- ürün adresi: /urun/<slug>/
  barcode         text unique,               -- Trendyol barkodu; içe aktarmada eşleştirme için
  name            text not null,
  brand           text not null default 'Bakasana',
  category_id     text references public.categories(id) on update cascade,
  description     text,
  features        text[] not null default '{}',
  price           numeric(10,2),             -- boş bırakılırsa sitede fiyat gösterilmez
  list_price      numeric(10,2),             -- indirim öncesi fiyat (isteğe bağlı)
  image_url       text,                      -- ana görsel (images listesinin ilki)
  images          text[] not null default '{}', -- tüm ürün fotoğrafları, sırasıyla
  in_stock        boolean not null default true, -- false: sitede "şu an stokta yok" yazar
  trendyol_url    text,
  hepsiburada_url text,
  amazon_url      text,
  rating          numeric(2,1),
  rating_count    int,
  rating_source   text,                      -- ör. 'Hepsiburada'
  sort            int  not null default 0,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists products_category_idx on public.products(category_id);

-- updated_at otomatik güncellensin (sitemap'teki "son değişiklik" tarihi buradan gelir)
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

drop trigger if exists products_touch on public.products;
create trigger products_touch before update on public.products
for each row execute function public.touch_updated_at();

-- Mağaza butonu tıklamaları (hangi kanal daha çok ilgi görüyor?)
create table if not exists public.clicks (
  id           bigint generated always as identity primary key,
  product_slug text,
  channel      text not null check (channel in ('trendyol','hepsiburada','amazon')),
  page         text,
  created_at   timestamptz not null default now()
);

-- Güvenlik (Row Level Security)
-- Sitedeki herkese açık anahtar (anon key) yalnızca şunları yapabilir:
--   * aktif ürünleri ve kategorileri OKUMAK
--   * tıklama kaydı EKLEMEK (okuyamaz, silemez)
-- Ürün ekleme/düzenleme yalnızca Supabase panelinden (giriş yapmış siz) yapılır.
alter table public.categories enable row level security;
alter table public.products   enable row level security;
alter table public.clicks     enable row level security;

drop policy if exists "categories public read" on public.categories;
create policy "categories public read" on public.categories
  for select to anon, authenticated using (true);

drop policy if exists "products public read" on public.products;
create policy "products public read" on public.products
  for select to anon, authenticated using (is_active);

drop policy if exists "clicks anonymous insert" on public.clicks;
create policy "clicks anonymous insert" on public.clicks
  for insert to anon, authenticated
  with check (char_length(coalesce(product_slug,'')) < 200 and char_length(coalesce(page,'')) < 300);

-- Raporlama: kanal bazında tıklama sayıları (panelden okuyun)
create or replace view public.click_report as
select channel, product_slug, count(*) as clicks, max(created_at) as last_click
from public.clicks
group by channel, product_slug
order by clicks desc;

revoke all on public.click_report from anon, authenticated;

-- Önceki sürümden yükseltiyorsanız (tablo zaten varsa) yeni sütunları ekler:
alter table public.products add column if not exists barcode  text unique;
alter table public.products add column if not exists images   text[] not null default '{}';
alter table public.products add column if not exists in_stock boolean not null default true;
