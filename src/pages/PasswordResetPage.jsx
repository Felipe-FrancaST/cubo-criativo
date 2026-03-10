import React from "react";
import { useAuth } from "../auth/AuthProvider.jsx";
import { supabase } from "../lib/supabaseClient";

function FloatingNotice({ tone = "success", message }) {
  if (!message) return null;
  const palette = tone === "error"
    ? "border-rose-400/35 bg-slate-950/95 text-rose-100 shadow-[0_20px_60px_-20px_rgba(244,63,94,0.45)]"
    : "border-emerald-400/35 bg-slate-950/95 text-emerald-100 shadow-[0_20px_60px_-20px_rgba(52,211,153,0.45)]";
  const icon = tone === "error" ? "error" : "verified";
  return (
    <div className="sticky top-3 z-[60] mb-4 flex justify-center px-1">
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

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs text-slate-400">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function hasRecoverySignals() {
  if (typeof window === "undefined") return false;
  try {
    const params = new URLSearchParams(window.location.search || "");
    const hash = String(window.location.hash || "");
    const path = String(window.location.pathname || "");
    const isResetPath = path === "/redefinir-senha";
    const hasRecoveryType = params.get("type") === "recovery" || /type=recovery/i.test(hash);
    const hasRecoveryToken = /access_token=/i.test(hash) || /refresh_token=/i.test(hash);
    const hasResetCode = isResetPath && !!params.get("code");
    return hasRecoveryType || hasRecoveryToken || hasResetCode;
  } catch {
    return false;
  }
}

export default function PasswordResetPage({ onGoHome, onGoLogin }) {
  const { isPasswordRecovery, session, clearPasswordRecovery } = useAuth();
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [ok, setOk] = React.useState("");
  const [ready, setReady] = React.useState(() => isPasswordRecovery || hasRecoverySignals());

  React.useEffect(() => {
    let active = true;
    async function prepareRecovery() {
      const hasSignals = hasRecoverySignals();
      if (isPasswordRecovery || (session && hasSignals)) {
        setReady(true);
        try { window.sessionStorage.setItem("cc_password_recovery", "1"); } catch {}
        return;
      }
      const code = typeof window !== "undefined" ? new URLSearchParams(window.location.search || "").get("code") : "";
      if (code && !session) {
        try {
          const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeErr) throw exchangeErr;
          if (!active) return;
          try { window.sessionStorage.setItem("cc_password_recovery", "1"); } catch {}
          setReady(true);
          return;
        } catch {
          if (!active) return;
        }
      }
      try {
        const { data } = await supabase.auth.getSession();
        if (!active) return;
        if (data?.session && hasSignals) {
          try { window.sessionStorage.setItem("cc_password_recovery", "1"); } catch {}
          setReady(true);
          return;
        }
      } catch {}
      setReady(Boolean(isPasswordRecovery));
    }
    prepareRecovery();
    return () => { active = false; };
  }, [isPasswordRecovery, session]);

  async function submit(e) {
    e?.preventDefault?.();
    setError("");
    setOk("");

    if (!ready) {
      setError("Abra a página pelo link enviado ao seu e-mail para redefinir a senha com segurança.");
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setError("A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    try {
      setBusy(true);
      const { error: updErr } = await supabase.auth.updateUser({ password: newPassword });
      if (updErr) throw updErr;
      clearPasswordRecovery?.();
      setNewPassword("");
      setConfirmPassword("");
      setOk("Senha atualizada com sucesso ✅ Agora você já pode entrar normalmente na sua conta.");
    } catch (e) {
      setError(e?.message || "Não foi possível redefinir sua senha.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex-1">
      <section className="container-cc px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
        <div className="mx-auto max-w-xl">
          <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.92),rgba(2,6,23,.92))] p-5 sm:p-7 shadow-2xl shadow-black/30 backdrop-blur-xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-100">
              <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              Recuperação segura
            </div>

            <h1 className="mt-4 text-2xl font-black sm:text-3xl">Escolha sua nova senha</h1>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Essa página é usada apenas para redefinir a senha pelo link enviado ao seu e-mail. Aqui não pedimos a senha atual.
            </p>

            {error ? <div className="mt-5"><FloatingNotice tone="error" message={error} /></div> : null}
            {ok ? <div className="mt-5"><FloatingNotice tone="success" message={ok} /></div> : null}

            <form onSubmit={submit} className="mt-6 space-y-4">
              <Field label="Nova senha">
                <input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} type="password" autoComplete="new-password" className="w-full rounded-2xl bg-slate-800/60 ring-1 ring-white/10 px-4 py-3 outline-none focus:ring-teal-400/60" placeholder="Mínimo 6 caracteres" />
              </Field>
              <Field label="Confirmar nova senha">
                <input value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} type="password" autoComplete="new-password" className="w-full rounded-2xl bg-slate-800/60 ring-1 ring-white/10 px-4 py-3 outline-none focus:ring-teal-400/60" placeholder="Repita a nova senha" />
              </Field>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button type="submit" disabled={busy} className={`inline-flex items-center justify-center rounded-2xl px-5 py-3 font-semibold ring-1 ring-white/10 ${busy ? "bg-slate-700/50 text-slate-300" : "bg-indigo-400 text-black hover:bg-indigo-300"}`}>
                  {busy ? "Salvando…" : "Definir nova senha"}
                </button>
                <button type="button" onClick={() => onGoLogin?.()} className="inline-flex items-center justify-center rounded-2xl px-5 py-3 font-semibold ring-1 ring-white/10 hover:bg-white/5">
                  Ir para login
                </button>
                <button type="button" onClick={() => onGoHome?.()} className="inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm text-slate-300 ring-1 ring-white/10 hover:bg-white/5">
                  Voltar ao início
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
