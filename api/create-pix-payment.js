import crypto from "crypto";
import { MercadoPagoConfig, Payment } from "mercadopago";

export const config = { runtime: "nodejs" };

const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
});

function toNumberBRL(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw new Error("Valor inválido");
  return Number(n.toFixed(2));
}

export async function POST(request) {
  try {
    const body = await request.json();
    const amount = toNumberBRL(body.amount);
    const email = String(body.email || "").trim();
    const name = String(body.name || "").trim();

    if (!email) return new Response("Missing payer email", { status: 400 });

    // Você pode mandar seu carrinho pra cá e guardar no metadata (sem DB)
    const items = Array.isArray(body.items) ? body.items : [];

    const payment = new Payment(mpClient);

    const result = await payment.create({
      body: {
        transaction_amount: amount,
        description: body.description || "Pagamento via Pix",
        payment_method_id: "pix",
        payer: {
          email,
          first_name: name.split(" ")[0] || "",
          last_name: name.split(" ").slice(1).join(" ") || "",
        },
        external_reference: body.orderId || crypto.randomUUID(),
        metadata: {
          items_json: JSON.stringify(items).slice(0, 4500),
        },
        // Se você quiser que o MP chame seu webhook:
        notification_url: `${body.origin || ""}/api/mp-webhook`,
      },
      requestOptions: {
        idempotencyKey: crypto.randomUUID(),
      },
    });

    const tx = result.point_of_interaction?.transaction_data;

    return Response.json({
      id: String(result.id),
      status: result.status, // normalmente "pending"
      qr_code: tx?.qr_code || null, // copia e cola
      qr_code_base64: tx?.qr_code_base64 || null, // imagem
      ticket_url: tx?.ticket_url || null,
      external_reference: result.external_reference || null,
    });
  } catch (err) {
    return new Response(`Pix error: ${err.message}`, { status: 500 });
  }
}
