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
              <div className="lg:hidden space-y-3 rounded-[28px] border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-3 shadow-[0_20px_60px_rgba(2,6,23,0.28)] backdrop-blur-sm">
                <div className="flex items-center justify-between gap-3 px-1">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Filtrar catálogo</p>
                    <p className="mt-1 text-xs text-slate-500">Escolha disponibilidade, tipo e encontre a peça ideal.</p>
                  </div>
                  <div className="rounded-full border border-white/10 bg-slate-950/80 px-3 py-1 text-[11px] font-medium text-slate-300">
                    {loading ? "…" : `${filtered.length} itens`}
                  </div>
                </div>

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

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 backdrop-blur-sm">
                  <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Buscar</label>
                  <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-3 shadow-inner shadow-black/20">
                    <span className="material-symbols-outlined text-[18px] text-slate-500" aria-hidden="true">search</span>
                    <input
                      type="search"
                      placeholder="Nome, tag ou descrição"
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
                <div className="lg:hidden rounded-[26px] border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-3 shadow-[0_20px_60px_rgba(2,6,23,0.22)] backdrop-blur-sm">
                  <MobileFilterChips
                    label="Tag"
                    options={tagOptions.map((tag) => ({ key: tag, label: tag }))}
                    value={selectedTag}
                    onChange={setSelectedTag}
                    tone="amber"
                  />
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
