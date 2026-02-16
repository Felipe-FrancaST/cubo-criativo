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
  const [busy, setBusy] = React.useState(false);

  const [error, setError] = React.useState("");
  const [info, setInfo] = React.useState("");

  async function handleSubmit(e) {
    e?.preventDefault?.();
    setError("");
    setInfo("");

    if (!email) return setError("Informe seu e-mail.");
    if (!password) return setError("Informe sua senha.");

    try {
      setBusy(true);
      const fn = mode === "login" ? signIn : signUp;
      const { data, error: err } = await fn({ email, password });
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
