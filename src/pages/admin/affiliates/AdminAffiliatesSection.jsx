import React from 'react';

const fmt = (n) => Number(n || 0).toLocaleString('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

export default function AdminAffiliatesSection({ accessToken }) {
  const [data, setData] = React.useState({
    affiliates: [],
    profiles: [],
    products: [],
    vip_plans: [],
  });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [form, setForm] = React.useState({
    user_id: '',
    slug: '',
    commission_type: 'percent',
    commission_value: 10,
    attribution_days: 30,
    active: true,
  });
  const [editing, setEditing] = React.useState(null);
  const [saving, setSaving] = React.useState(false);
  const [coupon, setCoupon] = React.useState({
    affiliate_id: '',
    code: '',
    label: '',
    discount_type: 'percent',
    discount_value: 10,
    min_order_value: 0,
    expires_at: '',
    max_uses: 100,
    applies_to: 'products',
    product_ids: [],
    vip_plan_ids: [],
  });
  const [couponBusy, setCouponBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin?action=affiliates', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(json.error || 'Não foi possível carregar vendedores.');
      }
      setData({
        affiliates: json.affiliates || [],
        profiles: json.profiles || [],
        products: json.products || [],
        vip_plans: json.vip_plans || [],
      });
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  React.useEffect(() => {
    load();
  }, [load]);

  const reset = () => {
    setEditing(null);
    setForm({
      user_id: '',
      slug: '',
      commission_type: 'percent',
      commission_value: 10,
      attribution_days: 30,
      active: true,
    });
  };

  const edit = (affiliate) => {
    setEditing(affiliate.id);
    setForm({
      user_id: affiliate.user_id,
      slug: affiliate.slug,
      commission_type: affiliate.commission_type || 'percent',
      commission_value: affiliate.commission_value || 0,
      attribution_days: affiliate.attribution_days || 30,
      active: affiliate.active !== false,
    });
  };

  async function save() {
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/admin?action=save-affiliate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ ...form, id: editing }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error || 'Erro ao salvar.');
      reset();
      await load();
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setSaving(false);
    }
  }

  async function saveCoupon() {
    setCouponBusy(true);
    setError('');
    try {
      const response = await fetch('/api/admin?action=save-affiliate-coupon', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(coupon),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error || 'Erro ao salvar cupom.');
      setCoupon((current) => ({ ...current, code: '', label: '' }));
      await load();
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setCouponBusy(false);
    }
  }

  async function paid(id) {
    if (!window.confirm('Marcar comissão como paga?')) return;
    const response = await fetch('/api/admin?action=affiliate-pay', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ id }),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(json.error || 'Erro');
      return;
    }
    await load();
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-white">Vendedores e comissões</h2>
          <p className="text-sm text-slate-400">
            Controle de vendedores, links, acessos, vendas e comissões.
          </p>
        </div>
        <button
          onClick={load}
          className="rounded-xl px-3 py-2 ring-1 ring-white/10 text-slate-200"
        >
          Atualizar
        </button>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-100 ring-1 ring-rose-400/20">
          {error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[350px_1fr]">
        <div className="rounded-2xl bg-white/[.03] p-4 ring-1 ring-white/10 space-y-3">
          <b className="text-white">
            {editing ? 'Editar vendedor' : 'Adicionar vendedor'}
          </b>

          <label className="block text-sm text-slate-300">
            Cliente
            <select
              value={form.user_id}
              onChange={(event) => setForm({ ...form, user_id: event.target.value })}
              className="mt-1 w-full rounded-xl bg-black/30 px-3 py-2 text-white ring-1 ring-white/10"
            >
              <option value="">Selecione</option>
              {data.profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.full_name || profile.id}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm text-slate-300">
            Link / slug
            <input
              value={form.slug}
              onChange={(event) => setForm({ ...form, slug: event.target.value })}
              placeholder="joao"
              className="mt-1 w-full rounded-xl bg-black/30 px-3 py-2 text-white ring-1 ring-white/10"
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="text-sm text-slate-300">
              Tipo
              <select
                value={form.commission_type}
                onChange={(event) =>
                  setForm({ ...form, commission_type: event.target.value })
                }
                className="mt-1 w-full rounded-xl bg-black/30 px-3 py-2 text-white ring-1 ring-white/10"
              >
                <option value="percent">%</option>
                <option value="fixed">R$ fixo</option>
              </select>
            </label>

            <label className="text-sm text-slate-300">
              Valor
              <input
                type="number"
                min="0"
                step=".01"
                value={form.commission_value}
                onChange={(event) =>
                  setForm({ ...form, commission_value: event.target.value })
                }
                className="mt-1 w-full rounded-xl bg-black/30 px-3 py-2 text-white ring-1 ring-white/10"
              />
            </label>
          </div>

          <label className="block text-sm text-slate-300">
            Validade do link (dias)
            <input
              type="number"
              min="1"
              max="365"
              value={form.attribution_days}
              onChange={(event) =>
                setForm({ ...form, attribution_days: event.target.value })
              }
              className="mt-1 w-full rounded-xl bg-black/30 px-3 py-2 text-white ring-1 ring-white/10"
            />
          </label>

          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(event) => setForm({ ...form, active: event.target.checked })}
            />
            Ativo
          </label>

          <div className="flex gap-2">
            <button
              disabled={saving || !form.user_id}
              onClick={save}
              className="rounded-xl bg-emerald-400 px-4 py-2 font-bold text-black disabled:opacity-50"
            >
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
            {editing && (
              <button
                onClick={reset}
                className="rounded-xl px-4 py-2 text-slate-200 ring-1 ring-white/10"
              >
                Cancelar
              </button>
            )}
          </div>

          <p className="text-xs text-slate-500">
            A comissão usa o valor total do produto antes do cupom. O desconto
            afeta somente o cliente. VIP gera comissão apenas na primeira assinatura.
          </p>
        </div>

        <div className="space-y-3">
          {loading ? (
            <div className="text-slate-400">Carregando…</div>
          ) : (
            data.affiliates.map((affiliate) => (
              <div
                key={affiliate.id}
                className="rounded-2xl bg-white/[.03] p-4 ring-1 ring-white/10"
              >
                <div className="flex justify-between gap-3">
                  <div>
                    <div className="font-black text-white">
                      {affiliate.profile?.full_name || affiliate.user_id}
                    </div>
                    <div className="text-sm text-cyan-300">/v/{affiliate.slug}</div>
                    <div className="text-xs text-slate-500">
                      {affiliate.active ? 'Ativo' : 'Inativo'} •{' '}
                      {affiliate.commission_type === 'fixed'
                        ? fmt(affiliate.commission_value)
                        : `${affiliate.commission_value}%`}{' '}
                      • {affiliate.attribution_days} dias
                    </div>
                  </div>
                  <button
                    onClick={() => edit(affiliate)}
                    className="rounded-xl px-3 py-2 text-slate-200 ring-1 ring-white/10"
                  >
                    Editar
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-2 md:grid-cols-7 gap-2">
                  {[
                    ['Acessos', affiliate.stats?.visits || 0],
                    ['Visitantes', affiliate.stats?.unique_visitors || 0],
                    ['Pedidos', affiliate.stats?.orders || 0],
                    ['Vendas', fmt(affiliate.stats?.revenue)],
                    ['Comissão', fmt(affiliate.stats?.commission)],
                    ['Pendente', fmt(affiliate.stats?.pending)],
                    ['Paga', fmt(affiliate.stats?.paid)],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl bg-black/20 p-3">
                      <div className="text-[11px] uppercase text-slate-500">{label}</div>
                      <div className="mt-1 font-bold text-white">{value}</div>
                    </div>
                  ))}
                </div>

                {(affiliate.commissions || []).slice(0, 8).map((commission) => (
                  <div
                    key={commission.id}
                    className="mt-2 flex flex-wrap justify-between gap-2 rounded-xl bg-black/20 p-3 text-xs text-slate-300"
                  >
                    <span>
                      Pedido {String(commission.order_id).slice(0, 8)}… • base{' '}
                      {fmt(commission.commission_base)} • comissão{' '}
                      {fmt(commission.commission_value)}
                    </span>
                    <span className="flex gap-2 items-center">
                      {commission.status}
                      {['pending', 'confirmed'].includes(commission.status) && (
                        <button
                          onClick={() => paid(commission.id)}
                          className="rounded-lg bg-emerald-400 px-2 py-1 font-bold text-black"
                        >
                          Marcar paga
                        </button>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-2xl bg-white/[.03] p-4 ring-1 ring-white/10">
        <div className="font-bold text-white">Criar cupom do vendedor</div>

        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <select
            value={coupon.affiliate_id}
            onChange={(event) =>
              setCoupon({ ...coupon, affiliate_id: event.target.value })
            }
            className="rounded-xl bg-black/30 px-3 py-2 text-white ring-1 ring-white/10"
          >
            <option value="">Vendedor</option>
            {data.affiliates.map((affiliate) => (
              <option key={affiliate.id} value={affiliate.id}>
                {affiliate.profile?.full_name || affiliate.slug}
              </option>
            ))}
          </select>

          <input
            value={coupon.code}
            onChange={(event) =>
              setCoupon({ ...coupon, code: event.target.value.toUpperCase() })
            }
            placeholder="CUPOMJOAO10"
            className="rounded-xl bg-black/30 px-3 py-2 text-white ring-1 ring-white/10"
          />

          <input
            value={coupon.label}
            onChange={(event) => setCoupon({ ...coupon, label: event.target.value })}
            placeholder="Rótulo"
            className="rounded-xl bg-black/30 px-3 py-2 text-white ring-1 ring-white/10"
          />

          <div className="grid grid-cols-2 gap-2">
            <select
              value={coupon.discount_type}
              onChange={(event) =>
                setCoupon({ ...coupon, discount_type: event.target.value })
              }
              className="rounded-xl bg-black/30 px-3 py-2 text-white ring-1 ring-white/10"
            >
              <option value="percent">%</option>
              <option value="fixed_min">R$ fixo</option>
            </select>
            <input
              type="number"
              step=".01"
              value={coupon.discount_value}
              onChange={(event) =>
                setCoupon({ ...coupon, discount_value: event.target.value })
              }
              className="rounded-xl bg-black/30 px-3 py-2 text-white ring-1 ring-white/10"
            />
          </div>

          <select
            value={coupon.applies_to}
            onChange={(event) =>
              setCoupon({ ...coupon, applies_to: event.target.value })
            }
            className="rounded-xl bg-black/30 px-3 py-2 text-white ring-1 ring-white/10"
          >
            <option value="products">Produtos</option>
            <option value="vip">Assinatura VIP</option>
            <option value="both">Produtos + VIP</option>
          </select>

          <input
            type="number"
            value={coupon.max_uses}
            onChange={(event) =>
              setCoupon({ ...coupon, max_uses: event.target.value })
            }
            placeholder="Usos"
            className="rounded-xl bg-black/30 px-3 py-2 text-white ring-1 ring-white/10"
          />
        </div>

        {coupon.applies_to !== 'vip' && (
          <label className="block mt-3 text-sm text-slate-300">
            Produtos específicos (opcional)
            <select
              multiple
              value={coupon.product_ids}
              onChange={(event) =>
                setCoupon({
                  ...coupon,
                  product_ids: Array.from(event.target.selectedOptions).map(
                    (option) => option.value,
                  ),
                })
              }
              className="mt-1 w-full min-h-28 rounded-xl bg-black/30 px-3 py-2 text-white ring-1 ring-white/10"
            >
              {data.products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
            <span className="text-xs text-slate-500">
              Deixe vazio para todos os produtos.
            </span>
          </label>
        )}

        {coupon.applies_to !== 'products' && (
          <label className="block mt-3 text-sm text-slate-300">
            Planos VIP específicos (opcional)
            <select
              multiple
              value={coupon.vip_plan_ids}
              onChange={(event) =>
                setCoupon({
                  ...coupon,
                  vip_plan_ids: Array.from(event.target.selectedOptions).map(
                    (option) => option.value,
                  ),
                })
              }
              className="mt-1 w-full min-h-24 rounded-xl bg-black/30 px-3 py-2 text-white ring-1 ring-white/10"
            >
              {data.vip_plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name || plan.short_name || plan.id} — {fmt(plan.price_brl)}
                </option>
              ))}
            </select>
            <span className="text-xs text-slate-500">
              Deixe vazio para todos os planos VIP.
            </span>
          </label>
        )}

        <button
          disabled={couponBusy || !coupon.affiliate_id || !coupon.code}
          onClick={saveCoupon}
          className="mt-3 rounded-xl bg-cyan-300 px-4 py-2 font-bold text-black disabled:opacity-50"
        >
          {couponBusy ? 'Salvando…' : 'Criar cupom'}
        </button>
      </div>
    </div>
  );
}
