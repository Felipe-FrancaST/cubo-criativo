-- Migração segura (idempotente) para garantir colunas/tabelas usadas pelo site
-- Rode no Supabase SQL Editor. Pode executar mais de uma vez.

create extension if not exists pgcrypto;

-- Profiles (se não existir)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  address_line1 text,
  address_line2 text,
  neighborhood text,
  city text,
  state text,
  zip text,
  created_at timestamptz not null default now()
);

-- Orders (cria se não existir)
create table if not exists public.orders (
  id uuid primary key,
  user_id uuid references auth.users(id) on delete set null,
  status text not null default 'pending',
  currency text not null default 'BRL',
  total numeric(10,2) not null default 0,
  payment_provider text,
  provider_payment_id text,
  customer_email text,
  customer_name text,
  customer_phone text,
  created_at timestamptz not null default now()
);

-- Garante colunas (caso a tabela já existisse sem elas)
alter table public.orders add column if not exists customer_email text;
alter table public.orders add column if not exists customer_name text;
alter table public.orders add column if not exists customer_phone text;
alter table public.orders add column if not exists provider_payment_id text;
alter table public.orders add column if not exists payment_provider text;
alter table public.orders add column if not exists total numeric(10,2) not null default 0;
alter table public.orders add column if not exists created_at timestamptz not null default now();

-- Order items
create table if not exists public.order_items (
  id bigserial primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id text,
  name text not null,
  scale text,
  qty int not null default 1,
  unit_price numeric(10,2) not null default 0,
  img text,
  created_at timestamptz not null default now()
);

alter table public.order_items add column if not exists img text;
alter table public.order_items add column if not exists scale text;
alter table public.order_items add column if not exists product_id text;

-- RLS (se você já usa RLS, mantenha; isso só habilita se ainda estiver desligado)
alter table public.profiles enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- Policies básicas (idempotentes)
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

drop policy if exists "orders_select_own" on public.orders;
create policy "orders_select_own" on public.orders
  for select using (auth.uid() = user_id);

drop policy if exists "orders_insert_own" on public.orders;
create policy "orders_insert_own" on public.orders
  for insert with check (auth.uid() = user_id);

drop policy if exists "orders_update_own" on public.orders;
create policy "orders_update_own" on public.orders
  for update using (auth.uid() = user_id);

drop policy if exists "order_items_select_own" on public.order_items;
create policy "order_items_select_own" on public.order_items
  for select using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));

drop policy if exists "order_items_insert_own" on public.order_items;
create policy "order_items_insert_own" on public.order_items
  for insert with check (exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));
