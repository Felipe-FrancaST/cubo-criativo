-- Adiciona status de produção/envio no painel de pedidos
-- Rode no Supabase (SQL Editor) UMA VEZ.

alter table public.orders
  add column if not exists production_status text not null default 'recebido',
  add column if not exists shipping_tracking text,
  add column if not exists refund_requested boolean not null default false,
  add column if not exists refund_requested_at timestamptz;

-- Opcional: ajuda a filtrar por status (não é obrigatório)
create index if not exists idx_orders_production_status on public.orders(production_status);

-- Opcional: ajuda a achar pedidos com reembolso solicitado
create index if not exists idx_orders_refund_requested on public.orders(refund_requested);
