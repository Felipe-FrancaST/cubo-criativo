-- Cubo Criativo: encomendas de miniaturas personalizadas.
-- Execute UMA VEZ no Supabase SQL Editor antes de publicar o novo código.
-- Acesso ao conteúdo exclusivamente pelas APIs autenticadas no servidor.
BEGIN;

CREATE TABLE IF NOT EXISTS public.custom_miniature_settings (
  id text PRIMARY KEY DEFAULT 'default' CHECK (id = 'default'),
  bust_price_cents integer NOT NULL DEFAULT 20000 CHECK (bust_price_cents BETWEEN 100 AND 100000000),
  miniature_price_cents integer NOT NULL DEFAULT 20000 CHECK (miniature_price_cents BETWEEN 100 AND 100000000),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.custom_miniature_settings (id, bust_price_cents, miniature_price_cents)
VALUES ('default', 20000, 20000) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.custom_miniature_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id uuid UNIQUE REFERENCES public.orders(id) ON DELETE SET NULL,
  customer_email text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('busto', 'miniatura')),
  notes text NOT NULL DEFAULT '' CHECK (char_length(notes) <= 2000),
  image_paths text[] NOT NULL DEFAULT '{}',
  image_names text[] NOT NULL DEFAULT '{}',
  base_price_cents integer CHECK (base_price_cents > 0),
  discount_cents integer NOT NULL DEFAULT 0 CHECK (discount_cents >= 0),
  total_cents integer CHECK (total_cents > 0),
  coupon_code text,
  payment_method text CHECK (payment_method IN ('pix', 'card')),
  payment_status text NOT NULL DEFAULT 'draft'
    CHECK (payment_status IN ('draft','processing','pending','paid','failed','cancelled')),
  production_status text NOT NULL DEFAULT 'aguardando_pagamento'
    CHECK (production_status IN ('aguardando_pagamento','recebido','em_analise','em_producao','finalizado','enviado','cancelado')),
  provider_payment_id text,
  payment_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (cardinality(image_paths) BETWEEN 1 AND 6),
  CHECK (cardinality(image_names) = cardinality(image_paths))
);
CREATE INDEX IF NOT EXISTS custom_miniature_requests_user_created_idx
  ON public.custom_miniature_requests (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS custom_miniature_requests_created_idx
  ON public.custom_miniature_requests (created_at DESC);

ALTER TABLE public.custom_miniature_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_miniature_requests ENABLE ROW LEVEL SECURITY;
-- Sem políticas de acesso direto para anon/authenticated: as APIs verificam
-- identidade e permissões; a chave service_role nunca vai ao navegador.
REVOKE ALL ON public.custom_miniature_settings FROM anon, authenticated;
REVOKE ALL ON public.custom_miniature_requests FROM anon, authenticated;

-- Privado, com limite por arquivo validado também no Storage e na API.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('custom-miniature-references','custom-miniature-references', false, 10485760,
        ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE
SET public = false, file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp'];
COMMIT;
