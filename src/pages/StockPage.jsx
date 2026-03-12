import React from "react";
import ProductCard from "../components/ProductCard.jsx";

export default function StockPage({ items, loading = false, error = "", addToCart, buyNow, openGallery , onRequireLogin}) {
  const [q, setQ] = React.useState(() => {
    if (typeof window === "undefined") return "";
    try {
      return String(new URLSearchParams(window.location.search || "").get("q") || "");
    } catch {
      return "";
    }
  });

  const filtered = React.useMemo(() => {
    const query = String(q || "").trim().toLowerCase();
    if (!query) return items;
    return (items || []).filter((p) => {
      const name = String(p?.nome || "").toLowerCase();
      const desc = String(p?.descricao || "").toLowerCase();
      const tags = Array.isArray(p?.tags) ? p.tags.map((t) => String(t).toLowerCase()).join(" ") : "";
      return name.includes(query) || desc.includes(query) || tags.includes(query);
    });
  }, [items, q]);

  // Deep link: /estoque?product=<id>&open=1
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search || "");
    const pid = sp.get("product");
    if (!pid) return;
    if (loading) return;

    const prod = items.find((p) => String(p.id) === String(pid));
    if (!prod) return;

    // Scroll até o card
    const el = document.getElementById(`product-${pid}`);
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 92;
      window.scrollTo({ top, behavior: "smooth" });
    }

    // Abre o produto (galeria) se solicitado
    if (sp.get("open") === "1") {
      // pequeno atraso para garantir render
      setTimeout(() => openGallery?.(prod), 250);
    }

    // limpa os params de deep-link para não reabrir ao voltar/atualizar
    try {
      const keptQ = sp.get("q");
      window.history.replaceState({}, "", keptQ ? `/estoque?q=${encodeURIComponent(keptQ)}` : "/estoque");
    } catch {
      // ignore
    }
  }, [loading, items, openGallery]);

  return (
    <main className="flex-1">
      <section
        className="container-cc px-4 sm:px-6 lg:px-8 py-10 sm:py-14" >
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold">Pronta entrega</h1>
            <p className="mt-1 text-sm text-slate-400">Action figures e miniaturas colecionáveis prontas para envio.</p>
          </div>
          <span className="text-xs sm:text-sm text-slate-400">
            {loading ? "carregando…" : (q ? `${filtered.length} de ${items.length}` : `${items.length} item(ns)`) }
          </span>
        </div>

        <div className="mt-5">
          <label className="block text-xs font-semibold text-slate-300" htmlFor="stock-search">Pesquisar</label>
          <div className="mt-2 flex gap-2">
            <input
              id="stock-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ex: miniatura rpg, action figure, dragão…"
              className="container-cc w-full rounded-xl px-4 py-3 bg-slate-950/60 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-teal-400 text-slate-100 placeholder:text-slate-500"
              inputMode="search"
              autoComplete="off"
            />
            {q && (
              <button
                type="button"
                onClick={() => setQ("")}
                className="container-cc shrink-0 rounded-xl px-4 py-3 ring-1 ring-white/15 hover:bg-white/4"
              >
                Limpar
              </button>
            )}
          </div>
        </div>

        {error ? (
          <div className="mt-6 rounded-2xl p-4 ring-1 ring-rose-400/30 bg-rose-500/10 text-rose-100 text-sm">
            Não foi possível carregar os produtos. {error}
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {loading &&
              Array.from({ length: 8 }).map((_, idx) => (
                <div
                  key={idx}
                  className="w-full max-w-[320px] rounded-2xl overflow-hidden ring-1 ring-white/10 bg-[#07161d]/60"
                >
                  <div className="aspect-[4/5] bg-[#0c2430]/68 animate-pulse" />
                  <div className="p-4">
                    <div className="h-4 bg-[#0c2430]/68 rounded animate-pulse" />
                    <div className="mt-3 h-9 bg-[#0c2430]/68 rounded animate-pulse" />
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <div className="h-10 bg-[#0c2430]/68 rounded animate-pulse" />
                      <div className="h-10 bg-[#0c2430]/68 rounded animate-pulse" />
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
              <div className="col-span-full text-center text-slate-400 text-sm">
                {q ? "Nenhum resultado para a sua busca." : "Nenhum item em estoque no momento."}
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
