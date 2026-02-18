import React from "react";
import ProductCard from "../components/ProductCard.jsx";

export default function CatalogPage({ items, loading = false, error = "", addToCart, buyNow, openViewer, openGallery }) {
  const allTags = React.useMemo(() => {
    const set = new Set();
    items.forEach((p) => (p.tags || []).forEach((t) => set.add(t)));
    return ["Todos", ...Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"))];
  }, [items]);

  const [selectedTag, setSelectedTag] = React.useState("Todos");
  const [query, setQuery] = React.useState("");

  React.useEffect(() => {
    // reset filtro quando lista mudar
    setSelectedTag("Todos");
    setQuery("");
  }, [items]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((p) => {
      const matchTag = selectedTag === "Todos" || (p.tags || []).includes(selectedTag);
      const matchName = q === "" || String(p.nome || "").toLowerCase().includes(q);
      return matchTag && matchName;
    });
  }, [items, selectedTag, query]);

  return (
    <main className="flex-1">
      <section
        className="mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14"
        style={{ maxWidth: "var(--container-max, 1200px)" }}
      >
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold">Catálogo</h1>
            <p className="mt-1 text-sm text-slate-400">Modelos sob encomenda / sob consulta.</p>
          </div>
          <span className="text-xs sm:text-sm text-slate-400">
            {loading ? "carregando…" : `${filtered.length} modelo(s)`}
          </span>
        </div>

        {error ? (
          <div className="mt-6 rounded-2xl p-4 ring-1 ring-rose-400/30 bg-rose-500/10 text-rose-100 text-sm">
            Não foi possível carregar os produtos. {error}
          </div>
        ) : (
          <>
            {/* Filtros */}
            <div className="mt-6 flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
              <div className="flex-1 overflow-x-auto">
                <div className="flex gap-2 min-w-max">
                  {allTags.map((tag) => {
                    const active = selectedTag === tag;
                    return (
                      <button
                        key={tag}
                        onClick={() => setSelectedTag(tag)}
                        className={`px-3 py-1 rounded-full text-sm whitespace-nowrap ring-1 ring-white/10 ${
                          active ? "bg-teal-400 text-black font-semibold" : "bg-slate-800/60 hover:bg-white/5"
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="w-full lg:w-80">
                <input
                  type="search"
                  placeholder="Buscar por nome…"
                  className="w-full rounded-lg bg-slate-800/60 ring-1 ring-white/10 px-3 py-2 text-sm placeholder:text-slate-400 outline-none"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 justify-items-center">
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
                    openViewer={openViewer}
                    openGallery={openGallery}
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
