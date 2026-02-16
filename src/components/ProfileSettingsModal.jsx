import React from "react";
import Modal from "./Modal.jsx";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../auth/AuthProvider.jsx";

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs text-slate-400">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

export default function ProfileSettingsModal({ open, onClose }) {
  const { user } = useAuth();

  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [ok, setOk] = React.useState("");

  const [fullName, setFullName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [addr1, setAddr1] = React.useState("");
  const [addr2, setAddr2] = React.useState("");
  const [neighborhood, setNeighborhood] = React.useState("");
  const [city, setCity] = React.useState("");
  const [stateUF, setStateUF] = React.useState("");
  const [zip, setZip] = React.useState("");

  const loadProfile = React.useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    setOk("");
    const { data, error: err } = await supabase
      .from("profiles")
      .select("full_name, phone, address_line1, address_line2, neighborhood, city, state, zip")
      .eq("id", user.id)
      .maybeSingle();

    if (err) {
      setError(err.message || "Não foi possível carregar seus dados.");
      setLoading(false);
      return;
    }

    setFullName(data?.full_name || "");
    setPhone(data?.phone || "");
    setAddr1(data?.address_line1 || "");
    setAddr2(data?.address_line2 || "");
    setNeighborhood(data?.neighborhood || "");
    setCity(data?.city || "");
    setStateUF(data?.state || "");
    setZip(data?.zip || "");
    setLoading(false);
  }, [user]);

  React.useEffect(() => {
    if (!open) return;
    if (!user) return;
    loadProfile();
  }, [open, user, loadProfile]);

  async function save() {
    if (!user) return;
    setError("");
    setOk("");
    setSaving(true);
    const payload = {
      id: user.id,
      full_name: fullName.trim(),
      phone: phone.trim(),
      address_line1: addr1.trim(),
      address_line2: addr2.trim(),
      neighborhood: neighborhood.trim(),
      city: city.trim(),
      state: stateUF.trim(),
      zip: zip.trim(),
    };
    // remove strings vazias
    Object.keys(payload).forEach((k) => {
      if (payload[k] === "") delete payload[k];
    });
    payload.id = user.id;

    const { error: err } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
    if (err) {
      setError(err.message || "Não foi possível salvar.");
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
              <p className="mt-1 text-xs text-slate-400">
                Essas informações aparecem no seu pedido e facilitam a entrega.
              </p>

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
              </div>

              <div className="mt-3">
                <Field label="Endereço completo">
                  <textarea
                    value={addr1}
                    onChange={(e) => setAddr1(e.target.value)}
                    rows={3}
                    autoComplete="street-address"
                    className="w-full rounded-xl bg-slate-800/60 ring-1 ring-white/10 px-4 py-3 outline-none focus:ring-teal-400/60 resize-none"
                    placeholder="Rua, número, bairro, cidade/UF, CEP"
                  />
                </Field>
              </div>

              <details className="mt-3 rounded-xl bg-white/5 ring-1 ring-white/10 p-3">
                <summary className="cursor-pointer text-sm text-slate-200 select-none">Detalhes (opcional)</summary>
                <div className="mt-3 space-y-3">
                  <Field label="Complemento">
                    <input
                      value={addr2}
                      onChange={(e) => setAddr2(e.target.value)}
                      type="text"
                      autoComplete="address-line2"
                      className="w-full rounded-xl bg-slate-800/60 ring-1 ring-white/10 px-4 py-3 outline-none focus:ring-teal-400/60"
                      placeholder="Apartamento, bloco, etc"
                    />
                  </Field>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Bairro">
                      <input
                        value={neighborhood}
                        onChange={(e) => setNeighborhood(e.target.value)}
                        type="text"
                        className="w-full rounded-xl bg-slate-800/60 ring-1 ring-white/10 px-4 py-3 outline-none focus:ring-teal-400/60"
                        placeholder="Bairro"
                      />
                    </Field>
                    <Field label="CEP">
                      <input
                        value={zip}
                        onChange={(e) => setZip(e.target.value)}
                        type="text"
                        autoComplete="postal-code"
                        className="w-full rounded-xl bg-slate-800/60 ring-1 ring-white/10 px-4 py-3 outline-none focus:ring-teal-400/60"
                        placeholder="00000-000"
                      />
                    </Field>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                    <Field label="Estado (UF)">
                      <input
                        value={stateUF}
                        onChange={(e) => setStateUF(e.target.value)}
                        type="text"
                        autoComplete="address-level1"
                        className="w-full rounded-xl bg-slate-800/60 ring-1 ring-white/10 px-4 py-3 outline-none focus:ring-teal-400/60"
                        placeholder="SP"
                        maxLength={2}
                      />
                    </Field>
                  </div>
                </div>
              </details>
            </div>

            {error ? (
              <p className="text-sm text-red-300 bg-red-500/10 ring-1 ring-red-500/30 rounded-xl px-4 py-3">{error}</p>
            ) : null}
            {ok ? (
              <p className="text-sm text-emerald-200 bg-emerald-500/10 ring-1 ring-emerald-500/30 rounded-xl px-4 py-3">{ok}</p>
            ) : null}

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={onClose}
                className="rounded-xl px-4 py-3 ring-1 ring-white/10 hover:bg-white/5"
              >
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
