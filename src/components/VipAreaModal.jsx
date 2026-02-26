import React from "react";
import Modal from "./Modal.jsx";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../auth/AuthProvider.jsx";

function cycleKeyUTC() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function statusLabel(s) {
  const v = String(s || "editavel").toLowerCase();
  if (v === "editavel" || v === "recebido") return { label: "Editável", cls: "bg-emerald-500/10 ring-emerald-400/25 text-emerald-200" };
  if (v === "em_producao") return { label: "Em produção", cls: "bg-indigo-500/10 ring-indigo-400/25 text-indigo-200" };
  if (v === "enviado") return { label: "Enviado", cls: "bg-amber-500/10 ring-amber-400/25 text-amber-200" };
  if (v === "entregue") return { label: "Entregue", cls: "bg-teal-500/10 ring-teal-400/25 text-teal-200" };
  return { label: v.replaceAll("_", " "), cls: "bg-white/5 ring-white/15 text-slate-200" };
}

function fmtBRLFromCents(cents) {
  const n = Number(cents);
  if (!isFinite(n)) return '—';
  return (n / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}



const FALLBACK_VIP_PLANS = [
  { id: "CUBO_L1_RPG", slug: "level-1", name: "Cubo Level 1 — RPG", short_name: "Level 1", miniatures_count: 3, boss_count: 0, items_per_month: 3 },
  { id: "CUBO_L2_RPG", slug: "level-2", name: "Cubo Level 2 — RPG", short_name: "Level 2", miniatures_count: 4, boss_count: 1, items_per_month: 5 },
  { id: "CUBO_L3_RPG", slug: "level-3", name: "Cubo Level 3 — RPG", short_name: "Level 3", miniatures_count: 8, boss_count: 2, items_per_month: 10 },
];

function normalizeText(v) {
  return String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function findPlanByProfileValue(plans, profilePlan) {
  const q = normalizeText(profilePlan);
  if (!q) return null;
  return (plans || []).find((p) => {
    const candidates = [p?.id, p?.slug, p?.name, p?.short_name, p?.title].map(normalizeText);
    return candidates.some((c) => c && (c === q || q.includes(c) || c.includes(q)));
  }) || null;
}

export default function VipAreaModal({ open, onClose, onGoVip }) {
  const { user } = useAuth();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [vipUntil, setVipUntil] = React.useState(null);
  const [vipPlan, setVipPlan] = React.useState("");
  const [orderStatus, setOrderStatus] = React.useState("editavel");
  const [shippingTracking, setShippingTracking] = React.useState("");
  const [options, setOptions] = React.useState([]);
  // selected: escolhas em edição (não necessariamente salvas)
  const [selected, setSelected] = React.useState([]);
  // savedSelected: escolhas já salvas no ciclo
  const [savedSelected, setSavedSelected] = React.useState([]);
  // Quando false, a UI fica travada e o botão vira "Editar".
  const [editing, setEditing] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState("");
  const [preview, setPreview] = React.useState(null);
  const [vipPlans, setVipPlans] = React.useState(FALLBACK_VIP_PLANS);

  // Votação (tema do próximo mês)
  const [poll, setPoll] = React.useState(null);
  const [pollOptions, setPollOptions] = React.useState([]);
  const [myVote, setMyVote] = React.useState(null);
  const [voteCounts, setVoteCounts] = React.useState({});
  const [voteBusy, setVoteBusy] = React.useState(false);

  // Upgrade de level (Pix)
  const [upgrade, setUpgrade] = React.useState(null); // {order_id, qr_code, qr_code_base64, ticket_url, status}
  const [upgradeBusy, setUpgradeBusy] = React.useState(false);
  const [upgradePayOpen, setUpgradePayOpen] = React.useState(false);
  const [upgradePayMethod, setUpgradePayMethod] = React.useState(null); // 'pix' | 'card'
  const [upgradeSuccess, setUpgradeSuccess] = React.useState(false);

  const cycle = React.useMemo(() => cycleKeyUTC(), []);
  const isVip = vipUntil ? new Date(vipUntil).getTime() > Date.now() : false;
  const st = statusLabel(orderStatus);
  const editable = isVip && (String(orderStatus || "").toLowerCase() === "editavel" || String(orderStatus || "").toLowerCase() === "recebido");

  // IDs que serão exibidos como selecionados na UI:
  // - editando: usa selected
  // - travado: usa savedSelected
  const displaySelected = React.useMemo(() => (editing ? selected : savedSelected), [editing, selected, savedSelected]);
  const selectedPlan = React.useMemo(() => findPlanByProfileValue(vipPlans, vipPlan) || FALLBACK_VIP_PLANS[0], [vipPlans, vipPlan]);

  const nextPlan = React.useMemo(() => {
    const plans = Array.isArray(vipPlans) && vipPlans.length ? vipPlans : FALLBACK_VIP_PLANS;
    const ordered = [...plans].sort((a, b) => (Number(a?.sort_order) || 0) - (Number(b?.sort_order) || 0));
    const idx = ordered.findIndex((p) => String(p?.id) === String(selectedPlan?.id));
    if (idx >= 0 && idx + 1 < ordered.length) return ordered[idx + 1];
    return null;
  }, [vipPlans, selectedPlan?.id]);
  const miniLimit = Math.max(0, Number(selectedPlan?.miniatures_count ?? selectedPlan?.items_per_month ?? 3) || 0);
  const bossLimit = Math.max(0, Number(selectedPlan?.boss_count ?? 0) || 0);
  const totalLimit = Math.max(0, Number(selectedPlan?.items_per_month ?? (miniLimit + bossLimit)) || (miniLimit + bossLimit));

  const currentPriceCents = React.useMemo(() => {
    if (typeof selectedPlan?.price_cents === 'number') return selectedPlan.price_cents;
    if (typeof selectedPlan?.price_brl === 'number') return Math.round(selectedPlan.price_brl * 100);
    if (typeof selectedPlan?.price === 'number') return Math.round(selectedPlan.price * 100);
    return 0;
  }, [selectedPlan]);

  const nextPriceCents = React.useMemo(() => {
    if (typeof nextPlan?.price_cents === 'number') return nextPlan.price_cents;
    if (typeof nextPlan?.price_brl === 'number') return Math.round(nextPlan.price_brl * 100);
    if (typeof nextPlan?.price === 'number') return Math.round(nextPlan.price * 100);
    return 0;
  }, [nextPlan]);

  const upgradeDiffCents = React.useMemo(() => {
    const diff = Number(nextPriceCents || 0) - Number(currentPriceCents || 0);
    return diff > 0 ? diff : 0;
  }, [nextPriceCents, currentPriceCents]);

  const optionTypeById = React.useMemo(() => {
    const map = new Map();
    for (const o of (options || [])) {
      const t = String(o?.item_type || 'miniature').toLowerCase();
      map.set(o.id, (t === 'boss') ? 'boss' : 'miniature');
    }
    return map;
  }, [options]);

  const selectedCounts = React.useMemo(() => {
    let mini = 0;
    let boss = 0;
    for (const id of (displaySelected || [])) {
      const t = optionTypeById.get(id) || 'miniature';
      if (t === 'boss') boss += 1;
      else mini += 1;
    }
    return { mini, boss, total: (mini + boss) };
  }, [displaySelected, optionTypeById]);

  function canAdd(optionId) {
    const t = optionTypeById.get(optionId) || 'miniature';
    if (selectedCounts.total >= totalLimit) return false;
    if (t === 'boss') return selectedCounts.boss < bossLimit;
    return selectedCounts.mini < miniLimit;
  }

  async function load() {
    if (!user) return;
    setLoading(true);
    setError("");
    setMsg("");
    try {
      try {
        const plansResp = await fetch('/api/vip-plans');
        const plansJson = await plansResp.json().catch(() => ({}));
        if (plansResp.ok && Array.isArray(plansJson?.plans) && plansJson.plans.length) setVipPlans(plansJson.plans);
      } catch {}
      const [{ data: prof }, { data: opts }, { data: lastVipOrder }, { data: sel }] = await Promise.all([
        supabase.from("profiles").select("vip_until,vip_plan").eq("id", user.id).maybeSingle(),
        supabase.from("vip_mini_options").select("id,title,description,image_url,gallery_images,sort_order,active,item_type").eq("active", true).order("sort_order", { ascending: true }),
        supabase
          .from("orders")
          .select("id,production_status,shipping_tracking,created_at")
          .eq("user_id", user.id)
          .eq("order_type", "vip")
          .eq("status", "paid")
          .order("created_at", { ascending: false })
          .limit(1),
        // saved_at ajuda a diferenciar seleção realmente salva de um registro antigo/placeholder
        supabase.from("vip_mini_selections").select("selected_option_ids,saved_at").eq("user_id", user.id).eq("cycle_key", cycle).maybeSingle(),
      ]);

      setVipUntil(prof?.vip_until || null);
      setVipPlan(prof?.vip_plan || "Cubo Level 1 — RPG");
      setOptions(Array.isArray(opts) ? opts : []);

      // Votação do tema (best-effort). Se as tabelas não existirem ainda, só omitimos a seção.
      try {
        const { data: p } = await supabase
          .from('vip_theme_polls')
          .select('id,month_key,title,status')
          .eq('status', 'open')
          .order('month_key', { ascending: false })
          .limit(1)
          .maybeSingle();
        setPoll(p || null);
        if (p?.id) {
          const [{ data: opts2 }, { data: mine }, { data: counts }] = await Promise.all([
            supabase.from('vip_theme_options').select('id,poll_id,title,description,image_url,sort_order,active').eq('poll_id', p.id).eq('active', true).order('sort_order', { ascending: true }),
            supabase.from('vip_theme_votes').select('option_id').eq('poll_id', p.id).eq('user_id', user.id).maybeSingle(),
            supabase.rpc('vip_theme_counts', { p_poll_id: p.id }),
          ]);
          setPollOptions(Array.isArray(opts2) ? opts2 : []);
          setMyVote(mine?.option_id || null);
          const map = {};
          for (const r of (counts || [])) map[String(r.option_id)] = Number(r.votes) || 0;
          setVoteCounts(map);
        } else {
          setPollOptions([]);
          setMyVote(null);
          setVoteCounts({});
        }
      } catch {
        setPoll(null);
        setPollOptions([]);
        setMyVote(null);
        setVoteCounts({});
      }

      const order = Array.isArray(lastVipOrder) ? lastVipOrder[0] : null;
      setOrderStatus(String(order?.production_status || "editavel").toLowerCase());
      setShippingTracking(String(order?.shipping_tracking || "").trim());

      // Regra: ao abrir a tela após assinatura, não deve vir nada pré-selecionado.
      // Só exibimos escolhas se houver saved_at (seleção confirmada no ciclo).
      const hasSaved = !!sel?.saved_at;
      const ids = (hasSaved && Array.isArray(sel?.selected_option_ids)) ? sel.selected_option_ids : [];
      setSavedSelected(ids);

      // Em edição: começa vazio se não houver seleção salva no ciclo.
      // Se já existe seleção salva, começa travado e o usuário clica em "Editar".
      if (ids.length) {
        setEditing(false);
        setSelected([]);
      } else {
        setEditing(true);
        setSelected([]);
      }
    } catch (e) {
      setError(e?.message || "Não foi possível carregar a Área VIP.");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    if (open) load();
  }, [open]);

  async function refreshVoteCounts(pollId) {
    try {
      const { data: counts } = await supabase.rpc('vip_theme_counts', { p_poll_id: pollId });
      const map = {};
      for (const r of (counts || [])) map[String(r.option_id)] = Number(r.votes) || 0;
      setVoteCounts(map);
    } catch {}
  }

  async function vote(optionId) {
    if (!user || !poll?.id) return;
    if (!isVip) {
      setMsg('A votação é exclusiva para membros VIP.');
      return;
    }
    try {
      setVoteBusy(true);
      setMsg('');
      const payload = { poll_id: poll.id, option_id: optionId, user_id: user.id };
      const { error: upErr } = await supabase.from('vip_theme_votes').upsert(payload, { onConflict: 'poll_id,user_id' });
      if (upErr) throw upErr;
      setMyVote(optionId);
      await refreshVoteCounts(poll.id);
      setMsg('Voto registrado ✅');
    } catch {
      setMsg('Não foi possível registrar seu voto.');
    } finally {
      setVoteBusy(false);
    }
  }

  async function startUpgradePix() {
    if (!user || !isVip) return;
    if (!nextPlan?.id) return;
    try {
      setUpgradeBusy(true);
      setMsg('');
      setUpgrade(null);
      const session = await supabase.auth.getSession();
      const jwt = session?.data?.session?.access_token;
      if (!jwt) {
        setMsg('Faça login novamente para continuar.');
        return;
      }
      const res = await fetch('/api/create-vip-upgrade-pix-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({ to_plan_id: nextPlan.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Não foi possível gerar o Pix do upgrade.');
      setUpgrade({
        order_id: data?.order_id || '',
        qr_code: data?.qr_code || '',
        qr_code_base64: data?.qr_code_base64 || '',
        ticket_url: data?.ticket_url || '',
        status: String(data?.status || '').toLowerCase(),
      });
      setMsg('Pix do upgrade gerado. A confirmação é automática.');
    } catch (e) {
      setMsg(String(e?.message || 'Não foi possível gerar o Pix do upgrade.'));
    } finally {
      setUpgradeBusy(false);
    }
  }

  async function startUpgradeCard() {
    if (!user || !isVip) return;
    if (!nextPlan?.id) return;
    try {
      setUpgradeBusy(true);
      setMsg('');
      const session = await supabase.auth.getSession();
      const jwt = session?.data?.session?.access_token;
      if (!jwt) {
        setMsg('Faça login novamente para continuar.');
        return;
      }
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({ mode: 'vip_upgrade', to_plan_id: nextPlan.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data?.code === 'profile_incomplete') {
          setMsg('Complete seus dados no perfil (CPF e endereço) para continuar.');
          return;
        }
        throw new Error(data?.error || 'Não foi possível iniciar o pagamento.');
      }
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      setMsg('Checkout criado.');
    } catch (e) {
      setMsg(String(e?.message || 'Não foi possível iniciar o pagamento.'));
    } finally {
      setUpgradeBusy(false);
    }
  }


  React.useEffect(() => {
    if (!upgrade?.order_id) return;
    let stopped = false;
    const t = setInterval(async () => {
      if (stopped) return;
      try {
        const session = await supabase.auth.getSession();
        const jwt = session?.data?.session?.access_token;
        if (!jwt) return;

        const res = await fetch(`/api/pix-payment?action=verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
          body: JSON.stringify({ order_id: upgrade.order_id }),
        });
        const data = await res.json().catch(() => ({}));
        const st = String(data?.status || '').toLowerCase();
        if (st) setUpgrade((p) => ({ ...(p || {}), status: st }));

        if (st === 'paid') {
          stopped = true;
          clearInterval(t);
          setUpgrade(null); // some o QR code
          setUpgradePayMethod(null);
          setUpgradeSuccess(true);
          setMsg('Você subiu de nível ✅');
          await load();
          setTimeout(() => setUpgradeSuccess(false), 12000);
        }

        if (st === 'failed') {
          stopped = true;
          clearInterval(t);
          setMsg('Pagamento recusado ou cancelado. Se precisar, gere um novo Pix.');
        }
      } catch {}
    }, 5000);
    return () => {
      stopped = true;
      clearInterval(t);
    };
  }, [upgrade?.order_id]);

  async function saveSelection() {
    if (!editable) return;
    if (!editing) return;
    if (selectedCounts.mini !== miniLimit || selectedCounts.boss !== bossLimit || selectedCounts.total !== totalLimit) {
      setMsg(`Escolha exatamente ${totalLimit} item(ns) para o seu plano (${miniLimit} miniatura(s)${bossLimit ? ` + ${bossLimit} boss(es)` : ""}).`);
      return;
    }
    try {
      setSaving(true);
      setMsg("");
      const payload = { user_id: user.id, cycle_key: cycle, selected_option_ids: selected, saved_at: new Date().toISOString() };
      const { error: upErr } = await supabase.from("vip_mini_selections").upsert(payload, { onConflict: "user_id,cycle_key" });
      if (upErr) throw upErr;
      setSavedSelected(selected);
      setSelected([]);
      setEditing(false);
      setMsg("Escolhas salvas ✅");
    } catch (e) {
      const raw = String(e?.message || "");
      // Não mostrar mensagens técnicas do Postgres na UI
      if (raw.toLowerCase().includes("violates check constraint") || raw.toLowerCase().includes("new row for relation")) {
        setMsg("Não foi possível salvar. Confira se você selecionou a quantidade correta do seu plano.");
      } else {
        setMsg("Não foi possível salvar. Tente novamente.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} maxWidth="max-w-4xl">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-950 to-black ring-1 ring-white/10">
        <div className="absolute inset-0 opacity-35 pointer-events-none" style={{ backgroundImage: "radial-gradient(circle at 20% 10%, rgba(168,85,247,.35), transparent 45%), radial-gradient(circle at 80% 20%, rgba(34,197,94,.22), transparent 55%), radial-gradient(circle at 50% 90%, rgba(56,189,248,.18), transparent 55%)" }} />
        <div className="relative p-5 sm:p-7">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Área VIP</p>
              <h2 className="mt-1 text-2xl sm:text-3xl font-extrabold">{vipPlan || "Clube VIP"}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs ring-1 ${st.cls}`}>
                  <span className="material-icons text-[16px]">flag</span>
                  Status: <b>{st.label}</b>
                </span>
                <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs ring-1 ring-white/15 bg-white/5 text-slate-200">
                  <span className="material-icons text-[16px]">calendar_month</span>
                  Ciclo: <b>{cycle}</b>
                </span>
                {isVip ? (
                  <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs ring-1 ring-violet-400/25 bg-violet-500/10 text-violet-100">
                    <span className="material-icons text-[16px]">stars</span>
                    VIP ativo • expira em <b>{new Date(vipUntil).toLocaleDateString("pt-BR")}</b>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs ring-1 ring-white/15 bg-white/5 text-slate-200">
                    <span className="material-icons text-[16px]">lock</span>
                    Não VIP
                  </span>
                )}
              </div>
            </div>
            <button onClick={onClose} className="rounded-xl p-2 ring-1 ring-white/15 hover:bg-white/5" aria-label="Fechar">
              <span className="material-icons">close</span>
            </button>
          </div>

          {!user ? (
            <div className="mt-6 rounded-2xl bg-white/5 ring-1 ring-white/10 p-4 text-slate-200">Faça login para acessar a Área VIP.</div>
          ) : loading ? (
            <div className="mt-6 rounded-2xl bg-white/5 ring-1 ring-white/10 p-4 text-slate-200">Carregando…</div>
          ) : error ? (
            <div className="mt-6 rounded-2xl bg-rose-500/10 ring-1 ring-rose-400/20 p-4 text-rose-100">{error}</div>
          ) : !isVip ? (
            <div className="mt-6 rounded-2xl bg-white/5 ring-1 ring-white/10 p-5">
              <p className="text-slate-200">Assine para escolher suas miniaturas mensais e liberar benefícios VIP.</p>
              <button onClick={onGoVip} className="mt-4 rounded-xl px-4 py-3 font-extrabold bg-teal-400 text-black ring-4 ring-teal-400/20">Ver planos VIP</button>
            </div>
          ) : (
            <>

              {String(orderStatus || '').toLowerCase() === 'enviado' && shippingTracking ? (
                <div className="mt-4 rounded-2xl bg-amber-500/10 ring-1 ring-amber-400/20 p-4">
                  <p className="text-sm font-semibold text-amber-100">Código de rastreio</p>
                  <div className="mt-2 flex flex-col sm:flex-row gap-2 sm:items-center">
                    <code className="rounded-lg bg-black/30 px-3 py-2 text-xs text-amber-50 ring-1 ring-amber-200/10">{shippingTracking}</code>
                    <button type="button" onClick={() => navigator.clipboard.writeText(String(shippingTracking || ''))} className="rounded-lg px-3 py-2 text-xs font-semibold ring-1 ring-amber-300/20 hover:bg-white/5">Copiar</button>
                    <a href={`https://rastreamento.correios.com.br/app/index.php?objetos=${encodeURIComponent(shippingTracking)}`} target="_blank" rel="noreferrer" className="rounded-lg px-3 py-2 text-xs font-semibold bg-amber-300 text-black hover:bg-amber-200">Rastrear pedido</a>
                  </div>
                </div>
              ) : null}

              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 rounded-2xl bg-white/5 ring-1 ring-white/10 p-5">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-slate-400">Seu nível VIP</div>
                      <div className="mt-1 text-xl sm:text-2xl font-extrabold text-violet-100">{selectedPlan?.short_name || selectedPlan?.name || 'VIP'}</div>
                      <div className="mt-2 text-sm text-slate-300">
                        {miniLimit} miniatura(s){bossLimit ? ` + ${bossLimit} boss(es)` : ''} • total {totalLimit}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs uppercase tracking-wide text-slate-400">Seu ciclo</div>
                      <div className="mt-1 text-sm text-slate-200">
                        Mini: <b>{selectedCounts.mini}</b>/{miniLimit}
                        <span className="ml-2 text-slate-400">•</span>
                        <span className="ml-2">Boss: <b>{selectedCounts.boss}</b>/{bossLimit}</span>
                      </div>
                      <div className="text-xs text-slate-400 mt-1">Total: <b>{selectedCounts.total}</b>/{totalLimit}</div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl bg-gradient-to-br from-violet-500/15 to-fuchsia-500/10 ring-1 ring-violet-400/20 p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-slate-300">Upgrade</div>
                      <div className="mt-1 font-extrabold text-slate-50">Subir de Nível</div>
                      <div className="mt-2 text-sm text-slate-200/80">
                        {nextPlan ? <>Próximo: <b>{nextPlan?.short_name || nextPlan?.name}</b></> : <>Você já está no maior nível.</>}
                      </div>
                      {nextPlan ? (
                        <div className="mt-2 text-xs text-slate-200/80">
                          Você paga apenas a diferença: <b>{fmtBRLFromCents(upgradeDiffCents)}</b>
                        </div>
                      ) : null}
                    </div>
                    <span className="material-icons text-violet-200">rocket_launch</span>
                  </div>
                  {nextPlan ? (
                    <button
                      disabled={upgradeBusy}
                      onClick={() => setUpgradePayOpen(true)}
                      className="mt-4 w-full rounded-xl px-4 py-3 font-extrabold bg-violet-400 text-black ring-4 ring-violet-400/20 hover:opacity-95 disabled:opacity-60"
                    >
                      {'Subir de Nível'}
                    </button>
                  ) : null}
                </div>
              </div>

              {upgradePayOpen ? (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                  <div className="absolute inset-0 bg-black/70" onClick={() => setUpgradePayOpen(false)} />
                  <div className="relative w-full max-w-md rounded-2xl bg-slate-950 ring-1 ring-white/10 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs uppercase tracking-wide text-slate-400">Upgrade de Nível</div>
                        <div className="mt-1 text-xl font-extrabold text-slate-100">Escolha a forma de pagamento</div>
                        <div className="mt-2 text-sm text-slate-300">Valor: <b>{fmtBRLFromCents(upgradeDiffCents)}</b></div>
                      </div>
                      <button onClick={() => setUpgradePayOpen(false)} className="rounded-xl p-2 ring-1 ring-white/15 hover:bg-white/5" aria-label="Fechar">
                        <span className="material-icons">close</span>
                      </button>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-2">
                      <button
                        disabled={upgradeBusy}
                        onClick={() => { setUpgradePayMethod('card'); setUpgradePayOpen(false); startUpgradeCard(); }}
                        className="rounded-xl px-4 py-3 font-extrabold bg-teal-400 text-black ring-4 ring-teal-400/20 hover:opacity-95 disabled:opacity-60"
                      >
                        Pagar com cartão
                      </button>
                      <button
                        disabled={upgradeBusy}
                        onClick={() => { setUpgradePayMethod('pix'); setUpgradePayOpen(false); startUpgradePix(); }}
                        className="rounded-xl px-4 py-3 font-semibold ring-1 ring-white/15 hover:bg-white/5 disabled:opacity-60"
                      >
                        Pagar com Pix
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              {upgrade?.order_id ? (
                <div className="mt-4 rounded-2xl bg-white/5 ring-1 ring-white/10 p-5">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <div className="text-sm font-extrabold text-slate-100">Pix do upgrade</div>
                      <div className="text-xs text-slate-400">Status: <b>{upgrade?.status || 'pendente'}</b></div>
                    </div>
                    {upgrade?.ticket_url ? (
                      <a className="text-sm font-semibold text-teal-200 hover:underline" href={upgrade.ticket_url} target="_blank" rel="noreferrer">Abrir no Mercado Pago</a>
                    ) : null}

              {upgradeSuccess ? (
                <div className="mt-4 rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-400/20 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-emerald-200/90">Upgrade concluído</div>
                      <div className="mt-1 text-xl font-extrabold text-emerald-100">Você subiu de nível ✅</div>
                      <div className="mt-2 text-sm text-slate-200/80">Seu novo nível já está ativo. Pode continuar escolhendo as miniaturas do seu plano.</div>
                    </div>
                    <span className="material-icons text-emerald-200">verified</span>
                  </div>
                </div>
              ) : null}

                  </div>
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="rounded-2xl bg-black/30 ring-1 ring-white/10 p-4 flex items-center justify-center">
                      {upgrade?.qr_code_base64 ? (
                        <img alt="QR Code Pix" className="w-56 h-56" src={`data:image/png;base64,${upgrade.qr_code_base64}`} />
                      ) : (
                        <div className="text-slate-300">QR Code indisponível</div>
                      )}
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wide text-slate-400">Copia e cola</div>
                      <textarea readOnly value={upgrade?.qr_code || ''} className="mt-2 w-full h-40 rounded-xl bg-black/30 ring-1 ring-white/10 p-3 text-xs text-slate-100" />
                      <button
                        onClick={() => { try { navigator.clipboard.writeText(upgrade?.qr_code || ''); setMsg('Código Pix copiado ✅'); } catch {} }}
                        className="mt-3 w-full rounded-xl px-4 py-3 font-extrabold bg-teal-400 text-black ring-4 ring-teal-400/20"
                      >
                        Copiar código Pix
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              {poll?.id ? (
                <div className="mt-4 rounded-2xl bg-white/5 ring-1 ring-white/10 p-5">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-slate-400">Votação VIP</div>
                      <div className="mt-1 text-xl font-extrabold text-slate-100">Tema do próximo mês</div>
                      <div className="text-sm text-slate-300 mt-1">{poll?.title || `Votação ${poll?.month_key}`}</div>
                    </div>
                    <div className="text-xs text-slate-400">Ciclo: <b>{poll?.month_key}</b></div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {(pollOptions || []).map((o) => {
                      const votes = Number(voteCounts[String(o.id)] || 0);
                      const totalVotes = Object.values(voteCounts || {}).reduce((a, b) => a + (Number(b) || 0), 0);
                      const pct = totalVotes ? Math.round((votes / totalVotes) * 100) : 0;
                      const active = String(myVote) === String(o.id);
                      return (
                        <button
                          key={o.id}
                          disabled={voteBusy}
                          onClick={() => vote(o.id)}
                          className={`text-left rounded-2xl ring-1 p-4 transition hover:-translate-y-0.5 ${active ? 'bg-violet-500/15 ring-violet-400/30' : 'bg-black/25 ring-white/10 hover:bg-white/5'}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="font-extrabold text-slate-100">{o.title}</div>
                              {o.description ? <div className="text-xs text-slate-300 mt-1 line-clamp-2">{o.description}</div> : null}
                            </div>
                            {active ? <span className="material-icons text-violet-200">check_circle</span> : <span className="material-icons text-slate-400">how_to_vote</span>}
                          </div>
                          <div className="mt-3">
                            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                              <div className="h-full bg-violet-400" style={{ width: `${pct}%` }} />
                            </div>
                            <div className="mt-2 text-xs text-slate-400">{votes} voto(s) • {pct}%</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <div className="mt-6 flex items-center justify-between gap-3 flex-wrap">
                <div className="text-sm text-slate-300">
                  Escolha <b>{totalLimit}</b> item(ns) do mês ({miniLimit} miniatura(s){bossLimit ? ` + ${bossLimit} boss(es)` : ""}) entre <b>{options.length}</b> opções.
                  {!editable ? (
                    <span className="ml-2 text-slate-400">(Escolhas bloqueadas: status {st.label})</span>
                  ) : null}
                </div>
                <div className="text-sm text-slate-200">
                  Selecionadas: <b>{selectedCounts.total}</b>/{totalLimit}
                  <span className="ml-2 text-slate-400">• Mini: <b className="text-slate-200">{selectedCounts.mini}</b>/{miniLimit}</span>
                  <span className="ml-2 text-slate-400">• Boss: <b className="text-slate-200">{selectedCounts.boss}</b>/{bossLimit}</span>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                {options.map((opt) => {
                  const isSel = displaySelected.includes(opt.id);
                  const kind = (String(opt?.item_type || 'miniature').toLowerCase() === 'boss') ? 'boss' : 'miniature';
                  const addBlocked = editing && !isSel && !canAdd(opt.id);
                  return (
                    <div
                      key={opt.id}
                      className={`rounded-2xl overflow-hidden ring-1 transition relative ${isSel ? "bg-violet-500/15 ring-violet-300/40 shadow-[0_0_0_1px_rgba(167,139,250,0.25)]" : "bg-white/5 ring-white/10"}`}
                    >
                      {isSel ? (
                        <div className="absolute top-2 left-2 z-10 inline-flex items-center gap-1 rounded-full bg-violet-500/25 text-violet-50 ring-1 ring-violet-300/30 px-2 py-1 text-[10px] font-extrabold">
                          <span className="material-icons text-[14px]">check</span>
                          Selecionado
                        </div>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setPreview(opt)}
                        className="block w-full text-left"
                      >
                        <div className="aspect-square bg-slate-900/80">
                          {opt.image_url ? (
                            <img src={opt.image_url} alt={opt.title} className="h-full w-full object-cover" loading="lazy" />
                          ) : (
                            <div className="h-full w-full grid place-items-center text-slate-500 text-xs">Sem imagem</div>
                          )}
                        </div>
                      </button>

                      <div className="p-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-extrabold text-slate-100 truncate">{opt.title}</p>
                            <div className="mt-1 flex flex-wrap gap-1">
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] ring-1 ${kind === 'boss' ? 'bg-amber-500/10 ring-amber-400/25 text-amber-100' : 'bg-emerald-500/10 ring-emerald-400/25 text-emerald-100'}`}>
                                {kind === 'boss' ? 'Boss' : 'Miniatura'}
                              </span>
                            </div>
                            {opt.description ? (
                              <p className="mt-1 text-[11px] text-slate-400 line-clamp-2">{opt.description}</p>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            disabled={!editable || !editing || saving || addBlocked}
                            onClick={() => {
                              if (!editing) return;
                              setSelected((prev) => {
                                const has = prev.includes(opt.id);
                                if (has) return prev.filter((x) => x !== opt.id);
                                // Recalcula contadores usando o estado "prev" para evitar race condition
                                let mini = 0;
                                let boss = 0;
                                for (const id of prev) {
                                  const t = optionTypeById.get(id) || 'miniature';
                                  if (t === 'boss') boss += 1;
                                  else mini += 1;
                                }
                                const total = mini + boss;
                                const tNew = optionTypeById.get(opt.id) || 'miniature';
                                if (total >= totalLimit) return prev;
                                if (tNew === 'boss' && boss >= bossLimit) return prev;
                                if (tNew !== 'boss' && mini >= miniLimit) return prev;
                                return [...prev, opt.id];
                              });
                            }}
                            className={`shrink-0 rounded-lg p-1.5 ring-1 ${isSel ? "bg-violet-500/25 ring-violet-300/30 text-violet-50" : "bg-white/5 ring-white/10 text-slate-300"} ${(!editable || !editing || saving) ? "opacity-60 cursor-not-allowed" : "hover:bg-white/10"}`}
                            aria-label={isSel ? 'Remover miniatura' : 'Selecionar miniatura'}
                          >
                            <span className="material-icons text-[18px]">{isSel ? "check_circle" : "add_circle"}</span>
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => setPreview(opt)}
                          className="mt-2 text-[11px] text-sky-300 hover:text-sky-200"
                        >
                          Ver imagens
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {preview ? (
                <div className="fixed inset-0 z-[70] bg-black/75 backdrop-blur-sm p-4" onClick={() => setPreview(null)}>
                  <div className="mx-auto mt-4 max-w-lg rounded-2xl bg-slate-950 ring-1 ring-white/10 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                    <div className="p-4 border-b border-white/10 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-lg font-extrabold text-white truncate">{preview.title}</h3>
                        {preview.description ? <p className="mt-1 text-sm text-slate-400">{preview.description}</p> : null}
                      </div>
                      <button onClick={() => setPreview(null)} className="rounded-lg p-2 ring-1 ring-white/10 hover:bg-white/5">
                        <span className="material-icons text-[18px]">close</span>
                      </button>
                    </div>
                    <div className="p-4 space-y-3">
                      {preview.image_url ? (
                        <img src={preview.image_url} alt={preview.title} className="w-full aspect-square object-cover rounded-xl ring-1 ring-white/10" />
                      ) : null}
                      {Array.isArray(preview.gallery_images) && preview.gallery_images.length ? (
                        <div className="grid grid-cols-3 gap-2">
                          {preview.gallery_images.map((url, idx) => (
                            <img key={idx} src={url} alt={`${preview.title} ${idx + 1}`} className="w-full aspect-square object-cover rounded-lg ring-1 ring-white/10" />
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400">Sem imagens adicionais para esta miniatura.</div>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="mt-5 flex items-center justify-between gap-3 flex-wrap">
                <div />
                {editing ? (
                  <button
                    type="button"
                    disabled={!editable || saving || selectedCounts.mini !== miniLimit || selectedCounts.boss !== bossLimit || selectedCounts.total !== totalLimit}
                    onClick={saveSelection}
                    className={`rounded-xl px-4 py-2 font-extrabold ring-1 ring-white/10 ${(!editable || saving || selectedCounts.mini !== miniLimit || selectedCounts.boss !== bossLimit || selectedCounts.total !== totalLimit) ? "bg-slate-700/40 text-slate-300" : "bg-emerald-300 text-black hover:bg-emerald-200"}`}
                  >
                    {saving ? "Salvando…" : "Salvar escolhas"}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={!editable}
                    onClick={() => {
                      if (!editable) return;
                      setSelected(Array.isArray(savedSelected) ? savedSelected : []);
                      setEditing(true);
                      setMsg("");
                    }}
                    className={`rounded-xl px-4 py-2 font-extrabold ring-1 ring-white/10 ${!editable ? "bg-slate-700/40 text-slate-300" : "bg-violet-300 text-black hover:bg-violet-200"}`}
                  >
                    Editar
                  </button>
                )}
              </div>
              {msg ? <div className="mt-3 text-sm text-slate-200">{msg}</div> : null}
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}