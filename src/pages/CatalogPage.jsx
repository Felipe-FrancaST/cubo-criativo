import React from "react";
import ProductCard from "../components/ProductCard.jsx";

function readParam(name, fallback = "") {
  if (typeof window === "undefined") return fallback;
  try {
    return String(new URLSearchParams(window.location.search || "").get(name) || fallback);
  } catch {
    return fallback;
  }
}

export default function CatalogPage({ items, loading = false, error = "", addToCart, buyNow, openGallery, onRequireLogin }) {
  // Deep link: /catalogo?disponibilidade=pronta|encomenda  & tipo=action|rpg
  const [availability, setAvailability] = React.useState(() => readParam("disponibilidade", "todas"));
  const [type, setType] = React.useState(() => readParam("tipo", "todos"));
  const [selectedTag, setSelectedTag] = React.useState("Todos");
  const [query, setQuery] = React.useState("");

  React.useEffect(() => {
    // Se o usuário navegar pelo histórico e mudar search, atualiza filtros base
    const onPop = () => {
      setAvailability(readParam("disponibilidade", "todas"));
      setType(readParam("tipo", "todos"));
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const tagOptions = React.useMemo(() => {
    const set = new Set();
    const isInternal = (t) => {
      const s = String(t || "").toLowerCase().trim();
      if (!s) return true;
      // tags internas / técnicas
      if (s === "rpg") return true;
      if (s === "action" || s === "action figure" || s === "figure action") return true;
      if (s.startsWith("tipo:")) return true;
      if (s.startsWith("classe:")) return true;
      if (s.startsWith("raca:") || s.startsWith("raça:")) return true;
      if (s.startsWith("prazo:")) return true;
      return false;
    };
    (items || []).forEach((p) => {
      (p.tags || []).forEach((t) => {
        if (!isInternal(t)) set.add(String(t));
      });
    });
    return ["Todos", ...Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"))];
  }, [items]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return (items || []).filter((p) => {
      // disponibilidade
      const isStock = !!p?._isStock;
      const matchAvail =
        availability === "todas" ||
        (availability === "pronta" && isStock) ||
        (availability === "encomenda" && !isStock);

      // tipo
      const t = String(p?._typeLabel || "").toLowerCase();
      const matchType =
        type === "todos" ||
        (type === "action" && t.includes("action")) ||
        (type === "rpg" && t.includes("rpg"));

      // tags
      const matchTag = selectedTag === "Todos" || (p.tags || []).includes(selectedTag);

      // busca
      const name = String(p?.nome || "").toLowerCase();
      const desc = String(p?.descricao || "").toLowerCase();
      const tags = Array.isArray(p?.tags) ? p.tags.map((t) => String(t).toLowerCase()).join(" ") : "";
      const matchQuery = !q || name.includes(q) || desc.includes(q) || tags.includes(q);

      return matchAvail && matchType && matchTag && matchQuery;
    });
  }, [items, availability, type, selectedTag, query]);

  return (
    <main className="flex-1">
      <section className="container-cc px-4 sm:px-6 lg:px-8 py-10 sm:py-14" >
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold">Catálogo</h1>
            <p className="mt-1 text-sm text-slate-400">
              Action figures, miniaturas de RPG e colecionáveis — <b>pronta entrega</b> e <b>sob encomenda</b>.
            </p>
          </div>
          <span className="text-xs sm:text-sm text-slate-400">{loading ? "carregando…" : `${filtered.length} item(ns)`}</span>
        </div>

        {error ? (
          <div className="mt-6 rounded-2xl p-4 ring-1 ring-rose-400/30 bg-rose-500/10 text-rose-100 text-sm">
            Não foi possível carregar os produtos. {error}
          </div>
        ) : (
          <>
            {/* Filtros principais */}
            <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1fr_1fr_320px] gap-3">
              <div className="lg:hidden">
                <label className="block text-xs text-slate-400 mb-1">Disponibilidade</label>
                <select
                  className="w-full rounded-lg bg-slate-800/60 ring-1 ring-white/10 px-3 py-2 text-sm outline-none"
                  value={availability}
                  onChange={(e) => setAvailability(e.target.value)}
                >
                  <option value="todas">Todos</option>
                  <option value="pronta">Pronta entrega</option>
                  <option value="encomenda">Sob encomenda</option>
                </select>
              </div>

              <div className="hidden lg:flex flex-wrap gap-2">
                {[
                    { key: "todas", label: "Todos" },
                    { key: "pronta", label: "Pronta entrega" },
                    { key: "encomenda", label: "Sob encomenda" },
                  ].map((opt) => {
                    const active = availability === opt.key;
                    return (
                      <button
                        key={opt.key}
                        onClick={() => setAvailability(opt.key)}
                        className={`px-3 py-1 rounded-full text-sm whitespace-nowrap ring-1 ring-white/10 ${
                          active ? "bg-teal-400 text-black font-semibold" : "bg-slate-800/60 hover:bg-white/5"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
              </div>

              <div className="lg:hidden">
                <label className="block text-xs text-slate-400 mb-1">Tipo</label>
                <select
                  className="w-full rounded-lg bg-slate-800/60 ring-1 ring-white/10 px-3 py-2 text-sm outline-none"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                >
                  <option value="todos">Todos os tipos</option>
                  <option value="action">Action Figures</option>
                  <option value="rpg">Miniaturas RPG</option>
                </select>
              </div>

              <div className="hidden lg:flex flex-wrap gap-2">
                {[
                    { key: "todos", label: "Todos os tipos" },
                    { key: "action", label: "Action Figures" },
                    { key: "rpg", label: "Miniaturas RPG" },
                  ].map((opt) => {
                    const active = type === opt.key;
                    return (
                      <button
                        key={opt.key}
                        onClick={() => setType(opt.key)}
                        className={`px-3 py-1 rounded-full text-sm whitespace-nowrap ring-1 ring-white/10 ${
                          active ? "bg-white/10 text-white font-semibold" : "bg-slate-800/60 hover:bg-white/5"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
              </div>

              <div className="w-full">
                <input
                  type="search"
                  placeholder="Buscar por nome, tag ou descrição…"
                  className="w-full rounded-lg bg-slate-800/60 ring-1 ring-white/10 px-3 py-2 text-sm placeholder:text-slate-400 outline-none"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Tags (secundário) */}
            {tagOptions.length > 1 && (
              <div className="mt-4">
                <div className="lg:hidden">
                  <label className="block text-xs text-slate-400 mb-1">Tag</label>
                  <select
                    className="w-full rounded-lg bg-slate-800/60 ring-1 ring-white/10 px-3 py-2 text-sm outline-none"
                    value={selectedTag}
                    onChange={(e) => setSelectedTag(e.target.value)}
                  >
                    {tagOptions.map((tag) => (
                      <option key={tag} value={tag}>
                        {tag}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="hidden lg:flex flex-wrap gap-2">
                  {tagOptions.map((tag) => {
                    const active = selectedTag === tag;
                    return (
                      <button
                        key={tag}
                        onClick={() => setSelectedTag(tag)}
                        className={`px-3 py-1 rounded-full text-sm whitespace-nowrap ring-1 ring-white/10 ${
                          active ? "bg-amber-400 text-black font-semibold" : "bg-slate-800/60 hover:bg-white/5"
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {loading &&
                Array.from({ length: 12 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="w-full max-w-[320px] rounded-2xl overflow-hidden ring-1 ring-white/10 bg-slate-900/60"
                  >
                    <div className="aspect-[4/5] bg-slate-800/60 animate-pulse" />
                    <div className="p-4">
                      <div className="h-4 bg-slate-800/60 rounded animate-pulse" />
                      <div className="mt-3 h-9 bg-slate-800/60 rounded animate-pulse" />
                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <div className="h-10 bg-slate-800/60 rounded animate-pulse" />
                        <div className="h-10 bg-slate-800/60 rounded animate-pulse" />
                      </div>
                    </div>
                  </div>
                ))}

              {!loading &&
                filtered.map((p) => (
                  <ProductCard
                    key={p.id}
                    p={p}
                    addToCart={addToCart}
                    buyNow={buyNow}
                    openGallery={openGallery}
                    onRequireLogin={onRequireLogin}
                  />
                ))}

              {!loading && filtered.length === 0 && (
                <div className="col-span-full text-center text-slate-400 text-sm">Nenhum item encontrado.</div>
              )}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
