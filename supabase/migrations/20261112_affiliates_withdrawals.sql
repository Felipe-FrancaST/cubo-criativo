-- Cubo Criativo: vendedores, comissões e saques
-- Execute no SQL Editor com privilégio de proprietário. Requer as tabelas
-- affiliates, affiliate_commissions, affiliate_visits e affiliate_attributions.
BEGIN;

ALTER TABLE public.affiliates ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS affiliate_id uuid REFERENCES public.affiliates(id) ON DELETE SET NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS affiliate_source text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS affiliate_visitor_id text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS affiliate_commission numeric(12,2);

CREATE TABLE IF NOT EXISTS public.affiliate_payout_profiles (
  affiliate_id uuid PRIMARY KEY REFERENCES public.affiliates(id) ON DELETE CASCADE,
  pix_key text NOT NULL CHECK (length(trim(pix_key)) BETWEEN 3 AND 140),
  holder_name text NOT NULL CHECK (length(trim(holder_name)) BETWEEN 3 AND 140),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.affiliate_withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE RESTRICT,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  pix_key text NOT NULL,
  holder_name text NOT NULL,
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','paid','rejected')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  rejected_at timestamptz,
  processed_by uuid,
  notes text
);
CREATE INDEX IF NOT EXISTS affiliate_withdrawal_requests_affiliate_date
  ON public.affiliate_withdrawal_requests (affiliate_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS affiliate_withdrawal_requests_status
  ON public.affiliate_withdrawal_requests (status, requested_at DESC);
ALTER TABLE public.affiliate_commissions ADD COLUMN IF NOT EXISTS withdrawal_id uuid
  REFERENCES public.affiliate_withdrawal_requests(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS affiliate_commissions_available_for_withdrawal
  ON public.affiliate_commissions(affiliate_id, status, withdrawal_id);

-- Somente o backend com chave service_role pode ler/gravar Pix e processar saques.
ALTER TABLE public.affiliate_payout_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_withdrawal_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.affiliate_payout_profiles FROM anon, authenticated;
REVOKE ALL ON public.affiliate_withdrawal_requests FROM anon, authenticated;
-- Alterações financeiras e administração só podem ser feitas por endpoints autenticados.
REVOKE INSERT, UPDATE, DELETE ON public.affiliates FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.affiliate_commissions FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.affiliate_attributions FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.affiliate_visits FROM anon, authenticated;

-- Reservar saldo e criar o pedido numa única transação, serializando por vendedor.
CREATE OR REPLACE FUNCTION public.affiliate_request_withdrawal(p_affiliate_id uuid)
RETURNS public.affiliate_withdrawal_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_aff public.affiliates%ROWTYPE;
        v_profile public.affiliate_payout_profiles%ROWTYPE;
        v_amount numeric(12,2);
        v_request public.affiliate_withdrawal_requests%ROWTYPE;
BEGIN
  SELECT * INTO v_aff FROM public.affiliates WHERE id = p_affiliate_id FOR UPDATE;
  IF NOT FOUND OR NOT v_aff.active OR v_aff.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Vendedor inativo ou não encontrado.';
  END IF;
  SELECT * INTO v_profile FROM public.affiliate_payout_profiles WHERE affiliate_id = p_affiliate_id;
  IF NOT FOUND OR length(trim(v_profile.pix_key)) < 3 OR length(trim(v_profile.holder_name)) < 3 THEN
    RAISE EXCEPTION 'Cadastre sua chave Pix e nome do titular primeiro.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.affiliate_withdrawal_requests
             WHERE affiliate_id=p_affiliate_id AND status='requested') THEN
    RAISE EXCEPTION 'Você já tem um saque aguardando processamento.';
  END IF;
  -- Evita duas requisições concorrentes usando as mesmas comissões.
  PERFORM 1 FROM public.affiliate_commissions
    WHERE affiliate_id=p_affiliate_id AND status='confirmed' AND withdrawal_id IS NULL FOR UPDATE;
  SELECT coalesce(sum(commission_value),0) INTO v_amount
    FROM public.affiliate_commissions
    WHERE affiliate_id=p_affiliate_id AND status='confirmed' AND withdrawal_id IS NULL;
  IF v_amount <= 0 THEN RAISE EXCEPTION 'Não há saldo disponível para saque.'; END IF;
  INSERT INTO public.affiliate_withdrawal_requests
    (affiliate_id, amount, pix_key, holder_name)
    VALUES (p_affiliate_id, v_amount, v_profile.pix_key, v_profile.holder_name)
    RETURNING * INTO v_request;
  UPDATE public.affiliate_commissions SET withdrawal_id=v_request.id
    WHERE affiliate_id=p_affiliate_id AND status='confirmed' AND withdrawal_id IS NULL;
  RETURN v_request;
END;
$$;

CREATE OR REPLACE FUNCTION public.affiliate_settle_withdrawal(
  p_request_id uuid, p_actor uuid, p_action text, p_notes text DEFAULT NULL)
RETURNS public.affiliate_withdrawal_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp
AS $$
DECLARE v_request public.affiliate_withdrawal_requests%ROWTYPE;
        v_sum numeric(12,2);
BEGIN
  SELECT * INTO v_request FROM public.affiliate_withdrawal_requests WHERE id=p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada.'; END IF;
  IF v_request.status <> 'requested' THEN RAISE EXCEPTION 'Este saque já foi processado.'; END IF;
  IF p_action NOT IN ('paid','rejected') THEN RAISE EXCEPTION 'Ação inválida.'; END IF;
  -- Protege saldos de mudanças na composição do lote.
  SELECT coalesce(sum(commission_value),0) INTO v_sum FROM public.affiliate_commissions
    WHERE withdrawal_id = p_request_id AND status='confirmed';
  IF v_sum <> v_request.amount THEN
    RAISE EXCEPTION 'Saldo do saque divergente. Verifique as comissões antes de processar.';
  END IF;
  IF p_action='paid' THEN
    UPDATE public.affiliate_commissions SET status='paid', paid_at=now()
      WHERE withdrawal_id=p_request_id AND status='confirmed';
  ELSE
    UPDATE public.affiliate_commissions SET withdrawal_id=NULL
      WHERE withdrawal_id=p_request_id AND status='confirmed';
  END IF;
  UPDATE public.affiliate_withdrawal_requests SET
    status=p_action, paid_at=CASE WHEN p_action='paid' THEN now() ELSE NULL END,
    rejected_at=CASE WHEN p_action='rejected' THEN now() ELSE NULL END,
    processed_by=p_actor, notes=NULLIF(left(trim(coalesce(p_notes,'')),500),'')
    WHERE id=p_request_id RETURNING * INTO v_request;
  RETURN v_request;
END;
$$;

-- Reembolso antes do Pix: estorna a comissão e cancela o saque pendente,
-- liberando as demais comissões do mesmo lote para outro saque.
CREATE OR REPLACE FUNCTION public.affiliate_reverse_commission(p_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp
AS $$
DECLARE v_withdrawal uuid; v_request_status text;
BEGIN
  SELECT withdrawal_id INTO v_withdrawal FROM public.affiliate_commissions WHERE order_id=p_order_id;
  IF v_withdrawal IS NOT NULL THEN
    SELECT status INTO v_request_status FROM public.affiliate_withdrawal_requests
      WHERE id=v_withdrawal FOR UPDATE;
    IF v_request_status='requested' THEN
      UPDATE public.affiliate_withdrawal_requests SET status='rejected',
        rejected_at=now(), notes='Saque cancelado automaticamente: pagamento estornado ou recusado.'
        WHERE id=v_withdrawal;
      UPDATE public.affiliate_commissions SET withdrawal_id=NULL
        WHERE withdrawal_id=v_withdrawal AND status='confirmed';
    END IF;
  END IF;
  UPDATE public.affiliate_commissions SET status='cancelled', confirmed_at=NULL
    WHERE order_id=p_order_id AND status IN ('pending','confirmed') AND withdrawal_id IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.affiliate_dashboard_stats(p_affiliate_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp
AS $$
  SELECT jsonb_build_object(
    'visits', (SELECT count(*) FROM public.affiliate_visits WHERE affiliate_id=p_affiliate_id),
    'unique_visitors', (SELECT count(DISTINCT visitor_id) FROM public.affiliate_visits WHERE affiliate_id=p_affiliate_id),
    'converted_visitors', (SELECT count(*) FROM public.affiliate_attributions WHERE affiliate_id=p_affiliate_id AND converted=true),
    'orders', (SELECT count(*) FROM public.affiliate_commissions WHERE affiliate_id=p_affiliate_id AND status <> 'cancelled'),
    'revenue', (SELECT coalesce(sum(commission_base),0) FROM public.affiliate_commissions WHERE affiliate_id=p_affiliate_id AND status <> 'cancelled'),
    'total_commission', (SELECT coalesce(sum(commission_value),0) FROM public.affiliate_commissions WHERE affiliate_id=p_affiliate_id AND status <> 'cancelled'),
    'pending_commission', (SELECT coalesce(sum(commission_value),0) FROM public.affiliate_commissions WHERE affiliate_id=p_affiliate_id AND status='pending'),
    'confirmed_commission', (SELECT coalesce(sum(commission_value),0) FROM public.affiliate_commissions WHERE affiliate_id=p_affiliate_id AND status='confirmed'),
    'available_balance', (SELECT coalesce(sum(commission_value),0) FROM public.affiliate_commissions WHERE affiliate_id=p_affiliate_id AND status='confirmed' AND withdrawal_id IS NULL),
    'reserved_balance', (SELECT coalesce(sum(commission_value),0) FROM public.affiliate_commissions WHERE affiliate_id=p_affiliate_id AND status='confirmed' AND withdrawal_id IS NOT NULL),
    'paid_commission', (SELECT coalesce(sum(commission_value),0) FROM public.affiliate_commissions WHERE affiliate_id=p_affiliate_id AND status='paid')
  );
$$;

REVOKE ALL ON FUNCTION public.affiliate_request_withdrawal(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.affiliate_settle_withdrawal(uuid,uuid,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.affiliate_dashboard_stats(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.affiliate_reverse_commission(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.affiliate_request_withdrawal(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.affiliate_settle_withdrawal(uuid,uuid,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.affiliate_dashboard_stats(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.affiliate_reverse_commission(uuid) TO service_role;
GRANT ALL ON public.affiliate_payout_profiles, public.affiliate_withdrawal_requests TO service_role;
COMMIT;
