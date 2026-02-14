import Stripe from "stripe";
import { Resend } from "resend";

export const config = { runtime: "nodejs" };

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request) {
  const sig = request.headers.get("stripe-signature");
  const rawBody = await request.text(); // precisa ser "raw" pro Stripe validar assinatura :contentReference[oaicite:7]{index=7}

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return new Response(`Webhook signature error: ${err.message}`, { status: 400 });
  }

  // Evento mais comum pra "pedido pago via Checkout"
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    // Pega itens do carrinho (line items) pela session.id :contentReference[oaicite:8]{index=8}
    const items = await stripe.checkout.sessions.listLineItems(session.id, {
      limit: 100,
    });

    const customerEmail =
      session.customer_details?.email || session.customer_email || "(sem email)";
    const customerName = session.customer_details?.name || "(sem nome)";
    const phone = session.customer_details?.phone || "(sem telefone)";
    const amountTotal = (session.amount_total ?? 0) / 100;

    const addressObj =
      session.customer_details?.address || session.shipping_details?.address || null;
    const address = addressObj
      ? `${addressObj.line1 || ""} ${addressObj.line2 || ""}<br/>
         ${addressObj.city || ""} - ${addressObj.state || ""}<br/>
         ${addressObj.postal_code || ""} - ${addressObj.country || ""}`.trim()
      : "(não coletado)";

    const itemsHtml = items.data
      .map((li) => {
        const name = li.description || "Item";
        const qty = li.quantity || 1;
        const price = ((li.amount_total ?? 0) / 100).toFixed(2);
        return `<li>${qty}× ${name} — R$ ${price}</li>`;
      })
      .join("");

    const subject = `Novo pedido pago — R$ ${amountTotal.toFixed(2)} — ${customerEmail}`;

    const html = `
      <h2>Novo pedido pago ✅</h2>
      <p><b>Checkout Session:</b> ${session.id}</p>
      <p><b>Valor total:</b> R$ ${amountTotal.toFixed(2)}</p>

      <h3>Cliente</h3>
      <p>
        <b>Nome:</b> ${customerName}<br/>
        <b>Email:</b> ${customerEmail}<br/>
        <b>Telefone:</b> ${phone}
      </p>

      <h3>Endereço</h3>
      <p>${address}</p>

      <h3>Itens</h3>
      <ul>${itemsHtml}</ul>
    `;

    const to = (process.env.ORDER_EMAIL_TO || "").trim();
    const from = (process.env.RESEND_FROM || "").trim();

    if (!to || !from) {
      return new Response("Missing ORDER_EMAIL_TO or RESEND_FROM env vars.", {
        status: 500,
      });
    }

    const result = await resend.emails.send({
      from,
      to: [to],
      subject,
      html,
    });

    if (result.error) {
      return new Response(`Email error: ${result.error.message}`, { status: 500 });
    }
  }

  return new Response("ok", { status: 200 });
}
