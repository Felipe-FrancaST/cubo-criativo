import { MercadoPagoConfig, Payment } from "mercadopago";
import { Resend } from "resend";

export const config = { runtime: "nodejs" };

const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
});
const paymentApi = new Payment(mpClient);

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request) {
  try {
    const payload = await request.json();

    // Normalmente vem algo como: { type: "payment", data: { id: "..." } }
    const paymentId = payload?.data?.id;
    if (!paymentId) return new Response("No payment id", { status: 200 });

    const p = await paymentApi.get({ id: paymentId });

    // status "approved" = pago
    if (p.status === "approved") {
      const to = (process.env.ORDER_EMAIL_TO || "").trim();
      const from = (process.env.RESEND_FROM || "").trim();
      if (!to || !from) return new Response("Missing email env vars", { status: 500 });

      const items = (() => {
        try {
          return JSON.parse(p.metadata?.items_json || "[]");
        } catch {
          return [];
        }
      })();

      const itemsHtml = items
        .map((it) => `<li>${it.qty ?? 1}× ${it.name ?? "Item"} — R$ ${Number(it.price ?? 0).toFixed(2)}</li>`)
        .join("");

      const html = `
        <h2>Pix confirmado ✅</h2>
        <p><b>Pagamento ID:</b> ${p.id}</p>
        <p><b>Status:</b> ${p.status}</p>
        <p><b>Valor:</b> R$ ${Number(p.transaction_amount ?? 0).toFixed(2)}</p>
        <p><b>Email:</b> ${p.payer?.email || "-"}</p>
        <p><b>Pedido:</b> ${p.external_reference || "-"}</p>
        <h3>Itens</h3>
        <ul>${itemsHtml || "<li>(sem itens no metadata)</li>"}</ul>
      `;

      const result = await resend.emails.send({
        from,
        to: [to],
        subject: `Pix confirmado — R$ ${Number(p.transaction_amount ?? 0).toFixed(2)}`,
        html,
      });

      if (result.error) {
        return new Response(`Email error: ${result.error.message}`, { status: 500 });
      }
    }

    return new Response("ok", { status: 200 });
  } catch (err) {
    return new Response(`Webhook error: ${err.message}`, { status: 500 });
  }
}
