-- Cubo Criativo — escopos específicos para cupons de vendedores
-- Execute no SQL Editor do Supabase antes de publicar a nova versão.
-- Preserva os cupons e históricos existentes; altera somente a validação de aplicaçao.
-- Escopos legados:
--   products = loja + personalizadas, vip = assinaturas, both = TUDO
-- Novos escopos:
--   shop_only = somente loja, custom_only = somente personalizadas,
--   shop_vip = loja + assinaturas, custom_vip = personalizadas + assinaturas.
BEGIN;

DO $$
DECLARE
  old_check record;
BEGIN
  IF to_regclass('public.coupons') IS NULL THEN
    RAISE EXCEPTION 'Tabela public.coupons não encontrada.';
  END IF;
  -- Remove somente checks preexistentes que envolvem a coluna applies_to.
  FOR old_check IN
    SELECT conname
      FROM pg_constraint
     WHERE conrelid = 'public.coupons'::regclass
       AND contype = 'c'
       AND pg_get_constraintdef(oid) ~* '\mapplies_to\M'
  LOOP
    EXECUTE format('ALTER TABLE public.coupons DROP CONSTRAINT %I', old_check.conname);
  END LOOP;
END
$$;

ALTER TABLE public.coupons
  ADD CONSTRAINT coupons_applies_to_all_scopes_check
  CHECK (applies_to IN ('products', 'vip', 'both', 'shop_only', 'custom_only', 'shop_vip', 'custom_vip'));

COMMIT;
