-- =========================================================
-- Cubo Criativo — Pix: lembrete de pagamento pendente
--
-- Cole no Supabase -> SQL Editor -> RUN
-- =========================================================

alter table public.orders add column if not exists pix_reminder_sent_at timestamptz;
alter table public.orders add column if not exists pix_reminder_count int not null default 0;

-- (Opcional) para auditoria futura
alter table public.orders add column if not exists pix_reminder_last_kind text;
