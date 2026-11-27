-- Construções têm apresentação própria, mas usam a mesma vaga de boss.
-- Preserva item_type e todas as regras/seleções dos planos existentes.
begin;
alter table public.vip_mini_options
  add column if not exists display_type text;
alter table public.vip_mini_options
  drop constraint if exists vip_mini_options_display_type_check;
alter table public.vip_mini_options
  add constraint vip_mini_options_display_type_check
  check (display_type is null or (display_type = 'construction' and item_type is not null and item_type = 'boss'));
notify pgrst, 'reload schema';
commit;
