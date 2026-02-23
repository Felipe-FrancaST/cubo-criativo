import React from "react";
import Modal from "./Modal.jsx";
import { useAuth } from "../auth/AuthProvider.jsx";
import { supabase } from "../lib/supabaseClient";
import { fetchAddressFromCep, isValidCep, onlyDigits } from "../lib/cep.js";

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs text-slate-400">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

export default function ProfileSettingsModal({ open, onClose, required = false, onSaved, initialTab = "profile", onSignOut }) {
  const { user, session, resetPassword } = useAuth();
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
    setActiveTab(initialTab === "settings" ? "settings" : "profile");
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

  async function saveVipSelection() {
    if (!user || !isVip) return;
    setError('');
    setOk('');
    if (vipSelected.length !== 3) {
      setError('Escolha exatamente 3 miniaturas para o mês.');
      return;
    }
    try {
      setVipBusy(true);
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

  return (
    <Modal open={open} onClose={onClose} title={activeTab === "settings" ? "Configurações" : "Perfil"}>
      <div className="w-full max-w-3xl">
        {!user ? (
          <p className="text-slate-300">Faça login para editar seus dados.</p>
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
                <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4">
                  <p className="text-sm font-semibold text-slate-100">Segurança da conta</p>
                  <p className="mt-1 text-xs text-slate-400">Troque sua senha aqui. Se necessário, você também pode receber o link por e-mail.</p>
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Nova senha"><input value={newPassword} onChange={(e)=>setNewPassword(e.target.value)} type="password" className="w-full rounded-xl bg-slate-800/60 ring-1 ring-white/10 px-4 py-3 outline-none focus:ring-teal-400/60" placeholder="Mínimo 6 caracteres" /></Field>
                    <Field label="Confirmar nova senha"><input value={newPassword2} onChange={(e)=>setNewPassword2(e.target.value)} type="password" className="w-full rounded-xl bg-slate-800/60 ring-1 ring-white/10 px-4 py-3 outline-none focus:ring-teal-400/60" placeholder="Repita a senha" /></Field>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button onClick={savePassword} disabled={pwdBusy} className={`rounded-xl px-4 py-2 font-semibold ring-1 ring-white/10 ${pwdBusy ? "bg-slate-700/50 text-slate-300" : "bg-indigo-400 hover:bg-indigo-300 text-black"}`}>{pwdBusy ? "Atualizando…" : "Trocar senha"}</button>
                    <button onClick={async()=>{ try { setError(""); setOk(""); await resetPassword({ email: String(user.email || "") }); setOk("Enviamos um link de recuperação para seu e-mail ✅"); } catch (e) { setError(e?.message || "Não foi possível enviar o link."); } }} className="rounded-xl px-4 py-2 ring-1 ring-white/10 hover:bg-white/5">Enviar link por e-mail</button>
                  </div>
                </div>
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
  );
}
