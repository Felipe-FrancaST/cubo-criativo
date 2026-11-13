-- Executar APÓS as migrações anteriores. Não modifica pedidos antigos.
create table if not exists public.shipping_settings (
 id text primary key default 'default',
 origin_zip text not null default '47803604' check (origin_zip ~ '^\d{8}$'),
 services text not null default '1,2,17',
 packages jsonb not null default '{}'::jsonb,
 mini_fee_cents integer not null default 500 check (mini_fee_cents between 0 and 100000),
 other_fee_cents integer not null default 1000 check (other_fee_cents between 0 and 100000),
 enabled boolean not null default true,
 updated_at timestamptz not null default now()
);
insert into public.shipping_settings (id) values ('default') on conflict (id) do nothing;
alter table public.shipping_settings enable row level security;
revoke all on public.shipping_settings from anon, authenticated;

create table if not exists public.order_shipping (
 order_id uuid primary key references public.orders(id) on delete cascade,
 user_id uuid not null references auth.users(id),
 origin_zip text not null,
 destination_zip text not null,
 carrier text not null,
 service_id text not null,
 service_name text not null,
 delivery_days integer,
 base_cents integer not null check (base_cents >= 0),
 fee_cents integer not null check (fee_cents >= 0),
 total_cents integer not null check (total_cents = base_cents + fee_cents),
 parcels jsonb not null default '[]'::jsonb,
 created_at timestamptz not null default now()
);
create index if not exists order_shipping_user_idx on public.order_shipping(user_id, created_at desc);
alter table public.order_shipping enable row level security;
revoke insert, update, delete on public.order_shipping from anon, authenticated;
revoke select on public.order_shipping from anon;
grant select on public.order_shipping to authenticated;
drop policy if exists order_shipping_self_read on public.order_shipping;
create policy order_shipping_self_read on public.order_shipping for select to authenticated using (user_id = (select auth.uid()));
