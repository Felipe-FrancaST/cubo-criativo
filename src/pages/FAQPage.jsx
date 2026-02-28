import React from 'react';

const faqs = [
  {
    q: 'Qual é o prazo de produção?',
    a: 'Peças em estoque são enviadas mais rápido. Peças sob encomenda costumam levar de 3 a 7 dias úteis de produção, variando por tamanho, acabamento e fila atual.',
  },
  {
    q: 'Vocês enviam para todo o Brasil?',
    a: 'Sim. Enviamos com embalagem reforçada e rastreio. O prazo de entrega depende da transportadora/Correios e do CEP.',
  },
  {
    q: 'As peças são frágeis?',
    a: 'Miniaturas em resina exigem cuidado no manuseio, especialmente partes finas. A embalagem é preparada para transporte, mas recomendamos abrir com cuidado.',
  },
  {
    q: 'Posso pedir orçamento personalizado?',
    a: 'Sim. Você pode falar pelo WhatsApp para orçamento, personalização, escala e pintura.',
  },
  {
    q: 'Quais formas de pagamento vocês aceitam?',
    a: 'Pagamento pelo checkout do site (Mercado Pago) e também atendimento para finalização via WhatsApp.',
  },
  {
    q: 'Como acompanho meu pedido?',
    a: 'Você pode acompanhar pela área de pedidos da sua conta e também tirar dúvidas pelo WhatsApp informando o número do pedido.',
  },
];

export default function FAQPage({ onGoHome }) {
  return (
    <main className="flex-1">
      <section className="container-cc px-4 sm:px-6 lg:px-8 py-10 sm:py-14" >
        <div className="flex items-start sm:items-end justify-between gap-4 flex-col sm:flex-row">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-extrabold bg-emerald-400 text-black ring-4 ring-emerald-400/25">
              <span className="material-icons text-[16px]">help</span>
              FAQ
            </p>
            <h1 className="mt-3 text-3xl sm:text-4xl font-black tracking-tight">Perguntas frequentes</h1>
            <p className="mt-2 text-slate-300 text-sm sm:text-base max-w-2xl">Respostas rápidas sobre prazos, envio, pagamento e cuidados com as peças.</p>
          </div>
          <button onClick={onGoHome} className="container-cc rounded-xl px-4 py-2 ring-1 ring-white/15 hover:bg-white/5 text-sm">
            <span className="material-icons align-middle text-[18px]">chevron_left</span> Voltar
          </button>
        </div>

        <div className="mt-8 space-y-4">
          {faqs.map((item) => (
            <details key={item.q} className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-5 open:bg-white/[0.07]">
              <summary className="cursor-pointer font-bold text-slate-100">{item.q}</summary>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">{item.a}</p>
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}
