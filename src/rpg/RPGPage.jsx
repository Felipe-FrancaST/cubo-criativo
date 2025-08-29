// src/rpg/RPGPage.jsx
import React from "react";
import Modal from "../components/Modal.jsx";
import { rpgUi, rpgClasses, rpgRacas, rpgItens } from "./rpgData.js";

// Formata BRL rapidinho
const fmtBRL = (n) =>
  typeof n === "number" && isFinite(n)
    ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "—";

function CardRPG({ item, onOpenGallery, onAdd }) {
  return (
    <article className="group rounded-2xl overflow-hidden bg-[#0b0f12]/80 ring-1 ring-white/10 hover:ring-amber-400/30 transition">
      <button
        type="button"
        onClick={() => onOpenGallery(item)}
        className="w-full aspect-[4/3] bg-black/30 overflow-hidden relative"
        title="Ver mais imagens"
      >
        <img
          src={item.imgs?.[0]}
          alt={item.nome}
          className="w-full h-full object-cover group-hover:scale-[1.02] transition"
          onError={(e) => {
            e.currentTarget.style.display = "none";
            e.currentTarget.parentElement.innerHTML =
              '<div class="text-slate-300 text-xs p-3 text-center">Imagem não encontrada.<br/>Coloque em <b>public/images/rpg</b>.</div>';
          }}
        />
        <span className="absolute bottom-2 right-2 text-[10px] px-2 py-0.5 rounded-full bg-black/60 ring-1 ring-white/20">
          ver fotos
        </span>
      </button>

      <div className="p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-bold tracking-tight">{item.nome}</h3>
          <span className="text-xs text-slate-400">{item.escala}</span>
        </div>
        <p className="mt-1 text-sm text-slate-400">
          {item.classe} • {item.raca}
        </p>
        <div className="mt-3 flex items-center justify-between">
          <span className="font-semibold">{fmtBRL(item.preco)}</span>
          <button
            onClick={() => onAdd(item)}
            className="rounded-lg px-3 py-1.5 bg-amber-400 text-black font-semibold ring-4 ring-amber-400/20 hover:bg-amber-300 transition"
          >
            Adicionar
          </button>
        </div>
      </div>
    </article>
  );
}

export default function RPGPage({ onClose, addToCart }) {
  // Animação de entrada
  const [entered, setEntered] = React.useState(false);
  React.useEffect(() => {
    const t = setTimeout(() => setEntered(true), 10);
    return () => clearTimeout(t);
  }, []);

  // Estado da aba (miniaturas | bosses)
  const [tab, setTab] = React.useState("miniatura");

  // Filtros
  const [classe, setClasse] = React.useState("Todos");
  const [raca, setRaca] = React.useState("Todas");
  const [q, setQ] = React.useState("");

  const itensFiltrados = React.useMemo(() => {
    const name = q.trim().toLowerCase();
    return rpgItens.filter((it) => {
      const byTab = it.tipo === tab;
      const byClasse = classe === "Todos" || it.classe === classe;
      const byRaca = raca === "Todas" || it.raca === raca;
      const byName = !name || it.nome.toLowerCase().includes(name);
      return byTab && byClasse && byRaca && byName;
    });
  }, [tab, classe, raca, q]);

  // Galeria
  const [galOpen, setGalOpen] = React.useState(false);
  const [galData, setGalData] = React.useState({ title: "", imgs: [] });
  const [galIdx, setGalIdx] = React.useState(0);

  function openGallery(item) {
    setGalData({ title: item.nome, imgs: item.imgs || [] });
    setGalIdx(0);
    setGalOpen(true);
  }

  return (
    <div
      className={`fixed inset-0 z-[70] overflow-y-auto ${
        entered ? "opacity-100" : "opacity-0"
      } transition-opacity duration-500`}
      style={{
        // fundo "temático"
        background:
          "radial-gradient(1200px 600px at 20% -10%, rgba(255,196,0,0.15), transparent), radial-gradient(1200px 600px at 120% 30%, rgba(120,200,255,0.1), transparent), #0a0f14",
      }}
    >
      {/* header do modo rpg */}
      <div className="sticky top-0 z-10 backdrop-blur bg-[#0b0f12]/70 border-b border-white/10">
        <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between" style={{ maxWidth: 1200 }}>
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold">
              <span className="text-amber-400">{rpgUi.title}</span>{" "}
              <span className="text-slate-300">/ Modo Imersivo</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">{rpgUi.subtitle}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full px-4 py-2 ring-1 ring-white/15 hover:bg-white/5 text-sm"
          >
            {rpgUi.ctaBack}
          </button>
        </div>
      </div>

      {/* conteúdo */}
      <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 py-6" style={{ maxWidth: 1200 }}>
        {/* Tabs */}
        <div className="flex items-center gap-2">
          {[
            { id: "miniatura", label: "Miniaturas" },
            { id: "boss", label: "Bosses" },
          ].map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`relative rounded-full px-4 py-2 text-sm ring-1 ring-white/10 transition ${
                  active
                    ? "bg-amber-400 text-black font-bold"
                    : "bg-[#0b0f12]/70 hover:bg-white/5"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Filtros */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <select
            value={classe}
            onChange={(e) => setClasse(e.target.value)}
            className="rounded-lg bg-[#0b0f12]/70 ring-1 ring-white/10 px-3 py-2 text-sm"
          >
            {rpgClasses.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={raca}
            onChange={(e) => setRaca(e.target.value)}
            className="rounded-lg bg-[#0b0f12]/70 ring-1 ring-white/10 px-3 py-2 text-sm"
          >
            {rpgRacas.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>

          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nome…"
            className="rounded-lg bg-[#0b0f12]/70 ring-1 ring-white/10 px-3 py-2 text-sm placeholder:text-slate-500"
          />
        </div>

        {/* Grid */}
        <div
          className={`mt-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 transform transition duration-500 ${
            entered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          {itensFiltrados.map((item) => (
            <CardRPG
              key={item.id}
              item={item}
              onOpenGallery={openGallery}
              onAdd={(it) =>
                addToCart?.(
                  // “compra” simulada usando a mesma estrutura do seu carrinho
                  { id: it.id, nome: it.nome, img: it.imgs?.[0] || "", status: "catalogo" },
                  { escala: it.escala || "", unitPrice: it.preco || 0 }
                )
              }
            />
          ))}

          {itensFiltrados.length === 0 && (
            <div className="col-span-full text-slate-400 text-sm">
              Nenhum item encontrado com os filtros atuais.
            </div>
          )}
        </div>
      </div>

      {/* Modal de Galeria */}
      <Modal
        open={galOpen}
        onClose={() => setGalOpen(false)}
        title={`Galeria — ${galData.title}`}
      >
        {galOpen && (
          <div>
            <div className="grid place-items-center rounded-xl ring-1 ring-white/10 bg-[#0b0f12]/70 p-2">
              <img
                src={galData.imgs[galIdx]}
                alt={galData.title}
                className="max-h-[70vh] w-auto object-contain rounded-md"
              />
            </div>

            {galData.imgs.length > 1 && (
              <div className="mt-3 grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 gap-2">
                {galData.imgs.map((src, i) => {
                  const active = i === galIdx;
                  return (
                    <button
                      key={i}
                      onClick={() => setGalIdx(i)}
                      className={`rounded-lg overflow-hidden ring-1 ${
                        active ? "ring-amber-400" : "ring-white/10 hover:ring-white/20"
                      }`}
                    >
                      <img src={src} alt={`thumb ${i + 1}`} className="h-16 w-full object-cover" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
