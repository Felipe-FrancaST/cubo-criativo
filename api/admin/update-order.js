/** Admin: atualiza pedido + envia email por status */
import { supabaseAdmin } from "../../server/supabase.js";
import { requireAdmin } from "../../server/admin/adminAuth.js";

export const config = { runtime: "nodejs" };
function safeBody(req){ if(!req.body) return {}; if(typeof req.body==='string'){ try{return JSON.parse(req.body)}catch{return {}} } return req.body; }
const ALLOWED_PROD_STATUS = new Set(["recebido","em_producao","pronto","enviado","entregue","cancelado","reembolsado"]);

async function sendResendEmail({to,subject,html}){
  const apiKey=String(process.env.RESEND_API_KEY||'').trim(); const from=String(process.env.RESEND_FROM||'').trim();
  if(!apiKey||!from||!to) return { skipped:true };
  const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({from,to:[to],subject,html})});
  return { ok:r.ok, data: await r.json().catch(()=>({})) };
}
function emailHtml({title,msg,details,ctaHref,ctaText}){
  return `<!doctype html><html><body style="margin:0;background:#0b1020;color:#e2e8f0;font-family:Arial,sans-serif"><div style="max-width:620px;margin:24px auto;padding:20px;border-radius:16px;background:#111827;border:1px solid rgba(255,255,255,.08)"><h2 style="margin:0 0 12px">${title}</h2><p style="color:#cbd5e1;line-height:1.6">${msg}</p>${details?`<div style="margin-top:14px;padding:12px;border-radius:12px;background:#0b1220;border:1px solid rgba(255,255,255,.06);color:#cbd5e1">${details}</div>`:''}${ctaHref?`<div style="margin-top:16px"><a href="${ctaHref}" style="display:inline-block;background:#22c55e;color:#00110a;text-decoration:none;padding:10px 14px;border-radius:10px;font-weight:700">${ctaText||'Abrir'}</a></div>`:''}<p style="margin-top:16px;color:#94a3b8;font-size:12px">Cubo Criativo</p></div></body></html>`;
}
async function notifyStatus({order,nextStatus,shipping_tracking,production_eta,cancelled_by}){
  const to = String(order?.customer_email||'').trim(); if(!to) return;
  const shortId = String(order.id||'').slice(0,8);
  const baseUrl = String(process.env.APP_URL||process.env.NEXT_PUBLIC_SITE_URL||'').trim();
  const reviewLink = baseUrl ? `${baseUrl}/` : null;
  let title='Atualização do pedido'; let msg='Seu pedido foi atualizado.'; let details=`Pedido #${shortId}`;
  if(nextStatus==='recebido') { title='Pedido recebido'; msg='Recebemos seu pedido e o pagamento foi confirmado. Em breve iniciaremos a produção da sua peça.'; }
  if(nextStatus==='em_producao') { title='Sua peça entrou em produção'; msg='Boas notícias: sua peça já está em produção.'; details = `Pedido #${shortId}${production_eta?`<br/>Estimativa informada: <b>${String(production_eta)}</b>`:''}`; }
  if(nextStatus==='enviado') { title='Seu pedido foi enviado'; msg='Seu pedido foi enviado e já está a caminho.'; details = `Pedido #${shortId}${shipping_tracking?`<br/>Código de rastreio: <b>${String(shipping_tracking)}</b>`:''}`; }
  if(nextStatus==='entregue') { title='Pedido entregue'; msg='Seu pedido foi marcado como entregue. Obrigado por comprar com a Cubo Criativo 💚'; details = `Pedido #${shortId}<br/>Se puder, deixe sua avaliação em “Meus pedidos”.`; }
  if(nextStatus==='cancelado') { title='Pedido cancelado'; msg=(cancelled_by==='customer') ? 'Recebemos seu cancelamento. Se houve pagamento, o reembolso será processado conforme a forma de pagamento.' : 'Seu pedido foi cancelado pela loja. Se houve pagamento, o reembolso será processado conforme a forma de pagamento.'; }
  if(nextStatus==='reembolsado') { title='Pedido reembolsado'; msg='Seu pedido foi reembolsado com sucesso. O valor será devolvido conforme o prazo da sua forma de pagamento.'; }
  await sendResendEmail({ to, subject: `${title} — Pedido ${shortId}`, html: emailHtml({ title, msg, details, ctaHref: nextStatus==='entregue'?reviewLink:null, ctaText:'Ir para o site e avaliar' }) });
}

export default async function handler(req,res){
  try{
    if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
    const auth=await requireAdmin(req); if(!auth.ok) return res.status(auth.status).json({error:auth.error});
    const body=safeBody(req); const order_id=String(body.order_id||'').trim(); if(!order_id) return res.status(400).json({error:'Missing order_id'});
    const sb=supabaseAdmin();
    const { data: currentOrder, error: currentErr } = await sb.from('orders').select('id,status,production_status,shipping_tracking,customer_email,customer_name').eq('id', order_id).maybeSingle();
    if (currentErr) return res.status(500).json({ error: currentErr.message || 'Failed to load order' });
    if (!currentOrder) return res.status(404).json({ error: 'Pedido não encontrado.' });
    const next={};
    if(body.production_status!==undefined){ const ps=String(body.production_status||'').trim().toLowerCase(); if(!ALLOWED_PROD_STATUS.has(ps)) return res.status(400).json({error:'Invalid production_status'}); next.production_status=ps; }
    if(body.shipping_tracking!==undefined){ const tr=String(body.shipping_tracking||'').trim(); next.shipping_tracking=tr||null; }
    const production_eta = String(body.production_eta || '').trim();
    const cancelled_by = String(body.cancelled_by || '').trim().toLowerCase();
    if(Object.keys(next).length===0 && !production_eta) return res.status(400).json({error:'No fields to update'});
    const currentPay = String(currentOrder?.status || '').toLowerCase();
    const wantsOrderFlowChange = Object.prototype.hasOwnProperty.call(next, 'production_status') || Object.prototype.hasOwnProperty.call(next, 'shipping_tracking');
    if (wantsOrderFlowChange && currentPay !== 'paid') {
      return res.status(400).json({ error: 'Só é possível alterar status/rastreio de pedidos com pagamento confirmado.' });
    }
    // tenta persistir estimativa se coluna existir
    if (production_eta) next.production_eta = production_eta;
    let updateResp = await sb.from('orders').update(next).eq('id', order_id);
    if (updateResp?.error && /production_eta|column/i.test(String(updateResp.error.message||''))) {
      const nextNoEta = { ...next }; delete nextNoEta.production_eta;
      updateResp = await sb.from('orders').update(nextNoEta).eq('id', order_id);
    }
    if(updateResp?.error) return res.status(500).json({error:updateResp.error.message||'Update failed'});

    const { data: order } = await sb.from('orders').select('id,customer_email,customer_name,production_status,shipping_tracking').eq('id', order_id).maybeSingle();
    if (next.production_status) {
      await notifyStatus({ order: { ...order, id: order_id }, nextStatus: next.production_status, shipping_tracking: next.shipping_tracking ?? order?.shipping_tracking, production_eta, cancelled_by });
    }
    return res.status(200).json({ ok:true });
  } catch(e){ console.error('admin/update-order error', e); return res.status(500).json({error:e?.message||String(e)}); }
}
