import React from "react";
import Modal from "./Modal.jsx";
import { useAuth } from "../auth/AuthProvider.jsx";
import { supabase } from "../lib/supabaseClient";
import { fetchAddressFromCep, isValidCep, onlyDigits } from "../lib/cep.js";
import { useFavorites } from "../state/FavoritesProvider.jsx";

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs text-slate-400">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

const FALLBACK_VIP_PLANS = [
  { id: "CUBO_L1_RPG", slug: "level-1", name: "Cubo Level 1 — RPG", short_name: "Level 1", miniatures_count: 3, boss_count: 0, items_per_month: 3 },
  { id: "CUBO_L2_RPG", slug: "level-2", name: "Cubo Level 2 — RPG", short_name: "Level 2", miniatures_count: 4, boss_count: 1, items_per_month: 5 },
  { id: "CUBO_L3_RPG", slug: "level-3", name: "Cubo Level 3 — RPG", short_name: "Level 3", miniatures_count: 8, boss_count: 2, items_per_month: 10 },
];
function normVipText(v) { return String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim(); }
function findVipPlanForProfile(plans, profilePlan) {
  const q = normVipText(profilePlan); if (!q) return null;
  return (plans || []).find((p) => [p?.id,p?.slug,p?.name,p?.short_name,p?.title].map(normVipText).some((c)=> c && (c===q || q.includes(c) || c.includes(q)))) || null;
}

export default function ProfileSettingsModal({ open, onClose, required = false, onSaved, initialTab = "profile", onSignOut, onNavigate, onRequireLogin }) {
  const { user, session, resetPassword } = useAuth();

  React.useEffect(() => {
    if (open && !user) {
      onRequireLogin?.("Faça login para editar seus dados.");
      if (!required) onClose?.();
    }
  }, [open, user]);
  const jwt = session?.access_token || "";

  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [ok, setOk] = React.useState("");
  const [activeTab, setActiveTab] = React.useState(initialTab === "settings" ? "settings" : "profile");

  const [fullName, setFullName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [cpf, setCpf] = React.useState("");
  const [birthdate, setBirthdate] = React.useState("");
  const [vipUntil, setVipUntil] = React.useState("");
  const [vipPlan, setVipPlan] = React.useState("");

  const [vipOptions, setVipOptions] = React.useState([]);
  const [vipSelected, setVipSelected] = React.useState([]);
  const [vipCycleKey, setVipCycleKey] = React.useState("");
  const [vipBusy, setVipBusy] = React.useState(false);
  const [vipPlans, setVipPlans] = React.useState(FALLBACK_VIP_PLANS);

  const [street, setStreet] = React.useState("");
  const [number, setNumber] = React.useState("");
  const [addr2, setAddr2] = React.useState("");
  const [neighborhood, setNeighborhood] = React.useState("");
  const [city, setCity] = React.useState("");
  const [stateUF, setStateUF] = React.useState("");
  const [zip, setZip] = React.useState("");

  const [avatarPreview, setAvatarPreview] = React.useState("");
  const [avatarFileName, setAvatarFileName] = React.useState("");
  const [avatarFile, setAvatarFile] = React.useState(null);
  const [newPassword, setNewPassword] = React.useState("");
  const [newPassword2, setNewPassword2] = React.useState("");
  const [pwdBusy, setPwdBusy] = React.useState(false);
  const [settingsSection, setSettingsSection] = React.useState("security");

  // Favoritos
  const { favoriteIds, toggleFavorite, reload: reloadFavorites } = useFavorites();
  const [favProducts, setFavProducts] = React.useState([]);
  const [favBusy, setFavBusy] = React.useState(false);

  // Cupons
  const [myCoupons, setMyCoupons] = React.useState([]);
  const [couponBusy, setCouponBusy] = React.useState(false);

  // Avaliações (por pedido entregue)
  const [deliveredOrders, setDeliveredOrders] = React.useState([]);
  const [reviewsByOrder, setReviewsByOrder] = React.useState({});
  const [reviewModal, setReviewModal] = React.useState({ open: false, order: null, rating: 5, comment: "", busy: false });


  const [cepBusy, setCepBusy] = React.useState(false);
  const [cepHint, setCepHint] = React.useState("");

  function isValidCpf(raw) {
    const v = onlyDigits(raw);
    if (v.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(v)) return false;
    const calc = (base, factor) => {
      let sum = 0;
      for (let i = 0; i < base.length; i++) sum += Number(base[i]) * (factor - i);
      const mod = (sum * 10) % 11;
      return mod === 10 ? 0 : mod;
    };
    const d1 = calc(v.slice(0, 9), 10);
    const d2 = calc(v.slice(0, 10), 11);
    return d1 === Number(v[9]) && d2 === Number(v[10]);
  }

  React.useEffect(() => {
    if (!open) return;
    const t = initialTab === "settings" ? "settings" : "profile";
    setActiveTab(t);
    setSettingsSection(t === "settings" ? "security" : settingsSection);
  }, [open, initialTab]);

  React.useEffect(() => {
    if (!open || !user) return;
    setAvatarPreview(String(user?.user_metadata?.avatar_url || ""));
  }, [open, user]);

  const loadProfile = React.useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    setOk("");

    const resp = await fetch("/api/profile", {
      method: "GET",
      headers: { ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}) },
    });

    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      setError(json?.error || "Não foi possível carregar seus dados.");
      setLoading(false);
      return;
    }

    const data = json?.profile || {};
    setFullName(data?.full_name || "");
    setPhone(data?.phone || "");
    setCpf(data?.cpf || "");
    setBirthdate(data?.birthdate || "");
    setVipUntil(data?.vip_until || "");
    setVipPlan(data?.vip_plan || "");
    setStreet(data?.address_line1 || "");
    setNumber(data?.address_number || "");
    setAddr2(data?.address_line2 || "");
    setNeighborhood(data?.neighborhood || "");
    setCity(data?.city || "");
    setStateUF(data?.state || "");
    setZip(data?.zip || "");
    setLoading(false);
  }, [user, jwt]);

  const selectedVipPlanObj = React.useMemo(() => findVipPlanForProfile(vipPlans, vipPlan) || FALLBACK_VIP_PLANS[0], [vipPlans, vipPlan]);
  const vipSelectionLimit = React.useMemo(() => Math.max(0, Number(selectedVipPlanObj?.items_per_month ?? ((Number(selectedVipPlanObj?.miniatures_count)||0) + (Number(selectedVipPlanObj?.boss_count)||0) || 3)) || 0), [selectedVipPlanObj]);

  const isVip = React.useMemo(() => {
    if (!vipUntil) return false;
    const t = new Date(vipUntil).getTime();
    return Number.isFinite(t) && t > Date.now();
  }, [vipUntil]);

  function cycleKeyUTC(date = new Date()) {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }

  React.useEffect(() => {
    if (!open || !user) return;
    setVipCycleKey(cycleKeyUTC(new Date()));
  }, [open, user]);

  const loadVipData = React.useCallback(async () => {
    if (!open || !user || !isVip) return;
    try {
      setVipBusy(true);
      try {
        const resp = await fetch('/api/vip-plans');
        const json = await resp.json().catch(() => ({}));
        if (resp.ok && Array.isArray(json?.plans) && json.plans.length) setVipPlans(json.plans);
      } catch {}
      const { data: opts, error: oErr } = await supabase
        .from('vip_mini_options')
        .select('id,title,description,image_url,active')
        .eq('active', true)
        .order('sort_order', { ascending: true });
      if (oErr) throw oErr;
      setVipOptions(opts || []);

      const { data: sel, error: sErr } = await supabase
        .from('vip_mini_selections')
        .select('selected_option_ids')
        .eq('user_id', user.id)
        .eq('cycle_key', vipCycleKey || cycleKeyUTC(new Date()))
        .maybeSingle();
      if (sErr && sErr.code !== 'PGRST116') throw sErr;
      const ids = Array.isArray(sel?.selected_option_ids) ? sel.selected_option_ids : [];
      setVipSelected(ids);
    } catch (e) {
      console.error('loadVipData error', e);
    } finally {
      setVipBusy(false);
    }
  }, [open, user, isVip, vipCycleKey]);

  React.useEffect(() => { loadVipData(); }, [loadVipData]);

    const loadFavoritesProducts = React.useCallback(async () => {
    if (!open || !user) {
      setFavProducts([]);
      return;
    }
    const ids = Array.from(favoriteIds || new Set()).filter(Boolean);
    if (!ids.length) {
      setFavProducts([]);
      return;
    }
    setFavBusy(true);
    try {
      // Buscar no mesmo formato da tabela "products" (campos reais do Supabase)
      const { data, error } = await supabase
        .from('products')
        .select(
          'id,slug,name,description,price_cents,currency,stock,active,featured,promo,image_url,images,status,tags,default_variant,variants,original_price_cents,category,created_at'
        )
        .in('id', ids);

      if (error) throw error;

      // Mapear para o formato usado no front (compat com ProductCard / galeria)
      const mapped = (data || []).map((row) => {
        const toInt = (v) => {
          const n = Number(v);
          return Number.isFinite(n) ? Math.trunc(n) : 0;
        };
        const centsToBRL = (cents) =>
          typeof cents === 'number' && Number.isFinite(cents) ? Number((cents / 100).toFixed(2)) : 0;

        const variants = Array.isArray(row?.variants)
          ? row.variants
              .filter(Boolean)
              .map((v) => {
                const priceCents = toInt(v?.price_cents ?? 0);
                return {
                  label: String(v?.label ?? ''),
                  price: centsToBRL(priceCents),
                  priceCents,
                };
              })
              .filter((v) => v.label)
          : [];

        const imgs = Array.isArray(row?.images) ? row.images.filter(Boolean).map(String) : [];
        const main = row?.image_url ? String(row.image_url) : '';
        const allImgs = imgs.length ? imgs : (main ? [main] : []);
        const img = main || allImgs[0] || '';

        return {
          id: String(row?.id ?? ''),
          slug: row?.slug ? String(row.slug) : '',
          nome: row?.name ? String(row.name) : '',
          descricao: row?.description ? String(row.description) : '',
          img,
          imgs: allImgs,
          status: row?.status ? String(row.status) : 'catalogo',
          featured: !!row?.featured,
          promo: !!row?.promo,
          originalPrice: centsToBRL(toInt(row?.original_price_cents ?? 0)),
          preco: centsToBRL(toInt(row?.price_cents ?? 0)),
          originalPriceCents: toInt(row?.original_price_cents ?? 0),
          priceCents: toInt(row?.price_cents ?? 0),
          currency: row?.currency ? String(row.currency) : 'brl',
          stock:
            row?.stock === null || row?.stock === undefined
              ? null
              : (() => {
                  const n = Number(row.stock);
                  return Number.isFinite(n) ? Math.trunc(n) : null;
                })(),
          active: row?.active !== false,
          tags: Array.isArray(row?.tags) ? row.tags.filter(Boolean).map(String) : [],
          category: row?.category ? String(row.category) : '',
          defaultVariant: row?.default_variant ? String(row.default_variant) : '',
          variants,
        };
      }).filter((pp) => pp.id && pp.nome);

      // Mantém a ordem dos favoritos (mais recente primeiro)
      const map = new Map(mapped.map((pp) => [String(pp.id), pp]));
      setFavProducts(ids.map((id) => map.get(String(id))).filter(Boolean));
    } catch (e) {
      console.warn('load favorites products failed', e);
      setFavProducts([]);
    } finally {
      setFavBusy(false);
    }
  }, [open, user, favoriteIds]);

  const loadMyCoupons = React.useCallback(async () => {
    if (!open || !user) {
      setMyCoupons([]);
      return;
    }
    setCouponBusy(true);
    try {
      const resp = await fetch('/api/coupons?action=my-coupons', {
        method: 'GET',
        headers: { ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}) },
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(json?.error || 'Não foi possível carregar seus cupons.');
      setMyCoupons(Array.isArray(json?.coupons) ? json.coupons : []);
    } catch (e) {
      console.warn('load coupons failed', e);
      setMyCoupons([]);
    } finally {
      setCouponBusy(false);
    }
  }, [open, user, jwt]);

  const loadDeliveredOrdersForReviews = React.useCallback(async () => {
    if (!open || !user) {
      setDeliveredOrders([]);
      setReviewsByOrder({});
      return;
    }
    try {
      // pedidos do usuário + itens
      const { data: orders, error: oErr } = await supabase
        .from('orders')
        .select('id,created_at,status,production_status,total,tracking_code,tracking_url')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(60);
      if (oErr) throw oErr;
      const delivered = (orders || []).filter((o) => String(o?.production_status || '').toLowerCase() === 'entregue');

      const orderIds = delivered.map((o) => o.id);
      let itemsByOrder = new Map();
      if (orderIds.length) {
        const { data: items, error: iErr } = await supabase
          .from('order_items')
          .select('order_id,product_id,product_name,product_image_url,img,name,qty,unit_price')
          .in('order_id', orderIds);
        if (iErr) throw iErr;
        itemsByOrder = new Map();
        (items || []).forEach((it) => {
          const k = String(it.order_id);
          const arr = itemsByOrder.get(k) || [];
          arr.push(it);
          itemsByOrder.set(k, arr);
        });
      }

      const withItems = delivered.map((o) => ({ ...o, order_items: itemsByOrder.get(String(o.id)) || [] }));
      setDeliveredOrders(withItems);

      // reviews existentes
      const { data: revs, error: rErr } = await supabase
        .from('customer_reviews')
        .select('order_id,rating,comment,display_name,created_at')
        .eq('user_id', user.id);
      if (rErr && rErr.code !== '42P01') throw rErr; // tabela pode não existir
      const map = {};
      (revs || []).forEach((r) => {
        map[String(r.order_id)] = r;
      });
      setReviewsByOrder(map);
    } catch (e) {
      console.warn('load reviews data failed', e);
      setDeliveredOrders([]);
      setReviewsByOrder({});
    }
  }, [open, user]);

  React.useEffect(() => {
    if (!open || activeTab !== 'settings') return;
    if (settingsSection === 'favorites') loadFavoritesProducts();
    if (settingsSection === 'coupons') loadMyCoupons();
    if (settingsSection === 'reviews') loadDeliveredOrdersForReviews();
  }, [open, activeTab, settingsSection, loadFavoritesProducts, loadMyCoupons, loadDeliveredOrdersForReviews]);

  async function saveVipSelection() {
    if (!user || !isVip) return;
    setError('');
    setOk('');
    if (vipSelected.length !== vipSelectionLimit) {
      setError(`Escolha exatamente ${vipSelectionLimit} item(ns) para o mês no seu plano.`);
      return;
    }
    try {
      setVipBusy(true);
      try {
        const resp = await fetch('/api/vip-plans');
        const json = await resp.json().catch(() => ({}));
        if (resp.ok && Array.isArray(json?.plans) && json.plans.length) setVipPlans(json.plans);
      } catch {}
      const payload = {
        user_id: user.id,
        cycle_key: vipCycleKey || cycleKeyUTC(new Date()),
        selected_option_ids: vipSelected,
      };
      const { error: upErr } = await supabase
        .from('vip_mini_selections')
        .upsert(payload, { onConflict: 'user_id,cycle_key' });
      if (upErr) throw upErr;
      setOk('Escolhas VIP salvas ✅');
    } catch (e) {
      setError(e?.message || 'Não foi possível salvar suas escolhas VIP.');
    } finally {
      setVipBusy(false);
    }
  }

  React.useEffect(() => {
    if (!open || !user) return;
    loadProfile();
  }, [open, user, loadProfile]);

  React.useEffect(() => {
    const d = onlyDigits(zip);
    if (d.length !== 8) {
      setCepHint("");
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      setCepBusy(true);
      const resp = await fetchAddressFromCep(d);
      if (cancelled) return;
      setCepBusy(false);
      if (!resp.ok) {
        setCepHint(resp.error || "Não foi possível consultar o CEP");
        return;
      }
      const a = resp.data;
      setCepHint("Endereço encontrado ✓");
      if (!street.trim() && a.street) setStreet(a.street);
      if (!neighborhood.trim() && a.neighborhood) setNeighborhood(a.neighborhood);
      if (!city.trim() && a.city) setCity(a.city);
      if (!stateUF.trim() && a.uf) setStateUF(a.uf);
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zip]);

  function handleAvatarFile(e) {
    setError("");
    const file = e?.target?.files?.[0];
    if (!file) return;
    if (!String(file.type || "").startsWith("image/")) {
      setError("Selecione uma imagem válida para a foto de perfil.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      setAvatarPreview(dataUrl);
      setAvatarFileName(file.name || "foto");
      setAvatarFile(file)
    };
    reader.readAsDataURL(file);
  }


  async function uploadAvatarIfNeeded() {
    if (!user || !avatarFile) return String(avatarPreview || user?.user_metadata?.avatar_url || '');
    const ext = (avatarFile.name || 'jpg').split('.').pop() || 'jpg';
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('avatars').upload(path, avatarFile, { upsert: true, cacheControl: '3600' });
    if (upErr) throw upErr;
    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    const publicUrl = String(data?.publicUrl || '');
    if (publicUrl) {
      const { error: metaErr } = await supabase.auth.updateUser({ data: { avatar_url: publicUrl } });
      if (metaErr) throw metaErr;
      setAvatarPreview(publicUrl);
      setAvatarFile(null);
    }
    return publicUrl;
  }

  async function savePassword() {
    setError("");
    setOk("");
    if (!newPassword || newPassword.length < 6) return setError("A nova senha deve ter pelo menos 6 caracteres.");
    if (newPassword !== newPassword2) return setError("As senhas não coincidem.");
    try {
      setPwdBusy(true);
      const { error: updErr } = await supabase.auth.updateUser({ password: newPassword });
      if (updErr) throw updErr;
      setNewPassword("");
      setNewPassword2("");
      setOk("Senha atualizada com sucesso ✅");
    } catch (e) {
      try {
        await resetPassword({ email: String(user?.email || "") });
        setOk("Enviamos um link para redefinir sua senha no e-mail ✅");
      } catch (e2) {
        setError(e2?.message || e?.message || "Não foi possível alterar a senha.");
      }
    } finally {
      setPwdBusy(false);
    }
  }

  async function submitReview() {
    if (!user || !reviewModal?.order?.id) return;
    setError('');
    setOk('');
    const rating = Math.max(1, Math.min(5, Number(reviewModal.rating) || 5));
    const comment = String(reviewModal.comment || '').trim();
    if (comment.length < 8) {
      setError('Escreva um comentário com pelo menos 8 caracteres.');
      return;
    }
    setReviewModal((p) => ({ ...p, busy: true }));
    try {
      const order = reviewModal.order;
      const productNames = Array.isArray(order?.order_items)
        ? order.order_items.map((it) => String(it?.product_name || it?.name || '').trim()).filter(Boolean)
        : [];
      const payload = {
        order_id: order.id,
        user_id: user.id,
        rating,
        comment,
        display_name: fullName?.trim() || String(user.email || '').split('@')[0],
        city: city?.trim() || null,
        state: stateUF?.trim() || null,
        approved: true,
        order_total: order.total ?? null,
        product_names: productNames.length ? productNames : null,
      };

      const { data, error: upErr } = await supabase
        .from('customer_reviews')
        .upsert(payload, { onConflict: 'order_id' })
        .select('order_id,rating,comment,display_name,created_at')
        .maybeSingle();
      if (upErr) throw upErr;
      setReviewsByOrder((prev) => ({ ...prev, [String(order.id)]: data || payload }));
      setOk('Avaliação salva ✅');
      setReviewModal({ open: false, order: null, rating: 5, comment: '', busy: false });
    } catch (e) {
      const msg = String(e?.message || e || 'Não foi possível salvar sua avaliação.');
      setError(msg.includes('customer_reviews') ? 'Ative a tabela de avaliações no Supabase (SUPABASE_REVIEWS.sql).' : msg);
    } finally {
      setReviewModal((p) => ({ ...p, busy: false }));
    }
  }

  async function save() {
    if (!user) return;
    setError("");
    setOk("");
    setSaving(true);
    const fail = (msg) => { setError(msg); setSaving(false); };

    if (!fullName.trim()) return fail("Informe seu nome.");
    if (!phone.trim()) return fail("Informe seu telefone.");
    if (cpf.trim() && !isValidCpf(cpf)) return fail("CPF inválido. Digite apenas números (11 dígitos).");
    if (!isValidCep(zip)) return fail("Informe um CEP válido.");
    if (!city.trim()) return fail("Informe sua cidade.");
    if (!stateUF.trim() || stateUF.trim().length !== 2) return fail("Informe a UF (2 letras).");
    if (!neighborhood.trim()) return fail("Informe o bairro.");
    if (!street.trim()) return fail("Informe a rua.");
    if (!number.trim()) return fail("Informe o número.");

    let avatarUrl = '';
    try { avatarUrl = await uploadAvatarIfNeeded(); } catch (e) { return fail(`Não foi possível salvar a foto de perfil: ${e?.message || e}`); }

    const payload = {
      id: user.id,
      full_name: fullName.trim(),
      phone: phone.trim(),
      cpf: onlyDigits(cpf),
      birthdate,
      address_line1: street.trim(),
      address_number: number.trim(),
      address_line2: addr2.trim(),
      neighborhood: neighborhood.trim(),
      city: city.trim(),
      state: stateUF.trim().toUpperCase(),
      zip: onlyDigits(zip),
      avatar_url: avatarUrl || undefined,
    };
    Object.keys(payload).forEach((k) => { if (payload[k] === "") delete payload[k]; });
    payload.id = user.id;

    const resp = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}) },
      body: JSON.stringify({ profile: payload }),
    });

    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      setError(json?.error || "Não foi possível salvar.");
      setSaving(false);
      return;
    }

    setOk("Dados salvos com sucesso ✅");
    try {
      window.dispatchEvent(new CustomEvent('profile:saved'));
    } catch {}
    try { onSaved?.(); } catch {}
    setTimeout(() => { try { onClose?.(); } catch {} }, 200);
    setSaving(false);
  }

  function goSettingsRoute(path) {
    try { onClose?.(); } catch {}
    try { onNavigate?.(path); } catch {}
  }

  return (
    <>
    <Modal open={open} onClose={onClose} title={activeTab === "settings" ? "Configurações" : "Perfil"}>
      <div className="w-full max-w-3xl">
        {!user ? (
          <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4 text-slate-200">
            <div className="font-semibold">Entre para continuar</div>
            <div className="text-sm text-slate-300 mt-1">Você precisa estar logado para editar seus dados.</div>
            <button type="button" onClick={() => onRequireLogin?.("Faça login para editar seus dados.")} className="mt-3 rounded-xl bg-emerald-500 text-black font-semibold px-4 py-2">Entrar / Criar conta</button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl bg-gradient-to-br from-indigo-500/15 via-fuchsia-500/10 to-teal-400/10 ring-1 ring-white/10 p-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="h-20 w-20 rounded-2xl ring-2 ring-white/15 bg-slate-800 overflow-hidden grid place-items-center">
                  {avatarPreview ? <img src={avatarPreview} alt="Foto de perfil" className="h-full w-full object-cover" /> : <span className="material-icons text-4xl text-slate-300">account_circle</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs uppercase tracking-wide text-slate-300/80">Minha conta</p>
                  <p className="text-lg font-bold text-white truncate">{fullName || user.email || "Cliente Cubo"}</p>
                  <p className="text-sm text-slate-300 break-all">{user.email}</p>
                  {avatarFileName ? <p className="text-xs text-slate-400 mt-1">Foto selecionada: {avatarFileName}</p> : null}
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:w-fit">
                <button type="button" onClick={() => setActiveTab("profile")} className={`rounded-xl px-4 py-2 text-sm font-semibold ring-1 transition ${activeTab === "profile" ? "bg-white/15 ring-white/20" : "bg-black/20 ring-white/10 hover:bg-white/5"}`}>Perfil</button>
                <button type="button" onClick={() => setActiveTab("settings")} className={`rounded-xl px-4 py-2 text-sm font-semibold ring-1 transition ${activeTab === "settings" ? "bg-white/15 ring-white/20" : "bg-black/20 ring-white/10 hover:bg-white/5"}`}>Configurações</button>
              </div>
            </div>

            {activeTab === "profile" ? (
              <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-100">Perfil</p>
                    <p className="mt-1 text-xs text-slate-400">Atualize seus dados de cadastro, entrega e foto de perfil.</p>
                  </div>
                  <label className="inline-flex items-center gap-2 rounded-xl px-3 py-2 bg-white/10 ring-1 ring-white/10 hover:bg-white/15 cursor-pointer text-sm">
                    <span className="material-icons text-base">photo_camera</span>
                    <span>Alterar foto</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleAvatarFile} />
                  </label>
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Nome completo"><input value={fullName} onChange={(e)=>setFullName(e.target.value)} type="text" autoComplete="name" className="w-full rounded-xl bg-slate-800/60 ring-1 ring-white/10 px-4 py-3 outline-none focus:ring-teal-400/60" placeholder="Seu nome" /></Field>
                  <Field label="Telefone (WhatsApp)"><input value={phone} onChange={(e)=>setPhone(e.target.value)} type="tel" autoComplete="tel" className="w-full rounded-xl bg-slate-800/60 ring-1 ring-white/10 px-4 py-3 outline-none focus:ring-teal-400/60" placeholder="(11) 99999-9999" /></Field>
                  <Field label="CPF (obrigatório para comprar)"><input value={cpf} onChange={(e)=>setCpf(e.target.value)} type="text" inputMode="numeric" autoComplete="off" className="w-full rounded-xl bg-slate-800/60 ring-1 ring-white/10 px-4 py-3 outline-none focus:ring-teal-400/60" placeholder="000.000.000-00" /></Field>
                  <Field label="Data de nascimento (obrigatório para comprar)"><input value={birthdate} onChange={(e)=>setBirthdate(e.target.value)} type="date" autoComplete="bday" className="w-full rounded-xl bg-slate-800/60 ring-1 ring-white/10 px-4 py-3 outline-none focus:ring-teal-400/60" /></Field>
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="CEP">
                    <input value={zip} onChange={(e)=>setZip(e.target.value)} type="text" autoComplete="postal-code" className="w-full rounded-xl bg-slate-800/60 ring-1 ring-white/10 px-4 py-3 outline-none focus:ring-teal-400/60" placeholder="00000-000" />
                    <div className="mt-1 text-[11px] text-slate-400">{cepBusy ? "Consultando CEP…" : cepHint || ""}</div>
                  </Field>
                  <Field label="UF"><input value={stateUF} onChange={(e)=>setStateUF(e.target.value.toUpperCase())} type="text" autoComplete="address-level1" maxLength={2} className="w-full rounded-xl bg-slate-800/60 ring-1 ring-white/10 px-4 py-3 outline-none focus:ring-teal-400/60" placeholder="SP" /></Field>
                </div>

                <div className="mt-3"><Field label="Cidade"><input value={city} onChange={(e)=>setCity(e.target.value)} type="text" autoComplete="address-level2" className="w-full rounded-xl bg-slate-800/60 ring-1 ring-white/10 px-4 py-3 outline-none focus:ring-teal-400/60" placeholder="Cidade" /></Field></div>
                <div className="mt-3"><Field label="Bairro"><input value={neighborhood} onChange={(e)=>setNeighborhood(e.target.value)} type="text" autoComplete="address-level3" className="w-full rounded-xl bg-slate-800/60 ring-1 ring-white/10 px-4 py-3 outline-none focus:ring-teal-400/60" placeholder="Bairro" /></Field></div>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2"><Field label="Rua"><input value={street} onChange={(e)=>setStreet(e.target.value)} type="text" autoComplete="address-line1" className="w-full rounded-xl bg-slate-800/60 ring-1 ring-white/10 px-4 py-3 outline-none focus:ring-teal-400/60" placeholder="Rua Exemplo" /></Field></div>
                  <Field label="Número"><input value={number} onChange={(e)=>setNumber(e.target.value)} type="text" inputMode="numeric" autoComplete="address-line2" className="w-full rounded-xl bg-slate-800/60 ring-1 ring-white/10 px-4 py-3 outline-none focus:ring-teal-400/60" placeholder="123" /></Field>
                </div>
                <div className="mt-3"><Field label="Complemento (opcional)"><input value={addr2} onChange={(e)=>setAddr2(e.target.value)} type="text" autoComplete="address-line2" className="w-full rounded-xl bg-slate-800/60 ring-1 ring-white/10 px-4 py-3 outline-none focus:ring-teal-400/60" placeholder="Apartamento, bloco, etc" /></Field></div>




              </div>
            ) : (
              <>
                {/* Navegação das configurações */}
                <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button type="button" onClick={() => setSettingsSection('security')} className={`rounded-xl px-3 py-2 text-sm font-semibold ring-1 transition ${settingsSection === 'security' ? 'bg-indigo-400 text-black ring-indigo-300' : 'ring-white/10 hover:bg-white/5'}`}>Segurança</button>
                    <button type="button" onClick={() => setSettingsSection('favorites')} className={`rounded-xl px-3 py-2 text-sm font-semibold ring-1 transition ${settingsSection === 'favorites' ? 'bg-indigo-400 text-black ring-indigo-300' : 'ring-white/10 hover:bg-white/5'}`}>Favoritos</button>
                    <button type="button" onClick={() => setSettingsSection('reviews')} className={`rounded-xl px-3 py-2 text-sm font-semibold ring-1 transition ${settingsSection === 'reviews' ? 'bg-indigo-400 text-black ring-indigo-300' : 'ring-white/10 hover:bg-white/5'}`}>Avaliações</button>
                    <button type="button" onClick={() => setSettingsSection('coupons')} className={`rounded-xl px-3 py-2 text-sm font-semibold ring-1 transition ${settingsSection === 'coupons' ? 'bg-indigo-400 text-black ring-indigo-300' : 'ring-white/10 hover:bg-white/5'}`}>Cupons</button>
                  </div>
                </div>

                {/* Conteúdo */}
                {settingsSection === 'security' && (
                  <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4">
                    <p className="text-sm font-semibold text-slate-100">Segurança da conta</p>
                    <p className="mt-1 text-xs text-slate-400">Troque sua senha com segurança. Se preferir, envie um link de recuperação por e-mail.</p>
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Field label="Nova senha"><input value={newPassword} onChange={(e)=>setNewPassword(e.target.value)} type="password" className="w-full rounded-xl bg-slate-800/60 ring-1 ring-white/10 px-4 py-3 outline-none focus:ring-teal-400/60" placeholder="Mínimo 6 caracteres" /></Field>
                      <Field label="Confirmar nova senha"><input value={newPassword2} onChange={(e)=>setNewPassword2(e.target.value)} type="password" className="w-full rounded-xl bg-slate-800/60 ring-1 ring-white/10 px-4 py-3 outline-none focus:ring-teal-400/60" placeholder="Repita a senha" /></Field>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button onClick={savePassword} disabled={pwdBusy} className={`rounded-xl px-4 py-2 font-semibold ring-1 ring-white/10 ${pwdBusy ? "bg-slate-700/50 text-slate-300" : "bg-indigo-400 hover:bg-indigo-300 text-black"}`}>{pwdBusy ? "Atualizando…" : "Trocar senha"}</button>
                      <button onClick={async()=>{ try { setError(""); setOk(""); await resetPassword({ email: String(user.email || "") }); setOk("Enviamos um link de recuperação para seu e-mail ✅"); } catch (e) { setError(e?.message || "Não foi possível enviar o link."); } }} className="rounded-xl px-4 py-2 ring-1 ring-white/10 hover:bg-white/5">Enviar link por e-mail</button>
                    </div>
                  </div>
                )}

                {settingsSection === 'favorites' && (
                  <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-100">Favoritos</p>
                        <p className="mt-1 text-xs text-slate-400">Salve seus produtos preferidos para encontrar rápido depois.</p>
                      </div>
                      <button onClick={() => { reloadFavorites(); loadFavoritesProducts(); }} className="rounded-xl px-3 py-2 text-sm ring-1 ring-white/10 hover:bg-white/5">Atualizar</button>
                    </div>

                    <div className="mt-4">
                      {favBusy ? (
                        <p className="text-sm text-slate-300">Carregando…</p>
                      ) : (favProducts?.length ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {favProducts.map((p) => (
                            <div key={p.id} className="rounded-2xl ring-1 ring-white/10 bg-black/20 p-3 flex gap-3">
                              <img src={p.img} alt={p.nome} className="h-16 w-16 rounded-xl object-cover ring-1 ring-white/10" />
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold truncate">{p.nome}</p>
                                <p className="text-xs text-slate-400 line-clamp-2">{p.descricao || ''}</p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <button
                                    onClick={() => {
                                      const pid = encodeURIComponent(String(p.id || ""));
                                      onNavigate?.(`/estoque?product=${pid}&open=1`);
                                      onClose?.();
                                    }}
                                    className="rounded-xl px-3 py-2 text-xs ring-1 ring-white/10 hover:bg-white/5"
                                  >
                                    Ver produto
                                  </button>
                                  <button
                                    onClick={() => toggleFavorite(p.id)}
                                    className="rounded-xl px-3 py-2 text-xs bg-rose-500/15 text-rose-200 ring-1 ring-rose-400/30 hover:bg-rose-500/20"
                                  >
                                    Remover
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-300">Você ainda não favoritou nenhum produto.</p>
                      ))}
                    </div>
                  </div>
                )}

                {settingsSection === 'coupons' && (
                  <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-100">Cupons</p>
                        <p className="mt-1 text-xs text-slate-400">Aqui ficam seus cupons ativos para usar no carrinho.</p>
                      </div>
                      <button onClick={() => loadMyCoupons()} className="rounded-xl px-3 py-2 text-sm ring-1 ring-white/10 hover:bg-white/5">Atualizar</button>
                    </div>
                    <div className="mt-4">
                      {couponBusy ? (
                        <p className="text-sm text-slate-300">Carregando…</p>
                      ) : (myCoupons?.length ? (
                        <div className="space-y-3">
                          {myCoupons.map((c) => (
                            <div key={c.code} className="rounded-2xl ring-1 ring-white/10 bg-black/20 p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-semibold text-slate-100">{c.label || 'Cupom'}</p>
                                  <p className="mt-1 text-xs text-slate-400">Código: <span className="font-mono text-slate-200">{c.code}</span></p>
                                  {c.expires_at ? (
                                    <p className="mt-1 text-[11px] text-slate-400">Validade: {new Date(c.expires_at).toLocaleString('pt-BR')}</p>
                                  ) : null}
                                </div>
                                <button
                                  className="rounded-xl px-3 py-2 text-sm bg-teal-400 text-black ring-4 ring-teal-400/20"
                                  onClick={async () => {
                                    try { await navigator.clipboard.writeText(String(c.code || '')); setOk('Cupom copiado ✅'); } catch { setOk('Copie o código manualmente.'); }
                                  }}
                                >
                                  Copiar
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-300">Nenhum cupom ativo no momento.</p>
                      ))}
                    </div>
                  </div>
                )}

                {settingsSection === 'reviews' && (
                  <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-100">Avaliações</p>
                        <p className="mt-1 text-xs text-slate-400">Veja suas compras entregues e avalie a experiência.</p>
                      </div>
                      <button onClick={() => loadDeliveredOrdersForReviews()} className="rounded-xl px-3 py-2 text-sm ring-1 ring-white/10 hover:bg-white/5">Atualizar</button>
                    </div>

                    <div className="mt-4 space-y-3">
                      {!deliveredOrders?.length ? (
                        <p className="text-sm text-slate-300">Quando um pedido for marcado como <b>Entregue</b>, ele aparecerá aqui para você avaliar.</p>
                      ) : (
                        deliveredOrders.map((o) => {
                          const rev = reviewsByOrder?.[String(o.id)];
                          const stars = rev?.rating ? '★'.repeat(Math.max(1, Math.min(5, Number(rev.rating)))) : '';
                          return (
                            <div key={o.id} className="rounded-2xl ring-1 ring-white/10 bg-black/20 p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold">Pedido entregue</p>
                                  <p className="text-xs text-slate-400">{o.created_at ? new Date(o.created_at).toLocaleString('pt-BR') : ''}</p>
                                  {Array.isArray(o.order_items) && o.order_items.length ? (
                                    <p className="mt-2 text-xs text-slate-300 line-clamp-2">
                                      {(o.order_items || []).map((it) => String(it?.product_name || it?.name || '')).filter(Boolean).join(' • ')}
                                    </p>
                                  ) : null}
                                  {rev ? (
                                    <div className="mt-2">
                                      <span className="text-amber-300 text-sm">{stars}</span>
                                      <p className="mt-1 text-sm text-slate-200">{rev.comment}</p>
                                    </div>
                                  ) : null}
                                </div>
                                <button
                                  className="rounded-xl px-3 py-2 text-sm bg-indigo-400 text-black ring-4 ring-indigo-400/20"
                                  onClick={() => {
                                    setError('');
                                    setOk('');
                                    setReviewModal({
                                      open: true,
                                      order: o,
                                      rating: Number(rev?.rating) || 5,
                                      comment: String(rev?.comment || ''),
                                      busy: false,
                                    });
                                  }}
                                >
                                  {rev ? 'Editar' : 'Avaliar'}
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4">
                  <p className="text-sm font-semibold text-slate-100">Sessão</p>
                  <div className="mt-3">
                    <button onClick={() => onSignOut?.()} className="rounded-xl px-4 py-2 bg-rose-500/15 text-rose-200 ring-1 ring-rose-400/30 hover:bg-rose-500/20">Sair da conta</button>
                  </div>
                </div>
              </>
            )}

            {error ? <p className="text-sm text-red-300 bg-red-500/10 ring-1 ring-red-500/30 rounded-xl px-4 py-3">{error}</p> : null}
            {ok ? <p className="text-sm text-emerald-200 bg-emerald-500/10 ring-1 ring-emerald-500/30 rounded-xl px-4 py-3">{ok}</p> : null}

            <div className="flex items-center justify-end gap-2">
              {!required && <button onClick={onClose} className="rounded-xl px-4 py-3 ring-1 ring-white/10 hover:bg-white/5">Fechar</button>}
              {activeTab === "profile" ? (
                <button onClick={save} disabled={saving || loading} className={`rounded-xl px-4 py-3 font-semibold ring-1 ring-white/10 transition ${saving || loading ? "bg-slate-700/50 text-slate-300 cursor-not-allowed" : "bg-emerald-400 hover:bg-emerald-300 text-black"}`}>
                  {saving ? "Salvando…" : "Salvar perfil"}
                </button>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </Modal>

    {/* Modal de avaliação */}
    <Modal
      open={!!reviewModal.open}
      onClose={() => setReviewModal({ open: false, order: null, rating: 5, comment: "", busy: false })}
      title="Avaliar compra"
    >
      {reviewModal.open && (
        <div className="space-y-3">
          <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4">
            <p className="text-sm font-semibold text-slate-100">Sua avaliação</p>
            <p className="mt-1 text-xs text-slate-400">Conte como foi sua experiência. Isso ajuda outras pessoas.</p>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Nota (1 a 5)">
                <select
                  value={reviewModal.rating}
                  onChange={(e) => setReviewModal((p) => ({ ...p, rating: Number(e.target.value) }))}
                  className="w-full rounded-xl bg-slate-800/60 ring-1 ring-white/10 px-4 py-3 outline-none"
                >
                  {[5,4,3,2,1].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </Field>
              <Field label="Pedido">
                <input
                  readOnly
                  value={reviewModal?.order?.created_at ? new Date(reviewModal.order.created_at).toLocaleString('pt-BR') : ''}
                  className="w-full rounded-xl bg-slate-800/40 ring-1 ring-white/10 px-4 py-3 outline-none text-slate-300"
                />
              </Field>
            </div>

            <div className="mt-3">
              <Field label="Comentário">
                <textarea
                  value={reviewModal.comment}
                  onChange={(e) => setReviewModal((p) => ({ ...p, comment: e.target.value }))}
                  rows={5}
                  className="w-full rounded-xl bg-slate-800/60 ring-1 ring-white/10 px-4 py-3 outline-none focus:ring-teal-400/60"
                  placeholder="Ex.: Chegou bem embalado, pintura impecável, envio rápido..."
                />
              </Field>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => setReviewModal({ open: false, order: null, rating: 5, comment: "", busy: false })}
                className="rounded-xl px-4 py-2 ring-1 ring-white/10 hover:bg-white/5"
              >
                Cancelar
              </button>
              <button
                onClick={submitReview}
                disabled={reviewModal.busy}
                className={`rounded-xl px-4 py-2 font-semibold ring-4 ring-indigo-400/20 ${reviewModal.busy ? 'bg-slate-700/50 text-slate-300' : 'bg-indigo-400 hover:bg-indigo-300 text-black'}`}
              >
                {reviewModal.busy ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
    </>
  );
}
