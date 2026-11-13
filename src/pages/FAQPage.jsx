import React from 'react'

const faqs = [
  { category: 'Pedidos', q: 'Como solicito cancelamento ou devolução?', a: 'Fale pelo e-mail ou WhatsApp oficial, informando o pedido. Em compras pela internet, o arrependimento pode ser comunicado em até 7 dias corridos do recebimento. Consulte a página Trocas e devoluções para detalhes, inclusive sobre defeitos.' },
  { category: 'VIP', q: 'O plano VIP renova automaticamente?', a: 'Nesta versão, a renovação é iniciada por você na Área VIP e depende de um novo pagamento. Confira o ciclo, as peças e o valor antes de renovar.' },
  { category: 'Produção', q: 'Qual é o prazo de produção?', a: 'Peças em estoque são enviadas mais rápido. Peças sob encomenda costumam levar de 15 a 30 dias úteis de produção, variando por tamanho, acabamento e fila atual.' },
  { category: 'Envio', q: 'Vocês enviam para todo o Brasil?', a: 'Sim. Enviamos com embalagem reforçada e rastreio. O prazo de entrega depende da transportadora e do CEP.' },
  { category: 'Produção', q: 'As peças são frágeis?', a: 'Miniaturas em resina exigem cuidado no manuseio, especialmente partes finas. A embalagem é preparada para transporte, mas recomendamos abrir com cuidado.' },
  { category: 'Produção', q: 'Posso pedir orçamento personalizado?', a: 'Sim. Você pode falar pelo WhatsApp para orçamento, personalização, escala e pintura.' },
  { category: 'Pagamento', q: 'Quais formas de pagamento vocês aceitam?', a: 'Pagamento pelo checkout do site (Pix ou Cartão) e também atendimento para finalização via WhatsApp.' },
  { category: 'Pedidos', q: 'Como acompanho meu pedido?', a: 'Você pode acompanhar pela área de pedidos da sua conta e também tirar dúvidas pelo WhatsApp informando o número do pedido.' },
]
const categories = ['Todas', 'Pedidos', 'Produção', 'Envio', 'Pagamento', 'VIP']
function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

export default function FAQPage({ onGoHome }) {
  const [category, setCategory] = React.useState('Todas')
  const [query, setQuery] = React.useState('')
  const search = normalize(query.trim())
  const visible = faqs.filter((item) => (category === 'Todas' || item.category === category) && (!search || normalize(`${item.q} ${item.a}`).includes(search)))
  return (
    <main className="editorial-page editorial-faq flex-1">
      <section className="container-cc editorial-container">
        <header className="editorial-page-hero"><div className="editorial-page-hero-copy"><p className="editorial-kicker"><span className="editorial-dot"/> CENTRAL DE AJUDA</p><h1>Perguntas frequentes</h1><p>Encontre respostas sobre compras, prazos, envio e cuidados com suas peças.</p></div><span className="editorial-page-hero-icon material-icons" aria-hidden="true">help_outline</span></header>
        <div className="editorial-faq-layout">
          <div className="editorial-faq-main">
            <div className="editorial-faq-search"><span className="material-icons" aria-hidden="true">search</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Buscar nas perguntas frequentes" placeholder="O que você precisa saber?"/>{query && <button type="button" onClick={() => setQuery('')} aria-label="Limpar busca"><span className="material-icons" aria-hidden="true">close</span></button>}</div>
            <div className="editorial-faq-categories" role="group" aria-label="Filtrar perguntas por assunto">{categories.map((item) => <button key={item} type="button" className="editorial-filter-chip" aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}</div>
            <p className="editorial-faq-count">{visible.length} {visible.length === 1 ? 'resposta encontrada' : 'respostas encontradas'}</p>
            <div className="editorial-faq-questions">{visible.map((item) => <details key={item.q} className="editorial-faq-item"><summary><span><small>{item.category}</small><strong>{item.q}</strong></span><span className="material-icons editorial-faq-chevron" aria-hidden="true">expand_more</span></summary><div className="editorial-faq-answer"><p>{item.a}</p></div></details>)}</div>
            {!visible.length && <div className="editorial-empty"><strong>Nenhuma pergunta encontrada.</strong><p>Tente outro termo ou veja todas as categorias.</p><button type="button" className="editorial-text-action" onClick={() => { setQuery(''); setCategory('Todas') }}>Mostrar todas</button></div>}
          </div>
          <aside className="editorial-faq-aside"><span className="material-icons" aria-hidden="true">support_agent</span><h2>Não encontrou a resposta?</h2><p>Consulte nossas políticas ou entre em contato pelos canais oficiais informados no site.</p><button type="button" className="editorial-button editorial-button-secondary" onClick={onGoHome}>Voltar à loja <span className="material-icons" aria-hidden="true">arrow_forward</span></button></aside>
        </div>
      </section>
    </main>
  )
}
