-- ==============================
-- Cubo Criativo — Migração para catálogo/produtos no Supabase
-- Cole no Supabase -> SQL Editor -> RUN
-- ==============================

-- Extensão para UUID (gen_random_uuid)
create extension if not exists pgcrypto;

-- =========================================================
-- 1) Tabela PRODUCTS (fonte de verdade do catálogo)
-- =========================================================
create table if not exists public.products (
  id text primary key,
  name text not null,
  image_url text,
  images jsonb not null default '[]'::jsonb,         -- array de URLs
  model_url text,
  status text not null default 'catalogo',           -- 'estoque' | 'catalogo'
  featured boolean not null default false,
  tags text[] not null default '{}'::text[],
  default_variant text,
  variants jsonb not null default '[]'::jsonb,       -- [{label, price}]
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Se a tabela já existir com parte das colunas, garante colunas faltantes:
alter table public.products add column if not exists name text;
alter table public.products add column if not exists image_url text;
alter table public.products add column if not exists images jsonb;
alter table public.products alter column images set default '[]'::jsonb;
alter table public.products add column if not exists model_url text;
alter table public.products add column if not exists status text;
alter table public.products alter column status set default 'catalogo';
alter table public.products add column if not exists featured boolean;
alter table public.products alter column featured set default false;
alter table public.products add column if not exists tags text[];
alter table public.products alter column tags set default '{}'::text[];
alter table public.products add column if not exists default_variant text;
alter table public.products add column if not exists variants jsonb;
alter table public.products alter column variants set default '[]'::jsonb;
alter table public.products add column if not exists created_at timestamptz;
alter table public.products alter column created_at set default now();
alter table public.products add column if not exists updated_at timestamptz;
alter table public.products alter column updated_at set default now();

-- Trigger simples para updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_products_updated_at on public.products;
create trigger set_products_updated_at
before update on public.products
for each row execute procedure public.set_updated_at();

-- =========================================================
-- 2) Ajustes para ORDERS (debug de emails)
-- =========================================================
alter table public.orders add column if not exists owner_email_sent_at timestamptz;
alter table public.orders add column if not exists customer_email_sent_at timestamptz;
alter table public.orders add column if not exists customer_email_error text;

-- =========================================================
-- 3) Ajustes para ORDER_ITEMS (snapshot de produto)
-- =========================================================
alter table public.order_items add column if not exists product_name text;
alter table public.order_items add column if not exists product_image_url text;
alter table public.order_items add column if not exists scale text;

-- Se a coluna id for uuid e não tiver default, seta default gen_random_uuid()
do $$
declare
  id_type text;
begin
  select data_type into id_type
  from information_schema.columns
  where table_schema='public' and table_name='order_items' and column_name='id';

  if id_type = 'uuid' then
    begin
      execute 'alter table public.order_items alter column id set default gen_random_uuid()';
    exception when others then
      -- ignore
      null;
    end;
  end if;
end $$;

-- =========================================================
-- 4) RLS: PRODUCTS precisa ser público para o site carregar
-- =========================================================
alter table public.products enable row level security;

drop policy if exists "products_select_all" on public.products;
create policy "products_select_all" on public.products
  for select
  using (true);

-- (Opcional) Se você quiser bloquear inserts/updates via anon, não crie policy para isso.
-- Pelo Table Editor você consegue editar como admin normalmente.

SQL