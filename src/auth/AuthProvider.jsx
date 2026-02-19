import React from "react";
import { supabase } from "../lib/supabaseClient";

const AuthContext = React.createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = React.useState(null);
  const [user, setUser] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session || null);
      setUser(data.session?.user || null);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession || null);
      setUser(nextSession?.user || null);
      setLoading(false);
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
      typeof window !== "undefined" ? window.location.origin : undefined;
    return supabase.auth.resetPasswordForEmail(email, redirectTo ? { redirectTo } : undefined);
  }

  async function signOut() {
    return supabase.auth.signOut();
  }

  async function signInWithGoogle() {
    const redirectTo = typeof window !== "undefined" ? window.location.origin : undefined;
    return supabase.auth.signInWithOAuth({
      provider: "google",
      options: redirectTo ? { redirectTo } : undefined,
    });
  }

  const value = React.useMemo(
    () => ({ session, user, loading, signUp, signIn, signInWithGoogle, resetPassword, signOut }),
    [session, user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
