import React from "react";
import brand from "../data/config";

function Card({ icon, title, desc, children }) {
  return (
    <div className="rounded-3xl p-6 sm:p-7 bg-white/5 ring-1 ring-white/10 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-2xl bg-black/30 ring-1 ring-white/10 grid place-items-center">
          <span className="material-icons text-[20px] text-emerald-300">{icon}</span>
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-extrabold">{title}</h2>
          {desc ? <p className="mt-1 text-sm text-slate-300">{desc}</p> : null}
        </div>
      </div>
      {children ? <div className="mt-5">{children}</div> : null}
    </div>
  );
}

export default function ContactPage({ onGoHome }) {
  const wa = String(brand.whatsapp || "").replace(/\D/g, "");
  const waLink = wa ? `https://wa.me/${wa}?text=${encodeURIComponent("Olá! Vim pelo site Cubo Criativo 🙂")}` : "";
  const email = brand.email || "";
  const mailLink = email ? `mailto:${email}?subject=${encodeURIComponent("Contato pelo site — Cubo Criativo")}` : "";

  return (
    <main className="flex-1">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 opacity-35 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-400/20 via-sky-500/10 to-fuchsia-500/15" />

        <div className="mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14" style={{ maxWidth: "var(--container-max, 1100px)" }}>
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-extrabold bg-emerald-400 text-black ring-4 ring-emerald-400/25">
                <span className="material-icons text-[16px]">contact_support</span>
                Contato
              </p>
              <h1 className="mt-3 text-3xl sm:text-4xl font-black tracking-tight">Fale com a gente</h1>
              <p className="mt-2 text-slate-300 text-sm sm:text-base max-w-2xl">
                Suporte, dúvidas, orçamento e acompanhamento do pedido — escolha o canal que preferir.
              </p>
            </div>

            <button onClick={onGoHome} className="rounded-xl px-4 py-2 ring-1 ring-white/15 hover:bg-white/5 text-sm">
              <span className="material-icons align-middle text-[18px]">chevron_left</span> Voltar
            </button>
          </div>

          <div className="mt-10 grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Card icon="chat" title="WhatsApp" desc="Resposta mais rápida (pedidos, orçamento e dúvidas).">
                <a
                  href={waLink}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 w-full rounded-2xl px-4 py-3 bg-emerald-400 text-black font-extrabold ring-4 ring-emerald-400/25 hover:brightness-110 transition"
                >
                  <span className="material-icons text-[18px]">chat</span>
                  Abrir WhatsApp
                </a>
                <p className="mt-3 text-xs text-slate-400">Número: +{wa}</p>
              </Card>

              <Card icon="mail" title="E-mail" desc="Para comprovantes, arquivos e solicitações detalhadas.">
                <a
                  href={mailLink}
                  className="inline-flex items-center justify-center gap-2 w-full rounded-2xl px-4 py-3 ring-1 ring-white/15 hover:bg-white/5 transition font-semibold"
                >
                  <span className="material-icons text-[18px]">send</span>
                  Enviar e-mail
                </a>
                <p className="mt-3 text-xs text-slate-400 break-all">{email}</p>
              </Card>
            </div>

            <div className="rounded-3xl p-6 sm:p-7 bg-white/5 ring-1 ring-white/10 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
              <h2 className="text-lg font-extrabold">Outros canais</h2>

              <div className="mt-4 space-y-3">
                <div className="rounded-2xl p-4 bg-black/25 ring-1 ring-white/10">
                  <p className="text-xs text-slate-400">Instagram</p>
                  <p className="mt-1 text-sm font-semibold text-slate-100">{brand.insta}</p>
                </div>
                <div className="rounded-2xl p-4 bg-black/25 ring-1 ring-white/10">
                  <p className="text-xs text-slate-400">Cidade/UF</p>
                  <p className="mt-1 text-sm font-semibold text-slate-100">{brand.city}</p>
                </div>
              </div>

              <div className="mt-6 rounded-2xl p-4 bg-gradient-to-br from-emerald-400/15 via-sky-400/10 to-fuchsia-400/10 ring-1 ring-white/10">
                <p className="text-xs text-slate-300">Dica</p>
                <p className="mt-1 text-sm text-slate-100 font-semibold">
                  Para agilizar o suporte, mande o <span className="text-emerald-200">número do pedido</span> (quando tiver)
                  e uma descrição do que você precisa.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
