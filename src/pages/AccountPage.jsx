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

export default function AccountPage({ onClose, onGoHome }) {
  const { user, signIn, signUp, signOut, resetPassword } = useAuth();

  const [mode, setMode] = React.useState("login"); // login | signup
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [fullName, setFullName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [addr1, setAddr1] = React.useState("");
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
      if (!addr1.trim()) return setError("Informe seu endereço.");
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
                address_line1: addr1.trim(),
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
        className="mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14"
        style={{ maxWidth: "var(--container-max, 520px)" }}
      >
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
                  className="rounded-xl px-4 py-3 font-semibold ring-1 ring-white/10 hover:bg-white/5"
                >
                  Sair
                </button>
                <button
                  onClick={() => {
                    onGoHome?.();
                    onClose?.();
                  }}
                  className="rounded-xl px-4 py-3 font-semibold bg-teal-400 text-black ring-4 ring-teal-400/20"
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

        <Field label="Endereço completo">
          <textarea
            value={addr1}
            onChange={(e) => setAddr1(e.target.value)}
            rows={3}
            autoComplete="street-address"
            className="w-full rounded-xl bg-slate-800/60 ring-1 ring-white/10 px-4 py-3 outline-none focus:ring-teal-400/60 resize-none"
            placeholder="Rua, número, bairro, cidade/UF, CEP (se tiver)"
          />
        </Field>
      </div>

      <details className="mt-3 rounded-xl bg-white/5 ring-1 ring-white/10 p-3">
        <summary className="cursor-pointer text-sm text-slate-200 select-none">
          Detalhes do endereço (opcional)
        </summary>
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
  </div>
)}
                <Field label="Email">
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    autoComplete="email"
                    className="w-full rounded-xl bg-slate-800/60 ring-1 ring-white/10 px-4 py-3 outline-none focus:ring-teal-400/60"
                    placeholder="voce@exemplo.com"
                  />
                </Field>

                <Field label="Senha">
                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type="password"
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    className="w-full rounded-xl bg-slate-800/60 ring-1 ring-white/10 px-4 py-3 outline-none focus:ring-teal-400/60"
                    placeholder="••••••••"
                  />
                </Field>

                {error && (
                  <p className="text-sm text-red-300 bg-red-500/10 ring-1 ring-red-500/30 rounded-xl px-4 py-3">
                    {error}
                  </p>
                )}
                {info && (
                  <p className="text-sm text-emerald-200 bg-emerald-500/10 ring-1 ring-emerald-500/30 rounded-xl px-4 py-3">
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
