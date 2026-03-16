import React from "react";
import Modal from "./Modal.jsx";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../auth/AuthProvider.jsx";
import VipPresentD20 from "./VipPresentD20.jsx";
import { clearVipCache, cycleDeadlineLabel, cycleKeyUTC, findPlanByProfileValue, fmtBRLFromCents, readVipCache, statusLabel, tabHelpContent, vipBlockMessage, writeVipCache } from "./vip-area/vipAreaHelpers.js";

// Planos VIP vêm do Supabase (tabela vip_plans). Sem valores fixos no código.
const FALLBACK_VIP_PLANS = [];

export default function VipAreaModal({ open, onClose, onGoVip, onRequireLogin, asPage = false, onGoHome }) {
  const { user, session, loading: authLoading } = useAuth();
  const accessToken = session?.access_token || "";

  const isOpen = asPage ? true : open;

  React.useEffect(() => {
    // Evita falso-positivo ao recarregar: aguarda o AuthProvider resolver a sessão.
    if (isOpen && !user && !authLoading) {
      // Em modo página não fechamos nada — apenas pedimos login.
      onRequireLogin?.("Entre para acessar a Área VIP.");
      if (!asPage) onClose?.();
    }
  }, [isOpen, user, asPage, authLoading]);
  // no refresh, usamos cache local para não "piscar" o upsell
  const cachedVipUntil = React.useMemo(() => {
    try {
      return String(window?.localStorage?.getItem('vip_until_cache') || '');
    } catch {
      return '';
    }
  }, [isOpen]);

  const [loading, setLoading] = React.useState(() => Boolean(isOpen && user));
  const [error, setError] = React.useState("");
  const [vipUntil, setVipUntil] = React.useState(() => (cachedVipUntil ? cachedVipUntil : null));
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

  // UI (organização)
  const [showPoll, setShowPoll] = React.useState(false);
  const [showUpgrade, setShowUpgrade] = React.useState(false);
  const [optionsLoading, setOptionsLoading] = React.useState(false);
  const [pollLoading, setPollLoading] = React.useState(false);
  const [pollBootstrapped, setPollBootstrapped] = React.useState(false);

  // Navegação (melhor experiência no mobile)
  const [tab, setTab] = React.useState('escolhas'); // 'escolhas' | 'pedido' | 'votacao' | 'upgrade' | 'presente'
  const [helpOpen, setHelpOpen] = React.useState(false);

  // Aviso elegante quando o usuário estoura o limite do plano
  const [limitNotice, setLimitNotice] = React.useState(null); // { title, text }
  const limitTimerRef = React.useRef(null);
  const loadSeqRef = React.useRef(0);

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
  const cacheKey = React.useMemo(() => (user?.id ? `vip_area:${user.id}:${cycle}` : ''), [user?.id, cycle]);
  const isVip = vipUntil ? new Date(vipUntil).getTime() > Date.now() : false;
  const st = statusLabel(orderStatus);
  const editable = isVip && (String(orderStatus || "").toLowerCase() === "editavel" || String(orderStatus || "").toLowerCase() === "recebido");
  const cycleDeadline = React.useMemo(() => cycleDeadlineLabel(cycle), [cycle]);
  const blockNotice = React.useMemo(() => vipBlockMessage(orderStatus), [orderStatus]);

  // IDs que serão exibidos como selecionados na UI:
  // - editando: usa selected
  // - travado: usa savedSelected
  const displaySelected = React.useMemo(() => (editing ? selected : savedSelected), [editing, selected, savedSelected]);
  const selectedPlan = React.useMemo(() => findPlanByProfileValue(vipPlans, vipPlan) || (Array.isArray(vipPlans) ? vipPlans[0] : null), [vipPlans, vipPlan]);
  const vipPlanLabel = React.useMemo(() => selectedPlan?.short_name || selectedPlan?.name || 'VIP', [selectedPlan]);

  const nextPlan = React.useMemo(() => {
    const plans = Array.isArray(vipPlans) && vipPlans.length ? vipPlans : FALLBACK_VIP_PLANS;
    const ordered = [...plans].sort((a, b) => (Number(a?.sort_order) || 0) - (Number(b?.sort_order) || 0));
    const idx = ordered.findIndex((p) => String(p?.id) === String(selectedPlan?.id));
    if (idx >= 0 && idx + 1 < ordered.length) return ordered[idx + 1];
    return null;
  }, [vipPlans, selectedPlan?.id]);
  const miniLimit = Math.max(0, Number(selectedPlan?.miniatures_count ?? selectedPlan?.items_per_month ?? 0) || 0);
  const bossLimit = Math.max(0, Number(selectedPlan?.boss_count ?? 0) || 0);
  const totalLimit = Math.max(0, Number(selectedPlan?.items_per_month ?? (miniLimit + bossLimit)) || (miniLimit + bossLimit));
  const help = React.useMemo(() => tabHelpContent(tab, { totalLimit, editable, planName: vipPlanLabel, deadline: cycleDeadline }) || { title: 'Como funciona', body: '' }, [tab, totalLimit, editable, vipPlanLabel, cycleDeadline]);

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

  const optionById = React.useMemo(() => {
    const map = new Map();
    for (const o of (options || [])) map.set(o.id, o);
    return map;
  }, [options]);

  const selectedCards = React.useMemo(() => {
    return (displaySelected || []).map((id) => ({ id, opt: optionById.get(id) || null }));
  }, [displaySelected, optionById]);

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

  const progress = React.useMemo(() => {
    const safePct = (value, limit) => {
      if (!limit) return value > 0 ? 100 : 0;
      return Math.min(100, Math.round((value / limit) * 100));
    };
    const remaining = Math.max(0, totalLimit - selectedCounts.total);
    const missingMini = Math.max(0, miniLimit - selectedCounts.mini);
    const missingBoss = Math.max(0, bossLimit - selectedCounts.boss);
    const complete = selectedCounts.total === totalLimit && selectedCounts.mini === miniLimit && selectedCounts.boss === bossLimit;
    return {
      totalPct: safePct(selectedCounts.total, totalLimit),
      miniPct: safePct(selectedCounts.mini, miniLimit),
      bossPct: bossLimit ? safePct(selectedCounts.boss, bossLimit) : 100,
      remaining,
      missingMini,
      missingBoss,
      complete,
    };
  }, [selectedCounts, totalLimit, miniLimit, bossLimit]);

  const visibleTabs = React.useMemo(() => {
    const tabs = [
      {
        k: 'escolhas',
        label: 'Escolhas',
        ic: 'checklist',
        mobileLabel: 'Escolhas',
        badge: progress.complete ? 'Fechado' : `${selectedCounts.total}/${totalLimit}`,
        tone: progress.complete ? 'bg-emerald-500/15 text-emerald-100 ring-emerald-400/30' : 'bg-violet-500/15 text-violet-100 ring-violet-400/30',
        visible: true,
      },
      {
        k: 'pedido',
        label: 'Pedido',
        ic: 'local_shipping',
        mobileLabel: 'Pedido',
        badge: st.label,
        tone: st.cls,
        visible: true,
      },
      {
        k: 'votacao',
        label: 'Votação',
        ic: 'how_to_vote',
        mobileLabel: 'Votação',
        badge: poll?.id ? (String(poll?.status || '').toLowerCase() === 'open' ? 'Aberta' : 'Encerrada') : 'Indisponível',
        tone: poll?.id ? 'bg-cyan-500/15 text-cyan-100 ring-cyan-400/30' : 'bg-white/4 text-slate-300 ring-white/10',
        visible: !!poll?.id || pollLoading || !pollBootstrapped,
      },
      {
        k: 'upgrade',
        label: 'Upgrade',
        ic: 'upgrade',
        mobileLabel: 'Upgrade',
        badge: nextPlan ? 'Disponível' : upgrade?.order_id ? 'Em andamento' : 'Fechado',
        tone: nextPlan || upgrade?.order_id ? 'bg-amber-400/15 text-amber-100 ring-amber-300/30' : 'bg-white/4 text-slate-300 ring-white/10',
        visible: !!nextPlan || !!upgrade?.order_id || !!upgradeSuccess,
      },
      {
        k: 'presente',
        label: 'Presente',
        ic: 'redeem',
        mobileLabel: 'Presente',
        badge: 'd20',
        tone: 'bg-emerald-500/15 text-emerald-100 ring-emerald-400/30',
        visible: true,
      },
    ];
    return tabs.filter((item) => item.visible);
  }, [progress.complete, selectedCounts.total, totalLimit, st.label, st.cls, poll?.id, poll?.status, pollLoading, pollBootstrapped, nextPlan, upgrade?.order_id, upgradeSuccess]);

  const orderTimelineSteps = React.useMemo(() => {
    const current = String(orderStatus || 'editavel').toLowerCase();
    const map = {
      editavel: 0,
      recebido: 1,
      em_producao: 2,
      pronto: 3,
      enviado: 4,
      entregue: 5,
      cancelado: 5,
      reembolsado: 5,
    };
    const currentIdx = map[current] ?? 0;
    const cancelled = current === 'cancelado' || current === 'reembolsado';
    const labels = [
      { key: 'editavel', title: 'Escolhas abertas', desc: 'Você ainda pode revisar o ciclo.' },
      { key: 'recebido', title: 'Pedido recebido', desc: 'Seu ciclo entrou na fila interna.' },
      { key: 'em_producao', title: 'Em produção', desc: 'Sua caixa está sendo preparada.' },
      { key: 'pronto', title: 'Pronto para envio', desc: 'Falta apenas gerar o envio.' },
      { key: 'enviado', title: 'Enviado', desc: shippingTracking ? `Rastreio ${shippingTracking}` : 'Seu código aparece aqui assim que sair.' },
      { key: 'entregue', title: 'Entregue', desc: 'Pedido finalizado com sucesso.' },
    ];
    return labels.map((step, idx) => ({
      ...step,
      done: cancelled ? idx < currentIdx : idx <= currentIdx,
      current: !cancelled && idx === currentIdx,
      blocked: cancelled && idx >= currentIdx,
      cancelled,
    }));
  }, [orderStatus, shippingTracking]);

  React.useEffect(() => {
    if (!visibleTabs.some((item) => item.k === tab)) {
      setTab(visibleTabs[0]?.k || 'escolhas');
    }
  }, [visibleTabs, tab]);

  const nextAction = React.useMemo(() => {
    if (!user) return {
      label: 'Entrar para acessar a Área VIP',
      hint: 'Faça login para liberar seu painel VIP e acompanhar o ciclo.',
      tab: null,
      ctaLabel: 'Entrar',
      kind: 'login',
    };
    if (!isVip) return {
      label: 'Assinar um plano VIP',
      hint: 'Libere escolhas mensais, votação, presente d20 e acompanhamento do pedido.',
      tab: null,
      ctaLabel: 'Ver planos VIP',
      kind: 'upsell',
    };
    if (editable && editing && !progress.complete) return {
      label: `Complete suas escolhas deste ciclo`,
      hint: progress.remaining > 0 ? `Faltam ${progress.remaining} item(ns) para fechar o mês.` : 'Ajuste miniaturas e bosses até bater o limite exato do seu plano.',
      tab: 'escolhas',
      ctaLabel: 'Ir para escolhas',
      kind: 'choices',
    };
    if (editable && editing && progress.complete) return {
      label: 'Salvar escolhas do ciclo',
      hint: 'Seu plano já está completo. Salve agora para garantir a produção deste mês.',
      tab: 'escolhas',
      ctaLabel: 'Salvar escolhas',
      kind: 'save',
    };
    if (editable && !editing) return {
      label: 'Acompanhar ou revisar seu pedido',
      hint: 'Suas escolhas já estão salvas. Você ainda pode revisar enquanto o ciclo estiver editável.',
      tab: 'pedido',
      ctaLabel: 'Ver pedido',
      kind: 'order',
    };
    if (String(orderStatus || '').toLowerCase() === 'enviado' && shippingTracking) return {
      label: 'Acompanhar entrega',
      hint: 'Seu código de rastreio já está disponível nesta área.',
      tab: 'pedido',
      ctaLabel: 'Ver rastreio',
      kind: 'tracking',
    };
    return {
      label: 'Acompanhar status do pedido',
      hint: 'Seu ciclo atual já foi fechado. Use esta área para acompanhar a próxima etapa.',
      tab: 'pedido',
      ctaLabel: 'Ver pedido',
      kind: 'order',
    };
  }, [user, isVip, editable, editing, progress, orderStatus, shippingTracking]);

  function canAdd(optionId) {
    const t = optionTypeById.get(optionId) || 'miniature';
    if (selectedCounts.total >= totalLimit) return false;
    if (t === 'boss') return selectedCounts.boss < bossLimit;
    return selectedCounts.mini < miniLimit;
  }


  React.useEffect(() => {
    if (!cacheKey) return;
    const cached = readVipCache(cacheKey, null);
    if (!cached || typeof cached !== 'object') return;
    if (cached.vipUntil) setVipUntil(cached.vipUntil);
    if (cached.vipPlan) setVipPlan(cached.vipPlan);
    if (cached.orderStatus) setOrderStatus(String(cached.orderStatus).toLowerCase());
    if (typeof cached.shippingTracking === 'string') setShippingTracking(cached.shippingTracking);
    if (Array.isArray(cached.savedSelected)) setSavedSelected(cached.savedSelected);
    if (Array.isArray(cached.selected)) setSelected(cached.selected);
    if (typeof cached.editing === 'boolean') setEditing(cached.editing);
    if (typeof cached.tab === 'string') setTab(cached.tab);
    if (Array.isArray(cached.options) && cached.options.length) setOptions(cached.options);
  }, [cacheKey]);

  React.useEffect(() => {
    if (!cacheKey || !user?.id) return;
    writeVipCache(cacheKey, {
      vipUntil,
      vipPlan,
      orderStatus,
      shippingTracking,
      savedSelected,
      selected,
      editing,
      tab,
      options: Array.isArray(options) ? options.slice(0, 24) : [],
      updatedAt: Date.now(),
    });
  }, [cacheKey, user?.id, vipUntil, vipPlan, orderStatus, shippingTracking, savedSelected, selected, editing, tab, options]);

  function showLimitNotice(kind, anchorEl) {
    // kind: 'total' | 'mini' | 'boss'
    if (limitTimerRef.current) {
      clearTimeout(limitTimerRef.current);
      limitTimerRef.current = null;
    }

    const planName = selectedPlan?.short_name || selectedPlan?.name || 'seu plano';
    const base = `Você já atingiu o limite do ${planName}.`;

    let title = 'Limite do plano atingido';
    let text = base;
    if (kind === 'mini') {
      text = `${base} Seu plano permite ${miniLimit} miniatura(s). Para escolher mais miniaturas, faça o upgrade.`;
    } else if (kind === 'boss') {
      text = `${base} Seu plano permite ${bossLimit} boss(es). Para escolher mais bosses, faça o upgrade.`;
    } else {
      text = `${base} Seu plano permite ${totalLimit} item(ns) por mês. Para escolher mais, faça o upgrade.`;
    }

    // Se não existir próximo plano, não promete upgrade — só informa o limite.
    if (!nextPlan) {
      text = `${base} Você já escolheu a quantidade máxima deste ciclo.`;
    }

    // Posiciona a notificação perto do botão/ação que disparou o limite.
    // (Experiência melhor no mobile: aparece onde o usuário está olhando.)
    let x = Math.round((window.innerWidth || 0) / 2);
    let y = Math.round((window.innerHeight || 0) * 0.75);
    try {
      if (anchorEl && typeof anchorEl.getBoundingClientRect === 'function') {
        const r = anchorEl.getBoundingClientRect();
        x = Math.round(r.left + r.width / 2);
        y = Math.round(r.top);
      }
      const pad = 16;
      const maxX = Math.max(pad, (window.innerWidth || 0) - pad);
      const maxY = Math.max(pad, (window.innerHeight || 0) - pad);
      x = Math.min(Math.max(x, pad), maxX);
      y = Math.min(Math.max(y, pad), maxY);
    } catch {}

    setLimitNotice({ title, text, x, y });
    limitTimerRef.current = setTimeout(() => setLimitNotice(null), 3800);
  }

  React.useEffect(() => {
    return () => {
      if (limitTimerRef.current) clearTimeout(limitTimerRef.current);
    };
  }, []);

  // Lazy-load por aba (evita travar o mobile)
  React.useEffect(() => {
    if (!user || !isVip) return;
    // sincroniza os painéis antigos com a navegação por abas
    setShowPoll(tab === 'votacao');
    setShowUpgrade(tab === 'upgrade');
    if (tab === 'escolhas' && !optionsLoading && (!options || options.length === 0)) {
      loadOptionsLite();
    }
    if (tab === 'votacao' && !pollLoading && !poll?.id) {
      loadPollAsync();
    }
  }, [tab, user, isVip]);

  function readCache(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.items)) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  function writeCache(key, items) {
    try {
      localStorage.setItem(key, JSON.stringify({ items, savedAt: Date.now() }));
    } catch {}
  }

  async function loadOptionsLite(seq = loadSeqRef.current) {
    if (!user) return;
    setOptionsLoading(true);
    const cacheKey = `vip_options_${cycle}`;
    const cached = readCache(cacheKey);
    if (cached?.items?.length) setOptions(cached.items);
    try {
      // Listagem leve: deixa o grid rápido; detalhes só no preview.
      const { data: opts } = await supabase
        .from("vip_mini_options")
        .select("id,title,image_url,sort_order,active,item_type")
        .eq("active", true)
        .order("sort_order", { ascending: true });
      const items = Array.isArray(opts) ? opts : [];
      if (seq !== loadSeqRef.current) return;
      setOptions(items);
      if (items.length) writeCache(cacheKey, items);
    } catch {
      // mantém cache (se houver)
    } finally {
      setOptionsLoading(false);
    }
  }

  async function loadPollAsync(seq = loadSeqRef.current) {
    if (!user) return;
    setPollLoading(true);
    try {
      let pollResp = await supabase
        .from('vip_theme_polls')
        .select('id,month_key,title,status,winner_option_id,closed_at')
        .order('month_key', { ascending: false })
        .limit(1)
        .maybeSingle();

      // compat: winner columns may not exist yet
      if (pollResp?.error && String(pollResp.error.message || '').match(/winner_option_id|closed_at|column/i)) {
        pollResp = await supabase
          .from('vip_theme_polls')
          .select('id,month_key,title,status')
          .order('month_key', { ascending: false })
          .limit(1)
          .maybeSingle();
      }

      const p = pollResp?.data;
      if (seq !== loadSeqRef.current) return;
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
    } finally {
      setPollLoading(false);
      setPollBootstrapped(true);
    }
  }

  async function openPreviewLite(opt) {
    if (!opt?.id) return;
    // Se já tem detalhes, abre direto
    if (opt.description || (Array.isArray(opt.gallery_images) && opt.gallery_images.length)) {
      setPreview(opt);
      return;
    }
    try {
      const { data } = await supabase
        .from('vip_mini_options')
        .select('id,title,description,image_url,gallery_images,sort_order,active,item_type')
        .eq('id', opt.id)
        .maybeSingle();
      const merged = { ...(opt || {}), ...(data || {}) };
      setOptions((prev) => (Array.isArray(prev) ? prev.map((x) => (String(x?.id) === String(opt.id) ? merged : x)) : prev));
      setPreview(merged);
    } catch {
      setPreview(opt);
    }
  }

  async function load() {
    if (!user) return;
    const seq = ++loadSeqRef.current;
    setLoading(true);
    setError("");
    setMsg("");
    try {
      // Planos em background (não trava a UI)
      (async () => {
        try {
          const plansResp = await fetch('/api/vip-plans');
          const plansJson = await plansResp.json().catch(() => ({}));
          if (plansResp.ok && Array.isArray(plansJson?.plans) && plansJson.plans.length) setVipPlans(plansJson.plans);
        } catch {}
      })();

      // Core (rápido): perfil + status + seleção salva
      const [{ data: prof }, { data: lastVipOrder }, { data: sel }] = await Promise.all([
        supabase.from("profiles").select("vip_until,vip_plan").eq("id", user.id).maybeSingle(),
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

      if (seq !== loadSeqRef.current) return;
      const until = prof?.vip_until || null;
      setVipUntil(until);
      setVipPlan(prof?.vip_plan || "");

      // Atualiza cache local para evitar "piscar" no refresh.
      try {
        if (until && new Date(String(until)) > new Date()) window.localStorage.setItem('vip_until_cache', String(until));
        else window.localStorage.removeItem('vip_until_cache');
      } catch {}
      // Mantém o que já estava na tela para evitar flicker no mobile durante refresh.

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

      // Carrega catálogo + votação em background
      setPollBootstrapped(false);
      loadOptionsLite(seq);
      loadPollAsync(seq);
    } catch (e) {
      setError(e?.message || "Não foi possível carregar a Área VIP.");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    if (!isOpen || authLoading || !user?.id) return;
    load();
  }, [isOpen, authLoading, user?.id, cycle]);

  React.useEffect(() => {
    if (!cacheKey || !editing) return;
    const draft = readVipCache(`${cacheKey}:draft`, null);
    if (!draft || !Array.isArray(draft.selected_option_ids)) return;
    if (savedSelected?.length) return;
    setSelected(draft.selected_option_ids);
  }, [cacheKey, editing, savedSelected]);

  React.useEffect(() => {
    if (!cacheKey) return;
    if (!editing || !Array.isArray(selected) || !selected.length) {
      clearVipCache(`${cacheKey}:draft`);
      return;
    }
    writeVipCache(`${cacheKey}:draft`, { selected_option_ids: selected, updatedAt: Date.now() });
  }, [cacheKey, editing, selected]);


  React.useEffect(() => {
    if (!isOpen || !user || !isVip || pollBootstrapped || pollLoading) return;
    loadPollAsync();
  }, [isOpen, user, isVip, pollBootstrapped, pollLoading]);

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
    if (String(poll?.status || '').toLowerCase() !== 'open') {
      setMsg('A votação já foi encerrada.');
      return;
    }
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
        onRequireLogin?.('Sessão expirada. Faça login novamente para continuar.');
        onClose?.();
        return;
      }
      const res = await fetch('/api/create-pix-payment?mode=vip_upgrade', {
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
        onRequireLogin?.('Sessão expirada. Faça login novamente para continuar.');
        onClose?.();
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
      clearVipCache(`${cacheKey}:draft`);
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

  function handlePrimaryAction() {
    if (!user) {
      onRequireLogin?.('Entre para acessar a Área VIP.');
      if (!asPage) onClose?.();
      return;
    }
    if (!isVip) {
      onGoVip?.();
      return;
    }
    if (nextAction.kind === 'save') {
      saveSelection();
      return;
    }
    if (nextAction.tab) setTab(nextAction.tab);
  }

  const body = (
      <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-slate-950 via-slate-950 to-black ring-1 ring-white/10 shadow-2xl shadow-black/30">
        <div className="absolute inset-0 opacity-35 pointer-events-none" style={{ backgroundImage: "radial-gradient(circle at 20% 10%, rgba(168,85,247,.35), transparent 45%), radial-gradient(circle at 80% 20%, rgba(34,197,94,.22), transparent 55%), radial-gradient(circle at 50% 90%, rgba(56,189,248,.18), transparent 55%)" }} />
        <div className="relative p-4 sm:p-7 pb-[calc(env(safe-area-inset-bottom,0px)+96px)] sm:pb-7">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Área VIP</p>
              <h2 className="mt-1 text-2xl sm:text-3xl font-extrabold">{vipPlan || "Clube VIP"}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs ring-1 ${st.cls}`}>
                  <span className="material-icons text-[16px]">flag</span>
                  Status: <b>{st.label}</b>
                </span>
                <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs ring-1 ring-white/15 bg-white/4 text-slate-200">
                  <span className="material-icons text-[16px]">calendar_month</span>
                  Ciclo: <b>{cycle}</b>
                </span>
                {isVip ? (
                  <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs ring-1 ring-violet-400/25 bg-violet-500/10 text-violet-100">
                    <span className="material-icons text-[16px]">stars</span>
                    VIP ativo • expira em <b>{new Date(vipUntil).toLocaleDateString("pt-BR")}</b>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs ring-1 ring-white/15 bg-white/4 text-slate-200">
                    <span className="material-icons text-[16px]">lock</span>
                    Não VIP
                  </span>
                )}
              </div>
            </div>
            {asPage ? (
              <div className="flex items-center gap-2">
                {onGoHome ? (
                  <button
                    type="button"
                    onClick={onGoHome}
                    className="rounded-xl px-3 py-2 text-xs font-semibold ring-1 ring-white/15 hover:bg-white/4 transition"
                    title="Voltar"
                  >
                    <span className="inline-flex items-center gap-2">
                      <span className="material-icons text-[16px]">arrow_back</span>
                      Voltar
                    </span>
                  </button>
                ) : null}
              </div>
            ) : (
              <button onClick={onClose} className="rounded-xl p-2 ring-1 ring-white/15 hover:bg-white/4" aria-label="Fechar">
                <span className="material-icons">close</span>
              </button>
            )}
          </div>

          {!user ? (
            authLoading ? (
              <div className="mt-6 rounded-2xl bg-white/4 ring-1 ring-white/10 p-4 text-slate-200">Carregando…</div>
            ) : (
              <div className="mt-6 rounded-2xl bg-white/4 ring-1 ring-white/10 p-5">
                <p className="text-slate-200">Entre para acessar a Área VIP.</p>
                <button
                  type="button"
                  onClick={() => onRequireLogin?.("Entre para acessar a Área VIP.")}
                  className="mt-4 rounded-xl px-4 py-3 font-extrabold bg-cyan-400 text-black ring-4 ring-cyan-400/20"
                >
                  Entrar
                </button>
              </div>
            )
          ) : loading ? (
            <div className="mt-6 rounded-2xl bg-white/4 ring-1 ring-white/10 p-4 text-slate-200">Carregando…</div>
          ) : error ? (
            <div className="mt-6 rounded-2xl bg-rose-500/10 ring-1 ring-rose-400/20 p-4 text-rose-100">{error}</div>
          ) : !isVip ? (
            <div className="mt-6 overflow-hidden rounded-[28px] bg-gradient-to-br from-violet-500/12 via-slate-950 to-cyan-500/10 ring-1 ring-violet-300/20 p-5 sm:p-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-2xl">
                  <div className="inline-flex items-center gap-2 rounded-full bg-violet-400/10 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.24em] text-violet-100 ring-1 ring-violet-300/20">
                    <span className="material-icons text-[16px]">workspace_premium</span>
                    Clube VIP
                  </div>
                  <h3 className="mt-4 text-2xl font-extrabold text-white">Seu próximo passo é entrar para o VIP</h3>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-slate-200/90">Assine para escolher miniaturas mensais, acompanhar produção, votar nos próximos temas e liberar seu presente d20 do mês em um painel exclusivo.</p>
                </div>
                <div className="lg:w-[320px] rounded-3xl bg-black/25 p-4 ring-1 ring-white/10">
                  <div className="text-xs font-extrabold uppercase tracking-[0.24em] text-slate-400">O que desbloqueia</div>
                  <div className="mt-4 space-y-3">
                    {[
                      ['deployed_code','Escolhas mensais','Selecione miniaturas e bosses do seu plano em um fluxo guiado.'],
                      ['local_shipping','Pedido acompanhado','Veja status do ciclo, produção e rastreio em um só lugar.'],
                      ['how_to_vote','Votação VIP','Ajude a definir o próximo tema do clube todo mês.'],
                      ['redeem','Presente d20','Faça sua rolagem mensal e receba prêmios e cupons.'],
                    ].map(([icon, title, desc]) => (
                      <div key={title} className="rounded-2xl bg-white/4 px-3 py-3 ring-1 ring-white/10">
                        <div className="flex items-start gap-3">
                          <span className="material-icons text-cyan-200">{icon}</span>
                          <div>
                            <div className="text-sm font-extrabold text-slate-100">{title}</div>
                            <div className="mt-1 text-xs leading-5 text-slate-400">{desc}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <button onClick={onGoVip} className="rounded-xl px-4 py-3 font-extrabold bg-cyan-400 text-black ring-4 ring-cyan-400/20 hover:bg-cyan-300">Ver planos VIP</button>
                <div className="rounded-xl px-4 py-3 text-sm text-slate-300 ring-1 ring-white/10 bg-white/4">Escolhas mensais, votação, presente e acompanhamento no mesmo painel.</div>
              </div>
            </div>
          ) : (
            <>

              {/* Tabs (mobile-first): select no mobile, pills no desktop */}
              <div className="mt-5 sticky top-3 z-20">
                <div className="rounded-2xl bg-black/35 backdrop-blur-md ring-1 ring-white/10 p-2">
                  <div className="sm:hidden rounded-2xl bg-gradient-to-br from-amber-400/10 via-violet-400/10 to-transparent ring-1 ring-white/10 px-3 py-3">
                    <label htmlFor="vip-tab-select" className="mb-2 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.24em] text-slate-400">
                      <span className="material-icons text-[16px] text-cyan-200">menu_open</span>
                      Navegação VIP
                    </label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 material-icons text-[18px] text-cyan-200">auto_awesome</span>
                      <select
                        id="vip-tab-select"
                        value={tab}
                        onChange={(e) => setTab(String(e.target.value || 'escolhas'))}
                        className="w-full appearance-none rounded-2xl border border-white/10 bg-slate-950/90 py-3 pl-11 pr-11 text-sm font-extrabold text-slate-100 outline-none ring-1 ring-white/10 transition focus:border-amber-300/40 focus:ring-amber-300/25"
                      >
                        {visibleTabs.map((t) => (
                          <option key={t.k} value={t.k}>{t.mobileLabel || t.label}</option>
                        ))}
                      </select>
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 material-icons text-[20px] text-slate-400">expand_more</span>
                    </div>
                  </div>

                  <div className="hidden sm:flex sticky top-0 z-20 -mx-1 gap-2 overflow-x-auto no-scrollbar bg-slate-950/85 px-1 py-2 backdrop-blur">
                    {visibleTabs.map((t) => {
                      const active = tab === t.k;
                      return (
                        <button
                          key={t.k}
                          type="button"
                          onClick={() => setTab(t.k)}
                          className={`shrink-0 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-extrabold ring-1 transition ${active ? 'bg-violet-400 text-black ring-violet-200/30' : 'bg-white/4 text-slate-200 ring-white/10 hover:bg-white/6'}`}
                        >
                          <span className="material-icons text-[16px]">{t.ic}</span>
                          {t.label}
                          <span className={`ml-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] ring-1 ${active ? 'bg-black/15 text-black ring-black/10' : t.tone}`}>
                            {t.badge}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-[24px] bg-white/4 ring-1 ring-white/10 p-3 sm:p-4">
                <div className="flex items-start gap-3 justify-between">
                  <div className="min-w-0">
                    <div className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Área VIP</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="inline-flex items-center rounded-full bg-white/4 px-3 py-1 text-xs font-semibold text-slate-200 ring-1 ring-white/10">Ciclo {cycle}</span>
                      <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ${st.cls}`}>{st.label}</span>
                      <span className="inline-flex items-center rounded-full bg-white/4 px-3 py-1 text-xs font-semibold text-slate-200 ring-1 ring-white/10">Plano {vipPlanLabel}</span>
                    </div>
                    {!editable && blockNotice ? (
                      <div className="mt-3 rounded-2xl bg-cyan-500/10 ring-1 ring-amber-400/25 px-4 py-3 text-sm text-amber-100">
                        <div className="font-extrabold">{blockNotice.title}</div>
                        <div className="mt-1 text-cyan-50/90">{blockNotice.text}</div>
                      </div>
                    ) : null}
                  </div>
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      onClick={() => setHelpOpen((v) => !v)}
                      aria-expanded={helpOpen}
                      aria-label="Como funciona esta aba"
                      className="grid h-11 w-11 place-items-center rounded-2xl bg-white/4 text-cyan-200 ring-1 ring-white/10 hover:bg-white/6"
                    >
                      <span className="material-icons">tips_and_updates</span>
                    </button>
                    {helpOpen ? (
                      <div className="absolute right-0 top-[calc(100%+12px)] z-30 w-[min(88vw,380px)] rounded-[20px] bg-gradient-to-br from-cyan-400/10 via-sky-300/5 to-slate-950/95 p-4 shadow-2xl backdrop-blur ring-1 ring-cyan-300/20">
                        <div className="text-xs font-extrabold uppercase tracking-[0.24em] text-slate-300">{help.title}</div>
                        <p className="mt-2 text-sm leading-6 text-slate-200/90">{help.body}</p>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 hidden gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.9fr)] md:grid">
                  <div className="rounded-[22px] bg-gradient-to-br from-violet-500/10 via-slate-950/50 to-cyan-500/10 p-4 ring-1 ring-white/10">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[11px] font-extrabold uppercase tracking-[0.24em] text-slate-400">Próxima ação</div>
                        <div className="mt-2 text-lg font-extrabold text-white">{nextAction.label}</div>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">{nextAction.hint}</p>
                      </div>
                      <button
                        type="button"
                        onClick={handlePrimaryAction}
                        className="rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-extrabold text-black ring-4 ring-cyan-400/15 transition hover:bg-cyan-300"
                      >
                        {nextAction.ctaLabel}
                      </button>
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-2xl bg-black/20 px-3 py-3 ring-1 ring-white/10">
                        <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Plano</div>
                        <div className="mt-1 text-sm font-extrabold text-slate-100">{vipPlanLabel}</div>
                      </div>
                      <div className="rounded-2xl bg-black/20 px-3 py-3 ring-1 ring-white/10">
                        <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Prazo</div>
                        <div className="mt-1 text-sm font-extrabold text-slate-100">{cycleDeadline}</div>
                      </div>
                      <div className="rounded-2xl bg-black/20 px-3 py-3 ring-1 ring-white/10">
                        <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Faltam</div>
                        <div className="mt-1 text-sm font-extrabold text-slate-100">{progress.remaining} item(ns)</div>
                      </div>
                      <div className="rounded-2xl bg-black/20 px-3 py-3 ring-1 ring-white/10">
                        <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Modo</div>
                        <div className="mt-1 text-sm font-extrabold text-slate-100">{editing ? 'Editando' : 'Salvo'}</div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[22px] bg-black/20 p-4 ring-1 ring-white/10">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[11px] font-extrabold uppercase tracking-[0.24em] text-slate-400">Progresso das escolhas</div>
                        <div className="mt-1 text-sm text-slate-300">Acompanhe miniaturas, bosses e o total do seu plano.</div>
                      </div>
                      <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-extrabold ring-1 ${progress.complete ? 'bg-emerald-500/15 text-emerald-100 ring-emerald-400/25' : 'bg-white/4 text-slate-200 ring-white/10'}`}>
                        {progress.complete ? 'Completo' : 'Em andamento'}
                      </span>
                    </div>
                    <div className="mt-4 space-y-3">
                      {[
                        ['Total', selectedCounts.total, totalLimit, progress.totalPct, progress.remaining ? `${progress.remaining} restante(s)` : 'Fechado'],
                        ['Miniaturas', selectedCounts.mini, miniLimit, progress.miniPct, progress.missingMini ? `${progress.missingMini} restante(s)` : 'Concluído'],
                        ...(bossLimit ? [['Bosses', selectedCounts.boss, bossLimit, progress.bossPct, progress.missingBoss ? `${progress.missingBoss} restante(s)` : 'Concluído']] : []),
                      ].map(([label, value, limit, pct, tail]) => (
                        <div key={label}>
                          <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                            <span className="font-semibold text-slate-200">{label}</span>
                            <span className="text-slate-400"><b className="text-slate-100">{value}</b>/{limit} • {tail}</span>
                          </div>
                          <div className="h-2.5 overflow-hidden rounded-full bg-white/8">
                            <div className="h-full rounded-full bg-cyan-300 transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

              </div>

              {/* Conteúdo por aba */}
              {tab === 'pedido' ? (
                <div className="mt-5 space-y-4">
                  <div className="rounded-2xl bg-white/4 ring-1 ring-white/10 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs uppercase tracking-wide text-slate-400">Status do seu pedido VIP</div>
                        <div className="mt-1 text-xl font-extrabold text-slate-100">{st.label}</div>
                        <div className="mt-2 text-sm text-slate-300">
                          {editable ? 'Você pode editar e salvar suas escolhas enquanto o status estiver em Editável.' : 'Seu pedido já avançou para a próxima etapa do ciclo.'}
                        </div>
                      </div>
                      <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs ring-1 ${st.cls}`}>
                        <span className="material-icons text-[16px]">flag</span>
                        <b>{st.label}</b>
                      </span>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-gradient-to-br from-cyan-500/10 via-slate-950/45 to-violet-500/10 ring-1 ring-white/10 p-5">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <div className="text-xs uppercase tracking-wide text-slate-400">Timeline do ciclo</div>
                        <div className="mt-1 text-sm text-slate-200">Veja em que etapa sua caixa VIP está agora.</div>
                      </div>
                      <span className="rounded-full bg-white/4 px-3 py-1 text-[11px] text-slate-200 ring-1 ring-white/10">
                        Ciclo {cycle}
                      </span>
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {orderTimelineSteps.map((step) => (
                        <div
                          key={step.key}
                          className={`rounded-2xl p-4 ring-1 transition ${
                            step.current
                              ? 'bg-cyan-400/12 ring-cyan-300/30'
                              : step.done
                              ? 'bg-emerald-500/10 ring-emerald-400/20'
                              : 'bg-black/20 ring-white/10'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-extrabold text-slate-100">{step.title}</div>
                              <div className="mt-1 text-xs leading-5 text-slate-400">{step.desc}</div>
                            </div>
                            <span
                              className={`material-icons text-[18px] ${
                                step.current ? 'text-cyan-200' : step.done ? 'text-emerald-200' : 'text-slate-500'
                              }`}
                            >
                              {step.current ? 'radio_button_checked' : step.done ? 'check_circle' : 'radio_button_unchecked'}
                            </span>
                          </div>
                          <div className="mt-3">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.18em] ring-1 ${
                                step.current
                                  ? 'bg-cyan-400/15 text-cyan-100 ring-cyan-300/30'
                                  : step.done
                                  ? 'bg-emerald-500/15 text-emerald-100 ring-emerald-300/30'
                                  : 'bg-white/4 text-slate-400 ring-white/10'
                              }`}
                            >
                              {step.current ? 'Etapa atual' : step.done ? 'Concluída' : 'Aguardando'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {shippingTracking ? (
                    <div className="rounded-2xl bg-cyan-500/10 ring-1 ring-cyan-400/20 p-5">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <p className="text-sm font-extrabold text-amber-100">Código de rastreio</p>
                        <a href={`https://rastreamento.correios.com.br/app/index.php?objetos=${encodeURIComponent(shippingTracking)}`} target="_blank" rel="noreferrer" className="rounded-lg px-3 py-2 text-xs font-extrabold bg-cyan-400 text-black hover:bg-amber-200">Rastrear</a>
                      </div>
                      <div className="mt-3 flex flex-col gap-2">
                        <code className="rounded-lg bg-black/30 px-3 py-3 text-xs text-cyan-50 ring-1 ring-amber-200/10 break-all">{shippingTracking}</code>
                        <button type="button" onClick={() => navigator.clipboard.writeText(String(shippingTracking || ''))} className="rounded-xl px-4 py-3 text-xs font-extrabold ring-1 ring-cyan-300/20 hover:bg-white/4">Copiar código</button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl bg-white/4 ring-1 ring-white/10 p-5 text-sm text-slate-300">
                      Quando seu pedido avançar para envio, o <b>código de rastreio</b> vai aparecer aqui.
                    </div>
                  )}
                </div>
              ) : null}

              {tab === 'presente' ? (
                <div className="mt-5">
                  <VipPresentD20 accessToken={accessToken} user={user} isVip={isVip} cycleKey={cycle} />
                </div>
              ) : null}

              {tab === 'upgrade' ? (
                <div className="mt-5 space-y-4">
                  <div className="rounded-2xl bg-white/4 ring-1 ring-white/10 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs uppercase tracking-wide text-slate-400">Upgrade de nível</div>
                        <div className="mt-1 text-xl font-extrabold text-slate-100">Mais escolhas por mês</div>
                        <div className="mt-2 text-sm text-slate-300">Faça upgrade para liberar mais miniaturas/bosses neste ciclo.</div>
                      </div>
                      <span className="material-icons text-violet-200">upgrade</span>
                    </div>
                    <div className="mt-4 grid gap-2">
                      <button
                        type="button"
                        disabled={!nextPlan || upgradeBusy}
                        onClick={() => { setUpgradePayOpen(true); }}
                        className={`w-full rounded-xl px-4 py-3 font-extrabold ring-1 ring-white/10 ${(!nextPlan || upgradeBusy) ? 'bg-slate-700/40 text-slate-300' : 'bg-violet-300 text-black hover:bg-violet-200'}`}
                      >
                        {nextPlan ? `Fazer upgrade para ${nextPlan?.short_name || nextPlan?.name}` : 'Upgrade indisponível'}
                        {nextPlan ? <span className="ml-2 text-xs font-semibold">({fmtBRLFromCents(upgradeDiffCents)})</span> : null}
                      </button>
                      {!nextPlan ? <div className="text-xs text-slate-400">Você já está no nível máximo.</div> : null}
                    </div>
                  </div>
                </div>
              ) : null}

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
                      <button onClick={() => setUpgradePayOpen(false)} className="rounded-xl p-2 ring-1 ring-white/15 hover:bg-white/4" aria-label="Fechar">
                        <span className="material-icons">close</span>
                      </button>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-2">
                      <button
                        disabled={upgradeBusy}
                        onClick={() => { setUpgradePayMethod('card'); setUpgradePayOpen(false); startUpgradeCard(); }}
                        className={`rounded-xl px-4 py-3 font-extrabold ring-4 transition ${upgradeBusy ? "bg-cyan-400/20 text-cyan-50 ring-cyan-200/15 cursor-wait" : "bg-cyan-400 text-black ring-cyan-400/20 hover:opacity-95"}`}
                      >
                        {upgradeBusy && upgradePayMethod === 'card' ? 'Aguarde…' : 'Pagar com cartão'}
                      </button>
                      <button
                        disabled={upgradeBusy}
                        onClick={() => { setUpgradePayMethod('pix'); setUpgradePayOpen(false); startUpgradePix(); }}
                        className={`rounded-xl px-4 py-3 font-semibold ring-1 transition ${upgradeBusy ? "bg-cyan-400/20 text-cyan-50 ring-cyan-200/15 cursor-wait" : "ring-white/15 hover:bg-white/4"}`}
                      >
                        {upgradeBusy && upgradePayMethod === 'pix' ? 'Aguarde…' : 'Pagar com Pix'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              {showUpgrade && upgrade?.order_id ? (
                <div className="mt-4 rounded-2xl bg-white/4 ring-1 ring-white/10 p-5">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <div className="text-sm font-extrabold text-slate-100">Pix do upgrade</div>
                      <div className="text-xs text-slate-400">Status: <b>{upgrade?.status || 'pendente'}</b></div>
                    </div>
                    {upgrade?.ticket_url ? (
                      <a className="text-sm font-semibold text-teal-200 hover:underline" href={upgrade.ticket_url} target="_blank" rel="noreferrer">Abrir no Mercado Pago</a>
                    ) : null}

              {showUpgrade && upgradeSuccess ? (
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
                        className="mt-3 w-full rounded-xl px-4 py-3 font-extrabold bg-cyan-400 text-black ring-4 ring-cyan-400/20"
                      >
                        Copiar código Pix
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              {showPoll && pollLoading ? (
                <div className="mt-4 rounded-2xl bg-white/4 ring-1 ring-white/10 p-5 text-slate-200">Carregando votação…</div>
              ) : null}

              {showPoll && poll?.id ? (
                <div className="mt-4 rounded-2xl bg-white/4 ring-1 ring-white/10 p-5">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-slate-400">Votação VIP</div>
                      <div className="mt-1 text-xl font-extrabold text-slate-100">Tema do próximo mês</div>
                      <div className="text-sm text-slate-300 mt-1">{poll?.title || `Votação ${poll?.month_key}`}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-slate-400">Ciclo: <b>{poll?.month_key}</b></div>
                      <div className="mt-1 text-xs">
                        {String(poll?.status || '').toLowerCase() === 'closed' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/20 px-2 py-1">
                            <span className="material-icons text-[14px]">verified</span>
                            Votação encerrada
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/15 text-violet-200 ring-1 ring-violet-400/20 px-2 py-1">
                            <span className="material-icons text-[14px]">how_to_vote</span>
                            Votação aberta
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {String(poll?.status || '').toLowerCase() === 'closed' ? (
                    (() => {
                      const wId = poll?.winner_option_id;
                      const w = (pollOptions || []).find((o) => String(o.id) === String(wId));
                      return (
                        <div className="mt-4 rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-400/20 p-4">
                          <div className="text-xs uppercase tracking-wide text-emerald-200/90">Resultado</div>
                          <div className="mt-1 text-lg font-extrabold text-emerald-100">
                            {w?.title ? `Vencedor: ${w.title}` : 'Votação encerrada (vencedor não divulgado)'}
                          </div>
                          <div className="mt-1 text-sm text-slate-200/80">Assim que o próximo ciclo abrir, você já vai ver as opções atualizadas.</div>
                        </div>
                      );
                    })()
                  ) : null}

                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {(pollOptions || []).map((o) => {
                      const votes = Number(voteCounts[String(o.id)] || 0);
                      const totalVotes = Object.values(voteCounts || {}).reduce((a, b) => a + (Number(b) || 0), 0);
                      const pct = totalVotes ? Math.round((votes / totalVotes) * 100) : 0;
                      const active = String(myVote) === String(o.id);
                      return (
                        <button
                          key={o.id}
                          disabled={voteBusy || String(poll?.status || '').toLowerCase() !== 'open'}
                          onClick={() => vote(o.id)}
                          className={`text-left rounded-2xl ring-1 p-4 transition hover:-translate-y-0.5 ${active ? 'bg-violet-500/15 ring-violet-400/30' : 'bg-black/25 ring-white/10 hover:bg-white/4'}`}
                        >
                          {o.image_url ? (
                            <div className="mb-3 overflow-hidden rounded-2xl bg-black/25 ring-1 ring-white/10">
                              <img
                                src={o.image_url}
                                alt={o.title}
                                className="h-48 w-full object-contain bg-black/20"
                                loading="lazy"
                              />
                            </div>
                          ) : null}
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="font-extrabold text-slate-100">{o.title}</div>
                              {o.description ? <div className="text-xs text-slate-300 mt-1 line-clamp-2">{o.description}</div> : null}
                            </div>
                            {active ? <span className="material-icons text-violet-200">check_circle</span> : <span className="material-icons text-slate-400">how_to_vote</span>}
                          </div>
                          <div className="mt-3">
                            <div className="h-2 rounded-full bg-white/6 overflow-hidden">
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

              {tab === 'escolhas' ? (
                <>
              <div className="mt-6 hidden rounded-2xl bg-white/4 ring-1 ring-white/10 p-4 md:block">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="text-sm text-slate-300">
                    Escolha <b>{totalLimit}</b> item(ns) do mês ({miniLimit} miniatura(s){bossLimit ? ` + ${bossLimit} boss(es)` : ""}) entre <b>{optionsLoading ? '…' : options.length}</b> opções.
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
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <div className="rounded-2xl bg-black/20 p-3 ring-1 ring-white/10">
                    <div className="flex items-center justify-between gap-2 text-xs"><span className="font-semibold text-slate-200">Total do plano</span><span className="text-slate-400"><b className="text-slate-100">{selectedCounts.total}</b>/{totalLimit}</span></div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/8"><div className="h-full bg-cyan-300 transition-all" style={{ width: `${progress.totalPct}%` }} /></div>
                  </div>
                  <div className="rounded-2xl bg-black/20 p-3 ring-1 ring-white/10">
                    <div className="flex items-center justify-between gap-2 text-xs"><span className="font-semibold text-slate-200">Miniaturas</span><span className="text-slate-400"><b className="text-slate-100">{selectedCounts.mini}</b>/{miniLimit}</span></div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/8"><div className="h-full bg-violet-300 transition-all" style={{ width: `${progress.miniPct}%` }} /></div>
                  </div>
                  {bossLimit ? (
                    <div className="rounded-2xl bg-black/20 p-3 ring-1 ring-white/10">
                      <div className="flex items-center justify-between gap-2 text-xs"><span className="font-semibold text-slate-200">Bosses</span><span className="text-slate-400"><b className="text-slate-100">{selectedCounts.boss}</b>/{bossLimit}</span></div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/8"><div className="h-full bg-amber-300 transition-all" style={{ width: `${progress.bossPct}%` }} /></div>
                    </div>
                  ) : null}
                </div>
              </div>

              {tab === 'escolhas' ? (
                <div className="md:hidden fixed right-3 top-1/2 z-20 -translate-y-1/2 rounded-2xl bg-slate-950/90 px-3 py-2 shadow-2xl backdrop-blur ring-1 ring-cyan-300/20">
                  <div className="space-y-1 text-[11px] font-bold leading-tight text-slate-200">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-400">Mini</span>
                      <span className="text-cyan-200">{selectedCounts.mini}/{miniLimit}</span>
                    </div>
                    {bossLimit ? (
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-400">Boss</span>
                        <span className="text-amber-200">{selectedCounts.boss}/{bossLimit}</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {/* Miniaturas escolhidas (fixo no topo, como antes) */}
              <div className="mt-4 rounded-2xl bg-white/4 ring-1 ring-white/10 p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-400">Minhas escolhas do mês</div>
                    <div className="mt-1 text-sm text-slate-200">
                      {editing ? 'Você está editando suas escolhas.' : ''}
                    </div>
                  </div>
                  <div className="text-xs text-slate-400">Ciclo: <b>{cycle}</b></div>
                </div>

                {selectedCards.length ? (
                  <>
                    <div className="mt-4 flex gap-3 overflow-x-auto pb-1 pr-1 sm:hidden no-scrollbar">
                      {selectedCards.map(({ id, opt }) => {
                        const isBoss = String(opt?.item_type || '').toLowerCase() === 'boss';
                        const borderCls = isBoss ? 'ring-amber-300/40 bg-amber-400/10' : 'ring-violet-300/35 bg-violet-400/10';
                        const badgeCls = isBoss ? 'bg-cyan-400/85 text-black' : 'bg-violet-300/85 text-black';
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => { if (opt) openPreviewLite(opt); }}
                            className={`shrink-0 w-[94px] rounded-[22px] ${borderCls} ring-1 p-2 text-left transition hover:-translate-y-0.5`}
                            title={opt?.title || 'Escolha'}
                          >
                            <div className="relative aspect-square overflow-hidden rounded-2xl bg-slate-950/85 p-2">
                              {opt?.image_url ? (
                                <img
                                  src={opt.image_url}
                                  alt={opt.title}
                                  className="h-full w-full object-contain"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="h-full w-full grid place-items-center text-slate-500 text-[10px]">Carregando…</div>
                              )}
                              <span className={`absolute left-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide ${badgeCls}`}>
                                {isBoss ? 'Boss' : 'Mini'}
                              </span>
                            </div>
                            <div className="mt-2 px-0.5">
                              <div className="line-clamp-2 min-h-[2.4rem] text-[11px] font-extrabold leading-5 text-slate-100">{opt?.title || '—'}</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-4 hidden sm:grid grid-cols-1 min-[420px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                      {selectedCards.map(({ id, opt }) => {
                        const isBoss = String(opt?.item_type || '').toLowerCase() === 'boss';
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => { if (opt) openPreviewLite(opt); }}
                            className={`text-left rounded-2xl transition overflow-hidden ${isBoss ? 'bg-amber-400/10 ring-1 ring-amber-300/25 hover:bg-cyan-400/15' : 'bg-black/25 ring-1 ring-violet-300/20 hover:bg-white/4'}`}
                            title={opt?.title || 'Escolha'}
                          >
                            <div className="aspect-square bg-[#07161d]/70 p-2">
                              {opt?.image_url ? (
                                <img
                                  src={opt.image_url}
                                  alt={opt.title}
                                  className="h-full w-full object-contain rounded-xl ring-1 ring-white/10"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="h-full w-full grid place-items-center text-slate-500 text-xs">Carregando…</div>
                              )}
                            </div>
                            <div className="p-2">
                              <div className="text-xs font-extrabold text-slate-100 truncate">{opt?.title || '—'}</div>
                              <div className="mt-1 text-[10px] text-slate-400">Toque para ver detalhes</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="mt-4 rounded-xl bg-black/20 ring-1 ring-white/10 p-4 text-sm text-slate-300">
                    Você ainda não escolheu nada neste ciclo.
                  </div>
                )}
              </div>

              {/* Notificação de limite: aparece perto da ação e some em poucos segundos */}
              {limitNotice ? (
                <div
                  className="fixed z-[9999] pointer-events-none"
                  style={{ left: `${limitNotice.x || 0}px`, top: `${limitNotice.y || 0}px` }}
                >
                  <div className="-translate-x-1/2 -translate-y-[115%] w-[min(360px,calc(100vw-32px))] rounded-2xl bg-gradient-to-br from-violet-500/25 to-fuchsia-500/15 ring-1 ring-violet-400/25 px-4 py-3 shadow-xl backdrop-blur">
                    <div className="flex items-start gap-2">
                      <span className="material-icons text-violet-200 text-[18px] mt-0.5">info</span>
                      <div className="min-w-0">
                        <p className="text-sm font-extrabold text-slate-100">{limitNotice.title}</p>
                        <p className="mt-0.5 text-xs text-slate-200/85 leading-relaxed">{limitNotice.text}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {optionsLoading && !options.length ? (
                <div className="mt-4 rounded-2xl bg-white/4 ring-1 ring-white/10 p-4 text-slate-200">Carregando catálogo VIP…</div>
              ) : null}

              <div className="mt-4 grid grid-cols-1 min-[420px]:grid-cols-2 sm:grid-cols-3 gap-3">
                {options.map((opt) => {
                  const isSel = displaySelected.includes(opt.id);
                  const kind = (String(opt?.item_type || 'miniature').toLowerCase() === 'boss') ? 'boss' : 'miniature';
                  // IMPORTANTE: não desabilitar o botão quando o limite for atingido.
                  // Se desabilitar, o usuário não consegue clicar e ver a mensagem de upgrade.
                  const addBlocked = editing && !isSel && !canAdd(opt.id);
                  return (
                    <div
                      key={opt.id}
                      className={`rounded-2xl overflow-hidden ring-1 transition relative ${isSel ? "bg-violet-500/15 ring-violet-300/40 shadow-[0_0_0_1px_rgba(167,139,250,0.25)]" : "bg-white/4 ring-white/10"}`}
                    >
                      {isSel ? (
                        <div className="absolute top-2 left-2 z-10 inline-flex items-center gap-1 rounded-full bg-violet-500/25 text-violet-50 ring-1 ring-violet-300/30 px-2 py-1 text-[10px] font-extrabold">
                          <span className="material-icons text-[14px]">check</span>
                          Selecionado
                        </div>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => openPreviewLite(opt)}
                        className="block w-full text-left"
                      >
                        <div className="aspect-square bg-[#07161d]/70 p-2">
                          {opt.image_url ? (
                            <img src={opt.image_url} alt={opt.title} className="h-full w-full object-contain rounded-xl ring-1 ring-white/10" loading="lazy" />
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
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] ring-1 ${kind === 'boss' ? 'bg-cyan-500/10 ring-amber-400/25 text-amber-100' : 'bg-emerald-500/10 ring-emerald-400/25 text-emerald-100'}`}>
                                {kind === 'boss' ? 'Boss' : 'Miniatura'}
                              </span>
                            </div>
                            {/* descrição/carrossel carregam no preview (sob demanda) */}
                          </div>
                          <button
                            type="button"
                            disabled={!editable || !editing || saving}
                            onClick={(e) => {
                              if (!editing) return;
                              const anchor = e?.currentTarget || null;
                              setSelected((prev) => {
                                const has = prev.includes(opt.id);
                                if (has) return prev.filter((x) => x !== opt.id);
                                // Se estiver bloqueado, mostramos o aviso e não alteramos o estado
                                if (addBlocked) {
                                  // Decide qual limite estourou (total/mini/boss) usando o estado atual
                                  let mini = 0;
                                  let boss = 0;
                                  for (const id of prev) {
                                    const t = optionTypeById.get(id) || 'miniature';
                                    if (t === 'boss') boss += 1;
                                    else mini += 1;
                                  }
                                  const total = mini + boss;
                                  const tNew = optionTypeById.get(opt.id) || 'miniature';
                                  if (total >= totalLimit) showLimitNotice('total', anchor);
                                  else if (tNew === 'boss' && boss >= bossLimit) showLimitNotice('boss', anchor);
                                  else if (tNew !== 'boss' && mini >= miniLimit) showLimitNotice('mini', anchor);
                                  else showLimitNotice('total', anchor);
                                  return prev;
                                }
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
                                if (total >= totalLimit) {
                                  showLimitNotice('total', anchor);
                                  return prev;
                                }
                                if (tNew === 'boss' && boss >= bossLimit) {
                                  showLimitNotice('boss', anchor);
                                  return prev;
                                }
                                if (tNew !== 'boss' && mini >= miniLimit) {
                                  showLimitNotice('mini', anchor);
                                  return prev;
                                }
                                return [...prev, opt.id];
                              });
                            }}
                            className={`shrink-0 rounded-lg p-1.5 ring-1 transition ${isSel ? "bg-violet-500/25 ring-violet-300/30 text-violet-50" : "bg-white/4 ring-white/10 text-slate-300"} ${(!editable || !editing || saving) ? "opacity-60 cursor-not-allowed" : addBlocked ? "hover:bg-rose-500/10 hover:ring-rose-400/30" : "hover:bg-white/6"}`}
                            aria-label={isSel ? 'Remover miniatura' : 'Selecionar miniatura'}
                          >
                            <span className="material-icons text-[18px]">{isSel ? "check_circle" : "add_circle"}</span>
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => openPreviewLite(opt)}
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
                      <button onClick={() => setPreview(null)} className="rounded-lg p-2 ring-1 ring-white/10 hover:bg-white/4">
                        <span className="material-icons text-[18px]">close</span>
                      </button>
                    </div>
                    <div className="p-4 space-y-3">
                      {preview.image_url ? (
                        <img src={preview.image_url} alt={preview.title} className="w-full aspect-square object-contain rounded-xl ring-1 ring-white/10 bg-black/25" />
                      ) : null}
                      {Array.isArray(preview.gallery_images) && preview.gallery_images.length ? (
                        <div className="grid grid-cols-3 gap-2">
                          {preview.gallery_images.map((url, idx) => (
                            <img key={idx} src={url} alt={`${preview.title} ${idx + 1}`} className="w-full aspect-square object-contain rounded-lg ring-1 ring-white/10 bg-black/25" />
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400">Sem imagens adicionais para esta miniatura.</div>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="sticky bottom-0 z-20 -mx-4 sm:-mx-7 mt-5 border-t border-white/10 bg-slate-950/90 px-4 sm:px-7 py-3 backdrop-blur supports-[backdrop-filter]:bg-slate-950/75">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="text-xs text-slate-300">
                    {editing ? (
                      <>Selecionadas: <b>{selectedCounts.total}</b>/{totalLimit}</>
                    ) : (
                      <>Suas escolhas deste ciclo já estão salvas.</>
                    )}
                  </div>
                  {editing ? (
                    <button
                      type="button"
                      disabled={!editable || saving || selectedCounts.mini !== miniLimit || selectedCounts.boss !== bossLimit || selectedCounts.total !== totalLimit}
                      onClick={saveSelection}
                      className={`min-w-[180px] rounded-xl px-4 py-3 font-extrabold ring-1 ring-white/10 ${(!editable || saving || selectedCounts.mini !== miniLimit || selectedCounts.boss !== bossLimit || selectedCounts.total !== totalLimit) ? "bg-slate-700/40 text-slate-300" : "bg-emerald-300 text-black hover:bg-emerald-200"}`}
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
                      className={`min-w-[180px] rounded-xl px-4 py-3 font-extrabold ring-1 ring-white/10 ${!editable ? "bg-slate-700/40 text-slate-300" : "bg-violet-300 text-black hover:bg-violet-200"}`}
                    >
                      Editar escolhas
                    </button>
                  )}
                </div>
              </div>
              {msg ? <div className="mt-3 text-sm text-slate-200">{msg}</div> : null}
                </>
              ) : null}
            </>
          )}
        </div>
      </div>
  );

  if (asPage) {
    return (
      <div className="container-cc px-3 sm:px-6 lg:px-8 py-6 sm:py-8">
        {body}
      </div>
    );
  }

  return (
    <Modal open={isOpen} onClose={onClose} maxWidth="max-w-4xl">
      {body}
    </Modal>
  );
}