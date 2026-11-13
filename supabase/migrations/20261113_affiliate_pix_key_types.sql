-- Cubo Criativo: identifica o tipo de chave Pix e mantém o tipo usado em cada saque.
-- Execute DEPOIS de 20261112_affiliates_withdrawals.sql.
-- Perfis antigos continuam íntegros; precisam confirmar seu tipo para um novo saque.
BEGIN;

ALTER TABLE public.affiliate_payout_profiles
  ADD COLUMN IF NOT EXISTS pix_key_type text;
ALTER TABLE public.affiliate_withdrawal_requests
  ADD COLUMN IF NOT EXISTS pix_key_type text;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'affiliate_payout_profiles_pix_type_ck') THEN
    ALTER TABLE public.affiliate_payout_profiles
      ADD CONSTRAINT affiliate_payout_profiles_pix_type_ck
      CHECK (pix_key_type IS NULL OR pix_key_type IN ('cpf','cnpj','phone','email','random'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'affiliate_withdrawal_requests_pix_type_ck') THEN
    ALTER TABLE public.affiliate_withdrawal_requests
      ADD CONSTRAINT affiliate_withdrawal_requests_pix_type_ck
      CHECK (pix_key_type IS NULL OR pix_key_type IN ('cpf','cnpj','phone','email','random'));
  END IF;
END $$;

COMMENT ON COLUMN public.affiliate_payout_profiles.pix_key_type IS
  'Tipo escolhido e validado pelo vendedor. NULL indica cadastro antigo a confirmar.';
COMMENT ON COLUMN public.affiliate_withdrawal_requests.pix_key_type IS
  'Tipo da chave no momento da solicitação. NULL identifica saque criado antes da migração.';

-- Preserva reserva atômica de saldo e snapshot do Pix no ato da solicitação.
CREATE OR REPLACE FUNCTION public.affiliate_request_withdrawal(p_affiliate_id uuid)
RETURNS public.affiliate_withdrawal_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp
AS $$
DECLARE v_aff public.affiliates%ROWTYPE;
        v_profile public.affiliate_payout_profiles%ROWTYPE;
        v_amount numeric(12,2);
        v_request public.affiliate_withdrawal_requests%ROWTYPE;
BEGIN
  SELECT * INTO v_aff FROM public.affiliates WHERE id=p_affiliate_id FOR UPDATE;
  IF NOT FOUND OR NOT v_aff.active OR v_aff.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Vendedor inativo ou não encontrado.';
  END IF;
  SELECT * INTO v_profile FROM public.affiliate_payout_profiles
    WHERE affiliate_id=p_affiliate_id;
  IF NOT FOUND OR v_profile.pix_key_type IS NULL
    OR length(trim(v_profile.pix_key))<3 OR length(trim(v_profile.holder_name))<3 THEN
    RAISE EXCEPTION 'Atualize os dados Pix e selecione o tipo de chave antes de solicitar.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.affiliate_withdrawal_requests
             WHERE affiliate_id=p_affiliate_id AND status='requested') THEN
    RAISE EXCEPTION 'Você já tem um saque aguardando processamento.';
  END IF;
  PERFORM 1 FROM public.affiliate_commissions
    WHERE affiliate_id=p_affiliate_id AND status='confirmed' AND withdrawal_id IS NULL FOR UPDATE;
  SELECT coalesce(sum(commission_value),0) INTO v_amount
    FROM public.affiliate_commissions
    WHERE affiliate_id=p_affiliate_id AND status='confirmed' AND withdrawal_id IS NULL;
  IF v_amount <= 0 THEN RAISE EXCEPTION 'Não há saldo disponível para saque.'; END IF;
  INSERT INTO public.affiliate_withdrawal_requests
    (affiliate_id,amount,pix_key_type,pix_key,holder_name)
    VALUES (p_affiliate_id,v_amount,v_profile.pix_key_type,v_profile.pix_key,v_profile.holder_name)
    RETURNING * INTO v_request;
  UPDATE public.affiliate_commissions SET withdrawal_id=v_request.id
    WHERE affiliate_id=p_affiliate_id AND status='confirmed' AND withdrawal_id IS NULL;
  RETURN v_request;
END;
$$;

REVOKE ALL ON FUNCTION public.affiliate_request_withdrawal(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.affiliate_request_withdrawal(uuid) TO service_role;
COMMIT;
