/** Admin: atualiza pedido + envia email por status */
import { supabaseAdmin } from "../../server/supabase.js";
import { requireAdmin } from "../../server/admin/adminAuth.js";
import { renderOrderStatusEmail } from "../../server/emailTemplates.js";

export const config = { runtime: "nodejs" };
function safeBody(req){ if(!req.body) return {}; if(typeof req.body==='string'){ try{return JSON.parse(req.body)}catch{return {}} } return req.body; }
const ALLOWED_PROD_STATUS = new Set(["editavel","recebido","em_producao","pronto","enviado","entregue","cancelado","reembolsado"]);

async function sendResendEmail({to,subject,html}){
  const apiKey=String(process.env.RESEND_API_KEY||'').trim(); const from=String(process.env.RESEND_FROM||'').trim();
  if(!apiKey||!from||!to) return { skipped:true };
  const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({from,to:[to],subject,html})});
  return { ok:r.ok, data: await r.json().catch(()=>({})) };
}
async function notifyStatus({order,nextStatus,shipping_tracking,production_eta,cancelled_by}){
  const to = String(order?.customer_email||'').trim(); if(!to) return;
  const shortId = String(order.id||'').slice(0,8);
  const baseUrl = String(process.env.APP_URL||process.env.NEXT_PUBLIC_SITE_URL||'').trim().replace(/\/$/, '');
  const reviewLink = baseUrl ? `${baseUrl}/#/conta` : '';
  const brandName = process.env.BRAND_NAME || 'Cubo Criativo';
  const supportEmail = process.env.SUPPORT_EMAIL || process.env.RESEND_FROM || '';
  const whatsapp = process.env.WHATSAPP_NUMBER || process.env.SUPPORT_WHATSAPP || '';
  const mail = renderOrderStatusEmail({
    brandName,
    orderId: order?.id,
    customerName: order?.customer_name,
    nextStatus,
    shippingTracking: shipping_tracking || order?.shipping_tracking || '',
    productionEta: production_eta || order?.production_eta || '',
    cancelledBy: cancelled_by || '',
    reviewLink,
    supportEmail,
    whatsapp,
  });
  await sendResendEmail({ to, subject: mail.subject || `Atualização do pedido — ${shortId}`, html: mail.html });
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
