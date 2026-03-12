import React from "react";

export default function SobrePage({ onGoHome }) {
  return (
    <main className="flex-1">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 opacity-35 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-400/20 via-sky-500/10 to-fuchsia-500/15" />

        <div
          className="container-cc px-4 sm:px-6 lg:px-8 py-10 sm:py-14" >
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-extrabold bg-emerald-400 text-black ring-4 ring-emerald-400/25">
                <span className="material-icons text-[16px]">groups</span>
                Sobre nós
              </p>
              <h1 className="mt-3 text-3xl sm:text-4xl font-black tracking-tight">
                Cubo Criativo
              </h1>
              <p className="mt-2 text-slate-300 text-sm sm:text-base max-w-2xl">
                Fundada em <b>março de 2025</b>, a Cubo Criativo nasceu para transformar ideias em peças
                com presença — da vitrine ao colecionável, sempre com acabamento e cuidado em cada detalhe.
              </p>
            </div>

            <button
              onClick={onGoHome}
              className="container-cc rounded-xl px-4 py-2 ring-1 ring-white/15 hover:bg-white/4 text-sm"
            >
              <span className="material-icons align-middle text-[18px]">chevron_left</span> Voltar
            </button>
          </div>

          <div className="mt-10 grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 rounded-3xl p-6 sm:p-7 bg-white/4 ring-1 ring-white/10 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
              <h2 className="text-lg font-extrabold">Nossa missão</h2>
              <p className="mt-2 text-slate-300 text-sm leading-relaxed">
                Criar miniaturas e peças decorativas que chamam atenção de verdade — com opções de escala,
                fotos detalhadas, produção cuidadosa e comunicação transparente do pedido ao envio.
              </p>

              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-2xl p-4 bg-black/25 ring-1 ring-white/10">
                  <p className="text-xs text-slate-400">O que fazemos</p>
                  <p className="mt-1 text-sm font-semibold text-slate-100">
                    Peças de catálogo, promoções e modelos RPG sob demanda.
                  </p>
                </div>
                <div className="rounded-2xl p-4 bg-black/25 ring-1 ring-white/10">
                  <p className="text-xs text-slate-400">Como trabalhamos</p>
                  <p className="mt-1 text-sm font-semibold text-slate-100">
                    Produção organizada por status, com foco em qualidade e prazos.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl p-6 sm:p-7 bg-white/4 ring-1 ring-white/10 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
              <h2 className="text-lg font-extrabold">Fundadores</h2>
              <ul className="mt-3 space-y-2 text-sm text-slate-200">
                <li className="flex items-start gap-2">
                  <span className="material-icons text-[18px] text-emerald-300">verified</span>
                  <span>Felipe França Alves</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="material-icons text-[18px] text-emerald-300">verified</span>
                  <span>Adriele Lira de Jesus</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="material-icons text-[18px] text-emerald-300">verified</span>
                  <span>Luis Gustavo Silva Soares</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="material-icons text-[18px] text-emerald-300">verified</span>
                  <span>Tainara Arcanjo Guimarães</span>
                </li>
              </ul>

              <div className="mt-6 rounded-2xl p-4 bg-gradient-to-br from-emerald-400/15 via-sky-400/10 to-fuchsia-400/10 ring-1 ring-white/10">
                <p className="text-xs text-slate-300">Desde</p>
                <p className="mt-1 text-2xl font-black tracking-tight text-white">Março 2025</p>
                <p className="mt-2 text-xs text-slate-300">
                  Obrigado por apoiar um projeto independente — cada pedido ajuda a gente a evoluir.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
