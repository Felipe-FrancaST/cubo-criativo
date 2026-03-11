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

function FloatingNotice({ tone = "success", message }) {
  if (!message) return null;
  const palette = tone === "error"
    ? "border-rose-400/35 bg-slate-950/95 text-rose-100 shadow-[0_20px_60px_-20px_rgba(244,63,94,0.45)]"
    : "border-emerald-400/35 bg-slate-950/95 text-emerald-100 shadow-[0_20px_60px_-20px_rgba(52,211,153,0.45)]";
  const icon = tone === "error" ? "error" : "verified";
  return (
    <div className="sticky top-3 z-[70] mb-4 flex justify-center px-1">
      <div className={`max-w-xl rounded-2xl border px-4 py-3 backdrop-blur-xl ring-1 ring-white/10 ${palette}`.trim()}>
        <div className="flex items-start gap-3">
          <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/8 ring-1 ring-white/10">
            <span className="material-icons text-[18px]">{icon}</span>
          </div>
          <p className="text-sm font-medium leading-6">{message}</p>
        </div>
      </div>
    </div>
  );
}


function PasswordInput({ value, onChange, autoComplete = "current-password", placeholder = "••••••••", className = "", inputClassName = "", buttonClassName = "", ...props }) {
  const [visible, setVisible] = React.useState(false);
  const resolvedInputClass = (className || inputClassName || "w-full rounded-xl bg-slate-800/60 ring-1 ring-white/10 px-4 py-3 pr-12 outline-none focus:ring-teal-400/60").trim();
  const resolvedButtonClass = (buttonClassName || "absolute inset-y-0 right-0 inline-flex w-12 items-center justify-center text-slate-300 transition hover:text-white").trim();
  return (
    <div className="relative">
      <input
        value={value}
        onChange={onChange}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        className={resolvedInputClass}
        placeholder={placeholder}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
        aria-pressed={visible}
        className={resolvedButtonClass}
      >
        <span className="material-icons text-[20px]">{visible ? "visibility_off" : "visibility"}</span>
      </button>
    </div>
  );
}

export default function AuthModal({ open, onClose, onSuccess }) {
  const { signIn, signUp, signInWithGoogle, resetPassword, signOut, needsGoogleTermsAcceptance, completeGoogleTermsConsent } = useAuth();

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
  const [agreeTerms, setAgreeTerms] = React.useState(false);
  const [googleAgreeTerms, setGoogleAgreeTerms] = React.useState(false);

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
      setAgreeTerms(false);
      setGoogleAgreeTerms(false);
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
      if (!agreeTerms) return setError("Você precisa concordar com os Termos de uso e a Política de Privacidade para criar sua conta.");
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
      setInfo("Enviamos um e-mail com um link seguro para você criar uma nova senha.");
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


  async function acceptGoogleTerms() {
    setError("");
    setInfo("");
    if (!googleAgreeTerms) {
      setError("Para concluir seu primeiro acesso com Google, você precisa concordar com os Termos de uso e a Política de Privacidade.");
      return;
    }
    try {
      setBusy(true);
      const { error: err } = await completeGoogleTermsConsent();
      if (err) throw err;
      setInfo("Conta Google concluída com sucesso. Seja bem-vindo à Cubo Criativo.");
      onSuccess?.();
      onClose?.();
    } catch (e) {
      setError(e?.message || "Não foi possível concluir seu cadastro com Google.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose}>
      <div className="w-full max-w-md">
        {needsGoogleTermsAcceptance ? (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-extrabold text-xl">Concluir cadastro com Google</h3>
                <p className="mt-1 text-xs text-slate-400">
                  É o seu primeiro acesso com Google. Para finalizar a criação da conta, confirme sua concordância com nossos termos.
                </p>
              </div>
              <button
                onClick={signOut}
                className="rounded-xl px-3 py-2 text-xs ring-1 ring-white/15 hover:bg-white/5"
                aria-label="Sair"
              >
                Sair
              </button>
            </div>

            <div className="mt-4 rounded-2xl border border-teal-400/20 bg-teal-500/10 px-4 py-4 text-sm text-slate-200 ring-1 ring-white/10">
              <div className="flex items-start gap-3">
                <span className="material-icons text-teal-300">verified_user</span>
                <div>
                  <p className="font-semibold text-slate-100">Conta nova detectada</p>
                  <p className="mt-1 text-slate-300">
                    Se você já tinha uma conta criada antes, entre com seu e-mail e senha normalmente. Para seu primeiro acesso com Google, precisamos do aceite abaixo.
                  </p>
                </div>
              </div>
            </div>

            <label className="mt-4 flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-sm text-slate-300 ring-1 ring-white/10">
              <input
                type="checkbox"
                checked={googleAgreeTerms}
                onChange={(e) => setGoogleAgreeTerms(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-white/20 bg-slate-900 text-teal-400 focus:ring-teal-400"
              />
              <span className="leading-6">
                Li e concordo com os{' '}
                <a href="/terms.html" target="_blank" rel="noreferrer" className="font-medium text-teal-300 hover:text-teal-200 underline underline-offset-4">Termos de uso</a>{' '}
                e com a{' '}
                <a href="/privacy.html" target="_blank" rel="noreferrer" className="font-medium text-teal-300 hover:text-teal-200 underline underline-offset-4">Política de Privacidade</a>.
              </span>
            </label>

            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={acceptGoogleTerms}
                disabled={busy}
                className={`flex-1 rounded-xl px-4 py-3 font-semibold ring-1 ring-white/10 transition ${busy ? 'bg-slate-700/50 text-slate-300 cursor-not-allowed' : 'bg-teal-500/90 text-slate-950 hover:bg-teal-400'}`}
              >
                {busy ? 'Concluindo...' : 'Concluir cadastro com Google'}
              </button>
            </div>
          </>
        ) : (
          <>
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
            <div className="mt-1">
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                className="w-full rounded-xl bg-slate-800/60 ring-1 ring-white/10 px-4 py-3 pr-12 outline-none focus:ring-teal-400/60"
                placeholder="••••••••"
              />
            </div>
          </div>

          {mode === "signup" && (
            <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-white/20 bg-slate-900 text-teal-400 focus:ring-teal-400"
              />
              <span className="leading-6">
                Li e concordo com os{' '}
                <a href="/terms.html" target="_blank" rel="noreferrer" className="font-medium text-teal-300 hover:text-teal-200 underline underline-offset-4">Termos de uso</a>{' '}
                e com a{' '}
                <a href="/privacy.html" target="_blank" rel="noreferrer" className="font-medium text-teal-300 hover:text-teal-200 underline underline-offset-4">Política de Privacidade</a>.
              </span>
            </label>
          )}

          {error ? <FloatingNotice tone="error" message={error} /> : null}
          {info ? <FloatingNotice tone="success" message={info} /> : null}

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
              Esqueceu a senha?
            </button>
            {mode === "signup" ? (
              <span className="text-right">Pode ser necessário confirmar o e-mail antes de entrar.</span>
            ) : (
              <span />
            )}
          </div>
        </form>
          </>
        )}
      </div>
    </Modal>
  );
}
