-- Vínculo autenticado de indicação por link e cupons resgatados pelos visitantes.
-- Aplicar APÓS 20261112_affiliates_withdrawals.sql no SQL Editor do Supabase.
-- A exigência de senha para saques é implementada no endpoint /api/affiliate.
BEGIN;

CREATE TABLE IF NOT EXISTS public.affiliate_user_attributions (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE RESTRICT,
  visitor_id text NOT NULL,
  last_visit_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS affiliate_user_attributions_expiry ON public.affiliate_user_attributions (affiliate_id, expires_at);

CREATE TABLE IF NOT EXISTS public.affiliate_coupon_claims (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE RESTRICT,
  coupon_code text NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, coupon_code)
);
CREATE INDEX IF NOT EXISTS affiliate_coupon_claims_user ON public.affiliate_coupon_claims (user_id, claimed_at DESC);

-- As duas tabelas contêm informações de indicação pessoais; somente
-- o backend autenticado pela service_role pode ler ou alterar registros.
ALTER TABLE public.affiliate_user_attributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_coupon_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.affiliate_user_attributions FROM anon, authenticated;
REVOKE ALL ON public.affiliate_coupon_claims FROM anon, authenticated;
GRANT ALL ON public.affiliate_user_attributions, public.affiliate_coupon_claims TO service_role;

CREATE INDEX IF NOT EXISTS affiliate_attributions_latest_visitor ON public.affiliate_attributions (visitor_id, last_visit_at DESC);
COMMIT;
