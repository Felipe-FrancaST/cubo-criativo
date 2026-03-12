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

function FilterChip({ active, children, onClick, tone = "default" }) {
  const activeClass = tone === "accent"
    ? "bg-amber-400 text-black ring-amber-300/40"
    : "bg-white/10 text-white ring-white/15";
  return (
    <button type="button" onClick={onClick} className={`rounded-full px-3 py-2 text-sm font-medium ring-1 transition ${active ? activeClass : "bg-slate-900/60 text-slate-200 ring-white/10 hover:bg-white/5"}`}>
      {children}
    </button>
  );
}

export default function CatalogPage({ items, loading = false, error = "", addToCart, buyNow, openGallery, onRequireLogin }) {
  const [type, setType] = React.useState(() => readParam("tipo", "todos"));
  const [selectedTag, setSelectedTag] = React.useState(() => readParam("tag", "Todos"));
  const [query, setQuery] = React.useState(() => readParam("q", ""));
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [helpOpen, setHelpOpen] = React.useState(false);

  React.useEffect(() => {
    const onPop = () => {
      setType(readParam("tipo", "todos"));
      setQuery(readParam("q", ""));
      setSelectedTag(readParam("tag", "Todos"));
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);


  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const params = new URLSearchParams(window.location.search || "");
      if (type && type !== "todos") params.set("tipo", type); else params.delete("tipo");
      if (query.trim()) params.set("q", query.trim()); else params.delete("q");
      if (selectedTag && selectedTag !== "Todos") params.set("tag", selectedTag); else params.delete("tag");
      const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
      window.history.replaceState({}, "", next);
    } catch {}
  }, [type, query, selectedTag]);

  const tagOptions = React.useMemo(() => {
    const set = new Set();
    const isInternal = (t) => {
      const s = String(t || "").toLowerCase().trim();
      if (!s) return true;
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
      const t = String(p?._typeLabel || "").toLowerCase();
      const matchType = type === "todos" || (type === "action" && t.includes("action")) || (type === "rpg" && t.includes("rpg"));
      const matchTag = selectedTag === "Todos" || (p.tags || []).includes(selectedTag);
      const name = String(p?.nome || "").toLowerCase();
      const desc = String(p?.descricao || "").toLowerCase();
      const tags = Array.isArray(p?.tags) ? p.tags.map((t) => String(t).toLowerCase()).join(" ") : "";
      const matchQuery = !q || name.includes(q) || desc.includes(q) || tags.includes(q);
      return matchType && matchTag && matchQuery;
    });
  }, [items, type, selectedTag, query]);

  const activeFilterCount = (type !== "todos" ? 1 : 0) + (selectedTag !== "Todos" ? 1 : 0);
  function clearFilters() {
    setType("todos");
    setSelectedTag("Todos");
  }

  const helpContent = [
    "Você escolhe a peça pelo catálogo e pode finalizar no site ou tirar dúvidas no WhatsApp.",
    "As peças do catálogo entram em produção no estúdio após a confirmação do pedido.",
    "O prazo médio é de 15–30 dias úteis, variando conforme acabamento, pintura e fila de produção.",
  ];

  return (
    <main className="flex-1">
      <section className="container-cc px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold">Catálogo</h1>
            <p className="mt-1 text-sm text-slate-400">Peças produzidas sob encomenda e modelos do catálogo para escolher com calma.</p>
          </div>
          <span className="text-xs sm:text-sm text-slate-400">{loading ? "carregando…" : `${filtered.length} item(ns)`}</span>
        </div>

        {error ? (
          <div className="mt-6 rounded-2xl p-4 ring-1 ring-rose-400/30 bg-rose-500/10 text-rose-100 text-sm">
            Não foi possível carregar os produtos. {error}
          </div>
        ) : (
          <>
            <div className="mt-6 rounded-[24px] border border-white/10 bg-white/[0.045] px-4 py-3 shadow-lg shadow-black/10 backdrop-blur-xl">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-100">Como funciona, prazos e dúvidas?</p>
                  <p className="text-xs text-slate-400">Toque na lâmpada para ver as orientações do catálogo.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setHelpOpen((v) => !v)}
                  className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl ring-1 transition ${helpOpen ? "bg-amber-400/15 text-amber-200 ring-amber-300/35" : "bg-white/5 text-slate-100 ring-white/10 hover:bg-white/10"}`}
                  aria-expanded={helpOpen}
                  aria-label="Mostrar ajuda do catálogo"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.8">
                    <path d="M9 18h6" strokeLinecap="round" />
                    <path d="M10 22h4" strokeLinecap="round" />
                    <path d="M12 2a7 7 0 0 0-4 12.75c.63.44 1 1.15 1 1.92V17h6v-.33c0-.77.37-1.48 1-1.92A7 7 0 0 0 12 2Z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>

              {helpOpen ? (
                <div className="mt-3 rounded-2xl bg-slate-950/55 px-4 py-4 ring-1 ring-white/10">
                  <ul className="space-y-2 text-sm text-slate-300">
                    {helpContent.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>

            <div className="mt-4 rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.9),rgba(2,6,23,.86))] p-3 sm:p-4 shadow-xl shadow-black/20 backdrop-blur-xl">
              <div className="flex items-center gap-2 sm:gap-3">
                <label className="relative flex-1">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.8">
                      <circle cx="11" cy="11" r="7" />
                      <path d="m20 20-3.5-3.5" strokeLinecap="round" />
                    </svg>
                  </span>
                  <input type="search" placeholder="Buscar por nome, tag ou descrição…" className="w-full rounded-2xl bg-slate-950/55 pl-11 pr-11 py-3 text-sm text-slate-100 placeholder:text-slate-500 ring-1 ring-white/10 outline-none focus:ring-teal-400/60" value={query} onChange={(e) => setQuery(e.target.value)} />
                  {query ? (
                    <button type="button" onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl p-2 text-slate-300 hover:bg-white/5" aria-label="Limpar busca">
                      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="2">
                        <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
                      </svg>
                    </button>
                  ) : null}
                </label>

                <button type="button" onClick={() => setFiltersOpen(true)} className="inline-flex lg:hidden items-center justify-center gap-2 rounded-2xl bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 ring-1 ring-white/10 hover:bg-white/8">
                  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.8">
                    <path d="M4 7h16M7 12h10M10 17h4" strokeLinecap="round" />
                  </svg>
                  <span>Filtros{activeFilterCount ? ` (${activeFilterCount})` : ""}</span>
                </button>
              </div>

              <div className="mt-4 hidden lg:block space-y-4">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Tipo</p>
                  <div className="flex flex-wrap gap-2">
                    <FilterChip active={type === "todos"} onClick={() => setType("todos")}>Todos os tipos</FilterChip>
                    <FilterChip active={type === "action"} onClick={() => setType("action")}>Action Figures</FilterChip>
                    <FilterChip active={type === "rpg"} onClick={() => setType("rpg")}>Miniaturas RPG</FilterChip>
                  </div>
                </div>

                {tagOptions.length > 1 ? (
                  <div>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Tags</p>
                      {activeFilterCount ? <button type="button" onClick={clearFilters} className="text-xs font-semibold text-slate-300 hover:text-white">Limpar filtros</button> : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {tagOptions.map((tag) => (
                        <FilterChip key={tag} tone="accent" active={selectedTag === tag} onClick={() => setSelectedTag(tag)}>
                          {tag}
                        </FilterChip>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>


            {filtersOpen ? (
              <div className="lg:hidden fixed inset-0 z-[120]">
                <button type="button" className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" onClick={() => setFiltersOpen(false)} aria-label="Fechar filtros" />
                <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.98),rgba(2,6,23,.98))] p-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)] shadow-2xl shadow-black/40">
                  <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-white/15" />
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-base font-bold text-slate-100">Filtros do catálogo</p>
                      <p className="text-xs text-slate-400">Refine a vitrine sem ocupar espaço da tela.</p>
                    </div>
                    <button type="button" onClick={() => setFiltersOpen(false)} className="rounded-xl p-2 ring-1 ring-white/10 hover:bg-white/5" aria-label="Fechar">
                      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="2">
                        <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>

                  <div className="mt-5 space-y-5 pb-2">
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Tipo</p>
                      <div className="flex flex-wrap gap-2">
                        <FilterChip active={type === "todos"} onClick={() => setType("todos")}>Todos os tipos</FilterChip>
                        <FilterChip active={type === "action"} onClick={() => setType("action")}>Action Figures</FilterChip>
                        <FilterChip active={type === "rpg"} onClick={() => setType("rpg")}>Miniaturas RPG</FilterChip>
                      </div>
                    </div>

                    {tagOptions.length > 1 ? (
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Tag</p>
                        <div className="flex flex-wrap gap-2 max-h-52 overflow-y-auto pr-1">
                          {tagOptions.map((tag) => (
                            <FilterChip key={tag} tone="accent" active={selectedTag === tag} onClick={() => setSelectedTag(tag)}>
                              {tag}
                            </FilterChip>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-6 grid grid-cols-2 gap-3">
                    <button type="button" onClick={clearFilters} className="rounded-2xl px-4 py-3 font-semibold ring-1 ring-white/10 hover:bg-white/5">Limpar</button>
                    <button type="button" onClick={() => setFiltersOpen(false)} className="rounded-2xl bg-indigo-400 px-4 py-3 font-semibold text-black ring-1 ring-indigo-300/40 hover:bg-indigo-300">Ver resultados</button>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
              {loading && Array.from({ length: 12 }).map((_, idx) => (
                <div key={idx} className="w-full max-w-[320px] rounded-2xl overflow-hidden ring-1 ring-white/10 bg-slate-900/60">
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

              {!loading && filtered.map((p) => (
                <ProductCard key={p.id} p={p} addToCart={addToCart} buyNow={buyNow} openGallery={openGallery} onRequireLogin={onRequireLogin} />
              ))}

              {!loading && filtered.length === 0 && <div className="col-span-full text-center text-slate-400 text-sm">Nenhum item encontrado.</div>}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
