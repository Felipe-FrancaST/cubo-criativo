-- Cubo Criativo — avaliações verificadas e moderação
-- Execute uma vez no Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.customer_reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null,
  user_id uuid not null,
  rating smallint not null,
  comment text not null,
  display_name text,
  city text,
  state text,
  order_total numeric(12,2),
  product_ids uuid[],
  product_slugs text[],
  product_names text[],
  approved boolean not null default false,
  featured boolean not null default false,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.customer_reviews add column if not exists order_id uuid;
alter table public.customer_reviews add column if not exists user_id uuid;
alter table public.customer_reviews add column if not exists rating smallint;
alter table public.customer_reviews add column if not exists comment text;
alter table public.customer_reviews add column if not exists display_name text;
alter table public.customer_reviews add column if not exists city text;
alter table public.customer_reviews add column if not exists state text;
alter table public.customer_reviews add column if not exists order_total numeric(12,2);
alter table public.customer_reviews add column if not exists product_ids uuid[];
alter table public.customer_reviews add column if not exists product_slugs text[];
alter table public.customer_reviews add column if not exists product_names text[];
alter table public.customer_reviews add column if not exists approved boolean not null default false;
alter table public.customer_reviews add column if not exists featured boolean not null default false;
alter table public.customer_reviews add column if not exists approved_at timestamptz;
alter table public.customer_reviews add column if not exists created_at timestamptz not null default now();
alter table public.customer_reviews add column if not exists updated_at timestamptz not null default now();

update public.customer_reviews set approved = false where approved is null;
update public.customer_reviews set featured = false where featured is null;

alter table public.customer_reviews drop constraint if exists customer_reviews_rating_check;
alter table public.customer_reviews add constraint customer_reviews_rating_check check (rating between 1 and 5);
alter table public.customer_reviews drop constraint if exists customer_reviews_comment_length_check;
alter table public.customer_reviews add constraint customer_reviews_comment_length_check check (char_length(btrim(comment)) between 8 and 500);

create unique index if not exists customer_reviews_order_key on public.customer_reviews(order_id);
create index if not exists customer_reviews_user_idx on public.customer_reviews(user_id);
create index if not exists customer_reviews_public_idx on public.customer_reviews(approved, featured, approved_at desc, created_at desc);
create index if not exists customer_reviews_product_ids_idx on public.customer_reviews using gin(product_ids);
create index if not exists customer_reviews_product_slugs_idx on public.customer_reviews using gin(product_slugs);

create or replace function public.set_customer_reviews_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_customer_reviews_updated_at on public.customer_reviews;
create trigger trg_customer_reviews_updated_at
before update on public.customer_reviews
for each row execute function public.set_customer_reviews_updated_at();

create or replace function public.protect_customer_review_moderation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_admin boolean := exists (select 1 from public.admins a where a.user_id = auth.uid());
begin
  if not is_admin then
    new.approved := false;
    new.featured := false;
    new.approved_at := null;
    if tg_op = 'UPDATE' then
      new.order_id := old.order_id;
      new.user_id := old.user_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_customer_review_moderation on public.customer_reviews;
create trigger trg_protect_customer_review_moderation
before insert or update on public.customer_reviews
for each row execute function public.protect_customer_review_moderation();

alter table public.customer_reviews enable row level security;

-- Remove políticas antigas para impedir que o cliente aprove a própria avaliação.
do $$
declare policy_row record;
begin
  for policy_row in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'customer_reviews'
  loop
    execute format('drop policy if exists %I on public.customer_reviews', policy_row.policyname);
  end loop;
end $$;

create policy customer_reviews_owner_select
on public.customer_reviews for select
to authenticated
using (user_id = auth.uid());

create policy customer_reviews_owner_insert_delivered
on public.customer_reviews for insert
to authenticated
with check (
  user_id = auth.uid()
  and approved = false
  and featured = false
  and exists (
    select 1 from public.orders o
    where o.id = order_id
      and o.user_id = auth.uid()
      and lower(coalesce(o.production_status, '')) = 'entregue'
  )
);

create policy customer_reviews_owner_update_delivered
on public.customer_reviews for update
to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and approved = false
  and featured = false
  and approved_at is null
  and exists (
    select 1 from public.orders o
    where o.id = order_id
      and o.user_id = auth.uid()
      and lower(coalesce(o.production_status, '')) = 'entregue'
  )
);

create policy customer_reviews_admin_select
on public.customer_reviews for select
to authenticated
using (exists (select 1 from public.admins a where a.user_id = auth.uid()));

create policy customer_reviews_admin_update
on public.customer_reviews for update
to authenticated
using (exists (select 1 from public.admins a where a.user_id = auth.uid()))
with check (exists (select 1 from public.admins a where a.user_id = auth.uid()));

create policy customer_reviews_admin_delete
on public.customer_reviews for delete
to authenticated
using (exists (select 1 from public.admins a where a.user_id = auth.uid()));

-- Visão pública sem IDs privados de usuário/pedido.
create or replace view public.customer_reviews_public
with (security_barrier = true)
as
select
  id,
  rating,
  comment,
  case when position('@' in coalesce(display_name, '')) > 0 then 'Cliente verificado' else display_name end as display_name,
  city,
  state,
  product_ids,
  product_slugs,
  product_names,
  featured,
  created_at,
  approved_at
from public.customer_reviews
where approved = true;

revoke all on public.customer_reviews from anon, authenticated;
grant select, insert, update, delete on public.customer_reviews to authenticated;
revoke all on public.customer_reviews_public from public;
grant select on public.customer_reviews_public to anon, authenticated;

comment on table public.customer_reviews is 'Avaliações verificadas vinculadas a pedidos entregues.';
comment on view public.customer_reviews_public is 'Somente avaliações aprovadas, sem dados privados do pedido ou usuário.';
