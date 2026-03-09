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

export default function AuthModal({ open, onClose, onSuccess }) {
  const { signIn, signUp, signInWithGoogle, resetPassword } = useAuth();

  function isValidCpf(raw) {
    const cpf = onlyDigits(raw);
    if (cpf.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(cpf)) return false; // todos dígitos iguais

    const calc = (base, factor) => {
      let sum = 0;
      for (let i = 0; i < base.length; i++) sum += Number(base[i]) * (factor - i);
      const mod = (sum * 10) % 11;
      return mod === 10 ? 0 : mod;
    };

    const d1 = calc(cpf.slice(0, 9), 10);
    const d2 = calc(cpf.slice(0, 10), 11);
    return d1 === Number(cpf[9]) && d2 === Number(cpf[10]);
  }

  const [mode, setMode] = React.useState("login"); // login | signup
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");

  // signup/profile
  const [fullName, setFullName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [cpf, setCpf] = React.useState("");
  const [birthdate, setBirthdate] = React.useState(""); // YYYY-MM-DD
  const [street, setStreet] = React.useState("");
  const [number, setNumber] = React.useState("");
  const [addr2, setAddr2] = React.useState(""); // complemento
  const [neighborhood, setNeighborhood] = React.useState("");
  const [city, setCity] = React.useState("");
  const [stateUF, setStateUF] = React.useState("");
  const [zip, setZip] = React.useState("");

  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [info, setInfo] = React.useState("");

  const [cepBusy, setCepBusy] = React.useState(false);
  const [cepHint, setCepHint] = React.useState("");

  React.useEffect(() => {
    if (!open) {
      setError("");
      setInfo("");
      setCepHint("");
      setCepBusy(false);
      setBusy(false);
      setPassword("");
    }
  }, [open]);

  // Auto-preenche cidade/UF/bairro/rua pelo CEP (ViaCEP)
  React.useEffect(() => {
    if (mode !== "signup") return;
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

      // Só preenche se o campo estiver vazio, para não apagar o que o cliente digitou.
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
  }, [zip, mode]);

  async function submit(e) {
    e?.preventDefault?.();
    setError("");
    setInfo("");

    if (!email || !password) {
      setError("Preencha email e senha.");
      return;
    }

    if (mode === "signup") {
      if (!fullName.trim()) return setError("Informe seu nome.");
      if (!phone.trim()) return setError("Informe seu telefone.");

      // CPF e data de nascimento são opcionais no cadastro,
      // mas se forem preenchidos, validamos.
      if (cpf.trim() && !isValidCpf(cpf)) return setError("CPF inválido. Digite apenas números (11 dígitos).");

      if (!isValidCep(zip)) return setError("Informe um CEP válido.");
      if (!city.trim()) return setError("Informe sua cidade.");
      if (!stateUF.trim() || stateUF.trim().length !== 2) return setError("Informe a UF (2 letras).");
      if (!neighborhood.trim()) return setError("Informe o bairro.");
      if (!street.trim()) return setError("Informe a rua.");
      if (!number.trim()) return setError("Informe o número.");
    }

    try {
      setBusy(true);
      const fn = mode === "login" ? signIn : signUp;

      const payload =
        mode === "login"
          ? { email, password }
          : {
              email,
              password,
              profile: {
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
              },
            };

      const { data, error: err } = await fn(payload);
      if (err) throw err;

      // Signup com confirmação por e-mail não retorna session
      if (mode === "signup" && !data?.session) {
        setInfo("Conta criada! Confira seu e-mail para confirmar o cadastro e depois faça login.");
        setMode("login");
        setPassword("");
        return;
      }

      onSuccess?.();
      onClose?.();
    } catch (err) {
      setError(err?.message || "Não foi possível autenticar.");
    } finally {
      setBusy(false);
    }
  }

  async function sendReset() {
    setError("");
    setInfo("");
    if (!email) {
      setError("Informe seu e-mail para recuperar a senha.");
      return;
    }
    try {
      setBusy(true);
      const { error: err } = await resetPassword({ email });
      if (err) throw err;
      setInfo("Enviamos um e-mail com o link para redefinir a senha.");
    } catch (e) {
      setError(e?.message || "Não foi possível enviar o e-mail de recuperação.");
    } finally {
      setBusy(false);
    }
  }

  async function doGoogle() {
    setError("");
    setInfo("");
    try {
      setBusy(true);
      const { error: err } = await signInWithGoogle();
      if (err) throw err;
      // Vai redirecionar para o Google.
    } catch (e) {
      setError(e?.message || "Não foi possível entrar com Google.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose}>
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-extrabold text-xl">{mode === "login" ? "Entrar" : "Criar conta"}</h3>
            <p className="mt-1 text-xs text-slate-400">
              {mode === "login" ? "Acesse seus pedidos e finalize compras." : "Crie sua conta para pagar e acompanhar pedidos."}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 ring-1 ring-white/15 hover:bg-white/5"
            aria-label="Fechar"
          >
            <span className="material-icons">close</span>
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 sm:grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`rounded-xl px-4 py-2 text-sm ring-1 ring-white/10 ${mode === "login" ? "bg-white/10" : "hover:bg-white/5"}`}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`rounded-xl px-4 py-2 text-sm ring-1 ring-white/10 ${mode === "signup" ? "bg-white/10" : "hover:bg-white/5"}`}
          >
            Criar conta
          </button>
        </div>

        <div className="mt-3">
          <button
            type="button"
            onClick={doGoogle}
            disabled={busy}
            className={`w-full rounded-xl px-4 py-3 font-semibold ring-1 ring-white/10 transition flex items-center justify-center gap-2 ${
              busy ? "bg-slate-700/50 text-slate-300 cursor-not-allowed" : "bg-white/10 hover:bg-white/15 text-slate-100"
            }`}
          >
            <span className="material-icons" style={{ fontSize: 18 }}>
              account_circle
            </span>
            Continuar com Google
          </button>
        </div>

        <div className="mt-3 flex items-center gap-3 text-xs text-slate-400">
          <div className="h-px flex-1 bg-white/10" />
          <span>ou</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <form onSubmit={submit} className="mt-4 space-y-3">
          {mode === "signup" && (
            <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4">
              <p className="text-sm font-semibold text-slate-100">Dados para entrega</p>
              {/* (removido) */}

              <div className="mt-4 space-y-3">
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Field label="CPF (opcional)">
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

                  <Field label="Data de nascimento (opcional)">
                    <input
                      value={birthdate}
                      onChange={(e) => setBirthdate(e.target.value)}
                      type="date"
                      autoComplete="bday"
                      className="w-full rounded-xl bg-slate-800/60 ring-1 ring-white/10 px-4 py-3 outline-none focus:ring-teal-400/60"
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Field label="CEP">
                    <input
                      value={zip}
                      onChange={(e) => setZip(e.target.value)}
                      type="text"
                      autoComplete="postal-code"
                      className="w-full rounded-xl bg-slate-800/60 ring-1 ring-white/10 px-4 py-3 outline-none focus:ring-teal-400/60"
                      placeholder="00000-000"
                    />
                    <div className="mt-1 text-[11px] text-slate-400">
                      {cepBusy ? "Consultando CEP…" : cepHint ? cepHint : ""}
                    </div>
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

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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
          )}

          <div>
            <label className="text-xs text-slate-400">Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoComplete="email"
              className="mt-1 w-full rounded-xl bg-slate-800/60 ring-1 ring-white/10 px-4 py-3 outline-none focus:ring-teal-400/60"
              placeholder="voce@exemplo.com"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400">Senha</label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              className="mt-1 w-full rounded-xl bg-slate-800/60 ring-1 ring-white/10 px-4 py-3 outline-none focus:ring-teal-400/60"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-sm text-red-300 bg-red-500/10 ring-1 ring-red-500/30 rounded-xl px-4 py-3">{error}</p>
          )}
          {info && (
            <p className="text-sm text-emerald-200 bg-emerald-500/10 ring-1 ring-emerald-500/30 rounded-xl px-4 py-3">{info}</p>
          )}

          <button
            disabled={busy}
            className={`w-full rounded-xl px-4 py-3 font-semibold ring-1 ring-white/10 transition ${
              busy ? "bg-slate-700/50 text-slate-300 cursor-not-allowed" : "bg-emerald-400 hover:bg-emerald-300 text-black"
            }`}
          >
            {busy ? "Aguarde…" : mode === "login" ? "Entrar" : "Criar conta"}
          </button>

          <div className="flex items-center justify-between gap-3 text-xs text-slate-400">
            <button
              type="button"
              onClick={sendReset}
              disabled={busy}
              className="hover:text-slate-200 underline underline-offset-4"
            >
              Esqueci minha senha
            </button>
            {mode === "signup" ? (
              <span className="text-right">Pode ser necessário confirmar o e-mail antes de entrar.</span>
            ) : (
              <span />
            )}
          </div>
        </form>
      </div>
    </Modal>
  );
}
