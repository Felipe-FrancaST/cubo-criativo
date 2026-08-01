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


function withBrandSubject(brandName, subject) {
  const brand = String(brandName || 'Cubo Criativo').trim();
  const core = String(subject || '').trim();
  if (!core) return brand;
  return `${brand} • ${core}`;
}

function formatPaymentLabel(value) {
  const raw = String(value || '').trim();
  const normalized = raw.toLowerCase();
  return ({
    mercado_pago: 'Mercado Pago',
    mercadopago: 'Mercado Pago',
    admin_manual: 'Pagamento manual',
    manual: 'Pagamento manual',
    pix: 'Pix',
    credit_card: 'Cartão de crédito',
    debit_card: 'Cartão de débito',
  })[normalized] || raw.replaceAll('_', ' ');
}

function renderEmailSummaryBanner({ eyebrow = 'Atualização', title = '', description = '' } = {}) {
  if (!title && !description) return '';
  return `
    <div style="margin:0 0 14px;padding:14px 16px;border-radius:16px;background:linear-gradient(135deg,rgba(34,197,94,.10),rgba(6,182,212,.10));border:1px solid rgba(103,232,249,.18);">
      ${eyebrow ? `<div style="font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#67e8f9;">${esc(eyebrow)}</div>` : ''}
      ${title ? `<div style="margin-top:4px;color:#f8fafc;font-size:18px;font-weight:800;line-height:1.35;">${esc(title)}</div>` : ''}
      ${description ? `<div style="margin-top:6px;color:#cbd5e1;font-size:13px;line-height:1.65;">${esc(description)}</div>` : ''}
    </div>`;
}

function getSiteUrl(explicitUrl = '') {
  return String(
    explicitUrl ||
      process.env.SITE_URL ||
      process.env.APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      ''
  )
    .trim()
    .replace(/\/$/, '');
}

function renderActionButton(href, label, { secondary = false } = {}) {
  const url = String(href || '').trim();
  const text = String(label || '').trim();
  if (!url || !text) return '';
  const background = secondary ? '#172033' : 'linear-gradient(135deg,#22c55e,#06b6d4)';
  const color = secondary ? '#e2e8f0' : '#04110d';
  const border = secondary ? '1px solid rgba(255,255,255,.14)' : '1px solid rgba(103,232,249,.28)';
  return `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin:0 8px 8px 0;padding:12px 17px;border-radius:12px;background:${background};border:${border};color:${color};text-decoration:none;font-size:13px;font-weight:800;line-height:1.2;">${esc(text)}</a>`;
}

function renderSupportCard({ supportEmail = '', whatsapp = '' } = {}) {
  const email = String(supportEmail || '').trim();
  const phone = String(whatsapp || '').trim();
  const rows = [];
  if (phone) rows.push(`<div style="margin-top:4px;color:#e2e8f0;"><b>WhatsApp:</b> ${esc(phone)}</div>`);
  if (email) rows.push(`<div style="margin-top:4px;color:#e2e8f0;"><b>E-mail:</b> ${esc(email)}</div>`);
  return `
    <div style="margin-top:16px;padding:13px 15px;border-radius:14px;background:#111a2d;border:1px solid rgba(255,255,255,.09);color:#aebcd0;font-size:12px;line-height:1.6;">
      <div style="color:#f8fafc;font-weight:800;">Precisa de ajuda?</div>
      ${rows.length ? rows.join('') : '<div style="margin-top:4px;">Responda este e-mail e nossa equipe ajudará você.</div>'}
    </div>`;
}

function renderLayout({ title, preheader, brandName, contentHtml, footerNote, siteUrl }) {
  const safeTitle = esc(title);
  const safeBrand = esc(brandName || 'Cubo Criativo');
  const safePre = esc(preheader || '');
  const baseUrl = getSiteUrl(siteUrl);
  const logoUrl = baseUrl ? `${baseUrl}/images/logo.png` : '';
  const homeUrl = baseUrl || '';
  const accountUrl = baseUrl ? `${baseUrl}/#/conta` : '';

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="color-scheme" content="dark" />
    <meta name="supported-color-schemes" content="dark" />
    <title>${safeTitle}</title>
    <style>
      @media only screen and (max-width: 640px) {
        .email-shell { padding: 12px 6px !important; }
        .email-card { border-radius: 14px !important; }
        .email-pad { padding-left: 16px !important; padding-right: 16px !important; }
        .email-title { font-size: 20px !important; }
        .email-hide-mobile { display: none !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:#080d18;font-family:Inter,Arial,Helvetica,sans-serif;color:#e2e8f0;-webkit-text-size-adjust:100%;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">${safePre}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="email-shell" style="width:100%;background:#080d18;padding:26px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" class="email-card" style="width:100%;max-width:640px;background:#0f1728;border:1px solid #263248;border-radius:20px;overflow:hidden;box-shadow:0 20px 55px rgba(0,0,0,.30);">
            <tr>
              <td class="email-pad" style="padding:22px 24px 18px;background:linear-gradient(135deg,#111c30,#0c1627);border-bottom:1px solid #263248;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td width="56" valign="middle">
                      ${logoUrl
                        ? `<img src="${esc(logoUrl)}" alt="${safeBrand}" width="48" height="48" style="display:block;width:48px;height:48px;border-radius:13px;object-fit:contain;background:#070b13;border:1px solid rgba(103,232,249,.20);" />`
                        : `<div style="width:48px;height:48px;line-height:48px;text-align:center;border-radius:13px;background:linear-gradient(135deg,#22c55e,#06b6d4);color:#04110d;font-size:17px;font-weight:900;">CC</div>`}
                    </td>
                    <td valign="middle" style="padding-left:13px;">
                      <div style="font-size:11px;letter-spacing:.15em;text-transform:uppercase;color:#7dd3fc;font-weight:800;">${safeBrand}</div>
                      <div class="email-title" style="font-size:23px;font-weight:850;color:#f8fafc;margin-top:4px;line-height:1.25;">${safeTitle}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td class="email-pad" style="padding:22px 24px 24px;">
                ${contentHtml}
              </td>
            </tr>

            <tr>
              <td class="email-pad" style="padding:17px 24px;background:#0b1322;border-top:1px solid #263248;">
                <div style="font-size:12px;line-height:1.55;color:#8ea0b8;">${esc(footerNote || 'Mensagem automática da Cubo Criativo.')}</div>
                ${homeUrl || accountUrl ? `<div style="margin-top:9px;font-size:12px;line-height:1.6;">${homeUrl ? `<a href="${esc(homeUrl)}" style="color:#67e8f9;text-decoration:none;font-weight:700;">Visitar o site</a>` : ''}${homeUrl && accountUrl ? `<span style="color:#46556d;"> &nbsp;•&nbsp; </span>` : ''}${accountUrl ? `<a href="${esc(accountUrl)}" style="color:#67e8f9;text-decoration:none;font-weight:700;">Meus pedidos</a>` : ''}</div>` : ''}
              </td>
            </tr>
          </table>

          <div style="max-width:640px;margin-top:13px;padding:0 8px;font-size:11px;color:#52627a;line-height:1.5;text-align:center;">
            Este e-mail foi enviado porque houve uma ação relacionada a um pedido ou serviço da Cubo Criativo.
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

  const subject = withBrandSubject(brandName, `Novo pedido confirmado — ${orderId ? String(orderId).slice(0, 8) : "pedido"} — ${fmtBRL(total)}`);

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
    siteUrl,
    orderUrl,
  } = payload || {};

  const { date, time } = formatDateTimeBR(createdAt);
  const shortId = orderId ? String(orderId).slice(0, 8) : '-';
  const baseUrl = getSiteUrl(siteUrl);
  const accountUrl = String(orderUrl || (baseUrl ? `${baseUrl}/#/conta` : '')).trim();

  const meta = renderKeyValueCard('Resumo do pedido', [
    { label: 'Pedido', value: shortId },
    { label: 'Data', value: date },
    { label: 'Hora', value: time },
    { label: 'Pagamento', value: paymentMethod || '-' },
    { label: 'Total', value: fmtBRL(total) },
    { label: 'Status', value: 'Pagamento confirmado' },
  ]);

  const itemsTable = `
    <div style="margin:16px 0 0;">
      <div style="font-size:13px;font-weight:800;color:#f8fafc;margin-bottom:7px;">Itens do pedido</div>
      ${renderItemsTable(items)}
    </div>`;

  const delivery = customer?.address
    ? renderKeyValueCard('Endereço de entrega', [{ label: 'Destino', value: customer.address }])
    : '';

  const contentHtml = `
    ${renderEmailSummaryBanner({
      eyebrow: 'Pagamento aprovado',
      title: `Pedido ${shortId} confirmado`,
      description: 'Recebemos seu pagamento e o pedido já entrou na fila de atendimento da Cubo Criativo.',
    })}
    ${renderMetaPills([
      { label: 'Status', value: 'Confirmado' },
      { label: 'Pagamento', value: paymentMethod || 'Aprovado' },
      { label: 'Total', value: fmtBRL(total) },
    ])}
    <div style="margin-top:6px;color:#cbd5e1;font-size:14px;line-height:1.7;">
      Olá <b style="color:#f8fafc;">${esc(customer?.name || 'cliente')}</b>! Seu pedido foi confirmado com sucesso.
      Agora nossa equipe fará a conferência e avisará você quando a produção começar.
    </div>
    ${meta}
    ${delivery}
    ${itemsTable}
    <div style="margin-top:16px;padding:14px 15px;border-radius:14px;background:rgba(6,182,212,.09);border:1px solid rgba(103,232,249,.20);color:#cffafe;font-size:12px;line-height:1.65;">
      <b style="color:#f8fafc;">Próximas atualizações:</b> início da produção, peça pronta, postagem com rastreio e confirmação de entrega.
    </div>
    ${accountUrl ? `<div style="margin-top:17px;">${renderActionButton(accountUrl, 'Acompanhar meu pedido')}</div>` : ''}
    ${renderSupportCard({ supportEmail, whatsapp })}
  `;

  return {
    subject: withBrandSubject(brandName, `Pedido confirmado — ${shortId}`),
    html: renderLayout({
      title: 'Pedido confirmado',
      preheader: `Pedido ${shortId} • ${fmtBRL(total)} • pagamento aprovado`,
      brandName,
      contentHtml,
      footerNote: 'Confirmação automática de pagamento e criação do pedido.',
      siteUrl: baseUrl,
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
    notificationKind = 'status',
    shippingTracking,
    shippingCarrier,
    trackingUrl,
    productionEta,
    cancelledBy,
    reviewLink,
    orderUrl,
    siteUrl,
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
  const kind = String(notificationKind || 'status').toLowerCase();
  const isVipOrder = String(orderType || '').toLowerCase() === 'vip';
  const baseUrl = getSiteUrl(siteUrl);
  const accountUrl = String(orderUrl || (baseUrl ? `${baseUrl}/#/conta` : '')).trim();
  const selectedVipItems = Array.isArray(vipSelection?.selected_options) ? vipSelection.selected_options : [];
  const regularItems = Array.isArray(items) ? items : [];
  const hasVisualItems = isVipOrder ? selectedVipItems.length > 0 : regularItems.length > 0;
  const carrierRaw = String(shippingCarrier || '').trim().toLowerCase();
  const carrierLabel = ({ correios: 'Correios', jadlog: 'Jadlog', loggi: 'Loggi' })[carrierRaw] || String(shippingCarrier || '').trim();
  const paymentLabel = formatPaymentLabel(paymentMethod);

  const titleByStatus = {
    recebido: isVipOrder ? 'Ciclo VIP confirmado' : 'Pedido recebido',
    editavel: isVipOrder ? 'Escolhas do ciclo liberadas' : 'Pedido aguardando ajustes',
    em_producao: isVipOrder ? 'Miniaturas VIP em produção' : 'Pedido em produção',
    pronto: isVipOrder ? 'Envio VIP pronto' : 'Pedido pronto',
    enviado: isVipOrder ? 'Envio VIP despachado' : 'Pedido enviado',
    entregue: isVipOrder ? 'Envio VIP entregue' : 'Pedido entregue',
    cancelado: 'Pedido cancelado',
    reembolsado: 'Pedido reembolsado',
  };

  let baseTitle = titleByStatus[status] || 'Atualização do pedido';
  if (kind === 'tracking') baseTitle = 'Rastreio atualizado';
  if (kind === 'eta') baseTitle = 'Previsão de produção atualizada';

  let intro = 'Seu pedido recebeu uma atualização.';
  let highlight = '';
  let ctaHref = '';
  let ctaText = '';
  let accent = 'rgba(6,182,212,.12)';
  let accentBorder = 'rgba(6,182,212,.25)';
  let accentColor = '#a5f3fc';

  if (kind === 'tracking') {
    intro = isVipOrder
      ? 'Atualizamos os dados de rastreio do seu envio VIP.'
      : 'Atualizamos os dados de rastreio do seu pedido.';
    highlight = shippingTracking
      ? `Novo código de rastreio: ${shippingTracking}${carrierLabel ? ` • ${carrierLabel}` : ''}.`
      : 'Os dados de transporte foram atualizados pela nossa equipe.';
    ctaHref = trackingUrl || accountUrl;
    ctaText = trackingUrl ? 'Acompanhar entrega' : 'Ver meu pedido';
    accent = 'rgba(168,85,247,.12)';
    accentBorder = 'rgba(168,85,247,.25)';
    accentColor = '#ddd6fe';
  } else if (kind === 'eta') {
    intro = 'A previsão informada para a produção do seu pedido foi atualizada.';
    highlight = productionEta
      ? `Nova estimativa: ${productionEta}.`
      : 'Consulte a área de pedidos para acompanhar a estimativa mais recente.';
    ctaHref = accountUrl;
    ctaText = 'Ver andamento do pedido';
    accent = 'rgba(245,158,11,.12)';
    accentBorder = 'rgba(245,158,11,.25)';
    accentColor = '#fde68a';
  } else if (status === 'recebido') {
    if (isVipOrder) {
      intro = 'Seu ciclo VIP foi confirmado e já está registrado em nossa fila.';
      highlight = hasVisualItems
        ? 'Sua seleção foi registrada. Avisaremos quando as miniaturas entrarem em produção.'
        : 'Acesse a Área VIP para conferir o ciclo e registrar suas escolhas.';
      ctaHref = reviewLink || accountUrl;
      ctaText = reviewLink ? 'Abrir Área VIP' : 'Ver meu pedido';
    } else {
      intro = 'Seu pedido foi recebido e está aguardando a próxima etapa do atendimento.';
      highlight = 'Você será avisado quando a produção começar.';
      ctaHref = accountUrl;
      ctaText = 'Acompanhar pedido';
    }
    accent = 'rgba(34,197,94,.12)';
    accentBorder = 'rgba(34,197,94,.25)';
    accentColor = '#bbf7d0';
  } else if (status === 'editavel') {
    intro = isVipOrder
      ? 'As escolhas do seu ciclo VIP estão liberadas.'
      : 'Seu pedido está aguardando a confirmação de alguns detalhes antes da produção.';
    highlight = isVipOrder
      ? 'Selecione as miniaturas dentro do prazo do ciclo para que a produção siga sem atrasos.'
      : 'Acompanhe a área de pedidos ou aguarde o contato da nossa equipe.';
    ctaHref = reviewLink || accountUrl;
    ctaText = isVipOrder ? 'Escolher miniaturas' : 'Ver meu pedido';
    accent = 'rgba(168,85,247,.12)';
    accentBorder = 'rgba(168,85,247,.25)';
    accentColor = '#ddd6fe';
  } else if (status === 'em_producao') {
    intro = isVipOrder
      ? 'As miniaturas selecionadas já entraram em produção no estúdio.'
      : 'Seu pedido entrou em produção e nossa equipe já está trabalhando nele.';
    highlight = productionEta
      ? `Estimativa atual: ${productionEta}.`
      : 'Avisaremos assim que a produção for concluída.';
    ctaHref = accountUrl;
    ctaText = 'Ver andamento';
  } else if (status === 'pronto') {
    intro = isVipOrder
      ? 'As miniaturas do seu ciclo ficaram prontas e estão em preparação para postagem.'
      : 'Seu pedido ficou pronto e está em preparação para envio.';
    highlight = 'Quando a postagem for realizada, enviaremos o código de rastreio por e-mail.';
    ctaHref = accountUrl;
    ctaText = 'Ver meu pedido';
    accent = 'rgba(245,158,11,.12)';
    accentBorder = 'rgba(245,158,11,.25)';
    accentColor = '#fde68a';
  } else if (status === 'enviado') {
    intro = isVipOrder
      ? 'Seu envio VIP foi despachado e está a caminho.'
      : 'Seu pedido foi despachado e está a caminho do endereço informado.';
    highlight = shippingTracking
      ? `Código de rastreio: ${shippingTracking}${carrierLabel ? ` • ${carrierLabel}` : ''}.`
      : 'A postagem foi registrada. O rastreio pode levar algum tempo para aparecer no sistema da transportadora.';
    ctaHref = trackingUrl || accountUrl;
    ctaText = trackingUrl ? 'Acompanhar entrega' : 'Ver meu pedido';
    accent = 'rgba(168,85,247,.12)';
    accentBorder = 'rgba(168,85,247,.25)';
    accentColor = '#ddd6fe';
  } else if (status === 'entregue') {
    intro = isVipOrder
      ? 'Seu envio VIP foi marcado como entregue. Esperamos que você aproveite muito as miniaturas.'
      : 'Seu pedido foi marcado como entregue. Esperamos que você tenha gostado da sua peça.';
    highlight = 'Sua avaliação ajuda a Cubo Criativo e também outros clientes.';
    ctaHref = reviewLink || accountUrl;
    ctaText = reviewLink ? (isVipOrder ? 'Avaliar envio VIP' : 'Avaliar pedido') : 'Ver meu pedido';
    accent = 'rgba(34,197,94,.12)';
    accentBorder = 'rgba(34,197,94,.25)';
    accentColor = '#bbf7d0';
  } else if (status === 'cancelado') {
    intro = cancelledBy === 'customer'
      ? 'Registramos sua solicitação de cancelamento.'
      : 'Seu pedido foi cancelado pela loja.';
    highlight = 'Se houve pagamento, a análise e o reembolso seguirão as condições informadas para o pedido.';
    ctaHref = accountUrl;
    ctaText = 'Consultar pedido';
    accent = 'rgba(239,68,68,.12)';
    accentBorder = 'rgba(239,68,68,.25)';
    accentColor = '#fecaca';
  } else if (status === 'reembolsado') {
    intro = 'O reembolso do seu pedido foi registrado.';
    highlight = 'O prazo para o valor aparecer depende da forma de pagamento, do banco ou da operadora.';
    ctaHref = accountUrl;
    ctaText = 'Consultar pedido';
    accent = 'rgba(245,158,11,.12)';
    accentBorder = 'rgba(245,158,11,.25)';
    accentColor = '#fde68a';
  }

  const pills = `
    <div style="margin:0 0 6px;">
      <span style="display:inline-block;padding:7px 11px;border-radius:999px;background:${accent};border:1px solid ${accentBorder};color:${accentColor};font-weight:800;font-size:12px;margin:0 7px 8px 0;">${esc(statusLabelPt(status))}</span>
      <span style="display:inline-block;padding:7px 11px;border-radius:999px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.10);color:#e2e8f0;font-weight:800;font-size:12px;margin:0 7px 8px 0;">${isVipOrder ? 'Clube VIP' : 'Loja'}</span>
      ${paymentLabel ? `<span style="display:inline-block;padding:7px 11px;border-radius:999px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.10);color:#e2e8f0;font-weight:800;font-size:12px;margin:0 7px 8px 0;">${esc(paymentLabel)}</span>` : ''}
      ${Number.isFinite(Number(total)) ? `<span style="display:inline-block;padding:7px 11px;border-radius:999px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.10);color:#e2e8f0;font-weight:800;font-size:12px;margin:0 7px 8px 0;">${esc(fmtBRL(total))}</span>` : ''}
    </div>`;

  const meta = renderKeyValueCard(isVipOrder ? 'Resumo do ciclo' : 'Resumo do pedido', [
    { label: 'Pedido', value: shortId },
    { label: 'Status', value: statusLabelPt(status) },
    { label: 'Plano VIP', value: vipPlanId ? String(vipPlanId).replaceAll('_', ' ') : '' },
    { label: 'Estimativa', value: productionEta || '' },
    { label: 'Transportadora', value: carrierLabel || '' },
    { label: 'Rastreio', value: shippingTracking || '' },
    { label: 'Total', value: Number.isFinite(Number(total)) ? fmtBRL(total) : '' },
  ]);

  const shouldShowItemImages = kind === 'status' && (status === 'recebido' || status === 'em_producao');
  const visualBlock = !shouldShowItemImages
    ? ''
    : isVipOrder
      ? renderShowcaseGrid(
          selectedVipItems.map((it) => ({
            name: it?.title || it?.name,
            image_url: it?.image_url || it?.img,
            subtitle: 'Miniatura selecionada',
          })),
          {
            title: status === 'em_producao' ? 'Miniaturas em produção' : 'Miniaturas selecionadas',
            emptyText: status === 'em_producao'
              ? 'As miniaturas deste ciclo já estão em produção. Avisaremos quando houver uma nova etapa.'
              : '',
          }
        )
      : renderShowcaseGrid(
          regularItems.map((it) => ({
            name: it?.name || it?.product_name,
            image_url: it?.img || it?.product_image_url,
            subtitle: it?.scale ? `Escala ${it.scale}` : '',
          })),
          { title: status === 'em_producao' ? 'Itens em produção' : 'Itens do pedido' }
        );

  const primaryAction = ctaHref && ctaText ? renderActionButton(ctaHref, ctaText) : '';
  const secondaryAction = accountUrl && ctaHref && accountUrl !== ctaHref
    ? renderActionButton(accountUrl, 'Ver detalhes do pedido', { secondary: true })
    : '';

  const contentHtml = `
    ${renderEmailSummaryBanner({
      eyebrow: kind === 'tracking' ? 'Transporte' : kind === 'eta' ? 'Produção' : 'Atualização do pedido',
      title: baseTitle,
      description: `Pedido ${shortId}`,
    })}
    ${pills}
    <div style="color:#cbd5e1;font-size:14px;line-height:1.7;">
      Olá <b style="color:#f8fafc;">${esc(customerName || 'cliente')}</b>! ${esc(intro)}
    </div>
    <div style="margin-top:14px;padding:13px 15px;border-radius:14px;background:${accent};border:1px solid ${accentBorder};color:${accentColor};font-size:12px;line-height:1.65;">${esc(highlight)}</div>
    ${meta}
    ${visualBlock}
    ${primaryAction || secondaryAction ? `<div style="margin-top:18px;">${primaryAction}${secondaryAction}</div>` : ''}
    ${renderSupportCard({ supportEmail, whatsapp })}
  `;

  const subjectPrefix = kind === 'tracking'
    ? 'Rastreio atualizado'
    : kind === 'eta'
      ? 'Previsão atualizada'
      : baseTitle;

  return {
    subject: withBrandSubject(brandName, `${subjectPrefix} — ${shortId}`),
    html: renderLayout({
      title: baseTitle,
      preheader: `Pedido ${shortId} • ${kind === 'tracking' ? 'rastreio atualizado' : kind === 'eta' ? 'previsão atualizada' : statusLabelPt(status)}`,
      brandName,
      contentHtml,
      footerNote: 'Notificação automática sobre o andamento do seu pedido.',
      siteUrl: baseUrl,
    }),
  };
}


export function renderPixReminderEmail(payload) {
  const {
    brandName,
    orderId,
    customerName,
    total,
    paymentUrl,
    orderUrl,
    siteUrl,
    supportEmail,
    whatsapp,
  } = payload || {};
  const shortId = orderId ? String(orderId).slice(0, 8) : '-';
  const baseUrl = getSiteUrl(siteUrl);
  const accountUrl = String(orderUrl || (baseUrl ? `${baseUrl}/#/conta` : '')).trim();

  const contentHtml = `
    ${renderEmailSummaryBanner({
      eyebrow: 'Pagamento pendente',
      title: 'Seu Pix ainda não foi confirmado',
      description: `Pedido ${shortId} • ${fmtBRL(total)}`,
    })}
    ${renderMetaPills([
      { label: 'Pedido', value: shortId },
      { label: 'Valor', value: fmtBRL(total) },
      { label: 'Status', value: 'Aguardando Pix' },
    ])}
    <div style="margin-top:6px;color:#cbd5e1;font-size:14px;line-height:1.7;">
      Olá <b style="color:#f8fafc;">${esc(customerName || 'cliente')}</b>! O pagamento Pix do seu pedido ainda aparece como pendente.
    </div>
    <div style="margin-top:14px;padding:13px 15px;border-radius:14px;background:rgba(245,158,11,.10);border:1px solid rgba(245,158,11,.24);color:#fde68a;font-size:12px;line-height:1.65;">
      Se você já realizou o pagamento, pode ignorar esta mensagem. A confirmação pode levar alguns minutos.
    </div>
    ${renderKeyValueCard('Resumo do pagamento', [
      { label: 'Pedido', value: shortId },
      { label: 'Forma', value: 'Pix' },
      { label: 'Valor', value: fmtBRL(total) },
      { label: 'Status', value: 'Pendente' },
    ])}
    ${paymentUrl || accountUrl ? `<div style="margin-top:18px;">${renderActionButton(paymentUrl || accountUrl, paymentUrl ? 'Abrir pagamento Pix' : 'Ver pedido')}${paymentUrl && accountUrl ? renderActionButton(accountUrl, 'Ver meus pedidos', { secondary: true }) : ''}</div>` : ''}
    ${renderSupportCard({ supportEmail, whatsapp })}
  `;

  return {
    subject: withBrandSubject(brandName, `Pix pendente — pedido ${shortId}`),
    html: renderLayout({
      title: 'Lembrete de pagamento Pix',
      preheader: `Pedido ${shortId} • Pix pendente • ${fmtBRL(total)}`,
      brandName,
      contentHtml,
      footerNote: 'Lembrete automático de pagamento pendente. Se o Pix já foi pago, desconsidere.',
      siteUrl: baseUrl,
    }),
  };
}

export function renderManualOrderPaymentEmail(payload) {
  const {
    brandName,
    orderId,
    customerName,
    total,
    paymentUrl,
    orderUrl,
    siteUrl,
    items,
    supportEmail,
    whatsapp,
  } = payload || {};
  const shortId = orderId ? String(orderId).slice(0, 8) : '-';
  const baseUrl = getSiteUrl(siteUrl);
  const accountUrl = String(orderUrl || (baseUrl ? `${baseUrl}/#/conta` : '')).trim();

  const contentHtml = `
    ${renderEmailSummaryBanner({
      eyebrow: 'Pedido preparado pela equipe',
      title: 'Seu link de pagamento está pronto',
      description: `Pedido ${shortId} • ${fmtBRL(total)}`,
    })}
    ${renderMetaPills([
      { label: 'Pedido', value: shortId },
      { label: 'Total', value: fmtBRL(total) },
      { label: 'Status', value: 'Aguardando pagamento' },
    ])}
    <div style="margin-top:6px;color:#cbd5e1;font-size:14px;line-height:1.7;">
      Olá <b style="color:#f8fafc;">${esc(customerName || 'cliente')}</b>! A equipe da Cubo Criativo preparou um pedido para você.
      Confira os itens abaixo e use o botão para concluir o pagamento com segurança.
    </div>
    ${renderKeyValueCard('Resumo do pedido', [
      { label: 'Pedido', value: shortId },
      { label: 'Total', value: fmtBRL(total) },
      { label: 'Status', value: 'Aguardando pagamento' },
    ])}
    <div style="margin-top:16px;">
      <div style="font-size:13px;font-weight:800;color:#f8fafc;margin-bottom:7px;">Itens</div>
      ${renderItemsTable(items)}
    </div>
    <div style="margin-top:14px;padding:13px 15px;border-radius:14px;background:rgba(6,182,212,.09);border:1px solid rgba(103,232,249,.20);color:#cffafe;font-size:12px;line-height:1.65;">
      Sua conta de acompanhamento já está vinculada a este e-mail. Depois do pagamento, o pedido aparecerá em <b>Meus pedidos</b>.
    </div>
    ${paymentUrl || accountUrl ? `<div style="margin-top:18px;">${renderActionButton(paymentUrl || accountUrl, paymentUrl ? 'Pagar meu pedido' : 'Ver pedido')}${paymentUrl && accountUrl ? renderActionButton(accountUrl, 'Acessar minha conta', { secondary: true }) : ''}</div>` : ''}
    ${renderSupportCard({ supportEmail, whatsapp })}
  `;

  return {
    subject: withBrandSubject(brandName, `Pedido criado para você — ${shortId}`),
    html: renderLayout({
      title: 'Pedido aguardando pagamento',
      preheader: `Pedido ${shortId} • ${fmtBRL(total)} • link de pagamento`,
      brandName,
      contentHtml,
      footerNote: 'Mensagem automática referente a um pedido criado pela equipe da Cubo Criativo.',
      siteUrl: baseUrl,
    }),
  };
}

export function renderOwnerVipWelcomeEmail(payload) {
  const p = payload || {};
  const brandName = p.brandName || 'Cubo Criativo';
  const customer = p.customer || {};
  const orderId = p.orderId || '';
  const shortId = String(orderId || '').slice(0, 8) || 'VIP';
  const createdAt = p.createdAt;
  const paymentMethod = p.paymentMethod || 'Pagamento aprovado';
  const total = Number.isFinite(Number(p.total)) ? Number(p.total) : null;
  const planName = p.planName || 'Plano VIP';
  const planDescription = p.planDescription || '';
  const recurrenceLabel = p.recurrenceLabel || 'Mensal';
  const miniaturesCount = Number(p.miniaturesCount || 0) || 0;
  const bossCount = Number(p.bossCount || 0) || 0;
  const scale = p.scale || '';
  const { date, time } = formatDateTimeBR(createdAt);

  const meta = renderMetaPills([
    { label: 'VIP', value: 'Novo assinante' },
    { label: 'Plano', value: planName },
    ...(total != null ? [{ label: 'Valor', value: fmtBRL(total) }] : []),
  ]);

  const details = renderKeyValueCard('Detalhes da assinatura', [
    { label: 'Pedido', value: shortId },
    { label: 'Plano', value: planName },
    { label: 'Recorrência', value: recurrenceLabel },
    ...(total != null ? [{ label: 'Valor', value: fmtBRL(total) }] : []),
    ...(miniaturesCount ? [{ label: 'Miniaturas incluídas', value: String(miniaturesCount) }] : []),
    ...(bossCount ? [{ label: 'Boss inclusos', value: String(bossCount) }] : []),
    ...(scale ? [{ label: 'Escala', value: scale }] : []),
    { label: 'Pagamento', value: paymentMethod },
    { label: 'Data', value: date },
    { label: 'Hora', value: time },
  ]);

  const customerCard = renderKeyValueCard('Cliente', [
    { label: 'Nome', value: customer?.name || '' },
    { label: 'Email', value: customer?.email || '' },
    { label: 'Telefone', value: customer?.phone || '' },
    { label: 'Endereço', value: customer?.address || '' },
  ]);

  const contentHtml = `
    ${renderEmailSummaryBanner({ eyebrow: 'Controle interno', title: 'Nova assinatura VIP confirmada', description: `Plano assinado: ${planName}.` })}
    ${meta}
    <div style="color:#cbd5e1;font-size:13px;line-height:1.6;">Uma nova assinatura VIP foi confirmada. Abaixo estão os dados do cliente e do plano para controle interno.</div>
    ${details}
    ${planDescription ? `<div style="margin-top:14px;padding:12px 14px;border-radius:14px;background:rgba(168,85,247,.08);border:1px solid rgba(168,85,247,.18);color:#f5d0fe;font-size:12px;line-height:1.55;"><b>Descrição do plano:</b><br/>${esc(planDescription)}</div>` : ''}
    ${customerCard}
  `;

  return {
    subject: withBrandSubject(brandName, `Nova assinatura VIP — ${planName} — ${total != null ? fmtBRL(total) : shortId}`),
    html: renderLayout({
      title: 'Nova assinatura VIP',
      preheader: `${planName} • Pedido ${shortId}`,
      brandName,
      contentHtml,
      footerNote: 'Email interno de controle de assinatura VIP.',
    }),
  };
}

export function renderOwnerVipUpgradeEmail(payload) {
  const p = payload || {};
  const brandName = p.brandName || 'Cubo Criativo';
  const customer = p.customer || {};
  const orderId = p.orderId || '';
  const shortId = String(orderId || '').slice(0, 8) || 'UPGRADE';
  const createdAt = p.createdAt;
  const paymentMethod = p.paymentMethod || 'Pagamento aprovado';
  const amountCharged = Number.isFinite(Number(p.amountCharged)) ? Number(p.amountCharged) : null;
  const fromPlanName = p.fromPlanName || 'Plano atual';
  const toPlanName = p.toPlanName || 'Novo plano VIP';
  const recurrenceLabel = p.recurrenceLabel || 'Mensal';
  const miniaturesCount = Number(p.miniaturesCount || 0) || 0;
  const bossCount = Number(p.bossCount || 0) || 0;
  const scale = p.scale || '';
  const { date, time } = formatDateTimeBR(createdAt);

  const meta = renderMetaPills([
    { label: 'VIP', value: 'Upgrade' },
    { label: 'De', value: fromPlanName },
    { label: 'Para', value: toPlanName },
    ...(amountCharged != null ? [{ label: 'Cobrado', value: fmtBRL(amountCharged) }] : []),
  ]);

  const details = renderKeyValueCard('Detalhes do upgrade', [
    { label: 'Pedido', value: shortId },
    { label: 'Upgrade', value: `${fromPlanName} → ${toPlanName}` },
    { label: 'Recorrência', value: recurrenceLabel },
    ...(amountCharged != null ? [{ label: 'Valor cobrado', value: fmtBRL(amountCharged) }] : []),
    ...(miniaturesCount ? [{ label: 'Miniaturas incluídas', value: String(miniaturesCount) }] : []),
    ...(bossCount ? [{ label: 'Boss inclusos', value: String(bossCount) }] : []),
    ...(scale ? [{ label: 'Escala', value: scale }] : []),
    { label: 'Pagamento', value: paymentMethod },
    { label: 'Data', value: date },
    { label: 'Hora', value: time },
  ]);

  const customerCard = renderKeyValueCard('Cliente', [
    { label: 'Nome', value: customer?.name || '' },
    { label: 'Email', value: customer?.email || '' },
    { label: 'Telefone', value: customer?.phone || '' },
    { label: 'Endereço', value: customer?.address || '' },
  ]);

  const contentHtml = `
    ${renderEmailSummaryBanner({ eyebrow: 'Controle interno', title: 'Upgrade VIP confirmado', description: `${fromPlanName} → ${toPlanName}` })}
    ${meta}
    <div style="color:#cbd5e1;font-size:13px;line-height:1.6;">Um cliente realizou upgrade de assinatura VIP. Confira abaixo os detalhes para controle interno.</div>
    ${details}
    ${customerCard}
  `;

  return {
    subject: withBrandSubject(brandName, `Upgrade VIP — ${fromPlanName} → ${toPlanName}`),
    html: renderLayout({
      title: 'Upgrade VIP',
      preheader: `${fromPlanName} → ${toPlanName} • Pedido ${shortId}`,
      brandName,
      contentHtml,
      footerNote: 'Email interno de controle de upgrade VIP.',
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
    ${renderEmailSummaryBanner({ eyebrow: 'Clube VIP', title: 'Upgrade confirmado', description: `Seu plano agora é ${toPlanName}.` })}
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
    subject: withBrandSubject(brandName, `Upgrade VIP confirmado — ${toPlanName}`),
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
    ${renderEmailSummaryBanner({ eyebrow: 'Clube VIP', title: 'Assinatura VIP ativada', description: `Plano confirmado: ${planName}.` })}
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
    subject: withBrandSubject(brandName, `Assinatura VIP confirmada — ${planName}`),
    html: renderLayout({
      title: 'Assinatura VIP ativada',
      preheader: `Plano ${planName} • Pedido ${shortId}`,
      brandName,
      contentHtml,
      footerNote: 'Mensagem automática de ativação da sua assinatura VIP.',
    }),
  };
}
