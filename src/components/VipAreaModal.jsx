import React from "react";
import Modal from "./Modal.jsx";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../auth/AuthProvider.jsx";
import VipPresentD20 from "./VipPresentD20.jsx";

function cycleKeyUTC() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function cycleDeadlineLabel(cycleKey) {
  try {
    const [year, month] = String(cycleKey || '').split('-').map(Number);
    if (!year || !month) return 'fim do mês';
    const end = new Date(Date.UTC(year, month, 0, 23, 59, 59));
    return end.toLocaleDateString('pt-BR');
  } catch {
    return 'fim do mês';
  }
}

function vipBlockMessage(status) {
  const v = String(status || '').toLowerCase();
  if (v === 'em_producao') return { title: 'Aguardando produção', text: 'Suas escolhas deste ciclo já foram fechadas e estão em processo de produção.' };
  if (v === 'enviado') return { title: 'Pedido enviado', text: 'Seu pedido deste ciclo já foi enviado. As escolhas ficam bloqueadas até a abertura do próximo ciclo.' };
  if (v === 'entregue') return { title: 'Ciclo encerrado', text: 'Este ciclo já foi concluído. Aguarde a abertura do próximo para fazer novas escolhas.' };
  return null;
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

function tabHelpContent(tab, ctx = {}) {
  const total = Number(ctx?.totalLimit || 0) || 0;
  const editable = !!ctx?.editable;
  const planName = ctx?.planName || 'VIP';
  const deadline = ctx?.deadline || 'fim do mês';

  const map = {
    escolhas: {
      title: 'Como funciona — Escolhas',
      body: `Selecione exatamente ${total} item(ns) do seu plano ${planName}. Quando completar o limite, o botão para salvar aparece. Você pode alterar tudo enquanto o ciclo estiver editável. Prazo atual: ${deadline}.`,
    },
    pedido: {
      title: 'Como funciona — Pedido',
      body: editable
        ? 'Aqui você acompanha o status do seu ciclo VIP. Enquanto o pedido estiver editável, ainda dá para revisar escolhas. Quando avançar para produção ou envio, esta aba vira o painel de acompanhamento.'
        : 'Aqui você acompanha o status do seu ciclo VIP, produção e envio. Quando houver rastreio disponível, ele aparece nesta aba para consulta e cópia.',
    },
    votacao: {
      title: 'Como funciona — Votação',
      body: 'Nesta aba você vota no tema futuro do clube. Cada assinante VIP pode registrar um voto por ciclo aberto. Quando a votação encerrar, o resultado fica consolidado pelo sistema.',
    },
    upgrade: {
      title: 'Como funciona — Upgrade',
      body: 'Se quiser subir de nível, faça o upgrade aqui. O sistema mostra o próximo plano disponível e libera mais benefícios conforme a regra do clube.',
    },
    presente: {
      title: 'Como funciona — Presente',
      body: 'Você tem uma rolagem do d20 por ciclo mensal. O número define automaticamente o prêmio do mês. Se cair cupom, ele é salvo na sua conta. Se cair 20, você libera a miniatura personalizada exclusiva e pode solicitar o prêmio aqui mesmo.',
    },
  };
  return map[tab] || map.escolhas;
}
// Planos VIP vêm do Supabase (tabela vip_plans). Sem valores fixos no código.
const FALLBACK_VIP_PLANS = [];

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

function readVipCache(key, fallback = null) {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeVipCache(key, value) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function clearVipCache(key) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(key);
  } catch {}
}

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
            {asPage ? (
              <div className="flex items-center gap-2">
                {onGoHome ? (
                  <button
                    type="button"
                    onClick={onGoHome}
                    className="rounded-xl px-3 py-2 text-xs font-semibold ring-1 ring-white/15 hover:bg-white/5 transition"
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
              <button onClick={onClose} className="rounded-xl p-2 ring-1 ring-white/15 hover:bg-white/5" aria-label="Fechar">
                <span className="material-icons">close</span>
              </button>
            )}
          </div>

          {!user ? (
            authLoading ? (
              <div className="mt-6 rounded-2xl bg-white/5 ring-1 ring-white/10 p-4 text-slate-200">Carregando…</div>
            ) : (
              <div className="mt-6 rounded-2xl bg-white/5 ring-1 ring-white/10 p-5">
                <p className="text-slate-200">Entre para acessar a Área VIP.</p>
                <button
                  type="button"
                  onClick={() => onRequireLogin?.("Entre para acessar a Área VIP.")}
                  className="mt-4 rounded-xl px-4 py-3 font-extrabold bg-teal-400 text-black ring-4 ring-teal-400/20"
                >
                  Entrar
                </button>
              </div>
            )
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

              {/* Tabs (mobile-first): select no mobile, pills no desktop */}
              <div className="mt-5 sticky top-3 z-20">
                <div className="rounded-2xl bg-black/35 backdrop-blur-md ring-1 ring-white/10 p-2">
                  <div className="sm:hidden rounded-2xl bg-gradient-to-br from-amber-400/10 via-violet-400/10 to-transparent ring-1 ring-white/10 px-3 py-3">
                    <label htmlFor="vip-tab-select" className="mb-2 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.24em] text-slate-400">
                      <span className="material-icons text-[16px] text-amber-200">menu_open</span>
                      Navegação VIP
                    </label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 material-icons text-[18px] text-amber-200">auto_awesome</span>
                      <select
                        id="vip-tab-select"
                        value={tab}
                        onChange={(e) => setTab(String(e.target.value || 'escolhas'))}
                        className="w-full appearance-none rounded-2xl border border-white/10 bg-slate-950/90 py-3 pl-11 pr-11 text-sm font-extrabold text-slate-100 outline-none ring-1 ring-white/10 transition focus:border-amber-300/40 focus:ring-amber-300/25"
                      >
                        {[{k:'escolhas',label:'Escolhas'},{k:'pedido',label:'Pedido'},{k:'votacao',label:'Votação'},{k:'upgrade',label:'Upgrade'},{k:'presente',label:'Presente'}].map((t) => (
                          <option key={t.k} value={t.k}>{t.label}</option>
                        ))}
                      </select>
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 material-icons text-[20px] text-slate-400">expand_more</span>
                    </div>
                  </div>

                  <div className="hidden sm:flex sticky top-0 z-20 -mx-1 gap-2 overflow-x-auto no-scrollbar bg-slate-950/85 px-1 py-2 backdrop-blur">
                    {[{k:'escolhas',label:'Escolhas',ic:'checklist'},{k:'pedido',label:'Pedido',ic:'local_shipping'},{k:'votacao',label:'Votação',ic:'how_to_vote'},{k:'upgrade',label:'Upgrade',ic:'upgrade'},{k:'presente',label:'Presente',ic:'redeem'}].map((t) => {
                      const active = tab === t.k;
                      return (
                        <button
                          key={t.k}
                          type="button"
                          onClick={() => setTab(t.k)}
                          className={`shrink-0 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-extrabold ring-1 transition ${active ? 'bg-violet-400 text-black ring-violet-200/30' : 'bg-white/5 text-slate-200 ring-white/10 hover:bg-white/10'}`}
                        >
                          <span className="material-icons text-[16px]">{t.ic}</span>
                          {t.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-[24px] bg-white/5 ring-1 ring-white/10 p-3 sm:p-4">
                <div className="flex items-start gap-3 justify-between">
                  <div className="min-w-0">
                    <div className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Área VIP</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="inline-flex items-center rounded-full bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200 ring-1 ring-white/10">Ciclo {cycle}</span>
                      <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ${st.cls}`}>{st.label}</span>
                      <span className="inline-flex items-center rounded-full bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200 ring-1 ring-white/10">Plano {vipPlanLabel}</span>
                    </div>
                    {!editable && blockNotice ? (
                      <div className="mt-3 rounded-2xl bg-amber-500/10 ring-1 ring-amber-400/25 px-4 py-3 text-sm text-amber-100">
                        <div className="font-extrabold">{blockNotice.title}</div>
                        <div className="mt-1 text-amber-50/90">{blockNotice.text}</div>
                      </div>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => setHelpOpen((v) => !v)}
                    aria-expanded={helpOpen}
                    aria-label="Como funciona esta aba"
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/5 text-amber-200 ring-1 ring-white/10 hover:bg-white/10"
                  >
                    <span className="material-icons">tips_and_updates</span>
                  </button>
                </div>

                {helpOpen ? (
                  <div className="mt-3 rounded-[20px] bg-gradient-to-br from-amber-300/10 via-sky-300/5 to-transparent p-4 ring-1 ring-white/10">
                    <div className="text-xs font-extrabold uppercase tracking-[0.24em] text-slate-300">{help.title}</div>
                    <p className="mt-2 text-sm leading-6 text-slate-200/90">{help.body}</p>
                  </div>
                ) : null}
              </div>

              {/* Conteúdo por aba */}
              {tab === 'pedido' ? (
                <div className="mt-5 space-y-4">
                  <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs uppercase tracking-wide text-slate-400">Status do seu pedido VIP</div>
                        <div className="mt-1 text-xl font-extrabold text-slate-100">{st.label}</div>
                        <div className="mt-2 text-sm text-slate-300">
                          {editable ? 'Você pode editar e salvar suas escolhas enquanto o status estiver em Editável.' : 'Suas escolhas podem estar bloqueadas por causa do status atual.'}
                        </div>
                      </div>
                      <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs ring-1 ${st.cls}`}>
                        <span className="material-icons text-[16px]">flag</span>
                        <b>{st.label}</b>
                      </span>
                    </div>
                  </div>

                  {String(orderStatus || '').toLowerCase() === 'enviado' && shippingTracking ? (
                    <div className="rounded-2xl bg-amber-500/10 ring-1 ring-amber-400/20 p-5">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <p className="text-sm font-extrabold text-amber-100">Código de rastreio</p>
                        <a href={`https://rastreamento.correios.com.br/app/index.php?objetos=${encodeURIComponent(shippingTracking)}`} target="_blank" rel="noreferrer" className="rounded-lg px-3 py-2 text-xs font-extrabold bg-amber-300 text-black hover:bg-amber-200">Rastrear</a>
                      </div>
                      <div className="mt-3 flex flex-col gap-2">
                        <code className="rounded-lg bg-black/30 px-3 py-3 text-xs text-amber-50 ring-1 ring-amber-200/10 break-all">{shippingTracking}</code>
                        <button type="button" onClick={() => navigator.clipboard.writeText(String(shippingTracking || ''))} className="rounded-xl px-4 py-3 text-xs font-extrabold ring-1 ring-amber-300/20 hover:bg-white/5">Copiar código</button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-5 text-sm text-slate-300">
                      Quando seu pedido for enviado, o <b>código de rastreio</b> vai aparecer aqui.
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
                  <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-5">
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

              {showUpgrade && upgrade?.order_id ? (
                <div className="mt-4 rounded-2xl bg-white/5 ring-1 ring-white/10 p-5">
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
                        className="mt-3 w-full rounded-xl px-4 py-3 font-extrabold bg-teal-400 text-black ring-4 ring-teal-400/20"
                      >
                        Copiar código Pix
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              {showPoll && pollLoading ? (
                <div className="mt-4 rounded-2xl bg-white/5 ring-1 ring-white/10 p-5 text-slate-200">Carregando votação…</div>
              ) : null}

              {showPoll && poll?.id ? (
                <div className="mt-4 rounded-2xl bg-white/5 ring-1 ring-white/10 p-5">
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
                          className={`text-left rounded-2xl ring-1 p-4 transition hover:-translate-y-0.5 ${active ? 'bg-violet-500/15 ring-violet-400/30' : 'bg-black/25 ring-white/10 hover:bg-white/5'}`}
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

              {tab === 'escolhas' ? (
                <>
              <div className="mt-6 flex items-center justify-between gap-3 flex-wrap">
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

              {/* Miniaturas escolhidas (fixo no topo, como antes) */}
              <div className="mt-4 rounded-2xl bg-white/5 ring-1 ring-white/10 p-4">
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
                        const badgeCls = isBoss ? 'bg-amber-300/85 text-black' : 'bg-violet-300/85 text-black';
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
                            className={`text-left rounded-2xl transition overflow-hidden ${isBoss ? 'bg-amber-400/10 ring-1 ring-amber-300/25 hover:bg-amber-400/15' : 'bg-black/25 ring-1 ring-violet-300/20 hover:bg-white/5'}`}
                            title={opt?.title || 'Escolha'}
                          >
                            <div className="aspect-square bg-slate-900/70 p-2">
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
                <div className="mt-4 rounded-2xl bg-white/5 ring-1 ring-white/10 p-4 text-slate-200">Carregando catálogo VIP…</div>
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
                        onClick={() => openPreviewLite(opt)}
                        className="block w-full text-left"
                      >
                        <div className="aspect-square bg-slate-900/70 p-2">
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
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] ring-1 ${kind === 'boss' ? 'bg-amber-500/10 ring-amber-400/25 text-amber-100' : 'bg-emerald-500/10 ring-emerald-400/25 text-emerald-100'}`}>
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
                            className={`shrink-0 rounded-lg p-1.5 ring-1 transition ${isSel ? "bg-violet-500/25 ring-violet-300/30 text-violet-50" : "bg-white/5 ring-white/10 text-slate-300"} ${(!editable || !editing || saving) ? "opacity-60 cursor-not-allowed" : addBlocked ? "hover:bg-rose-500/10 hover:ring-rose-400/30" : "hover:bg-white/10"}`}
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
                      <button onClick={() => setPreview(null)} className="rounded-lg p-2 ring-1 ring-white/10 hover:bg-white/5">
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