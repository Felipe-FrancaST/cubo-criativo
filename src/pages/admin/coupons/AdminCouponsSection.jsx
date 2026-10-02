import { SectionTitle } from '../orders/AdminOrdersComponents.jsx'
import { fmtBRL } from '../orders/adminOrdersUtils.js'
export default function AdminCouponsSection({ admin }) {
  const {
    gameCouponLoading,
    gameCouponError,
    gameCouponForm,
    setGameCouponForm,
    currentGameCoupon,
    gameCouponMetricsLoading,
    gameCouponMetricsError,
    gameCouponMetrics,
    fetchGameCoupon,
    fetchGameCouponMetrics,
    saveGameCoupon,
  } = admin
  return (
    <div className="space-y-4">
      <SectionTitle
        icon="sell"
        title="Cupons do Cubo Game"
        subtitle="Defina aqui qual desconto o jogo vai gerar para os usuários vencedores."
        right={
          <button
            onClick={() => {
              fetchGameCoupon()
              fetchGameCouponMetrics()
            }}
            className="rounded-xl px-3 py-2 text-sm text-slate-200 hover:bg-white/4 ring-1 ring-white/10"
          >
            <span className="material-icons text-[18px] align-middle mr-1">
              refresh
            </span>
            Recarregar
          </button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          {
            label: 'Pessoas jogaram',
            value: gameCouponMetrics.players_count,
            hint: `${gameCouponMetrics.unique_winners_count} vencedores únicos`,
          },
          {
            label: 'Ganharam',
            value: gameCouponMetrics.wins_count,
            hint: `${gameCouponMetrics.coupons_generated_count} cupons gerados`,
          },
          {
            label: 'Cupons aplicados',
            value: gameCouponMetrics.coupons_applied_count,
            hint: 'checkout iniciado com cupom',
          },
          {
            label: 'Viraram compra',
            value: gameCouponMetrics.purchases_with_coupon_count,
            hint: `${gameCouponMetrics.coupon_conversion_rate}% dos ganhos`,
          },
          {
            label: 'Faturamento gerado',
            value: fmtBRL(Number(gameCouponMetrics.revenue_generated_brl || 0)),
            hint: `desconto dado ${fmtBRL(Number(gameCouponMetrics.discount_granted_brl || 0))}`,
          },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-4"
          >
            <div className="text-xs uppercase tracking-wide text-slate-500">
              {card.label}
            </div>
            <div className="mt-2 text-2xl font-black text-white">
              {card.value}
            </div>
            <div className="mt-1 text-xs text-slate-400">{card.hint}</div>
          </div>
        ))}
      </div>

      {gameCouponMetricsLoading ? (
        <div className="text-sm text-slate-400">
          Carregando métricas do Cubo Game…
        </div>
      ) : null}

      {gameCouponMetricsError ? (
        <div className="rounded-2xl bg-rose-500/10 ring-1 ring-rose-400/20 p-4 text-sm text-rose-100">
          {gameCouponMetricsError}
        </div>
      ) : null}

      {gameCouponMetrics.coupon_orders_using_fallback ? (
        <div className="rounded-2xl bg-cyan-500/10 ring-1 ring-cyan-400/20 p-4 text-sm text-amber-100">
          As métricas de aplicação/compra estão em modo compatível. Para contar
          checkouts iniciados com mais precisão, rode também o SQL do arquivo{' '}
          <code>supabase/coupon_metrics_orders.sql</code>.
        </div>
      ) : null}

      {gameCouponError ? (
        <div className="rounded-2xl bg-rose-500/10 ring-1 ring-rose-400/20 p-4 text-sm text-rose-100">
          {gameCouponError}
          <div className="mt-2 text-rose-200/80">
            Se aparecer erro de tabela ausente, rode o SQL do arquivo{' '}
            <code>supabase/coupon_game_settings.sql</code> no Supabase.
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
        <div className="rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-4">
          <div className="text-sm font-semibold text-white">
            Cupom ativo no jogo
          </div>
          <div className="mt-1 text-sm text-slate-400">
            O jogador vence, e o sistema gera um código único baseado nesta
            configuração.
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <div className="text-xs text-slate-400 mb-1">
                Tipo de desconto
              </div>
              <select
                value={gameCouponForm.discount_type}
                onChange={(e) =>
                  setGameCouponForm((prev) => ({
                    ...prev,
                    discount_type: e.target.value,
                  }))
                }
                className="w-full rounded-xl bg-slate-950/60 ring-1 ring-white/10 px-3 py-2 text-sm text-white"
              >
                <option value="percent">Porcentagem (%)</option>
                <option value="fixed_min">Valor fixo (R$)</option>
                <option value="shipping_reduced">Frete reduzido (R$)</option>
              </select>
            </label>

            <label className="block">
              <div className="text-xs text-slate-400 mb-1">
                Valor do desconto
              </div>
              <input
                type="number"
                min="0"
                step="0.01"
                value={gameCouponForm.discount_value}
                onChange={(e) =>
                  setGameCouponForm((prev) => ({
                    ...prev,
                    discount_value: e.target.value,
                  }))
                }
                className="w-full rounded-xl bg-slate-950/60 ring-1 ring-white/10 px-3 py-2 text-sm text-white"
                placeholder={
                  gameCouponForm.discount_type === 'percent'
                    ? 'Ex.: 10'
                    : 'Ex.: 15'
                }
              />
            </label>

            <label className="block">
              <div className="text-xs text-slate-400 mb-1">
                Pedido mínimo (R$)
              </div>
              <input
                type="number"
                min="0"
                step="0.01"
                value={gameCouponForm.min_order_value}
                onChange={(e) =>
                  setGameCouponForm((prev) => ({
                    ...prev,
                    min_order_value: e.target.value,
                  }))
                }
                className="w-full rounded-xl bg-slate-950/60 ring-1 ring-white/10 px-3 py-2 text-sm text-white"
                placeholder="0"
              />
            </label>

            <label className="block">
              <div className="text-xs text-slate-400 mb-1">
                Rótulo exibido no jogo
              </div>
              <input
                type="text"
                value={gameCouponForm.label}
                onChange={(e) =>
                  setGameCouponForm((prev) => ({
                    ...prev,
                    label: e.target.value,
                  }))
                }
                className="w-full rounded-xl bg-slate-950/60 ring-1 ring-white/10 px-3 py-2 text-sm text-white"
                placeholder="Ex.: 10% OFF hoje"
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              onClick={saveGameCoupon}
              disabled={gameCouponLoading}
              className="rounded-xl px-4 py-2 text-sm font-semibold bg-emerald-400 text-black ring-4 ring-emerald-400/20 disabled:opacity-50"
            >
              {gameCouponLoading ? 'Salvando…' : 'Salvar cupom atual'}
            </button>
            <div className="text-xs text-slate-400">
              O cupom perfeito de 20% continua separado e só sai em partida
              perfeita.
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-4">
            <div className="text-sm font-semibold text-white">
              Configuração ativa agora
            </div>
            {currentGameCoupon ? (
              <div className="mt-3 space-y-3 text-sm">
                <div className="rounded-xl bg-emerald-500/10 ring-1 ring-emerald-400/20 p-3">
                  <div className="text-xs text-emerald-200/80 uppercase tracking-wide">
                    Rótulo
                  </div>
                  <div className="mt-1 text-lg font-bold text-emerald-100">
                    {currentGameCoupon.label}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-white/[0.03] ring-1 ring-white/10 p-3">
                    <div className="text-xs text-slate-500">Tipo</div>
                    <div className="mt-1 text-slate-100">
                      {currentGameCoupon.discount_type}
                    </div>
                  </div>
                  <div className="rounded-xl bg-white/[0.03] ring-1 ring-white/10 p-3">
                    <div className="text-xs text-slate-500">Valor</div>
                    <div className="mt-1 text-slate-100">
                      {currentGameCoupon.discount_value}
                    </div>
                  </div>
                  <div className="rounded-xl bg-white/[0.03] ring-1 ring-white/10 p-3 col-span-2">
                    <div className="text-xs text-slate-500">Pedido mínimo</div>
                    <div className="mt-1 text-slate-100">
                      {fmtBRL(Number(currentGameCoupon.min_order_value || 0))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-3 text-sm text-slate-400">
                {gameCouponLoading
                  ? 'Carregando configuração…'
                  : 'Nenhuma configuração ativa encontrada.'}
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-4">
            <div className="text-sm font-semibold text-white">
              Como funciona
            </div>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              <li>• O admin escolhe o desconto aqui.</li>
              <li>• O jogo mostra esse rótulo como prêmio atual.</li>
              <li>
                • Ao vencer, o usuário recebe um código único na tabela{' '}
                <code>coupons</code>.
              </li>
              <li>• O carrinho continua validando o código normalmente.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
