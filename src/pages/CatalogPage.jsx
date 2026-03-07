import React from "react";
import ProductCard from "../components/ProductCard.jsx";

function MobileFilterChips({ label, options, value, onChange, tone = "teal" }) {
  const activeTone = {
    teal: "border-teal-300/70 bg-teal-400/15 text-teal-100 shadow-[0_0_0_1px_rgba(45,212,191,0.18)]",
    slate: "border-white/20 bg-white/10 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.05)]",
    amber: "border-amber-300/60 bg-amber-400/15 text-amber-100 shadow-[0_0_0_1px_rgba(251,191,36,0.18)]",
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 backdrop-blur-sm">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">{label}</span>
        <span className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" aria-hidden="true" />
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {options.map((opt) => {
          const active = value === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => onChange(opt.key)}
              className={`shrink-0 rounded-full border px-3.5 py-2 text-xs font-medium whitespace-nowrap transition-all duration-200 ${
                active
                  ? activeTone[tone] || activeTone.teal
                  : "border-white/10 bg-slate-900/80 text-slate-300 hover:border-white/15 hover:bg-white/[0.06] hover:text-white"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

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
  const [mobileFiltersOpen, setMobileFiltersOpen] = React.useState(false);

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

  const availabilityOptions = React.useMemo(() => ([
    { key: "todas", label: "Todos" },
    { key: "pronta", label: "Pronta entrega" },
    { key: "encomenda", label: "Sob encomenda" },
  ]), []);

  const typeOptions = React.useMemo(() => ([
    { key: "todos", label: "Todos os tipos" },
    { key: "action", label: "Action Figures" },
    { key: "rpg", label: "Miniaturas RPG" },
  ]), []);

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
              {/* texto removido */}
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
              <div className="lg:hidden space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex-1 rounded-[22px] border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-2 shadow-[0_18px_40px_rgba(2,6,23,0.22)] backdrop-blur-sm">
                    <div className="flex items-center gap-3 rounded-[18px] border border-white/10 bg-slate-950/80 px-3 py-3 shadow-inner shadow-black/20">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-[18px] w-[18px] text-slate-500" aria-hidden="true">
                        <circle cx="11" cy="11" r="6.5" />
                        <path d="M16 16l4.5 4.5" strokeLinecap="round" />
                      </svg>
                      <input
                        type="search"
                        placeholder="Buscar no catálogo"
                        className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-500 outline-none"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                      {query ? (
                        <button
                          type="button"
                          onClick={() => setQuery("")}
                          className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] font-medium text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
                        >
                          Limpar
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setMobileFiltersOpen(true)}
                    className="inline-flex items-center gap-2 rounded-[22px] border border-white/10 bg-gradient-to-b from-white/[0.08] to-white/[0.03] px-4 py-3 text-sm font-medium text-white shadow-[0_18px_40px_rgba(2,6,23,0.22)] backdrop-blur-sm transition hover:border-white/15 hover:bg-white/[0.08]"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-[18px] w-[18px] text-slate-300" aria-hidden="true">
                      <path d="M4 7h8" strokeLinecap="round" />
                      <path d="M16 7h4" strokeLinecap="round" />
                      <circle cx="14" cy="7" r="2" />
                      <path d="M4 17h4" strokeLinecap="round" />
                      <path d="M12 17h8" strokeLinecap="round" />
                      <circle cx="10" cy="17" r="2" />
                    </svg>
                    Filtros
                    <span className="rounded-full border border-teal-400/20 bg-teal-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-teal-200">
                      {loading ? "…" : filtered.length}
                    </span>
                  </button>
                </div>

                {mobileFiltersOpen ? (
                  <>
                    <button
                      type="button"
                      aria-label="Fechar filtros"
                      className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-[2px]"
                      onClick={() => setMobileFiltersOpen(false)}
                    />

                    <div className="fixed inset-x-0 bottom-0 z-50 rounded-t-[32px] border border-white/10 bg-[#071019]/95 p-4 shadow-[0_-20px_80px_rgba(2,6,23,0.7)] backdrop-blur-xl">
                      <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-white/10" aria-hidden="true" />

                      <div className="mb-4 flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Filtros</p>
                          <p className="mt-1 text-sm text-slate-300">Refine o catálogo de forma rápida e elegante.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setMobileFiltersOpen(false)}
                          className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
                        >
                          Fechar
                        </button>
                      </div>

                      <div className="space-y-3 pb-[max(env(safe-area-inset-bottom),0px)]">
                        <MobileFilterChips
                          label="Disponibilidade"
                          options={availabilityOptions}
                          value={availability}
                          onChange={setAvailability}
                          tone="teal"
                        />

                        <MobileFilterChips
                          label="Tipo"
                          options={typeOptions}
                          value={type}
                          onChange={setType}
                          tone="slate"
                        />

                        {tagOptions.length > 1 ? (
                          <MobileFilterChips
                            label="Tag"
                            options={tagOptions.map((tag) => ({ key: tag, label: tag }))}
                            value={selectedTag}
                            onChange={setSelectedTag}
                            tone="amber"
                          />
                        ) : null}

                        <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3">
                          <span className="text-xs text-slate-400">{loading ? "carregando…" : `${filtered.length} item(ns) encontrados`}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setAvailability("todas");
                              setType("todos");
                              setSelectedTag("Todos");
                              setQuery("");
                            }}
                            className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
                          >
                            Limpar filtros
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                ) : null}
              </div>

              <div className="hidden lg:flex flex-wrap gap-2">
                {availabilityOptions.map((opt) => {
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

              <div className="hidden lg:flex flex-wrap gap-2">
                {typeOptions.map((opt) => {
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

              <div className="hidden lg:block w-full">
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
