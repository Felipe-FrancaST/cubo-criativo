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

  async function signUp({ email, password }) {
    return supabase.auth.signUp({ email, password });
  }

  async function signIn({ email, password }) {
    return supabase.auth.signInWithPassword({ email, password });
  }

  async function signOut() {
    return supabase.auth.signOut();
  }

  const value = React.useMemo(
    () => ({ session, user, loading, signUp, signIn, signOut }),
    [session, user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
