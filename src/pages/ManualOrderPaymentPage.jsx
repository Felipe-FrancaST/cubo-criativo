import React from 'react';

const fmtBRL = (n) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function parseParams() {
  if (typeof window === 'undefined') return { order: '', sig: '', payment: '' };
  const params = new URLSearchParams(window.location.search || '');
  return {
    order: String(params.get('order') || '').trim(),
    sig: String(params.get('sig') || '').trim(),
    payment: String(params.get('payment') || '').trim().toLowerCase(),
  };
}

function PaymentSuccessNotice({ order }) {
  return (
    <div className="rounded-3xl bg-emerald-500/10 ring-1 ring-emerald-400/20 p-5 text-emerald-100">
      <div className="text-xl font-extrabold">Pagamento efetivado</div>
      <div className="mt-2 text-sm text-emerald-50/90">
        Seu pagamento foi confirmado. Criamos uma conta automaticamente para acompanhar este pedido em <b>Meus pedidos</b>.
      </div>
      <div className="mt-3 rounded-2xl bg-black/20 p-4 ring-1 ring-white/10 text-sm text-slate-100">
        <div><b>E-mail de acesso:</b> {order?.customer_email || '—'}</div>
        <div className="mt-1"><b>Senha inicial:</b> CPF do cliente</div>
      </div>
    </div>
  );
}

export default function ManualOrderPaymentPage({ onGoHome }) {
  const [{ order, sig, payment }] = React.useState(parseParams);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [busyMethod, setBusyMethod] = React.useState('');
  const [error, setError] = React.useState('');
  const [data, setData] = React.useState(null);
  const [pix, setPix] = React.useState({ qr_code: '', qr_code_base64: '', ticket_url: '' });
  const [copyMsg, setCopyMsg] = React.useState('');

  const loadOrder = React.useCallback(async () => {
    if (!order || !sig) return;
    setLoading(true);
    setError('');
    try {
      const resp = await fetch(`/api/manual-order-payment?order=${encodeURIComponent(order)}&sig=${encodeURIComponent(sig)}`);
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(json?.error || 'Não foi possível carregar o pedido.');
      setData(json.order || null);
      if (json.order?.status === 'paid') setPix({ qr_code: '', qr_code_base64: '', ticket_url: '' });
    } catch (e) {
      setError(e?.message || 'Erro ao carregar pedido.');
    } finally {
      setLoading(false);
    }
  }, [order, sig]);

  React.useEffect(() => { loadOrder(); }, [loadOrder]);

  React.useEffect(() => {
    if (!order || !sig) return;
    if (data?.status === 'paid') return;
    const t = window.setInterval(async () => {
      try {
        const resp = await fetch('/api/manual-order-payment?action=status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order, sig }),
        });
        const json = await resp.json().catch(() => ({}));
        if (resp.ok && json?.order) {
          setData(json.order);
          if (json?.paid) setPix({ qr_code: '', qr_code_base64: '', ticket_url: '' });
        }
      } catch {}
    }, 5000);
    return () => window.clearInterval(t);
  }, [order, sig, data?.status]);

  React.useEffect(() => {
    if (!payment) return;
    if (payment === 'success' || payment === 'pending') {
      fetch('/api/manual-order-payment?action=status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order, sig }),
      }).then((r) => r.json().catch(() => ({}))).then((json) => {
        if (json?.order) setData(json.order);
      }).catch(() => {});
    }
  }, [payment, order, sig]);


  React.useEffect(() => {
    if (!copyMsg) return undefined;
    const t = window.setTimeout(() => setCopyMsg(''), 2200);
    return () => window.clearTimeout(t);
  }, [copyMsg]);

  async function copyPixCode() {
    const code = String(pix?.qr_code || '').trim();
    if (!code) {
      setCopyMsg('Código Pix indisponível.');
      return;
    }
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        const ta = document.createElement('textarea');
        ta.value = code;
        ta.setAttribute('readonly', 'readonly');
        ta.style.position = 'absolute';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopyMsg('Código Pix copiado.');
    } catch {
      setCopyMsg('Não foi possível copiar o código Pix.');
    }
  }

  async function handlePix() {
    setBusy(true);
    setBusyMethod('pix');
    setError('');
    try {
      const resp = await fetch('/api/manual-order-payment?action=create-pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order, sig }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(json?.error?.message || json?.error || 'Não foi possível gerar o Pix.');
      if (json?.already_paid) {
        await loadOrder();
        return;
      }
      setPix({ qr_code: json.qr_code || '', qr_code_base64: json.qr_code_base64 || '', ticket_url: json.ticket_url || '' });
      if (json?.order) setData(json.order);
    } catch (e) {
      setError(e?.message || 'Erro ao gerar Pix.');
    } finally {
      setBusy(false);
      setBusyMethod('');
    }
  }

  async function handleCard() {
    setBusy(true);
    setBusyMethod('card');
    setError('');
    try {
      const resp = await fetch('/api/manual-order-payment?action=create-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order, sig }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(json?.error?.message || json?.error || 'Não foi possível abrir o pagamento com cartão.');
      if (json?.already_paid) {
        await loadOrder();
        return;
      }
      if (json?.init_point) window.location.href = json.init_point;
      else throw new Error('Link de pagamento indisponível.');
    } catch (e) {
      setError(e?.message || 'Erro ao abrir checkout.');
      setBusy(false);
      setBusyMethod('');
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="rounded-[28px] bg-white/[0.03] ring-1 ring-white/10 p-5 sm:p-7">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.25em] text-cyan-200/70">Pagamento do pedido</div>
            <div className="mt-2 text-3xl font-extrabold text-white">Finalize seu pedido</div>
            <div className="mt-2 text-slate-300">Pague com Pix ou cartão. Depois do pagamento, sua conta já estará pronta para acompanhar em <b>Meus pedidos</b>.</div>
          </div>
          <button onClick={onGoHome} className="rounded-xl px-3 py-2 text-sm text-slate-200 hover:bg-white/4 ring-1 ring-white/10">Site</button>
        </div>

        {loading ? <div className="mt-6 text-slate-300">Carregando pedido…</div> : null}
        {error ? <div className="mt-4 rounded-2xl bg-red-500/10 ring-1 ring-red-500/20 px-4 py-3 text-red-100">{error}</div> : null}

        {data ? (
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-5">
            <div className="rounded-3xl bg-black/20 ring-1 ring-white/10 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm text-slate-400">Pedido #{data.order_number}</div>
                  <div className="text-lg font-bold text-white">{data.customer_name || 'Cliente'}</div>
                </div>
                <div className="rounded-full px-3 py-1 text-xs ring-1 ring-white/10 bg-white/5 text-slate-100">{String(data.status || 'pending').toLowerCase() === 'paid' ? 'Pago' : 'Aguardando pagamento'}</div>
              </div>
              <div className="mt-4 space-y-3">
                {(data.items || []).map((it) => (
                  <div key={it.id || `${it.name}-${it.scale}`} className="rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-slate-100 font-semibold">{it.name}</div>
                      <div className="text-xs text-slate-400">Qtd: {it.qty}{it.scale ? ` • Escala: ${it.scale}` : ''}</div>
                    </div>
                    <div className="text-slate-100 font-semibold">{fmtBRL(Number(it.unit_price || 0) * Number(it.qty || 1))}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between text-lg font-extrabold text-white border-t border-white/10 pt-4">
                <span>Total</span>
                <span>{fmtBRL(data.total)}</span>
              </div>
            </div>

            <div className="space-y-4">
              {String(data.status || '').toLowerCase() === 'paid' ? (
                <PaymentSuccessNotice order={data} />
              ) : (
                <>
                  <div className="rounded-3xl bg-white/[0.03] ring-1 ring-white/10 p-5">
                    <div className="text-white font-bold text-lg">Pagar agora</div>
                    <div className="mt-2 text-sm text-slate-300">Escolha a forma de pagamento para concluir este pedido.</div>
                    <div className="mt-4 grid grid-cols-1 gap-3">
                      <button onClick={handleCard} disabled={busy} className="rounded-2xl bg-cyan-400 text-[#031116] font-black px-4 py-3 disabled:opacity-60 disabled:cursor-wait">{busy && busyMethod === 'card' ? 'Aguarde…' : 'Pagar com cartão'}</button>
                      <button onClick={handlePix} disabled={busy} className="rounded-2xl bg-white/5 text-white font-black px-4 py-3 ring-1 ring-white/10 disabled:opacity-60 disabled:cursor-wait">{busy && busyMethod === 'pix' ? 'Aguarde…' : 'Pagar com Pix'}</button>
                    </div>
                  </div>

                  {pix.qr_code_base64 ? (
                    <div className="rounded-3xl bg-white/[0.03] ring-1 ring-white/10 p-5">
                      <div className="text-white font-bold">Pix gerado</div>
                      <div className="mt-2 text-sm text-slate-300">Depois que o pagamento for aprovado, este QR Code some e sua conta ficará pronta.</div>
                      <img src={`data:image/png;base64,${pix.qr_code_base64}`} alt="QR Code Pix" className="mt-4 mx-auto w-56 h-56 rounded-2xl bg-white p-3" />
                      {pix.qr_code ? <textarea readOnly value={pix.qr_code} className="mt-4 h-24 w-full rounded-2xl bg-black/30 ring-1 ring-white/10 p-3 text-xs text-slate-200" /> : null}
                      {copyMsg ? <div className={`mt-3 rounded-xl px-3 py-2 text-sm ring-1 ${copyMsg.includes('copiado') ? 'bg-emerald-500/10 text-emerald-100 ring-emerald-400/20' : 'bg-red-500/10 text-red-100 ring-red-400/20'}`}>{copyMsg}</div> : null}
                      <div className="mt-3 flex flex-wrap gap-3">
                        {pix.qr_code ? <button type="button" onClick={copyPixCode} className="inline-flex rounded-xl px-3 py-2 text-sm text-white hover:bg-white/8 ring-1 ring-white/10">Copiar código Pix</button> : null}
                        {pix.ticket_url ? <a href={pix.ticket_url} target="_blank" rel="noreferrer" className="inline-flex rounded-xl px-3 py-2 text-sm text-cyan-200 hover:bg-white/4 ring-1 ring-white/10">Abrir link do Pix</a> : null}
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
