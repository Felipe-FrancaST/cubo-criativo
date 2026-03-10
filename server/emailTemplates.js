/**
 * Email templates (Resend) - Cubo Criativo
 * - Emails bonitos e compatíveis (CSS inline)
 * - 2 tipos: email de controle (para você) e email para o cliente
 */

const TZ = process.env.APP_TIMEZONE || "America/Bahia";

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function formatDateTimeBR(dateInput) {
  try {
    const d = dateInput ? new Date(dateInput) : new Date();
    const dt = new Intl.DateTimeFormat("pt-BR", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
    // Ex: 17/02/2026 10:22
    const [date, time] = dt.split(" ");
    return { date, time: time || "" };
  } catch {
    return { date: "", time: "" };
  }
}

function fmtBRL(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return x.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function renderLayout({ title, preheader, brandName, contentHtml, footerNote }) {
  const safeTitle = esc(title);
  const safeBrand = esc(brandName || "Cubo Criativo");
  const safePre = esc(preheader || "");

  // CSS inline para compatibilidade com email clients
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width" />
    <title>${safeTitle}</title>
  </head>
  <body style="margin:0;padding:0;background:#0b1020;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${safePre}</div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b1020;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="width:100%;max-width:640px;background:#0f172a;border:1px solid rgba(255,255,255,.08);border-radius:18px;overflow:hidden;">
            <tr>
              <td style="padding:22px 22px 12px;">
                <div style="display:flex;align-items:center;gap:12px;">
                  <div style="width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,#22c55e,#06b6d4);box-shadow:0 10px 30px rgba(6,182,212,.15);"></div>
                  <div>
                    <div style="font-size:14px;letter-spacing:.14em;text-transform:uppercase;color:#94a3b8;">${safeBrand}</div>
                    <div style="font-size:22px;font-weight:800;color:#e2e8f0;margin-top:2px;">${safeTitle}</div>
                  </div>
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding:0 22px 18px;">
                <div style="height:1px;background:rgba(255,255,255,.08);"></div>
              </td>
            </tr>

            <tr>
              <td style="padding:0 22px 22px;">
                ${contentHtml}
              </td>
            </tr>

            <tr>
              <td style="padding:16px 22px;background:rgba(255,255,255,.03);border-top:1px solid rgba(255,255,255,.08);">
                <div style="font-size:12px;line-height:1.5;color:#94a3b8;">
                  ${esc(footerNote || "Mensagem automática para controle de pedidos.")}
                </div>
              </td>
            </tr>
          </table>

          <div style="max-width:640px;margin-top:14px;font-size:11px;color:#64748b;line-height:1.4;">
            Dica: se as imagens não aparecerem, verifique se o seu provedor bloqueia conteúdo remoto por padrão.
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function renderItemsTable(items) {
  const rows = (Array.isArray(items) ? items : []).map((it) => {
    const name = esc(it?.name || it?.nome || "Item");
    const qty = Number(it?.qty ?? it?.quantity ?? 1) || 1;
    const unit = Number(it?.unit_price ?? it?.price ?? 0) || 0;
    const total = unit * qty;
    const img = it?.img ? String(it.img) : "";
    const scale = it?.scale ? ` <span style="color:#94a3b8;">(Escala: ${esc(it.scale)})</span>` : "";

    const imgCell = img
      ? `<img src="${esc(img)}" alt="${name}" width="44" height="44" style="display:block;width:44px;height:44px;border-radius:10px;object-fit:cover;border:1px solid rgba(255,255,255,.12);background:#0b1020;" />`
      : `<div style="width:44px;height:44px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:#0b1020;"></div>`;

    return `
      <tr>
        <td style="padding:10px 8px;border-bottom:1px solid rgba(255,255,255,.08);">${imgCell}</td>
        <td style="padding:10px 8px;border-bottom:1px solid rgba(255,255,255,.08);color:#e2e8f0;">
          <div style="font-weight:700;">${name}${scale}</div>
        </td>
        <td align="center" style="padding:10px 8px;border-bottom:1px solid rgba(255,255,255,.08);color:#e2e8f0;">${qty}</td>
        <td align="right" style="padding:10px 8px;border-bottom:1px solid rgba(255,255,255,.08);color:#e2e8f0;">${fmtBRL(unit)}</td>
        <td align="right" style="padding:10px 8px;border-bottom:1px solid rgba(255,255,255,.08);color:#e2e8f0;font-weight:700;">${fmtBRL(total)}</td>
      </tr>
    `;
  }).join("");

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid rgba(255,255,255,.10);border-radius:14px;overflow:hidden;background:rgba(255,255,255,.02);">
      <tr style="background:rgba(255,255,255,.04);">
        <th align="left" style="padding:10px 8px;font-size:12px;color:#94a3b8;font-weight:700;">&nbsp;</th>
        <th align="left" style="padding:10px 8px;font-size:12px;color:#94a3b8;font-weight:700;">Item</th>
        <th align="center" style="padding:10px 8px;font-size:12px;color:#94a3b8;font-weight:700;">Qtd</th>
        <th align="right" style="padding:10px 8px;font-size:12px;color:#94a3b8;font-weight:700;">Unit.</th>
        <th align="right" style="padding:10px 8px;font-size:12px;color:#94a3b8;font-weight:700;">Total</th>
      </tr>
      ${rows || `
        <tr><td colspan="5" style="padding:14px;color:#94a3b8;">(sem itens)</td></tr>
      `}
    </table>
  `;
}


function renderMetaPills(items) {
  const rows = (Array.isArray(items) ? items : [])
    .filter((it) => it && (it.label || it.value))
    .map((it) => {
      const label = esc(it.label || '');
      const value = esc(it.value || '');
      return `
        <span style="display:inline-flex;align-items:center;gap:6px;padding:7px 10px;border-radius:999px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.10);margin:0 8px 8px 0;">
          ${label ? `<span style="color:#94a3b8;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;">${label}</span>` : ''}
          ${value ? `<span style="color:#e2e8f0;font-size:12px;font-weight:800;">${value}</span>` : ''}
        </span>`;
    })
    .join('');

  if (!rows) return '';

  return `
    <div style="display:flex;flex-wrap:wrap;align-items:center;gap:0;margin:14px 0 0;">
      ${rows}
    </div>`;
}

function renderShowcaseGrid(items, { title = '', emptyText = '' } = {}) {
  const safeItems = (Array.isArray(items) ? items : []).filter(Boolean).slice(0, 8);
  if (!safeItems.length) {
    return emptyText
      ? `<div style="margin-top:14px;color:#94a3b8;font-size:12px;line-height:1.55;">${esc(emptyText)}</div>`
      : '';
  }

  const cards = safeItems.map((it) => {
    const name = esc(it?.name || it?.title || 'Miniatura');
    const subtitle = esc(it?.subtitle || it?.scale || it?.caption || '');
    const img = String(it?.img || it?.image_url || '').trim();
    const media = img
      ? `<img src="${esc(img)}" alt="${name}" width="120" height="120" style="display:block;width:100%;height:120px;border-radius:12px;object-fit:cover;background:#0b1020;border:1px solid rgba(255,255,255,.08);" />`
      : `<div style="width:100%;height:120px;border-radius:12px;background:linear-gradient(135deg,rgba(34,197,94,.08),rgba(6,182,212,.08));border:1px solid rgba(255,255,255,.08);"></div>`;
    return `
      <td width="50%" valign="top" style="padding:0 6px 12px;">
        <div style="padding:10px;border-radius:16px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);">
          ${media}
          <div style="margin-top:10px;color:#e2e8f0;font-size:13px;font-weight:800;line-height:1.35;">${name}</div>
          ${subtitle ? `<div style="margin-top:4px;color:#94a3b8;font-size:11px;line-height:1.45;">${subtitle}</div>` : ''}
        </div>
      </td>`;
  });

  let rows = '';
  for (let i = 0; i < cards.length; i += 2) {
    const first = cards[i];
    const second = cards[i + 1] || '<td width="50%" valign="top" style="padding:0 6px 12px;"></td>';
    rows += `<tr>${first}${second}</tr>`;
  }

  return `
    <div style="margin-top:16px;">
      ${title ? `<div style="font-size:13px;font-weight:800;color:#e2e8f0;margin-bottom:8px;">${esc(title)}</div>` : ''}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
    </div>`;
}

function renderKeyValueCard(title, pairs) {
  const rows = pairs
    .filter((p) => p && (p.value ?? "") !== "")
    .map((p) => `
      <tr>
        <td style="padding:6px 0;color:#94a3b8;font-size:12px;width:140px;">${esc(p.label)}</td>
        <td style="padding:6px 0;color:#e2e8f0;font-size:13px;font-weight:600;">${esc(p.value)}</td>
      </tr>
    `)
    .join("");

  return `
    <div style="margin:14px 0 0;">
      <div style="font-size:13px;font-weight:800;color:#e2e8f0;margin-bottom:6px;">${esc(title)}</div>
      <div style="border:1px solid rgba(255,255,255,.10);border-radius:14px;background:rgba(255,255,255,.02);padding:12px 14px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${rows || `<tr><td style="color:#94a3b8;">—</td></tr>`}
        </table>
      </div>
    </div>
  `;
}

export function renderOwnerOrderEmail(payload) {
  const {
    brandName,
    orderId,
    orderStatus,
    createdAt,
    paymentMethod,
    total,
    customer,
    items,
  } = payload || {};

  const { date, time } = formatDateTimeBR(createdAt);

  const headerPills = `
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin:0 0 12px;">
      <span style="display:inline-block;padding:6px 10px;border-radius:999px;background:rgba(34,197,94,.12);border:1px solid rgba(34,197,94,.25);color:#bbf7d0;font-weight:800;font-size:12px;">
        ${esc(String(orderStatus || "paid").toLowerCase() === "paid" ? "PAGO" : "PENDENTE")}
      </span>
      <span style="display:inline-block;padding:6px 10px;border-radius:999px;background:rgba(6,182,212,.12);border:1px solid rgba(6,182,212,.25);color:#a5f3fc;font-weight:800;font-size:12px;">
        ${esc(paymentMethod || "Pagamento")}
      </span>
      <span style="display:inline-block;padding:6px 10px;border-radius:999px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.10);color:#e2e8f0;font-weight:800;font-size:12px;">
        ${esc(fmtBRL(total))}
      </span>
    </div>
  `;

  const metaCard = renderKeyValueCard("Resumo do pedido", [
    { label: "Pedido", value: orderId ? String(orderId).slice(0, 8) : "-" },
    { label: "Data", value: date },
    { label: "Hora", value: time },
  ]);

  const customerCard = renderKeyValueCard("Cliente", [
    { label: "Nome", value: customer?.name || "" },
    { label: "Email", value: customer?.email || "" },
    { label: "Telefone", value: customer?.phone || "" },
    { label: "Endereço", value: customer?.address || "" },
  ]);

  const itemsTable = `
    <div style="margin:14px 0 0;">
      <div style="font-size:13px;font-weight:800;color:#e2e8f0;margin-bottom:6px;">Itens</div>
      ${renderItemsTable(items)}
    </div>
  `;

  const contentHtml = `
    ${headerPills}
    <div style="color:#cbd5e1;font-size:13px;line-height:1.6;">
      Você recebeu um novo pedido com pagamento confirmado. Use os dados abaixo para produção e envio.
    </div>
    ${metaCard}
    ${customerCard}
    ${itemsTable}
    <div style="margin-top:14px;padding:12px 14px;border-radius:14px;background:rgba(255,255,255,.03);border:1px dashed rgba(255,255,255,.14);color:#94a3b8;font-size:12px;line-height:1.5;">
      Forma de pagamento: <b style="color:#e2e8f0;">${esc(paymentMethod || "-")}</b>
    </div>
  `;

  const subject = `Novo pedido confirmado — ${orderId ? String(orderId).slice(0, 8) : "pedido"} — ${fmtBRL(total)}`;

  return {
    subject,
    html: renderLayout({
      title: "Novo pedido confirmado",
      preheader: `Pedido ${orderId ? String(orderId).slice(0, 8) : ""} • ${fmtBRL(total)} • ${paymentMethod || ""}`,
      brandName,
      contentHtml,
      footerNote: "Email de controle interno (produção).",
    }),
  };
}

export function renderCustomerOrderEmail(payload) {
  const {
    brandName,
    orderId,
    createdAt,
    paymentMethod,
    total,
    customer,
    items,
    supportEmail,
    whatsapp,
  } = payload || {};

  const { date, time } = formatDateTimeBR(createdAt);

  const intro = `
    <div style="color:#cbd5e1;font-size:13px;line-height:1.6;">
      Olá <b style="color:#e2e8f0;">${esc(customer?.name || "cliente")}</b>! ✅<br/>
      Recebemos o seu pagamento e o seu pedido foi confirmado.
    </div>
  `;

  const meta = renderKeyValueCard("Detalhes do pedido", [
    { label: "Pedido", value: orderId ? String(orderId).slice(0, 8) : "-" },
    { label: "Data", value: date },
    { label: "Hora", value: time },
    { label: "Pagamento", value: paymentMethod || "-" },
    { label: "Total", value: fmtBRL(total) },
  ]);

  const itemsTable = `
    <div style="margin:14px 0 0;">
      <div style="font-size:13px;font-weight:800;color:#e2e8f0;margin-bottom:6px;">Itens</div>
      ${renderItemsTable(items)}
    </div>
  `;

  const delivery = customer?.address
    ? renderKeyValueCard("Endereço de entrega", [{ label: "Endereço", value: customer.address }])
    : "";

  const help = `
    <div style="margin-top:14px;padding:12px 14px;border-radius:14px;background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.18);color:#bbf7d0;font-size:12px;line-height:1.55;">
      Qualquer dúvida, responda este email ou fale no WhatsApp <b style="color:#e2e8f0;">${esc(whatsapp || "")}</b>.
      ${supportEmail ? `<br/>Contato: <b style="color:#e2e8f0;">${esc(supportEmail)}</b>` : ""}
    </div>
  `;

  const contentHtml = `
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin:0 0 12px;">
      <span style="display:inline-block;padding:6px 10px;border-radius:999px;background:rgba(34,197,94,.12);border:1px solid rgba(34,197,94,.25);color:#bbf7d0;font-weight:800;font-size:12px;">PEDIDO CONFIRMADO</span>
      <span style="display:inline-block;padding:6px 10px;border-radius:999px;background:rgba(6,182,212,.12);border:1px solid rgba(6,182,212,.25);color:#a5f3fc;font-weight:800;font-size:12px;">${esc(paymentMethod || "Pagamento")}</span>
    </div>
    ${intro}
    ${meta}
    ${delivery}
    ${itemsTable}
    ${help}
  `;

  const subject = `Seu pedido foi confirmado — ${brandName || "Cubo Criativo"}`;

  return {
    subject,
    html: renderLayout({
      title: "Pedido confirmado",
      preheader: `Pedido ${orderId ? String(orderId).slice(0, 8) : ""} • ${fmtBRL(total)} • ${paymentMethod || ""}`,
      brandName,
      contentHtml,
      footerNote: "Obrigado por comprar com a gente 💚",
    }),
  };
}

export function buildAddressFromProfile(profile) {
  if (!profile) return "";
  const parts = [
    profile.address_line1,
    profile.address_line2,
    profile.neighborhood,
    profile.city,
    profile.state,
    profile.zip,
  ].map((x) => String(x || "").trim()).filter(Boolean);

  return parts.join(" • ");
}


function statusLabelPt(status) {
  const s = String(status || '').toLowerCase();
  return ({
    recebido: 'Recebido',
    editavel: 'Escolhas abertas',
    em_producao: 'Em produção',
    pronto: 'Pronto',
    enviado: 'Enviado',
    entregue: 'Entregue',
    cancelado: 'Cancelado',
    reembolsado: 'Reembolsado',
  }[s] || (s ? s.replaceAll('_', ' ') : 'Atualizado'));
}

export function renderOrderStatusEmail(payload) {
  const {
    brandName,
    orderId,
    customerName,
    nextStatus,
    shippingTracking,
    trackingUrl,
    productionEta,
    cancelledBy,
    reviewLink,
    supportEmail,
    whatsapp,
    total,
    paymentMethod,
    orderType,
    vipPlanId,
    items,
    vipSelection,
  } = payload || {};

  const shortId = orderId ? String(orderId).slice(0, 8) : '-';
  const status = String(nextStatus || '').toLowerCase();
  const isVipOrder = String(orderType || '').toLowerCase() === 'vip';
  const selectedVipItems = Array.isArray(vipSelection?.selected_options) ? vipSelection.selected_options : [];
  const regularItems = Array.isArray(items) ? items : [];
  const hasVisualItems = isVipOrder ? selectedVipItems.length > 0 : regularItems.length > 0;
  const titleByStatus = {
    recebido: isVipOrder ? 'Seu ciclo VIP foi confirmado' : 'Pedido recebido',
    editavel: 'Seu ciclo VIP está aberto para escolhas',
    em_producao: isVipOrder ? 'Suas miniaturas VIP entraram em produção' : 'Seu pedido entrou em produção',
    pronto: isVipOrder ? 'Seu envio VIP está pronto' : 'Seu pedido está pronto',
    enviado: isVipOrder ? 'Seu envio VIP foi despachado' : 'Seu pedido foi enviado',
    entregue: isVipOrder ? 'Seu envio VIP foi entregue' : 'Pedido entregue',
    cancelado: 'Pedido cancelado',
    reembolsado: 'Pedido reembolsado',
  };
  const baseTitle = titleByStatus[status] || 'Atualização do pedido';
  const subject = `${baseTitle} — Pedido ${shortId}`;

  let intro = 'Seu pedido teve uma atualização de status.';
  let highlight = '';
  let ctaHref = '';
  let ctaText = '';
  let accent = 'rgba(6,182,212,.12)';
  let accentBorder = 'rgba(6,182,212,.25)';
  let accentColor = '#a5f3fc';

  if (status === 'recebido') {
    if (isVipOrder) {
      intro = 'Seu ciclo VIP foi confirmado e em breve vamos produzir as miniaturas escolhidas para este mês.';
      highlight = hasVisualItems
        ? 'Assim que sua seleção estiver liberada para produção, você receberá novas atualizações por aqui.'
        : 'Seu acesso VIP já está ativo. Vá até a Área VIP para conferir o ciclo e suas escolhas.';
      ctaHref = reviewLink || '';
      ctaText = 'Abrir Área VIP';
    } else {
      intro = 'Recebemos seu pedido e o pagamento foi confirmado. Agora ele entrou na nossa fila de atendimento.';
      highlight = 'Avisaremos por e-mail quando a produção começar e quando seu envio estiver pronto para postagem.';
    }
    accent = 'rgba(34,197,94,.12)'; accentBorder = 'rgba(34,197,94,.25)'; accentColor = '#bbf7d0';
  } else if (status === 'editavel') {
    intro = 'Seu ciclo VIP está aberto para personalização.';
    highlight = 'Escolha suas miniaturas na Área VIP para que possamos seguir para produção sem atrasos.';
    ctaHref = reviewLink || '';
    ctaText = 'Escolher minhas miniaturas';
    accent = 'rgba(168,85,247,.12)'; accentBorder = 'rgba(168,85,247,.25)'; accentColor = '#ddd6fe';
  } else if (status === 'em_producao') {
    intro = isVipOrder
      ? 'Suas miniaturas escolhidas já estão em processo de produção no estúdio.'
      : 'Seu pedido já entrou em produção e estamos trabalhando na sua peça.';
    highlight = productionEta
      ? `Estimativa informada pela loja: ${productionEta}.`
      : (isVipOrder
        ? 'Assim que finalizarmos a produção, você receberá um novo aviso por e-mail com a próxima etapa.'
        : 'Em breve enviaremos a próxima atualização com o andamento do pedido.');
  } else if (status === 'pronto') {
    intro = isVipOrder
      ? 'Suas miniaturas VIP ficaram prontas e estão em preparação final para postagem.'
      : 'Sua peça ficou pronta e agora está sendo preparada para envio.';
    highlight = 'Assim que o pedido for postado, você receberá o código de rastreio por e-mail.';
    accent = 'rgba(245,158,11,.12)'; accentBorder = 'rgba(245,158,11,.25)'; accentColor = '#fde68a';
  } else if (status === 'enviado') {
    intro = isVipOrder
      ? 'Seu envio VIP foi despachado e já está a caminho do seu endereço.'
      : 'Seu pedido foi enviado e já está a caminho do seu endereço.';
    highlight = shippingTracking
      ? `Código de rastreio: ${shippingTracking}`
      : 'O envio foi realizado. Se o rastreio ainda não apareceu, ele pode ser atualizado em breve.';
    ctaHref = trackingUrl || '';
    ctaText = trackingUrl ? 'Acompanhar envio' : '';
    accent = 'rgba(168,85,247,.12)'; accentBorder = 'rgba(168,85,247,.25)'; accentColor = '#ddd6fe';
  } else if (status === 'entregue') {
    intro = isVipOrder
      ? 'Seu envio VIP foi marcado como entregue. Esperamos que você tenha curtido muito as miniaturas 💚'
      : 'Seu pedido foi marcado como entregue. Esperamos que você tenha curtido sua peça 💚';
    highlight = 'Sua avaliação ajuda muito nossa loja e outros clientes.';
    ctaHref = reviewLink || '';
    ctaText = isVipOrder ? 'Avaliar meu envio VIP' : 'Avaliar meu pedido';
    accent = 'rgba(34,197,94,.12)'; accentBorder = 'rgba(34,197,94,.25)'; accentColor = '#bbf7d0';
  } else if (status === 'cancelado') {
    intro = cancelledBy === 'customer'
      ? 'Recebemos sua solicitação de cancelamento. Se houve pagamento, o reembolso seguirá conforme a forma de pagamento.'
      : 'Seu pedido foi cancelado pela loja. Se houve pagamento, o reembolso seguirá conforme a forma de pagamento.';
    highlight = cancelledBy === 'customer'
      ? 'Se precisar de ajuda para refazer o pedido, conte com a gente.'
      : 'Se precisar de suporte ou quiser refazer o pedido, estamos à disposição.';
    accent = 'rgba(239,68,68,.12)'; accentBorder = 'rgba(239,68,68,.25)'; accentColor = '#fecaca';
  } else if (status === 'reembolsado') {
    intro = 'Seu pedido foi reembolsado com sucesso.';
    highlight = 'O valor será devolvido conforme o prazo da sua forma de pagamento e da operadora/banco.';
    accent = 'rgba(245,158,11,.12)'; accentBorder = 'rgba(245,158,11,.25)'; accentColor = '#fde68a';
  }

  const pills = `
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin:0 0 12px;">
      <span style="display:inline-block;padding:6px 10px;border-radius:999px;background:${accent};border:1px solid ${accentBorder};color:${accentColor};font-weight:800;font-size:12px;">${esc(statusLabelPt(status))}</span>
      ${isVipOrder ? `<span style="display:inline-block;padding:6px 10px;border-radius:999px;background:rgba(168,85,247,.12);border:1px solid rgba(168,85,247,.25);color:#ddd6fe;font-weight:800;font-size:12px;">Clube VIP</span>` : `<span style="display:inline-block;padding:6px 10px;border-radius:999px;background:rgba(34,197,94,.12);border:1px solid rgba(34,197,94,.25);color:#bbf7d0;font-weight:800;font-size:12px;">Loja</span>`}
      ${vipPlanId ? `<span style="display:inline-block;padding:6px 10px;border-radius:999px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.10);color:#e2e8f0;font-weight:800;font-size:12px;">${esc(String(vipPlanId).replaceAll('_', ' '))}</span>` : ''}
      ${paymentMethod ? `<span style="display:inline-block;padding:6px 10px;border-radius:999px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.10);color:#e2e8f0;font-weight:800;font-size:12px;">${esc(paymentMethod)}</span>` : ''}
      ${Number.isFinite(Number(total)) ? `<span style="display:inline-block;padding:6px 10px;border-radius:999px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.10);color:#e2e8f0;font-weight:800;font-size:12px;">${esc(fmtBRL(total))}</span>` : ''}
    </div>`;

  const meta = renderKeyValueCard(isVipOrder ? 'Resumo do ciclo' : 'Resumo do pedido', [
    { label: 'Pedido', value: shortId },
    { label: 'Status', value: statusLabelPt(status) },
    { label: 'Estimativa', value: productionEta || '' },
    { label: 'Rastreio', value: shippingTracking || '' },
    { label: 'Link do rastreio', value: trackingUrl || '' },
  ]);

  const shouldShowItemImages = status === 'recebido' || status === 'em_producao';

  const visualBlock = !shouldShowItemImages
    ? ''
    : isVipOrder
      ? renderShowcaseGrid(
          selectedVipItems.map((it) => ({ name: it?.title || it?.name, image_url: it?.image_url || it?.img, subtitle: 'Miniatura selecionada' })),
          {
            title: status === 'em_producao' ? 'Miniaturas que já estão em produção' : 'Miniaturas selecionadas para este ciclo',
            emptyText: status === 'em_producao' ? 'As miniaturas deste ciclo já estão em produção. Assim que houver novas imagens ou rastreio, avisaremos por aqui.' : '',
          }
        )
      : renderShowcaseGrid(
          regularItems.map((it) => ({ name: it?.name || it?.product_name, image_url: it?.img || it?.product_image_url, subtitle: it?.scale ? `Escala ${it.scale}` : '' })),
          {
            title: status === 'em_producao' ? 'Itens em produção' : 'Itens do seu pedido',
            emptyText: '',
          }
        );

  const supportBox = `
    <div style="margin-top:14px;padding:12px 14px;border-radius:14px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);color:#cbd5e1;font-size:12px;line-height:1.55;">
      ${whatsapp ? `WhatsApp: <b style="color:#e2e8f0;">${esc(whatsapp)}</b>` : ''}
      ${whatsapp && supportEmail ? '<br/>' : ''}
      ${supportEmail ? `Email: <b style="color:#e2e8f0;">${esc(supportEmail)}</b>` : ''}
      ${!whatsapp && !supportEmail ? 'Se precisar de ajuda, responda este e-mail.' : ''}
    </div>`;

  const cta = ctaHref && ctaText ? `
    <div style="margin-top:16px;">
      <a href="${esc(ctaHref)}" style="display:inline-block;padding:11px 16px;border-radius:12px;background:linear-gradient(135deg,#22c55e,#06b6d4);color:#04110d;text-decoration:none;font-weight:800;">${esc(ctaText)}</a>
    </div>` : '';

  const contentHtml = `
    ${pills}
    <div style="color:#cbd5e1;font-size:13px;line-height:1.65;">Olá <b style="color:#e2e8f0;">${esc(customerName || 'cliente')}</b>!<br/>${esc(intro)}</div>
    <div style="margin-top:14px;padding:12px 14px;border-radius:14px;background:${accent};border:1px solid ${accentBorder};color:${accentColor};font-size:12px;line-height:1.55;">${esc(highlight)}</div>
    ${visualBlock}
    ${meta}
    ${cta}
    ${supportBox}
  `;

  return {
    subject,
    html: renderLayout({
      title: baseTitle,
      preheader: `Pedido ${shortId} • ${statusLabelPt(status)}`,
      brandName,
      contentHtml,
      footerNote: 'Mensagem automática com atualização do seu pedido.',
    }),
  };
}


export function renderVipUpgradeEmail(payload) {
  const p = payload || {};
  const brandName = p.brandName || 'Cubo Criativo';
  const customerName = p.customerName || 'cliente';
  const orderId = p.orderId || '';
  const shortId = String(orderId || '').slice(0, 8) || 'UPGRADE';
  const vipAreaUrl = p.reviewLink || p.vipAreaUrl || '';
  const supportEmail = p.supportEmail || '';
  const whatsapp = p.whatsapp || '';
  const fromPlanName = p.fromPlanName || 'Plano atual';
  const toPlanName = p.toPlanName || 'Novo plano VIP';
  const fromPlanDescription = p.fromPlanDescription || '';
  const toPlanDescription = p.toPlanDescription || '';
  const amountCharged = Number.isFinite(Number(p.amountCharged)) ? Number(p.amountCharged) : null;
  const previousPrice = Number.isFinite(Number(p.previousPrice)) ? Number(p.previousPrice) : null;
  const newPrice = Number.isFinite(Number(p.newPrice)) ? Number(p.newPrice) : null;
  const miniaturesCount = Number(p.miniaturesCount || 0) || 0;
  const bossCount = Number(p.bossCount || 0) || 0;
  const scale = p.scale || '';
  const paymentMethod = p.paymentMethod || 'Pagamento aprovado';
  const recurrenceLabel = p.recurrenceLabel || 'Mensal';
  const upgradeHighlights = Array.isArray(p.upgradeHighlights) && p.upgradeHighlights.length ? p.upgradeHighlights : [
    `Seu plano agora é o ${toPlanName}`,
    miniaturesCount ? `Limite atualizado para ${miniaturesCount} miniatura${miniaturesCount > 1 ? 's' : ''}${scale ? ` em ${scale}` : ''}` : null,
    bossCount ? `Boss inclusos no plano: ${bossCount}` : null,
    'As novas vantagens já estão liberadas na sua Área VIP',
  ].filter(Boolean);

  const detailRows = [
    { label: 'Upgrade realizado', value: `${fromPlanName} → ${toPlanName}` },
    { label: 'Recorrência', value: recurrenceLabel },
    ...(amountCharged != null ? [{ label: 'Valor cobrado agora', value: fmtBRL(amountCharged) }] : []),
    ...(previousPrice != null ? [{ label: 'Plano anterior', value: fmtBRL(previousPrice) }] : []),
    ...(newPrice != null ? [{ label: 'Novo valor mensal', value: fmtBRL(newPrice) }] : []),
    ...(miniaturesCount ? [{ label: 'Miniaturas incluídas', value: `${miniaturesCount}` }] : []),
    ...(bossCount ? [{ label: 'Boss inclusos', value: `${bossCount}` }] : []),
    ...(scale ? [{ label: 'Escala', value: scale }] : []),
    { label: 'Pagamento', value: paymentMethod },
    { label: 'Pedido', value: shortId },
    { label: 'Status', value: 'Upgrade confirmado' },
  ];

  const detailsTable = `
    <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:separate;border-spacing:0;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:14px;overflow:hidden;">
      <tbody>
        ${detailRows.map((row, idx) => `
          <tr>
            <td style="padding:10px 12px;border-bottom:${idx === detailRows.length - 1 ? '0' : '1px solid rgba(255,255,255,.08)'};color:#94a3b8;font-size:12px;font-weight:700;width:42%;">${esc(row.label)}</td>
            <td style="padding:10px 12px;border-bottom:${idx === detailRows.length - 1 ? '0' : '1px solid rgba(255,255,255,.08)'};color:#f8fafc;font-size:13px;font-weight:700;">${esc(row.value)}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;

  const highlightList = `<ul style="margin:10px 0 0 18px;padding:0;color:#e2e8f0;font-size:13px;line-height:1.65;">${upgradeHighlights.map((b)=>`<li style="margin:0 0 4px 0;">${esc(String(b))}</li>`).join('')}</ul>`;
  const meta = renderMetaPills([
    { label: 'Upgrade', value: 'Confirmado' },
    { label: 'Novo plano', value: toPlanName },
    ...(amountCharged != null ? [{ label: 'Cobrado agora', value: fmtBRL(amountCharged) }] : []),
  ]);

  const supportBox = `
    <div style="margin-top:14px;padding:12px 14px;border-radius:14px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);color:#cbd5e1;font-size:12px;line-height:1.55;">
      ${whatsapp ? `WhatsApp: <b style="color:#e2e8f0;">${esc(whatsapp)}</b>` : ''}
      ${whatsapp && supportEmail ? '<br/>' : ''}
      ${supportEmail ? `Email: <b style="color:#e2e8f0;">${esc(supportEmail)}</b>` : ''}
      ${!whatsapp && !supportEmail ? 'Se precisar de ajuda, responda este email.' : ''}
    </div>`;

  const cta = vipAreaUrl ? `
    <div style="margin-top:16px;">
      <a href="${esc(vipAreaUrl)}" style="display:inline-block;padding:11px 16px;border-radius:12px;background:linear-gradient(135deg,#a78bfa,#22d3ee);color:#09090b;text-decoration:none;font-weight:800;">Acessar Área VIP</a>
    </div>` : '';

  const contentHtml = `
    <div style="color:#cbd5e1;font-size:13px;line-height:1.65;">
      Olá <b style="color:#e2e8f0;">${esc(customerName)}</b>!<br/>
      Seu upgrade foi confirmado com sucesso ✅ Agora você está no plano <b style="color:#f8fafc;">${esc(toPlanName)}</b>.
    </div>
    <div style="margin-top:14px;padding:12px 14px;border-radius:14px;background:rgba(34,211,238,.08);border:1px solid rgba(34,211,238,.18);color:#cffafe;font-size:12px;line-height:1.55;">
      <b>Obrigado por evoluir seu plano com a Cubo Criativo.</b> As novas vantagens do clube já podem ser aproveitadas a partir de agora.
    </div>
    ${meta}
    <div style="margin-top:14px;">
      <div style="color:#94a3b8;font-size:12px;font-weight:700;margin:0 0 6px 2px;">Detalhes do upgrade</div>
      ${detailsTable}
    </div>
    <div style="margin-top:14px;display:grid;grid-template-columns:1fr;gap:10px;">
      <div style="padding:12px 14px;border-radius:14px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);color:#cbd5e1;font-size:13px;line-height:1.6;">
        <div style="color:#94a3b8;font-size:12px;font-weight:700;margin-bottom:4px;">Plano anterior</div>
        <div style="color:#f8fafc;font-weight:800;">${esc(fromPlanName)}</div>
        ${fromPlanDescription ? `<div style="margin-top:6px;">${esc(fromPlanDescription)}</div>` : ''}
      </div>
      <div style="padding:12px 14px;border-radius:14px;background:rgba(168,85,247,.10);border:1px solid rgba(168,85,247,.25);color:#f5d0fe;font-size:13px;line-height:1.6;">
        <div style="color:#e9d5ff;font-size:12px;font-weight:700;margin-bottom:4px;">Novo plano ativo</div>
        <div style="color:#fff7ed;font-weight:800;">${esc(toPlanName)}</div>
        ${toPlanDescription ? `<div style="margin-top:6px;color:#f5d0fe;">${esc(toPlanDescription)}</div>` : ''}
      </div>
    </div>
    <div style="margin-top:14px;padding:12px 14px;border-radius:14px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);">
      <div style="color:#94a3b8;font-size:12px;font-weight:700;margin-bottom:4px;">O que mudou no seu plano</div>
      ${highlightList}
    </div>
    ${cta}
    ${supportBox}
  `;

  return {
    subject: `Upgrade VIP confirmado — ${toPlanName}`,
    html: renderLayout({
      title: 'Upgrade VIP confirmado',
      preheader: `${fromPlanName} → ${toPlanName} • Pedido ${shortId}`,
      brandName,
      contentHtml,
      footerNote: 'Mensagem automática de confirmação do upgrade da sua assinatura VIP.',
    }),
  };
}
export function renderVipWelcomeEmail(payload) {
  const p = payload || {};
  const brandName = p.brandName || 'Cubo Criativo';
  const customerName = p.customerName || 'cliente';
  const orderId = p.orderId || '';
  const shortId = String(orderId || '').slice(0, 8) || 'VIP';
  const vipAreaUrl = p.reviewLink || p.vipAreaUrl || '';
  const total = Number.isFinite(Number(p.total)) ? Number(p.total) : null;
  const paymentMethod = p.paymentMethod || 'Pagamento';
  const supportEmail = p.supportEmail || '';
  const whatsapp = p.whatsapp || '';
  const planName = p.planName || 'Cubo Level 1 — RPG';
  const planDescription = p.planDescription || '';
  const monthlyPrice = Number.isFinite(Number(p.monthlyPrice)) ? Number(p.monthlyPrice) : total;
  const miniaturesCount = Number(p.miniaturesCount || 0) || 0;
  const bossCount = Number(p.bossCount || 0) || 0;
  const scale = p.scale || '';
  const recurrenceLabel = p.recurrenceLabel || 'Mensal';
  const cycleLabel = p.cycleLabel || 'Ciclo atual';
  const benefits = Array.isArray(p.benefits) && p.benefits.length ? p.benefits : [
    miniaturesCount ? `${miniaturesCount} miniatura${miniaturesCount > 1 ? 's' : ''} por ciclo${scale ? ` em ${scale}` : ''}` : 'Miniaturas mensais em resina premium',
    bossCount ? `${bossCount} boss incluso${bossCount > 1 ? 's' : ''} no plano` : 'Escolha mensal das miniaturas disponíveis na Área VIP',
    'Acompanhamento e suporte prioritário para sua assinatura',
  ];

  const detailRows = [
    { label: 'Plano assinado', value: planName },
    { label: 'Recorrência', value: recurrenceLabel },
    ...(monthlyPrice != null ? [{ label: 'Valor do plano', value: fmtBRL(monthlyPrice) }] : []),
    ...(miniaturesCount ? [{ label: 'Miniaturas incluídas', value: `${miniaturesCount}` }] : []),
    ...(bossCount ? [{ label: 'Boss inclusos', value: `${bossCount}` }] : []),
    ...(scale ? [{ label: 'Escala', value: scale }] : []),
    { label: 'Pagamento', value: paymentMethod },
    { label: 'Pedido', value: shortId },
    { label: 'Status', value: 'VIP ativo' },
  ];

  const detailsTable = `
    <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:separate;border-spacing:0;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:14px;overflow:hidden;">
      <tbody>
        ${detailRows.map((row, idx) => `
          <tr>
            <td style="padding:10px 12px;border-bottom:${idx === detailRows.length - 1 ? '0' : '1px solid rgba(255,255,255,.08)'};color:#94a3b8;font-size:12px;font-weight:700;width:42%;">${esc(row.label)}</td>
            <td style="padding:10px 12px;border-bottom:${idx === detailRows.length - 1 ? '0' : '1px solid rgba(255,255,255,.08)'};color:#f8fafc;font-size:13px;font-weight:700;">${esc(row.value)}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;

  const benefitList = `<ul style="margin:10px 0 0 18px;padding:0;color:#e2e8f0;font-size:13px;line-height:1.65;">${benefits.map((b)=>`<li style="margin:0 0 4px 0;">${esc(String(b))}</li>`).join('')}</ul>`;
  const meta = renderMetaPills([
    { label: 'Assinatura', value: planName },
    ...(monthlyPrice != null ? [{ label: 'Plano', value: fmtBRL(monthlyPrice) }] : []),
    { label: cycleLabel, value: 'Liberado' },
  ]);

  const supportBox = `
    <div style="margin-top:14px;padding:12px 14px;border-radius:14px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);color:#cbd5e1;font-size:12px;line-height:1.55;">
      ${whatsapp ? `WhatsApp: <b style="color:#e2e8f0;">${esc(whatsapp)}</b>` : ''}
      ${whatsapp && supportEmail ? '<br/>' : ''}
      ${supportEmail ? `Email: <b style="color:#e2e8f0;">${esc(supportEmail)}</b>` : ''}
      ${!whatsapp && !supportEmail ? 'Se precisar de ajuda, responda este email.' : ''}
    </div>`;

  const cta = vipAreaUrl ? `
    <div style="margin-top:16px;">
      <a href="${esc(vipAreaUrl)}" style="display:inline-block;padding:11px 16px;border-radius:12px;background:linear-gradient(135deg,#a78bfa,#22d3ee);color:#09090b;text-decoration:none;font-weight:800;">Acessar Área VIP</a>
    </div>` : '';

  const contentHtml = `
    <div style="color:#cbd5e1;font-size:13px;line-height:1.65;">
      Olá <b style="color:#e2e8f0;">${esc(customerName)}</b>!<br/>
      Obrigado por assinar o <b style="color:#f8fafc;">${esc(planName)}</b>. Sua assinatura VIP foi ativada com sucesso ✅
    </div>
    <div style="margin-top:14px;padding:12px 14px;border-radius:14px;background:rgba(168,85,247,.10);border:1px solid rgba(168,85,247,.25);color:#f5d0fe;font-size:12px;line-height:1.55;">
      <b>Obrigado pela assinatura!</b> Sua confiança ajuda a Cubo Criativo a continuar criando novas miniaturas, temas e experiências exclusivas para os assinantes.
    </div>
    ${meta}
    <div style="margin-top:14px;">
      <div style="color:#94a3b8;font-size:12px;font-weight:700;margin:0 0 6px 2px;">Detalhes do plano</div>
      ${detailsTable}
    </div>
    ${planDescription ? `<div style="margin-top:14px;padding:12px 14px;border-radius:14px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);color:#cbd5e1;font-size:13px;line-height:1.6;">${esc(planDescription)}</div>` : ''}
    <div style="margin-top:14px;padding:12px 14px;border-radius:14px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);">
      <div style="color:#94a3b8;font-size:12px;font-weight:700;margin-bottom:4px;">O que já está liberado na sua assinatura</div>
      ${benefitList}
    </div>
    <div style="margin-top:14px;padding:12px 14px;border-radius:14px;background:rgba(34,211,238,.08);border:1px solid rgba(34,211,238,.18);color:#cffafe;font-size:12px;line-height:1.55;">
      <b>Próximo passo:</b> acesse a sua <b>Área VIP</b> para escolher as miniaturas do ciclo e acompanhar as próximas etapas da assinatura.
    </div>
    ${cta}
    ${supportBox}
  `;

  return {
    subject: `Assinatura VIP confirmada — ${planName}`,
    html: renderLayout({
      title: 'Assinatura VIP ativada',
      preheader: `Plano ${planName} • Pedido ${shortId}`,
      brandName,
      contentHtml,
      footerNote: 'Mensagem automática de ativação da sua assinatura VIP.',
    }),
  };
}
