import React from "react";
import { useAuth } from "../auth/AuthProvider.jsx";
import { supabase } from "../lib/supabaseClient";

function FloatingNotice({ tone = "success", message }) {
  if (!message) return null;
  const palette = tone === "error"
    ? "border-rose-400/35 bg-[#05131a]/95 text-rose-100 shadow-[0_20px_60px_-20px_rgba(244,63,94,0.45)]"
    : "border-emerald-400/35 bg-[#05131a]/95 text-emerald-100 shadow-[0_20px_60px_-20px_rgba(52,211,153,0.45)]";
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

function getRecoveryContext() {
  if (typeof window === "undefined") {
    return {
      hasSignals: false,
      type: "",
      tokenHash: "",
      code: "",
      accessToken: "",
      refreshToken: "",
    };
  }

  const params = new URLSearchParams(window.location.search || "");
  const hashParams = new URLSearchParams(String(window.location.hash || "").replace(/^#/, ""));
  const path = String(window.location.pathname || "");
  const type = String(params.get("type") || hashParams.get("type") || "").toLowerCase();
  const tokenHash = String(params.get("token_hash") || "");
  const code = String(params.get("code") || "");
  const accessToken = String(hashParams.get("access_token") || "");
  const refreshToken = String(hashParams.get("refresh_token") || "");
  const isResetPath = path === "/redefinir-senha";

  const hasSignals = Boolean(
    type === "recovery" ||
    tokenHash ||
    (isResetPath && code) ||
    (accessToken && refreshToken)
  );

  return { hasSignals, type, tokenHash, code, accessToken, refreshToken };
}


function PasswordInput({ value, onChange, autoComplete = "new-password", placeholder = "••••••••", className = "", inputClassName = "", buttonClassName = "", ...props }) {
  const [visible, setVisible] = React.useState(false);
  const resolvedInputClass = (className || inputClassName || "w-full rounded-2xl bg-[#0c2430]/68 ring-1 ring-white/10 px-4 py-3 pr-12 outline-none focus:ring-cyan-400/60").trim();
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

export default function PasswordResetPage({ onGoHome, onGoLogin }) {
  const { isPasswordRecovery, session, clearPasswordRecovery } = useAuth();
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [ok, setOk] = React.useState("");
  const [ready, setReady] = React.useState(() => isPasswordRecovery || getRecoveryContext().hasSignals);

  const prepareRecoverySession = React.useCallback(async () => {
    const ctx = getRecoveryContext();

    try {
      if (ctx.accessToken && ctx.refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: ctx.accessToken,
          refresh_token: ctx.refreshToken,
        });
        if (error) throw error;
      } else if (ctx.tokenHash && ctx.type === "recovery") {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: ctx.tokenHash,
          type: "recovery",
        });
        if (error) throw error;
      } else if (ctx.code) {
        const { error } = await supabase.auth.exchangeCodeForSession(ctx.code);
        if (error) throw error;
      }

      const { data } = await supabase.auth.getSession();
      const hasSession = !!data?.session;
      if (hasSession) {
        try { window.sessionStorage.setItem("cc_password_recovery", "1"); } catch {}
      }
      return hasSession;
    } catch {
      return false;
    }
  }, []);

  React.useEffect(() => {
    let alive = true;

    async function boot() {
      const ctx = getRecoveryContext();

      if (!ctx.hasSignals && !isPasswordRecovery && !session) {
        if (alive) setReady(false);
        return;
      }

      const ok = await prepareRecoverySession();
      if (!alive) return;

      if (ok || isPasswordRecovery || session) {
        setReady(true);
        return;
      }

      setReady(false);
    }

    boot();
    return () => { alive = false; };
  }, [isPasswordRecovery, session, prepareRecoverySession]);

  async function submit(e) {
    e?.preventDefault?.();
    setError("");
    setOk("");

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

      let { data } = await supabase.auth.getSession();
      if (!data?.session) {
        const recovered = await prepareRecoverySession();
        if (!recovered) {
          throw new Error("Abra a página pelo link enviado ao seu e-mail para redefinir a senha com segurança.");
        }
        const refreshed = await supabase.auth.getSession();
        data = refreshed.data;
      }

      if (!data?.session) {
        throw new Error("Abra a página pelo link enviado ao seu e-mail para redefinir a senha com segurança.");
      }

      const { error: updErr } = await supabase.auth.updateUser({
        password: newPassword,
        data: { has_password: true },
      });
      if (updErr) throw updErr;

      clearPasswordRecovery?.();
      setReady(true);
      setNewPassword("");
      setConfirmPassword("");
      setOk("Senha atualizada com sucesso ✅ Agora você já pode entrar normalmente na sua conta.");

      try {
        window.history.replaceState({}, "", "/redefinir-senha");
      } catch {}
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
                <PasswordInput value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" className="w-full rounded-2xl bg-[#0c2430]/68 ring-1 ring-white/10 px-4 py-3 pr-12 outline-none focus:ring-cyan-400/60" placeholder="Mínimo 6 caracteres" />
              </Field>
              <Field label="Confirmar nova senha">
                <PasswordInput value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" className="w-full rounded-2xl bg-[#0c2430]/68 ring-1 ring-white/10 px-4 py-3 pr-12 outline-none focus:ring-cyan-400/60" placeholder="Repita a nova senha" />
              </Field>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button type="submit" disabled={busy} className={`inline-flex items-center justify-center rounded-2xl px-5 py-3 font-semibold ring-1 ring-white/10 ${busy ? "bg-[#12303b]/55 text-slate-300" : "bg-cyan-500 text-black hover:bg-cyan-400"}`}>
                  {busy ? "Salvando…" : "Definir nova senha"}
                </button>
                <button type="button" onClick={() => onGoLogin?.()} className="inline-flex items-center justify-center rounded-2xl px-5 py-3 font-semibold ring-1 ring-white/10 hover:bg-white/4">
                  Ir para login
                </button>
                <button type="button" onClick={() => onGoHome?.()} className="inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm text-slate-300 ring-1 ring-white/10 hover:bg-white/4">
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
