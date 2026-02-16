import React from "react";
import Modal from "./Modal.jsx";
import { useAuth } from "../auth/AuthProvider.jsx";

export default function AuthModal({ open, onClose, onSuccess }) {
  const { signIn, signUp, resetPassword } = useAuth();

  const [mode, setMode] = React.useState("login"); // login | signup
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [info, setInfo] = React.useState("");

  React.useEffect(() => {
    if (!open) {
      setError("");
      setInfo("");
      setBusy(false);
      setPassword("");
    }
  }, [open]);

  async function submit(e) {
    e?.preventDefault?.();
    setError("");
    setInfo("");

    if (!email || !password) {
      setError("Preencha email e senha.");
      return;
    }

    try {
      setBusy(true);
      const fn = mode === "login" ? signIn : signUp;
      const { data, error: err } = await fn({ email, password });
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

  return (
    <Modal open={open} onClose={onClose}>
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-extrabold text-xl">{mode === "login" ? "Entrar" : "Criar conta"}</h3>
            <p className="mt-1 text-xs text-slate-400">
              {mode === "login"
                ? "Acesse seus pedidos e finalize compras."
                : "Crie sua conta para pagar e acompanhar pedidos."}
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

        <div className="mt-4 grid grid-cols-2 gap-2">
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

        <form onSubmit={submit} className="mt-4 space-y-3">
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
