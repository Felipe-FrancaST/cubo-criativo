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
