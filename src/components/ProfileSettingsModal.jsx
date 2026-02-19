import React from "react";
import Modal from "./Modal.jsx";
import { useAuth } from "../auth/AuthProvider.jsx";
import { fetchAddressFromCep, isValidCep, onlyDigits } from "../lib/cep.js";

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs text-slate-400">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

export default function ProfileSettingsModal({ open, onClose }) {
  const { user, session } = useAuth();
  const jwt = session?.access_token || "";

  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [ok, setOk] = React.useState("");

  const [fullName, setFullName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [cpf, setCpf] = React.useState("");
  const [birthdate, setBirthdate] = React.useState(""); // YYYY-MM-DD

  const [street, setStreet] = React.useState("");
  const [number, setNumber] = React.useState("");
  const [addr2, setAddr2] = React.useState("");
  const [neighborhood, setNeighborhood] = React.useState("");
  const [city, setCity] = React.useState("");
  const [stateUF, setStateUF] = React.useState("");
  const [zip, setZip] = React.useState("");

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

  const [cepBusy, setCepBusy] = React.useState(false);
  const [cepHint, setCepHint] = React.useState("");

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

    setStreet(data?.address_line1 || "");
    setNumber(data?.address_number || "");
    setAddr2(data?.address_line2 || "");
    setNeighborhood(data?.neighborhood || "");
    setCity(data?.city || "");
    setStateUF(data?.state || "");
    setZip(data?.zip || "");
    setLoading(false);
  }, [user, jwt]);

  React.useEffect(() => {
    if (!open) return;
    if (!user) return;
    loadProfile();
  }, [open, user, loadProfile]);

  // Auto-preenche pelo CEP
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

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zip]);

  async function save() {
    if (!user) return;
    setError("");
    setOk("");
    setSaving(true);

    const fail = (msg) => {
      setError(msg);
      setSaving(false);
    };

    // validações (obrigatório)
    if (!fullName.trim()) return fail("Informe seu nome.");
    if (!phone.trim()) return fail("Informe seu telefone.");
    if (!cpf.trim()) return fail("Informe seu CPF.");
    if (!isValidCpf(cpf)) return fail("CPF inválido. Digite apenas números (11 dígitos).");
    if (!birthdate) return fail("Informe sua data de nascimento.");
    if (!isValidCep(zip)) return fail("Informe um CEP válido.");
    if (!city.trim()) return fail("Informe sua cidade.");
    if (!stateUF.trim() || stateUF.trim().length !== 2) return fail("Informe a UF (2 letras).");
    if (!neighborhood.trim()) return fail("Informe o bairro.");
    if (!street.trim()) return fail("Informe a rua.");
    if (!number.trim()) return fail("Informe o número.");

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
    };

    // remove strings vazias
    Object.keys(payload).forEach((k) => {
      if (payload[k] === "") delete payload[k];
    });
    payload.id = user.id;

    const resp = await fetch("/api/profile", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
      },
      body: JSON.stringify({ profile: payload }),
    });

    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      setError(json?.error || "Não foi possível salvar.");
      setSaving(false);
      return;
    }

    setOk("Dados salvos com sucesso ✅");
    setSaving(false);
  }

  return (
    <Modal open={open} onClose={onClose} title="Configurações">
      <div className="w-full max-w-2xl">
        {!user ? (
          <p className="text-slate-300">Faça login para editar seus dados.</p>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4">
              <p className="text-sm font-semibold text-slate-100">Dados do cliente</p>
              <p className="mt-1 text-xs text-slate-400">Essas informações aparecem no seu pedido e facilitam a entrega.</p>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Nome completo">
                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    type="text"
                    autoComplete="name"
                    className="w-full rounded-xl bg-slate-800/60 ring-1 ring-white/10 px-4 py-3 outline-none focus:ring-teal-400/60"
                    placeholder="Seu nome"
                  />
                </Field>
                <Field label="Telefone (WhatsApp)">
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    type="tel"
                    autoComplete="tel"
                    className="w-full rounded-xl bg-slate-800/60 ring-1 ring-white/10 px-4 py-3 outline-none focus:ring-teal-400/60"
                    placeholder="(11) 99999-9999"
                  />
                </Field>

                <Field label="CPF">
                  <input
                    value={cpf}
                    onChange={(e) => setCpf(e.target.value)}
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    className="w-full rounded-xl bg-slate-800/60 ring-1 ring-white/10 px-4 py-3 outline-none focus:ring-teal-400/60"
                    placeholder="000.000.000-00"
                  />
                </Field>

                <Field label="Data de nascimento">
                  <input
                    value={birthdate}
                    onChange={(e) => setBirthdate(e.target.value)}
                    type="date"
                    autoComplete="bday"
                    className="w-full rounded-xl bg-slate-800/60 ring-1 ring-white/10 px-4 py-3 outline-none focus:ring-teal-400/60"
                  />
                </Field>
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="CEP">
                  <input
                    value={zip}
                    onChange={(e) => setZip(e.target.value)}
                    type="text"
                    autoComplete="postal-code"
                    className="w-full rounded-xl bg-slate-800/60 ring-1 ring-white/10 px-4 py-3 outline-none focus:ring-teal-400/60"
                    placeholder="00000-000"
                  />
                  <div className="mt-1 text-[11px] text-slate-400">{cepBusy ? "Consultando CEP…" : cepHint || ""}</div>
                </Field>

                <Field label="UF">
                  <input
                    value={stateUF}
                    onChange={(e) => setStateUF(e.target.value.toUpperCase())}
                    type="text"
                    autoComplete="address-level1"
                    className="w-full rounded-xl bg-slate-800/60 ring-1 ring-white/10 px-4 py-3 outline-none focus:ring-teal-400/60"
                    placeholder="SP"
                    maxLength={2}
                  />
                </Field>
              </div>

              <div className="mt-3">
                <Field label="Cidade">
                  <input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    type="text"
                    autoComplete="address-level2"
                    className="w-full rounded-xl bg-slate-800/60 ring-1 ring-white/10 px-4 py-3 outline-none focus:ring-teal-400/60"
                    placeholder="Cidade"
                  />
                </Field>
              </div>

              <div className="mt-3">
                <Field label="Bairro">
                  <input
                    value={neighborhood}
                    onChange={(e) => setNeighborhood(e.target.value)}
                    type="text"
                    autoComplete="address-level3"
                    className="w-full rounded-xl bg-slate-800/60 ring-1 ring-white/10 px-4 py-3 outline-none focus:ring-teal-400/60"
                    placeholder="Bairro"
                  />
                </Field>
              </div>

              <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <Field label="Rua">
                    <input
                      value={street}
                      onChange={(e) => setStreet(e.target.value)}
                      type="text"
                      autoComplete="address-line1"
                      className="w-full rounded-xl bg-slate-800/60 ring-1 ring-white/10 px-4 py-3 outline-none focus:ring-teal-400/60"
                      placeholder="Rua Exemplo"
                    />
                  </Field>
                </div>

                <Field label="Número">
                  <input
                    value={number}
                    onChange={(e) => setNumber(e.target.value)}
                    type="text"
                    inputMode="numeric"
                    autoComplete="address-line2"
                    className="w-full rounded-xl bg-slate-800/60 ring-1 ring-white/10 px-4 py-3 outline-none focus:ring-teal-400/60"
                    placeholder="123"
                  />
                </Field>
              </div>

              <div className="mt-3">
                <Field label="Complemento (opcional)">
                  <input
                    value={addr2}
                    onChange={(e) => setAddr2(e.target.value)}
                    type="text"
                    autoComplete="address-line2"
                    className="w-full rounded-xl bg-slate-800/60 ring-1 ring-white/10 px-4 py-3 outline-none focus:ring-teal-400/60"
                    placeholder="Apartamento, bloco, etc"
                  />
                </Field>
              </div>
            </div>

            {error ? (
              <p className="text-sm text-red-300 bg-red-500/10 ring-1 ring-red-500/30 rounded-xl px-4 py-3">{error}</p>
            ) : null}
            {ok ? (
              <p className="text-sm text-emerald-200 bg-emerald-500/10 ring-1 ring-emerald-500/30 rounded-xl px-4 py-3">{ok}</p>
            ) : null}

            <div className="flex items-center justify-end gap-2">
              <button onClick={onClose} className="rounded-xl px-4 py-3 ring-1 ring-white/10 hover:bg-white/5">
                Fechar
              </button>
              <button
                onClick={save}
                disabled={saving || loading}
                className={`rounded-xl px-4 py-3 font-semibold ring-1 ring-white/10 transition ${
                  saving || loading
                    ? "bg-slate-700/50 text-slate-300 cursor-not-allowed"
                    : "bg-emerald-400 hover:bg-emerald-300 text-black"
                }`}
              >
                {saving ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
