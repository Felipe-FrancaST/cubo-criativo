-- Catálogo não possui estoque; pronta entrega exige quantidade não negativa.
-- Execute antes de publicar a nova versão do site.
begin;
alter table public.products alter column stock drop not null;
alter table public.products alter column stock drop default;
update public.products set stock = null where status = 'catalogo' and stock is not null;
update public.products set stock = 0 where status = 'estoque' and stock is null;
alter table public.products drop constraint if exists products_sale_mode_stock_check;
alter table public.products add constraint products_sale_mode_stock_check check (
  (status is distinct from 'catalogo' or stock is null)
  and (status is distinct from 'estoque' or (stock is not null and stock >= 0))
);
commit;
