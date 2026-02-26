import React from "react";
import { supabase } from "../lib/supabaseClient.js";
import { useAuth } from "../auth/AuthProvider.jsx";

const FavoritesContext = React.createContext(null);

export function FavoritesProvider({ children }) {
  const { user, session } = useAuth();
  const [favoriteIds, setFavoriteIds] = React.useState(() => new Set());
  const [loading, setLoading] = React.useState(false);
  const token = session?.access_token || "";

  const reload = React.useCallback(async () => {
    if (!user) {
      setFavoriteIds(new Set());
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("favorite_products")
        .select("product_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const s = new Set((data || []).map((r) => String(r?.product_id || "").trim()).filter(Boolean));
      setFavoriteIds(s);
    } catch (e) {
      console.warn("favorites load failed", e);
      setFavoriteIds(new Set());
    } finally {
      setLoading(false);
    }
  }, [user]);

  React.useEffect(() => {
    reload();
  }, [reload, token]);

  const isFavorite = React.useCallback(
    (productId) => {
      const id = String(productId || "").trim();
      return id ? favoriteIds.has(id) : false;
    },
    [favoriteIds]
  );

  const toggleFavorite = React.useCallback(
    async (productId) => {
      if (!user) {
        return { ok: false, error: "Faça login para favoritar." };
      }
      const id = String(productId || "").trim();
      if (!id) return { ok: false, error: "Produto inválido." };

      const currently = favoriteIds.has(id);
      // Optimistic UI
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (currently) next.delete(id);
        else next.add(id);
        return next;
      });

      try {
        if (currently) {
          const { error } = await supabase
            .from("favorite_products")
            .delete()
            .eq("user_id", user.id)
            .eq("product_id", id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("favorite_products")
            .insert({ user_id: user.id, product_id: id });
          if (error) throw error;
        }
        return { ok: true };
      } catch (e) {
        // rollback
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          if (currently) next.add(id);
          else next.delete(id);
          return next;
        });
        return { ok: false, error: e?.message || "Não foi possível atualizar favoritos." };
      }
    },
    [user, favoriteIds]
  );

  const value = React.useMemo(
    () => ({ favoriteIds, loading, reload, isFavorite, toggleFavorite }),
    [favoriteIds, loading, reload, isFavorite, toggleFavorite]
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const ctx = React.useContext(FavoritesContext);
  if (!ctx) throw new Error("useFavorites must be used within FavoritesProvider");
  return ctx;
}
