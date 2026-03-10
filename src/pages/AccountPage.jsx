import React from "react";
import { useAuth } from "../auth/AuthProvider.jsx";

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs text-slate-400">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
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

export default function AccountPage({ onClose, onGoHome }) {
  const { user, signIn, signUp, signOut, resetPassword } = useAuth();

  const [mode, setMode] = React.useState("login"); // login | signup
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
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
  const [busy, setBusy] = React.useState(false);

  const [error, setError] = React.useState("");
  const [info, setInfo] = React.useState("");

  async function handleSubmit(e) {
    e?.preventDefault?.();
    setError("");
    setInfo("");

    if (!email) return setError("Informe seu e-mail.");
    if (!password) return setError("Informe sua senha.");
    if (mode === "signup") {
      if (!fullName.trim()) return setError("Informe seu nome.");
      if (!phone.trim()) return setError("Informe seu telefone.");
      if (!cpf.trim()) return setError("Informe seu CPF.");
      if (!birthdate) return setError("Informe sua data de nascimento.");
      if (!zip.trim()) return setError("Informe seu CEP.");
      if (!city.trim()) return setError("Informe sua cidade.");
      if (!stateUF.trim() || stateUF.trim().length !== 2) return setError("Informe sua UF (2 letras).");
      if (!neighborhood.trim()) return setError("Informe seu bairro.");
      if (!street.trim()) return setError("Informe sua rua.");
      if (!number.trim()) return setError("Informe o número.");
    }

    try {
      setBusy(true);
      const fn = mode === "login" ? signIn : signUp;
      const { data, error: err } = await fn(
        mode === "login"
          ? { email, password }
          : {
              email,
              password,
              profile: {
                full_name: fullName.trim(),
                phone: phone.trim(),
                cpf: cpf.trim(),
                birthdate,
                address_line1: street.trim(),
                address_number: number.trim(),
                address_line2: addr2.trim(),
                neighborhood: neighborhood.trim(),
                city: city.trim(),
                state: stateUF.trim(),
                zip: zip.trim(),
              },
            }
      );
      if (err) throw err;

      if (mode === "signup" && !data?.session) {
        // Email confirmation enabled
        setInfo("Conta criada! Confira seu e-mail para confirmar o cadastro e depois faça login.");
        setMode("login");
        setPassword("");
        return;
      }

      setInfo("Login realizado com sucesso.");
      onClose?.();
    } catch (e2) {
      setError(e2?.message || "Não foi possível autenticar.");
    } finally {
      setBusy(false);
    }
  }

  async function handleReset() {
    setError("");
    setInfo("");
    if (!email) return setError("Informe seu e-mail para enviar o link de recuperação.");
    try {
      setBusy(true);
      const { error: err } = await resetPassword({ email });
      if (err) throw err;
      setInfo("Enviamos um e-mail com o link para redefinir a senha.");
    } catch (e2) {
      setError(e2?.message || "Não foi possível enviar o e-mail de recuperação.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex-1">
      <section
        className="container-cc px-4 sm:px-6 lg:px-8 py-10 sm:py-14" >
        <div className="rounded-3xl ring-1 ring-white/10 bg-slate-900/40 backdrop-blur p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold">Minha conta</h1>
              <p className="mt-1 text-sm text-slate-400">
                Entre para finalizar pedidos, acompanhar compras e pagar com segurança.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {onGoHome && (
                <button
                  onClick={onGoHome}
                  className="rounded-xl px-3 py-2 text-sm ring-1 ring-white/10 hover:bg-white/5"
                >
                  Início
                </button>
              )}
              {onClose && (
                <button
                  onClick={onClose}
                  className="rounded-xl px-3 py-2 text-sm ring-1 ring-white/10 hover:bg-white/5"
                >
                  Fechar
                </button>
              )}
            </div>
          </div>

          {user ? (
            <div className="mt-6">
              <div className="rounded-2xl p-4 ring-1 ring-white/10 bg-white/5">
                <p className="text-sm text-slate-300">Logado como</p>
                <p className="mt-1 font-mono text-sm text-slate-100 break-all">{user.email}</p>
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => signOut()}
                  className="container-cc rounded-xl px-4 py-3 font-semibold ring-1 ring-white/10 hover:bg-white/5"
                >
                  Sair
                </button>
                <button
                  onClick={() => {
                    onGoHome?.();
                    onClose?.();
                  }}
                  className="container-cc rounded-xl px-4 py-3 font-semibold bg-teal-400 text-black ring-4 ring-teal-400/20"
                >
                  Voltar para a loja
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="mt-6 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className={`rounded-xl px-4 py-2 text-sm ring-1 ring-white/10 ${
                    mode === "login" ? "bg-white/10" : "hover:bg-white/5"
                  }`}
                >
                  Entrar
                </button>
                <button
                  type="button"
                  onClick={() => setMode("signup")}
                  className={`rounded-xl px-4 py-2 text-sm ring-1 ring-white/10 ${
                    mode === "signup" ? "bg-white/10" : "hover:bg-white/5"
                  }`}
                >
                  Criar conta
                </button>
              </div>

              <form onSubmit={handleSubmit} className="mt-5 space-y-3">
                {mode === "signup" && (
  <div className="space-y-3">
    <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4">
      <p className="text-sm font-semibold text-slate-100">Dados para entrega</p>
      <p className="mt-1 text-xs text-slate-400">
        Preencha para facilitar o fechamento do pedido (você pode editar depois).
      </p>

      <div className="mt-4 space-y-3">
        <Field label="Nome completo">
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            type="text"
            autoComplete="name"
            className="container-cc w-full rounded-xl bg-slate-800/60 ring-1 ring-white/10 px-4 py-3 outline-none focus:ring-teal-400/60"
            placeholder="Seu nome"
          />
        </Field>

        <Field label="Telefone (WhatsApp)">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            type="tel"
            autoComplete="tel"
            className="container-cc w-full rounded-xl bg-slate-800/60 ring-1 ring-white/10 px-4 py-3 outline-none focus:ring-teal-400/60"
            placeholder="(11) 99999-9999"
          />
        </Field>


        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Field label="CPF">
            <input
              value={cpf}
              onChange={(e) => setCpf(e.target.value)}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              className="container-cc w-full rounded-xl bg-slate-800/60 ring-1 ring-white/10 px-4 py-3 outline-none focus:ring-teal-400/60"
              placeholder="000.000.000-00"
            />
          </Field>
          <Field label="Data de nascimento">
            <input
              value={birthdate}
              onChange={(e) => setBirthdate(e.target.value)}
              type="date"
              autoComplete="bday"
              className="container-cc w-full rounded-xl bg-slate-800/60 ring-1 ring-white/10 px-4 py-3 outline-none focus:ring-teal-400/60"
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Field label="CEP">
            <input
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              type="text"
              inputMode="numeric"
              autoComplete="postal-code"
              className="container-cc w-full rounded-xl bg-slate-800/60 ring-1 ring-white/10 px-4 py-3 outline-none focus:ring-teal-400/60"
              placeholder="00000-000"
            />
          </Field>
          <Field label="UF">
            <input
              value={stateUF}
              onChange={(e) => setStateUF(e.target.value.toUpperCase())}
              type="text"
              autoComplete="address-level1"
              className="container-cc w-full rounded-xl bg-slate-800/60 ring-1 ring-white/10 px-4 py-3 outline-none focus:ring-teal-400/60"
              placeholder="SP"
              maxLength={2}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Field label="Cidade">
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              type="text"
              autoComplete="address-level2"
              className="container-cc w-full rounded-xl bg-slate-800/60 ring-1 ring-white/10 px-4 py-3 outline-none focus:ring-teal-400/60"
              placeholder="Cidade"
            />
          </Field>
          <Field label="Bairro">
            <input
              value={neighborhood}
              onChange={(e) => setNeighborhood(e.target.value)}
              type="text"
              autoComplete="address-level3"
              className="container-cc w-full rounded-xl bg-slate-800/60 ring-1 ring-white/10 px-4 py-3 outline-none focus:ring-teal-400/60"
              placeholder="Bairro"
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Field label="Rua">
            <input
              value={street}
              onChange={(e) => setStreet(e.target.value)}
              type="text"
              autoComplete="address-line1"
              className="container-cc w-full rounded-xl bg-slate-800/60 ring-1 ring-white/10 px-4 py-3 outline-none focus:ring-teal-400/60"
              placeholder="Rua"
            />
          </Field>
          <Field label="Número">
            <input
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              type="text"
              inputMode="numeric"
              autoComplete="address-line2"
              className="container-cc w-full rounded-xl bg-slate-800/60 ring-1 ring-white/10 px-4 py-3 outline-none focus:ring-teal-400/60"
              placeholder="123"
            />
          </Field>
        </div>

        <Field label="Complemento (opcional)">
          <input
            value={addr2}
            onChange={(e) => setAddr2(e.target.value)}
            type="text"
            autoComplete="address-line3"
            className="container-cc w-full rounded-xl bg-slate-800/60 ring-1 ring-white/10 px-4 py-3 outline-none focus:ring-teal-400/60"
            placeholder="Apartamento, bloco, etc"
          />
        </Field>
	      </div>
    </div>
  </div>
)}
                <Field label="Email">
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    autoComplete="email"
                    className="container-cc w-full rounded-xl bg-slate-800/60 ring-1 ring-white/10 px-4 py-3 outline-none focus:ring-teal-400/60"
                    placeholder="voce@exemplo.com"
                  />
                </Field>

                <Field label="Senha">
                  <PasswordInput
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    className="container-cc w-full rounded-xl bg-slate-800/60 ring-1 ring-white/10 px-4 py-3 pr-12 outline-none focus:ring-teal-400/60"
                    placeholder="••••••••"
                  />
                </Field>

                {error && (
                  <p className="container-cc text-sm text-red-300 bg-red-500/10 ring-1 ring-red-500/30 rounded-xl px-4 py-3">
                    {error}
                  </p>
                )}
                {info && (
                  <p className="container-cc text-sm text-emerald-200 bg-emerald-500/10 ring-1 ring-emerald-500/30 rounded-xl px-4 py-3">
                    {info}
                  </p>
                )}

                <button
                  disabled={busy}
                  className={`w-full rounded-xl px-4 py-3 font-semibold ring-1 ring-white/10 transition ${
                    busy
                      ? "bg-slate-700/50 text-slate-300 cursor-not-allowed"
                      : "bg-emerald-400 hover:bg-emerald-300 text-black"
                  }`}
                >
                  {busy ? "Aguarde…" : mode === "login" ? "Entrar" : "Criar conta"}
                </button>

                <div className="flex items-center justify-between gap-3 text-xs text-slate-400">
                  <button
                    type="button"
                    onClick={handleReset}
                    className="hover:text-slate-200 underline underline-offset-4"
                    disabled={busy}
                  >
                    Esqueci minha senha
                  </button>
                  <span className="text-right">
                    {mode === "signup" ? "Você pode precisar confirmar o e-mail antes de entrar." : null}
                  </span>
                </div>
              </form>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
