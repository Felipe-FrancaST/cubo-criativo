-- Cole este SQL no Supabase (SQL Editor) para criar as tabelas e políticas.

create extension if not exists pgcrypto;

-- Perfil opcional (para guardar nome/telefone)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  created_at timestamptz not null default now()
);

-- Pedidos
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

-- Itens do pedido
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

-- =====================
-- RLS
-- =====================
alter table public.profiles enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- Profiles: o dono pode ver/alterar
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- Orders: o dono pode ver (os inserts/updates do site são feitos via Service Role, mas mantemos policy)
drop policy if exists "orders_select_own" on public.orders;
create policy "orders_select_own" on public.orders
  for select using (auth.uid() = user_id);

-- Order items: só vê se o pedido é seu
drop policy if exists "order_items_select_own" on public.order_items;
create policy "order_items_select_own" on public.order_items
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and o.user_id = auth.uid()
    )
  );

-- =====================
-- Trigger: cria profile automaticamente quando um usuário se cadastra
-- =====================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();
