import React from "react";
import Modal from "./Modal.jsx";
import { useAuth } from "../auth/AuthProvider.jsx";

export default function AuthModal({ open, onClose, onSuccess }) {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = React.useState("login");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (!open) {
      setError("");
      setBusy(false);
    }
  }, [open]);

  async function submit(e) {
    e?.preventDefault?.();
    setError("");
    if (!email || !password) {
      setError("Preencha email e senha.");
      return;
    }
    try {
      setBusy(true);
      const fn = mode === "login" ? signIn : signUp;
      const { error: err } = await fn({ email, password });
      if (err) throw err;
      onSuccess?.();
      onClose?.();
    } catch (err) {
      setError(err?.message || "Não foi possível autenticar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose}>
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-bold text-lg">{mode === "login" ? "Entrar" : "Criar conta"}</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-2 ring-1 ring-white/15 hover:bg-white/5"
            aria-label="Fechar"
          >
            <span className="material-icons">close</span>
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`rounded-lg px-4 py-2 ring-1 ring-white/10 ${
              mode === "login" ? "bg-white/10" : "hover:bg-white/5"
            }`}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`rounded-lg px-4 py-2 ring-1 ring-white/10 ${
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
              className="mt-1 w-full rounded-lg bg-slate-800/60 ring-1 ring-white/10 px-3 py-2 outline-none"
              placeholder="voce@exemplo.com"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400">Senha</label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              className="mt-1 w-full rounded-lg bg-slate-800/60 ring-1 ring-white/10 px-3 py-2 outline-none"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-sm text-red-300 bg-red-500/10 ring-1 ring-red-500/30 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            disabled={busy}
            className={`w-full rounded-lg px-4 py-3 font-semibold ring-1 ring-white/10 transition ${
              busy ? "bg-slate-700/50 text-slate-300 cursor-not-allowed" : "bg-emerald-400 hover:bg-emerald-300 text-black"
            }`}
          >
            {busy
              ? "Aguarde…"
              : mode === "login"
              ? "Entrar"
              : "Criar conta"}
          </button>

          {mode === "signup" && (
            <p className="text-xs text-slate-400">
              Se o seu projeto Supabase estiver com confirmação de e-mail habilitada, você pode precisar confirmar
              o cadastro no e-mail antes de conseguir entrar.
            </p>
          )}
        </form>
      </div>
    </Modal>
  );
}
