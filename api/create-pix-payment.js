import crypto from "crypto";
import { MercadoPagoConfig, Payment } from "mercadopago";

export const config = { runtime: "nodejs" };

function maskToken(t) {
  if (!t) return "(missing)";
  const s = String(t);
  // mostra só prefixo e final pra debug (não vaza segredo)
  return `${s.slice(0, 12)}...${s.slice(-6)}`;
}

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
    // ✅ Debug seguro: confirma qual token a Vercel está lendo
    console.log("MP_ACCESS_TOKEN:", maskToken(process.env.MP_ACCESS_TOKEN));

    const body = await request.json();
    const amount = toNumberBRL(body.amount);
    const email = String(body.email || "").trim();
    const name = String(body.name || "").trim();

    if (!email) return new Response("Missing payer email", { status: 400 });

    const items = Array.isArray(body.items) ? body.items : [];

    const payment = new Payment(mpClient);

    const origin = String(body.origin || "").trim();
    const notificationUrl = origin ? `${origin}/api/mp-webhook` : undefined;

    console.log("Pix create:", {
      amount,
      email,
      hasOrigin: Boolean(origin),
      notificationUrl,
      itemsCount: items.length,
    });

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
        ...(notificationUrl ? { notification_url: notificationUrl } : {}),
      },
      requestOptions: {
        idempotencyKey: crypto.randomUUID(),
      },
    });

    const tx = result.point_of_interaction?.transaction_data;

    console.log("Pix created:", {
      id: result.id,
      status: result.status,
      hasQr: Boolean(tx?.qr_code),
      hasQrBase64: Boolean(tx?.qr_code_base64),
    });

    return Response.json({
      id: String(result.id),
      status: result.status,
      qr_code: tx?.qr_code || null,
      qr_code_base64: tx?.qr_code_base64 || null,
      ticket_url: tx?.ticket_url || null,
      external_reference: result.external_reference || null,
    });
  } catch (err) {
    // ✅ log detalhado no servidor
    console.error("Pix error full:", err);

    // ✅ mensagem mais útil pro front
    const msg =
      err?.message ||
      err?.cause?.message ||
      "Erro desconhecido ao criar Pix";

    return new Response(`Pix error: ${msg}`, { status: 500 });
  }
}
