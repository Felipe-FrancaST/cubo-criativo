import React from "react";
import { supabase } from "../lib/supabaseClient";

const AuthContext = React.createContext(null);

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


function userHasPassword(user) {
  if (!user) return false;
  const providers = [];
  const directProvider = String(user?.app_metadata?.provider || '').toLowerCase().trim();
  const appProviders = Array.isArray(user?.app_metadata?.providers) ? user.app_metadata.providers : [];
  const identityProviders = Array.isArray(user?.identities)
    ? user.identities.map((i) => String(i?.provider || '').toLowerCase().trim()).filter(Boolean)
    : [];
  providers.push(directProvider, ...appProviders.map((p) => String(p || '').toLowerCase().trim()), ...identityProviders);
  const unique = Array.from(new Set(providers.filter(Boolean)));
  if (unique.includes('email')) return true;
  if (!unique.length) return true;
  return !(unique.length === 1 && unique[0] === 'google');
}

export function AuthProvider({ children }) {
  const [session, setSession] = React.useState(null);
  const [user, setUser] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = React.useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.sessionStorage.getItem("cc_password_recovery") === "1" || hasRecoverySignals();
    } catch {
      return hasRecoverySignals();
    }
  });

  React.useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session || null);
      setUser(data.session?.user || null);
      if (data.session && hasRecoverySignals()) {
        setIsPasswordRecovery(true);
        try { window.sessionStorage.setItem("cc_password_recovery", "1"); } catch {}
      }
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession || null);
      setUser(nextSession?.user || null);
      setLoading(false);

      if (event === "PASSWORD_RECOVERY") {
        setIsPasswordRecovery(true);
        try { window.sessionStorage.setItem("cc_password_recovery", "1"); } catch {}
        return;
      }

      if (event === "SIGNED_OUT") {
        setIsPasswordRecovery(false);
        try { window.sessionStorage.removeItem("cc_password_recovery"); } catch {}
        return;
      }

      if (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "USER_UPDATED" || event === "TOKEN_REFRESHED") {
        const keepRecovery = hasRecoverySignals();
        setIsPasswordRecovery(keepRecovery);
        try {
          if (keepRecovery) window.sessionStorage.setItem("cc_password_recovery", "1");
          else window.sessionStorage.removeItem("cc_password_recovery");
        } catch {}
      }
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  async function saveProfile(userId, profile, jwt) {
    if (!userId || !profile) return { error: null };

    const payload = {
      full_name: profile.full_name,
      phone: profile.phone,
      address_line1: profile.address_line1,
      address_number: profile.address_number,
      address_line2: profile.address_line2,
      neighborhood: profile.neighborhood,
      city: profile.city,
      state: profile.state,
      zip: profile.zip,
      cpf: profile.cpf,
      birthdate: profile.birthdate,
    };

    // remove campos vazios
    Object.keys(payload).forEach((k) => {
      if (payload[k] === undefined || payload[k] === null || payload[k] === "") {
        delete payload[k];
      }
    });

    // Preferência: salvar via API (Service Role), para não depender de RLS no client.
    try {
      if (jwt) {
        const resp = await fetch("/api/profile", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${jwt}`,
          },
          body: JSON.stringify({ profile: payload }),
        });

        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          return {
            error: new Error(data?.error || "Não foi possível salvar seus dados."),
          };
        }
        return { error: null };
      }
    } catch (e) {
      // fallback abaixo
      console.warn("profile api failed", e);
    }

    // Fallback: tentar salvar direto pelo client (caso RLS esteja ok)
    try {
      const { error } = await supabase
        .from("profiles")
        .upsert({ id: userId, ...payload }, { onConflict: "id" });
      if (error) return { error };
      return { error: null };
    } catch (e) {
      return { error: e };
    }
  }

  async function signUp({ email, password, profile }) {
    const emailRedirectTo =
      typeof window !== "undefined" ? window.location.origin : undefined;

    // Se a confirmação por e-mail estiver habilitada no Supabase,
    // esse redirect evita links quebrados em produção.
    const resp = await supabase.auth.signUp({
      email,
      password,
      options: emailRedirectTo ? { emailRedirectTo } : undefined,
    });

    // Se a confirmação por e-mail estiver desativada, já teremos session/user.
    // Salva os dados do perfil.
    if (resp?.data?.user?.id && profile) {
      if (resp?.data?.session) {
        const saved = await saveProfile(resp.data.user.id, profile, resp.data.session.access_token);
        if (saved?.error) {
          // não bloqueia criação de conta, mas avisa no console para debug
          console.warn("profiles upsert error", saved.error);
        }
      } else {
        // Sem session (email confirmation): guarda temporariamente
        try {
          localStorage.setItem(
            "pending_profile",
            JSON.stringify({ email, profile })
          );
        } catch {
          // ignore
        }
      }
    }

    return resp;
  }

  async function signIn({ email, password }) {
    const resp = await supabase.auth.signInWithPassword({ email, password });

    // Se havia um profile pendente (signup com confirmação por e-mail), tenta salvar ao entrar
    try {
      const raw = localStorage.getItem("pending_profile");
      if (raw && resp?.data?.user?.id) {
        const parsed = JSON.parse(raw);
        if (parsed?.email === email && parsed?.profile) {
          const saved = await saveProfile(resp.data.user.id, parsed.profile, resp.data.session.access_token);
          if (saved?.error) console.warn("profiles upsert error", saved.error);
          localStorage.removeItem("pending_profile");
        }
      }
    } catch {
      // ignore
    }

    return resp;
  }

  async function resetPassword({ email }) {
    const redirectTo =
      typeof window !== "undefined" ? `${window.location.origin}/redefinir-senha` : undefined;
    return supabase.auth.resetPasswordForEmail(email, redirectTo ? { redirectTo } : undefined);
  }

  function clearPasswordRecovery() {
    setIsPasswordRecovery(false);
    try { if (typeof window !== "undefined") window.sessionStorage.removeItem("cc_password_recovery"); } catch {}
  }

  async function signOut() {
    return supabase.auth.signOut();
  }

  async function signInWithGoogle() {
    const redirectTo = typeof window !== "undefined" ? window.location.origin : undefined;
    setIsPasswordRecovery(false);
    try { if (typeof window !== "undefined") window.sessionStorage.removeItem("cc_password_recovery"); } catch {}
    return supabase.auth.signInWithOAuth({
      provider: "google",
      options: redirectTo ? { redirectTo } : undefined,
    });
  }

  const accountHasPassword = React.useMemo(() => userHasPassword(user), [user]);

  const value = React.useMemo(
    () => ({ session, user, loading, signUp, signIn, signInWithGoogle, resetPassword, signOut, isPasswordRecovery, clearPasswordRecovery, accountHasPassword }),
    [session, user, loading, isPasswordRecovery, accountHasPassword]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
