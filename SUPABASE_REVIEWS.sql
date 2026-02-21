-- Avaliações de pedidos entregues (Cubo Criativo)
-- Execute este script no SQL Editor do Supabase

create extension if not exists pgcrypto;

create table if not exists public.customer_reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique,
  user_id uuid not null,
  rating int not null check (rating between 1 and 5),
  comment text not null check (char_length(trim(comment)) >= 8 and char_length(comment) <= 500),
  display_name text not null,
  city text,
  state text,
  approved boolean not null default true,
  order_total numeric,
  product_names text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customer_reviews_created_at_idx on public.customer_reviews (created_at desc);
create index if not exists customer_reviews_user_id_idx on public.customer_reviews (user_id);
create index if not exists customer_reviews_approved_idx on public.customer_reviews (approved);

create or replace function public.set_updated_at_customer_reviews()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_customer_reviews_updated_at on public.customer_reviews;
create trigger trg_customer_reviews_updated_at
before update on public.customer_reviews
for each row execute function public.set_updated_at_customer_reviews();

alter table public.customer_reviews enable row level security;

-- Leitura pública apenas de avaliações aprovadas (para Home)
drop policy if exists "customer_reviews_public_read_approved" on public.customer_reviews;
create policy "customer_reviews_public_read_approved"
on public.customer_reviews
for select
to anon, authenticated
using (approved = true);

-- Usuário autenticado pode ler as próprias avaliações (mesmo se approved=false futuramente)
drop policy if exists "customer_reviews_user_read_own" on public.customer_reviews;
create policy "customer_reviews_user_read_own"
on public.customer_reviews
for select
to authenticated
using (auth.uid() = user_id);

-- Usuário autenticado pode inserir apenas avaliação do próprio usuário e de pedido próprio entregue/pago
-- (se a tabela orders existir com user_id / production_status / status)
drop policy if exists "customer_reviews_user_insert_own_delivered_order" on public.customer_reviews;
create policy "customer_reviews_user_insert_own_delivered_order"
on public.customer_reviews
for insert
to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.orders o
    where o.id = customer_reviews.order_id
      and o.user_id = auth.uid()
      and lower(coalesce(o.production_status, 'recebido')) = 'entregue'
  )
);

-- Usuário autenticado pode atualizar apenas a própria avaliação
-- mantendo vínculo com pedido próprio entregue
-- (permite editar texto/nota depois)
drop policy if exists "customer_reviews_user_update_own" on public.customer_reviews;
create policy "customer_reviews_user_update_own"
on public.customer_reviews
for update
to authenticated
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.orders o
    where o.id = customer_reviews.order_id
      and o.user_id = auth.uid()
      and lower(coalesce(o.production_status, 'recebido')) = 'entregue'
  )
);

-- Opcional: impedir delete pelo usuário (sem policy de delete)
