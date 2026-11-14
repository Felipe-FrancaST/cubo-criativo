-- Cubo Criativo: opções de acabamento e preços de peças personalizadas.
-- Executar uma vez no Supabase SQL Editor ANTES de publicar o frontend/backend.
-- Conserva os valores já configurados como preços COM pintura.
BEGIN;

ALTER TABLE public.custom_miniature_settings
  ADD COLUMN IF NOT EXISTS bust_unpainted_price_cents integer,
  ADD COLUMN IF NOT EXISTS miniature_unpainted_price_cents integer;

-- Preço inicial sem pintura: 25% abaixo do preço com pintura já configurado.
-- O administrador poderá alterar ambos os valores a qualquer momento.
UPDATE public.custom_miniature_settings
SET bust_unpainted_price_cents = COALESCE(
      bust_unpainted_price_cents,
      GREATEST(1, floor(bust_price_cents * 0.75)::integer)
    ),
    miniature_unpainted_price_cents = COALESCE(
      miniature_unpainted_price_cents,
      GREATEST(1, floor(miniature_price_cents * 0.75)::integer)
    );

ALTER TABLE public.custom_miniature_settings
  ALTER COLUMN bust_unpainted_price_cents SET DEFAULT 15000,
  ALTER COLUMN bust_unpainted_price_cents SET NOT NULL,
  ALTER COLUMN miniature_unpainted_price_cents SET DEFAULT 15000,
  ALTER COLUMN miniature_unpainted_price_cents SET NOT NULL;

ALTER TABLE public.custom_miniature_settings
  ADD CONSTRAINT custom_bust_unpainted_price_range CHECK (bust_unpainted_price_cents BETWEEN 1 AND 100000000),
  ADD CONSTRAINT custom_miniature_unpainted_price_range CHECK (miniature_unpainted_price_cents BETWEEN 1 AND 100000000),
  ADD CONSTRAINT custom_bust_finish_prices CHECK (bust_unpainted_price_cents < bust_price_cents),
  ADD CONSTRAINT custom_miniature_finish_prices CHECK (miniature_unpainted_price_cents < miniature_price_cents);

ALTER TABLE public.custom_miniature_requests
  ADD COLUMN IF NOT EXISTS finish text NOT NULL DEFAULT 'painted';
ALTER TABLE public.custom_miniature_requests
  ADD CONSTRAINT custom_request_finish_valid CHECK (finish IN ('painted', 'unpainted'));

-- Novos campos continuam protegidos pelas políticas e permissões existentes.
COMMIT;
