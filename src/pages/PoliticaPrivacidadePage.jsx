import React from 'react';

export default function PoliticaPrivacidadePage({ onGoHome }) {
  return (
    <main className="flex-1">
      <section className="container-cc px-4 sm:px-6 lg:px-8 py-10 sm:py-14" >
        <div className="flex items-start sm:items-end justify-between gap-4 flex-col sm:flex-row">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Política de Privacidade</h1>
            <p className="mt-2 text-slate-300 text-sm">Última atualização: fevereiro de 2026.</p>
          </div>
          <button onClick={onGoHome} className="container-cc rounded-xl px-4 py-2 ring-1 ring-white/15 hover:bg-white/5 text-sm">Voltar</button>
        </div>
        <div className="mt-8 space-y-5 text-sm leading-relaxed text-slate-300">
          <div className="rounded-2xl p-5 bg-white/5 ring-1 ring-white/10">
            <p>Coletamos dados necessários para cadastro, pagamento, envio e suporte (como nome, telefone, endereço, CPF e dados do pedido). Usamos essas informações para processar compras, prevenção a fraude, atendimento e cumprimento de obrigações legais.</p>
          </div>
          <div className="rounded-2xl p-5 bg-white/5 ring-1 ring-white/10">
            <h2 className="font-bold text-slate-100">Compartilhamento</h2>
            <p className="mt-2">Os dados podem ser compartilhados com provedores de pagamento, hospedagem e logística quando necessário para concluir a compra e entregar o pedido.</p>
          </div>
          <div className="rounded-2xl p-5 bg-white/5 ring-1 ring-white/10">
            <h2 className="font-bold text-slate-100">Seus direitos</h2>
            <p className="mt-2">Você pode solicitar correção, atualização ou exclusão de dados, respeitando obrigações legais e fiscais de retenção. Para isso, entre em contato pelos canais exibidos na página de contato.</p>
          </div>
          <div className="rounded-2xl p-5 bg-white/5 ring-1 ring-white/10">
            <h2 className="font-bold text-slate-100">Segurança</h2>
            <p className="mt-2">Adotamos medidas de segurança compatíveis com a operação da loja. Ainda assim, nenhum sistema é 100% infalível.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
