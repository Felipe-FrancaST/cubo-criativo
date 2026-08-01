/**
 * Vercel Serverless Function (para Vercel Cron)
 * Route: /api/cron/pix-reminders
 *
 * Envia lembrete por e-mail para pedidos Pix que ficaram pendentes.
 *
 * Segurança: exige header Authorization: Bearer <CRON_SECRET>
 *
 * Env vars:
 * - CRON_SECRET=...
 * - MP_ACCESS_TOKEN=...
 * - SUPABASE_URL=...
 * - SUPABASE_SERVICE_ROLE_KEY=...
 * - RESEND_API_KEY=re_...
 * - RESEND_FROM="Cubo Criativo <...>"
 */

import { supabaseAdmin } from "../../server/supabase.js";
import { cleanupOrder3dModel, shouldCleanupOrder3dForStatus } from "../../server/order3dCleanup.js";
import { renderPixReminderEmail } from "../../server/emailTemplates.js";

export const config = { runtime: "nodejs" };

function isValidEmail(value) {
  const v = String(value || "").trim();
  return v.includes("@") && v.length <= 254;
}

async function mpFetch(token, url) {
  const resp = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  const data = await resp.json().catch(() => ({}));
  return { ok: resp.ok, status: resp.status, data };
}

// Busca e-mail verdadeiro do usuário no Supabase Auth (Admin API)
async function fetchAuthUserEmail(sb, userId) {
  try {
    if (!userId) return null;
    const { data, error } = await sb.auth.admin.getUserById(userId);
    if (error) return null;
    const email = String(data?.user?.email || "").trim();
    return isValidEmail(email) ? email : null;
  } catch {
    return null;
  }
}

async function sendResendEmail({ apiKey, from, to, subject, html }) {
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html }),
  });
  const data = await resp.json().catch(() => ({}));
  return { ok: resp.ok, status: resp.status, data };
}


export default async function handler(req, res) {
  try {
    const secret = String(process.env.CRON_SECRET || "").trim();
    const auth = String(req.headers.authorization || "").trim();
    if (!secret || auth !== `Bearer ${secret}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const mpToken = String(process.env.MP_ACCESS_TOKEN || "").trim();
    if (!mpToken) return res.status(500).json({ error: "Missing MP_ACCESS_TOKEN" });

    const resendKey = String(process.env.RESEND_API_KEY || "").trim();
    const resendFrom = String(process.env.RESEND_FROM || "").trim();
    if (!resendKey || !resendFrom) {
      return res.status(500).json({ error: "Missing RESEND_API_KEY / RESEND_FROM" });
    }

    const sb = supabaseAdmin();

    // Janela: 30 minutos após criação (para evitar mandar na hora)
    const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    // Tenta filtrar usando coluna pix_reminder_sent_at (se existir). Se não existir, faz fallback.
    let orders = [];
    let queryError = null;

    const attempt = await sb
      .from("orders")
      .select(
        "id,user_id,status,total,currency,payment_provider,provider_payment_id,customer_email,customer_name,created_at,pix_reminder_sent_at"
      )
      .eq("payment_provider", "mercado_pago")
      .eq("status", "pending")
      .not("provider_payment_id", "is", null)
      .lt("created_at", cutoff)
      .is("pix_reminder_sent_at", null)
      .limit(50);

    if (attempt.error) {
      queryError = attempt.error;
      const fallback = await sb
        .from("orders")
        .select("id,user_id,status,total,currency,payment_provider,provider_payment_id,customer_email,customer_name,created_at")
        .eq("payment_provider", "mercado_pago")
        .eq("status", "pending")
        .not("provider_payment_id", "is", null)
        .lt("created_at", cutoff)
        .limit(50);
      if (fallback.error) {
        return res.status(500).json({ error: "Supabase query failed", details: fallback.error });
      }
      orders = fallback.data || [];
    } else {
      orders = attempt.data || [];
    }

    let sent = 0;
    let skipped = 0;

    for (const o of orders) {
      const orderId = String(o.id || "");
      const paymentId = String(o.provider_payment_id || "").trim();
      if (!orderId || !paymentId) {
        skipped++;
        continue;
      }

      // Confere status no Mercado Pago (evita lembrar se já pagou)
      const paymentResp = await mpFetch(mpToken, `https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`);
      if (!paymentResp.ok) {
        skipped++;
        continue;
      }
      const mp = paymentResp.data || {};
      const mpStatus = String(mp.status || "").toLowerCase();
      if (mpStatus !== "pending") {
        // best-effort: atualiza o pedido (se já aprovou/cancelou)
        try {
          const mapped = mpStatus === "approved" ? "paid" : (mpStatus === "rejected" || mpStatus === "cancelled") ? "failed" : "pending";
          await sb.from("orders").update({ status: mapped }).eq("id", orderId);
          if (shouldCleanupOrder3dForStatus(mapped)) await cleanupOrder3dModel(sb, orderId);
        } catch {
          // ignore
        }
        skipped++;
        continue;
      }

      const tx = mp.point_of_interaction?.transaction_data || {};
      const ticketUrl = String(tx.ticket_url || "").trim();

      // Email do cliente
      const email1 = isValidEmail(o.customer_email) ? String(o.customer_email).trim() : null;
      const email2 = await fetchAuthUserEmail(sb, o.user_id);
      const to = email1 || email2;
      if (!to) {
        skipped++;
        continue;
      }

      const amount = typeof o.total === "number" ? o.total : Number(o.total) || 0;
      const siteUrl = String(process.env.SITE_URL || process.env.APP_URL || process.env.NEXT_PUBLIC_SITE_URL || '').trim().replace(/\/$/, '');
      const mail = renderPixReminderEmail({
        brandName: process.env.BRAND_NAME || 'Cubo Criativo',
        orderId,
        customerName: o.customer_name || '',
        total: amount,
        paymentUrl: ticketUrl,
        orderUrl: siteUrl ? `${siteUrl}/conta` : '',
        siteUrl,
        supportEmail: process.env.SUPPORT_EMAIL || process.env.ORDER_EMAIL_TO || '',
        whatsapp: process.env.WHATSAPP_NUMBER || process.env.SUPPORT_WHATSAPP || '',
      });

      const emailResp = await sendResendEmail({
        apiKey: resendKey,
        from: resendFrom,
        to,
        subject: mail.subject,
        html: mail.html,
      });

      if (!emailResp.ok) {
        skipped++;
        continue;
      }

      sent++;
      // Marca como enviado (se as colunas existirem)
      try {
        await sb
          .from("orders")
          .update({
            pix_reminder_sent_at: new Date().toISOString(),
            pix_reminder_count: 1,
            pix_reminder_last_kind: "pending_30m",
          })
          .eq("id", orderId);
      } catch {
        // ignore (ex: colunas não existem)
      }
    }

    return res
      .status(200)
      .json({ ok: true, candidates: orders.length, sent, skipped, query_error: queryError || null });
  } catch (e) {
    console.error("pix-reminders cron error", e);
    return res.status(500).json({ error: e?.message || String(e) });
  }
}
