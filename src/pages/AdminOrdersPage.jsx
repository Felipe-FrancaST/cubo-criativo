import React from "react";
import { useAuth } from "../auth/AuthProvider.jsx";
import { DetailRow, KpiCard, OrderBadgeCluster, SectionTitle, SidebarItem, TimelineList } from "./admin/orders/AdminOrdersComponents.jsx";
import { badgeBase, copyToClipboard, daysBetween, emailAuditBadge, endOfDay, exportCsv, fmtAddress, fmtBRL, fmtDate, onlyDigits, prodStatusBadge, shortId, startOfDay, statusBadge, toDateInputValue } from "./admin/orders/adminOrdersUtils.js";
import { TRACKING_CARRIERS, inferTrackingCarrierFromUrl, normalizeTrackingCarrier, resolveTrackingCarrier, trackingCarrierLabel } from "../lib/tracking";
import { fetchAddressFromCep } from "../lib/cep.js";
import { supabase } from "../lib/supabaseClient.js";
import AdminProductsSection from "./admin/products/AdminProductsSection.jsx";
import AdminReviewsSection from "./admin/reviews/AdminReviewsSection.jsx";


function safeStorageFileName(name = 'modelo.glb') {
  const raw = String(name || 'modelo.glb').trim() || 'modelo.glb';
  const withoutPath = raw.split(/[\\/]/).pop() || 'modelo.glb';
  const normalized = withoutPath
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return normalized.toLowerCase().endsWith('.glb') ? normalized : `${normalized || 'modelo'}.glb`;
}

async function uploadOrder3dModel(file) {
  if (!file) return { url: '', name: '' };
  const fileName = safeStorageFileName(file.name || 'modelo.glb');
  if (!fileName.toLowerCase().endsWith('.glb')) throw new Error('Envie um arquivo no formato .glb.');
  const maxBytes = 100 * 1024 * 1024;
  if (Number(file.size || 0) > maxBytes) throw new Error('O arquivo .glb deve ter no máximo 100 MB.');
  const path = `manual-orders/${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${fileName}`;
  const { error: uploadError } = await supabase.storage
    .from('order-3d-models')
    .upload(path, file, { cacheControl: '3600', upsert: false, contentType: 'model/gltf-binary' });
  if (uploadError) throw new Error(uploadError.message || 'Não foi possível enviar o arquivo 3D.');
  const { data } = supabase.storage.from('order-3d-models').getPublicUrl(path);
  return { url: data?.publicUrl || '', name: file.name || fileName };
}

function formatCpfInput(value) {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function formatPhoneInput(value) {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function formatCepInput(value) {
  const d = onlyDigits(value).slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

function dateTimeLocalValue(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function dateTimeLocalToIso(value) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

function OrderDetailsModal({ open, order, onClose, onUpdateStatus, onUpdateTracking, onUpdateCreatedAt, onRequestRefund, onDeleteOrder, onResendEmail, onAddNote, resendBusy, toast, adminQuickSearch, setAdminQuickSearch, runAdminQuickSearch }) {
  if (!open) return null;
  const p = order?.profile || null;
  const address = fmtAddress(p);

  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);
  const [deleteKeyword, setDeleteKeyword] = React.useState("");
  const phone = order?.customer_phone || p?.phone || "";
  const [noteDraft, setNoteDraft] = React.useState('');
  const [launchDateDraft, setLaunchDateDraft] = React.useState(() => dateTimeLocalValue(order?.created_at));
  const isVipOrder = String(order?.order_type || '').trim().toLowerCase() === 'vip';
  const vipSelectedOptions = Array.isArray(order?.vip_selection?.selected_options) ? order.vip_selection.selected_options : [];
  const vipSelectedTitles = Array.isArray(order?.vip_selection?.selected_titles) ? order.vip_selection.selected_titles : [];
  const vipSelectedIds = Array.isArray(order?.vip_selection?.selected_option_ids) ? order.vip_selection.selected_option_ids : [];

  React.useEffect(() => {
    setLaunchDateDraft(dateTimeLocalValue(order?.created_at));
  }, [order?.id, order?.created_at]);
  const waPhone = onlyDigits(phone);
  const waMsg = encodeURIComponent(
    `Olá! Sobre seu pedido ${shortId(order?.id)}:\nStatus: ${String(order?.production_status || "recebido")}\n\nQualquer dúvida, me responda aqui.`
  );
  const waUrl = waPhone ? `https://wa.me/55${waPhone}?text=${waMsg}` : null;

  return (
    <>
      <div className="fixed inset-0 z-[9999]">
      <div className="absolute inset-0 bg-[#020b10]/72" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full sm:w-[560px] bg-[#0a0f1a] border-l border-white/10">
        <div className="p-4 border-b border-white/10 flex items-start justify-between gap-3">
          <div>
            <div className="text-white font-semibold">Pedido {shortId(order?.id)}</div>
            <div className="text-xs text-slate-400">{fmtDate(order?.created_at)}</div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl px-3 py-2 text-slate-200 hover:bg-white/4 ring-1 ring-white/10"
            aria-label="Fechar"
          >
            <span className="material-icons text-[18px]">close</span>
          </button>
        </div>

        <div className="p-4 overflow-y-auto h-[calc(100%-64px)]">
          {toast ? (
            <div className="mb-3 rounded-2xl bg-white/[0.04] ring-1 ring-white/10 px-3 py-2 text-sm text-slate-200">
              {toast}
            </div>
          ) : null}

          <div className="mb-4 rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-sm font-semibold text-white">Busca global do admin</div>
                <div className="text-xs text-slate-400">Encontre pedido, cliente, e-mail, CPF ou rastreio e abra a área mais provável.</div>
              </div>
              <div className="flex w-full max-w-3xl gap-2">
                <input
                  value={adminQuickSearch}
                  onChange={(e) => setAdminQuickSearch(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') runAdminQuickSearch(); }}
                  placeholder="Ex: cliente@email.com, CPF, código do pedido, rastreio..."
                  className="w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-slate-100"
                />
                <button onClick={runAdminQuickSearch} className="rounded-xl px-3 py-2 text-sm font-semibold bg-cyan-300 text-black ring-4 ring-cyan-300/20">Buscar</button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-3">
            <OrderBadgeCluster order={order} />

            <div className="mt-3 rounded-2xl bg-black/20 ring-1 ring-white/10 p-3">
              <div className="text-[11px] text-slate-500">Data de lançamento</div>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  type="datetime-local"
                  value={launchDateDraft}
                  onChange={(e) => setLaunchDateDraft(e.target.value)}
                  className="w-full rounded-xl bg-black/30 ring-1 ring-white/10 px-3 py-2 text-sm text-white"
                />
                <button
                  onClick={() => {
                    const iso = dateTimeLocalToIso(launchDateDraft);
                    if (!iso) return;
                    onUpdateCreatedAt?.(order, iso);
                  }}
                  disabled={!launchDateDraft || dateTimeLocalToIso(launchDateDraft) === order?.created_at}
                  className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-white/4 ring-1 ring-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Alterar data
                </button>
              </div>
              <div className="mt-1 text-xs text-slate-500">Atual: {fmtDate(order?.created_at)}</div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <div className="text-[11px] text-slate-500">Total</div>
                <div className="text-lg font-semibold text-white">{fmtBRL(order?.effective_total ?? order?.total)}</div>
                {Number(order?.upgrade_total || 0) > 0 ? (
                  <div className="text-[11px] text-violet-200/80">Inclui upgrade{Number(order?.related_upgrades_count || 0) > 1 ? 's' : ''} de {fmtBRL(order?.upgrade_total)}</div>
                ) : null}
              </div>
              <div>
                <div className="text-[11px] text-slate-500">Pagamento</div>
                <div className="text-sm text-slate-200">{order?.payment_provider || "—"}</div>
                <div className="text-xs text-slate-500 break-words">{order?.provider_payment_id || ""}</div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
              <button
                onClick={() => onUpdateStatus?.(order)}
                className="rounded-2xl bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-100 ring-1 ring-white/10 transition hover:bg-white/[0.08] hover:-translate-y-0.5"
              >
                <span className="material-icons text-[16px] align-middle mr-1">sync_alt</span>
                Alterar status
              </button>
              <button
                onClick={() => onUpdateTracking?.(order)}
                className="rounded-2xl bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-100 ring-1 ring-white/10 transition hover:bg-white/[0.08] hover:-translate-y-0.5"
              >
                <span className="material-icons text-[16px] align-middle mr-1">local_shipping</span>
                Atualizar rastreio
              </button>
              <button
                onClick={() => onResendEmail?.(order)}
                disabled={!!resendBusy}
                className="rounded-2xl bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-100 ring-1 ring-white/10 transition hover:bg-white/[0.08] hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <span className="material-icons text-[16px] align-middle mr-1">forward_to_inbox</span>
                {resendBusy ? 'Reenviando…' : 'Reenviar e-mail'}
              </button>
              <button
                onClick={() => copyToClipboard(order?.customer_email || '')}
                className="rounded-2xl bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-100 ring-1 ring-white/10 transition hover:bg-white/[0.08] hover:-translate-y-0.5"
              >
                <span className="material-icons text-[16px] align-middle mr-1">content_copy</span>
                Copiar e-mail
              </button>
              <button
                onClick={() => copyToClipboard(order?.id)}
                className="rounded-2xl bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-100 ring-1 ring-white/10 transition hover:bg-white/[0.08] hover:-translate-y-0.5"
              >
                <span className="material-icons text-[16px] align-middle mr-1">fingerprint</span>
                Copiar ID
              </button>
              <button
                onClick={() => copyToClipboard(order?.provider_payment_id)}
                className="rounded-2xl bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-100 ring-1 ring-white/10 transition hover:bg-white/[0.08] hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!order?.provider_payment_id}
              >
                <span className="material-icons text-[16px] align-middle mr-1">payments</span>
                Copiar ID pagamento
              </button>
              <button
                onClick={() => setConfirmDeleteOpen(true)}
                className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-100 ring-1 ring-red-500/30 transition hover:bg-red-500/15 hover:-translate-y-0.5"
              >
                <span className="material-icons text-[16px] align-middle mr-1">delete</span>
                Excluir
              </button>
            </div>
          </div>

          <div className="mt-4 rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-3">
            <div className="text-sm font-semibold text-white">Último e-mail</div>
            <DetailRow label="Tipo" value={order?.last_email_type || '—'} />
            <DetailRow label="Status" value={emailAuditBadge(order?.last_email_status).label} />
            <DetailRow label="Enviado em" value={fmtDate(order?.last_email_sent_at)} />
            <DetailRow label="Erro" value={order?.last_email_error || '—'} />
          </div>

          <div className="mt-4 rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-3">
            <div className="text-sm font-semibold text-white">Cliente</div>
            <DetailRow
              label="Nome"
              value={order?.customer_name || p?.full_name}
              action={
                order?.customer_name ? (
                  <button
                    onClick={() => copyToClipboard(order.customer_name)}
                    className="rounded-xl px-2 py-1 text-xs text-slate-200 hover:bg-white/4 ring-1 ring-white/10"
                  >
                    Copiar
                  </button>
                ) : null
              }
            />
            <DetailRow
              label="Email"
              value={order?.customer_email}
              action={
                order?.customer_email ? (
                  <button
                    onClick={() => copyToClipboard(order.customer_email)}
                    className="rounded-xl px-2 py-1 text-xs text-slate-200 hover:bg-white/4 ring-1 ring-white/10"
                  >
                    Copiar
                  </button>
                ) : null
              }
            />
            <DetailRow
              label="Telefone"
              value={phone}
              action={
                waUrl ? (
                  <a
                    className="rounded-xl px-2 py-1 text-xs text-slate-200 hover:bg-white/4 ring-1 ring-white/10"
                    href={waUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    WhatsApp
                  </a>
                ) : null
              }
            />
            <DetailRow
              label="Endereço"
              value={address}
              action={
                address ? (
                  <button
                    onClick={() => copyToClipboard(address)}
                    className="rounded-xl px-2 py-1 text-xs text-slate-200 hover:bg-white/4 ring-1 ring-white/10"
                  >
                    Copiar
                  </button>
                ) : null
              }
            />
          </div>

          <div className="mt-4 rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-3">
            <div className="text-sm font-semibold text-white">Itens</div>
            <div className="mt-2 space-y-2">
              {(order?.order_items || []).length ? (
                order.order_items.map((it, idx) => (
                  <div key={idx} className="flex items-center gap-3 rounded-xl bg-black/20 ring-1 ring-white/10 p-2">
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-white/4 ring-1 ring-white/10 shrink-0">
                      {it?.img ? <img src={it.img} alt="" className="w-full h-full object-contain" /> : null}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm text-slate-100 truncate">{it.name}</div>
                      <div className="text-xs text-slate-400">
                        {it.qty || 1}x {it.scale ? `• escala ${it.scale}` : ""} {it.unit_price != null ? `• ${fmtBRL(it.unit_price)}` : ""}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-slate-400">Nenhum item.</div>
              )}
            </div>

            {isVipOrder ? (
              <div className="mt-3 rounded-2xl bg-violet-500/10 ring-1 ring-violet-300/20 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs text-violet-200/80 uppercase tracking-wide">Miniaturas escolhidas pelo assinante</div>
                    <div className="mt-1 text-[11px] text-slate-400">
                      Ciclo: {order?.vip_selection?.cycle_key || order?.profile?.vip_cycle_key || String(order?.created_at || '').slice(0, 7) || '—'}
                    </div>
                  </div>
                  <span className="rounded-full bg-violet-300/10 px-2 py-1 text-[11px] font-semibold text-violet-100 ring-1 ring-violet-300/20">
                    {(vipSelectedOptions.length || vipSelectedTitles.length || vipSelectedIds.length)} item(ns)
                  </span>
                </div>

                {vipSelectedOptions.length ? (
                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {vipSelectedOptions.map((opt) => (
                      <div
                        key={String(opt?.id || opt?.title)}
                        className="rounded-xl bg-black/20 ring-1 ring-white/10 p-2"
                        title={opt?.title || ""}
                      >
                        <div className="w-full aspect-square rounded-lg overflow-hidden bg-white/4 ring-1 ring-white/10">
                          {opt?.image_url ? (
                            <img src={opt.image_url} alt={opt?.title || ""} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full grid place-items-center text-[10px] text-slate-500">sem imagem</div>
                          )}
                        </div>
                        <div className="mt-2 text-[11px] text-slate-200 leading-snug break-words" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                          {opt?.title || 'Miniatura VIP'}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : vipSelectedTitles.length ? (
                  <div className="mt-2 text-xs text-slate-200">{vipSelectedTitles.join(", ")}</div>
                ) : vipSelectedIds.length ? (
                  <div className="mt-2 text-xs text-slate-300">IDs escolhidos: {vipSelectedIds.join(", ")}</div>
                ) : (
                  <div className="mt-3 rounded-xl bg-black/20 ring-1 ring-white/10 p-3 text-sm text-slate-300">
                    Nenhuma miniatura escolhida foi encontrada para este ciclo VIP.
                  </div>
                )}
              </div>
            ) : null}

            {order?.vip_present_roll ? (
              <div className="mt-3 rounded-2xl bg-violet-500/10 ring-1 ring-violet-300/20 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs text-violet-200/80 uppercase tracking-wide">Presente VIP</div>
                    <div className="mt-1 text-sm font-extrabold text-white">Resultado {order.vip_present_roll.roll_value}</div>
                    <div className="mt-1 text-xs text-slate-200">{order.vip_present_roll.reward_label}</div>
                  </div>
                  <div className="rounded-xl px-3 py-2 text-sm font-black ring-1 ring-white/10 bg-black/30 text-violet-100">d20 {order.vip_present_roll.roll_value}</div>
                </div>

                {order.vip_present_roll.coupon?.code ? (
                  <div className="mt-3 rounded-xl bg-black/25 ring-1 ring-white/10 p-3">
                    <div className="text-[11px] uppercase tracking-wide text-slate-400">Cupom gerado</div>
                    <div className="mt-1 text-sm font-bold text-slate-100">{order.vip_present_roll.coupon.code}</div>
                    <div className="mt-1 text-xs text-slate-300">{order.vip_present_roll.coupon.label}</div>
                  </div>
                ) : null}

                {order.vip_present_roll.roll_value === 20 ? (
                  <div className="mt-3 rounded-xl bg-amber-400/10 ring-1 ring-cyan-300/20 p-3 text-xs text-cyan-50">
                    Solicitação do prêmio: <b>{order.vip_present_roll.claim_status || 'available'}</b>
                    {order.vip_present_roll.claimed_at ? ` • ${new Date(order.vip_present_roll.claimed_at).toLocaleString('pt-BR')}` : ''}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          {Array.isArray(order?.related_upgrades) && order.related_upgrades.length ? (
            <div className="mt-4 rounded-2xl bg-violet-500/10 ring-1 ring-violet-300/20 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">Upgrade vinculado ao pedido</div>
                  <div className="text-xs text-violet-100/80">Os upgrades não aparecem mais como pedido separado. Eles ficam agrupados aqui.</div>
                </div>
                <div className="rounded-full bg-black/25 px-3 py-1 text-[11px] font-semibold text-violet-100 ring-1 ring-white/10">
                  {order.related_upgrades.length} upgrade{order.related_upgrades.length === 1 ? '' : 's'}
                </div>
              </div>
              <div className="mt-3 space-y-3">
                {order.related_upgrades.map((up) => (
                  <div key={up.id} className="rounded-2xl bg-black/20 ring-1 ring-white/10 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-bold text-white">Plano atualizado para {up.plan_label || up.vip_plan_id || 'VIP'}</div>
                        <div className="mt-1 text-xs text-slate-300">Upgrade em {fmtDate(up.created_at)} • pedido {shortId(up.id)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-extrabold text-violet-100">{fmtBRL(up.total)}</div>
                        <div className="mt-1 inline-flex rounded-full px-2 py-1 text-[11px] ring-1 ring-white/10 text-slate-200 bg-white/5">{String(up.status || 'pending').toLowerCase() === 'paid' ? 'Pago' : String(up.status || 'pending')}</div>
                      </div>
                    </div>
                    {Array.isArray(up.order_items) && up.order_items.length ? (
                      <div className="mt-2 text-xs text-slate-300">
                        {up.order_items.map((it) => `${it.name}${Number(it.qty || 1) > 1 ? ` ×${it.qty}` : ''}`).join(' • ')}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-4 rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-3">
            <div className="text-sm font-semibold text-white">Operação</div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <div className="text-[11px] text-slate-500">Dias em aberto</div>
                <div className="text-lg font-semibold text-white">{Number(order?.days_open || 0)}</div>
              </div>
              <div>
                <div className="text-[11px] text-slate-500">Prazo</div>
                <div className={order?.is_overdue ? 'text-sm font-semibold text-red-200' : 'text-sm font-semibold text-emerald-200'}>{order?.is_overdue ? 'Atrasado' : 'No prazo'}</div>
              </div>
            </div>
            {order?.latest_admin_note ? (
              <div className="mt-3 rounded-xl bg-black/20 ring-1 ring-white/10 p-3">
                <div className="text-[11px] text-slate-500">Última nota interna</div>
                <div className="mt-1 text-sm text-slate-100">{order.latest_admin_note}</div>
              </div>
            ) : null}
            <div className="mt-3">
              <div className="text-[11px] text-slate-500">Nova nota interna</div>
              <textarea value={noteDraft} onChange={(e)=>setNoteDraft(e.target.value)} className="mt-2 h-24 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-sm text-white" placeholder="Ex: cliente pediu urgência, revisar escala, aguarda resposta..." />
              <div className="mt-2 flex justify-end">
                <button onClick={()=>{ const note = String(noteDraft||'').trim(); if (!note) return; onAddNote?.(order, note); setNoteDraft(''); }} className="rounded-xl px-3 py-2 text-sm text-slate-200 hover:bg-white/4 ring-1 ring-white/10">Salvar nota</button>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-white">Timeline do pedido</div>
                <div className="text-xs text-slate-500">
                  {order?.timeline_source === 'order_events'
                    ? 'Histórico persistido a cada alteração feita no admin.'
                    : 'Resumo automático com base no estado atual do pedido.'}
                </div>
              </div>
              <span className="rounded-full bg-white/[0.04] px-2 py-1 text-[11px] text-slate-300 ring-1 ring-white/10">
                {(order?.timeline || []).length} evento{(order?.timeline || []).length === 1 ? '' : 's'}
              </span>
            </div>
            <div className="mt-3">
              <TimelineList events={order?.timeline || []} />
            </div>
          </div>
        </div>
      </div>
    </div>

      <ConfirmDeleteModal
        open={confirmDeleteOpen}
        order={order}
        keywordValue={deleteKeyword}
        onKeywordChange={setDeleteKeyword}
        onClose={() => {
          setConfirmDeleteOpen(false);
          setDeleteKeyword("");
        }}
        onConfirm={() => {
          setConfirmDeleteOpen(false);
          setDeleteKeyword("");
          onDeleteOrder?.(order);
        }}
      />
    </>
  );
}

function ConfirmDeleteModal({ open, order, keywordValue = "", onKeywordChange, onClose, onConfirm }) {
  if (!open) return null;
  const id = shortId(order?.id || order?.order_id || "");
  const total = fmtBRL(order?.total);
  const email = order?.customer_email || order?.profile?.email || "";
  const keywordOk = String(keywordValue || "").trim().toLowerCase() === "excluir";

  return (
    <div className="fixed inset-0 z-[10010] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-3xl bg-[#0b0f18] ring-1 ring-white/10 shadow-2xl overflow-hidden">
        <div className="p-5 border-b border-white/10">
          <p className="text-sm font-semibold text-slate-100">Excluir pedido</p>
          <p className="text-xs text-slate-400 mt-1">
            Tem certeza? Essa ação é <span className="text-red-200 font-semibold">PERMANENTE</span> e não pode ser desfeita.
          </p>
        </div>

        <div className="p-5 space-y-3">
          <div className="rounded-2xl bg-white/4 ring-1 ring-white/10 p-4">
            <p className="text-xs text-slate-400">Pedido</p>
            <p className="text-sm text-slate-100 mt-1">
              <span className="font-semibold">#{id}</span>{email ? ` • ${email}` : ""}{total ? ` • ${total}` : ""}
            </p>
          </div>
          <p className="text-xs text-slate-400">
            Dica: se você só quer “sumir” com ele da operação, prefira marcar como <b>Cancelado</b> em vez de excluir.
          </p>
          <label className="block">
            <div className="text-xs text-slate-400 mb-1">Digite <span className="font-semibold text-red-200">excluir</span> para confirmar</div>
            <input
              value={keywordValue}
              onChange={(e) => onKeywordChange?.(e.target.value)}
              className="w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-slate-100"
              placeholder="excluir"
              autoFocus
            />
          </label>
        </div>

        <div className="p-5 flex items-center justify-end gap-2 border-t border-white/10">
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm text-slate-200 hover:bg-white/4 ring-1 ring-white/10"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={!keywordOk}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-red-100 bg-red-500/15 hover:bg-red-500/25 ring-1 ring-red-500/30 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Excluir permanentemente
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmDeleteVotingModal({ state, onClose, onConfirm }) {
  const open = !!state?.open;
  const pollWrap = state?.poll;
  const poll = pollWrap?.poll || pollWrap;
  if (!open) return null;

  const id = shortId(poll?.id || "");
  const month = poll?.month_key || "—";
  const title = poll?.title || "Votação";
  const busy = !!state?.busy;
  const err = state?.error || "";

  return (
    <div className="fixed inset-0 z-[10020] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={busy ? undefined : onClose} />
      <div className="relative w-full max-w-lg rounded-3xl bg-[#0b0f18] ring-1 ring-white/10 shadow-2xl overflow-hidden">
        <div className="p-5 border-b border-white/10">
          <p className="text-sm font-semibold text-slate-100">Excluir votação</p>
          <p className="text-xs text-slate-400 mt-1">
            Tem certeza? Isso vai remover a votação do admin e também vai sumir para os VIPs. Essa ação é{" "}
            <span className="text-red-200 font-semibold">PERMANENTE</span>.
          </p>
        </div>

        <div className="p-5 space-y-2">
          <div className="rounded-2xl bg-white/4 ring-1 ring-white/10 p-4">
            <p className="text-xs text-slate-400">Votação</p>
            <p className="text-sm text-slate-100 mt-1">
              <span className="font-semibold">#{id}</span> • {month}
            </p>
            <p className="text-xs text-slate-300 mt-1">{title}</p>
          </div>

          {err ? <div className="rounded-xl bg-red-500/10 ring-1 ring-red-500/30 p-3 text-sm text-red-200">{err}</div> : null}
        </div>

        <div className="p-5 flex items-center justify-end gap-2 border-t border-white/10">
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded-xl px-4 py-2 text-sm text-slate-200 hover:bg-white/4 ring-1 ring-white/10 disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-red-100 bg-red-500/15 hover:bg-red-500/25 ring-1 ring-red-500/30 disabled:opacity-60"
          >
            {busy ? "Excluindo..." : "Excluir permanentemente"}
          </button>
        </div>
      </div>
    </div>
  );
}


function ConfirmDangerModal({ open, title, message, details, confirmLabel = "Confirmar", cancelLabel = "Cancelar", busy = false, error = "", keyword = "", keywordValue = "", onKeywordChange, onClose, onConfirm }) {
  if (!open) return null;
  const needsKeyword = !!keyword;
  const keywordOk = !needsKeyword || String(keywordValue || '').trim().toUpperCase() === String(keyword).trim().toUpperCase();

  return (
    <div className="fixed inset-0 z-[10030] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={busy ? undefined : onClose} />
      <div className="relative w-full max-w-lg rounded-3xl bg-[#0b0f18] ring-1 ring-white/10 shadow-2xl overflow-hidden">
        <div className="p-5 border-b border-white/10">
          <p className="text-sm font-semibold text-slate-100">{title}</p>
          <p className="text-xs text-slate-400 mt-1">{message}</p>
        </div>

        <div className="p-5 space-y-3">
          {details ? (
            <div className="rounded-2xl bg-white/4 ring-1 ring-white/10 p-4 text-sm text-slate-100">
              {details}
            </div>
          ) : null}

          {needsKeyword ? (
            <label className="block">
              <div className="text-xs text-slate-400 mb-1">Digite <span className="font-semibold text-red-200">{keyword}</span> para confirmar</div>
              <input
                value={keywordValue}
                onChange={(e) => onKeywordChange?.(e.target.value)}
                className="w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-slate-100"
                placeholder={keyword}
                autoFocus
              />
            </label>
          ) : null}

          {error ? <div className="rounded-xl bg-red-500/10 ring-1 ring-red-500/30 p-3 text-sm text-red-200">{error}</div> : null}
        </div>

        <div className="p-5 flex items-center justify-end gap-2 border-t border-white/10">
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded-xl px-4 py-2 text-sm text-slate-200 hover:bg-white/4 ring-1 ring-white/10 disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={busy || !keywordOk}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-red-100 bg-red-500/15 hover:bg-red-500/25 ring-1 ring-red-500/30 disabled:opacity-60"
          >
            {busy ? 'Processando...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusModal({ open, mode, order, onClose, onSubmit }) {
  const [productionStatus, setProductionStatus] = React.useState("recebido");
  const [eta, setEta] = React.useState("3 a 7 dias úteis");
  const [tracking, setTracking] = React.useState("");
  const [shippingCarrier, setShippingCarrier] = React.useState("correios");

  React.useEffect(() => {
    if (!open) return;
    setProductionStatus(String(order?.production_status || "recebido"));
    setEta(String(order?.production_eta || "3 a 7 dias úteis"));
    setTracking(String(order?.shipping_tracking || ""));
    setShippingCarrier(resolveTrackingCarrier({ carrier: order?.shipping_carrier, trackingUrl: order?.tracking_url }));
  }, [open, order]);

  if (!open) return null;

  const submit = () => {
    if (mode === "status") {
      const next = String(productionStatus || "recebido").toLowerCase();
      const patch = { production_status: next };
      if (next === "em_producao") patch.production_eta = eta;
      if (next === "enviado" && tracking.trim()) { patch.shipping_tracking = tracking.trim(); patch.shipping_carrier = normalizeTrackingCarrier(shippingCarrier); }
      onSubmit?.(patch);
      return;
    }
    if (mode === "tracking") {
      onSubmit?.({ shipping_tracking: tracking.trim(), shipping_carrier: normalizeTrackingCarrier(shippingCarrier), ...(tracking.trim() ? { production_status: "enviado" } : {}) });
    }
  };

  return (
    <div className="fixed inset-0 z-[9999]">
      <div className="absolute inset-0 bg-[#020b10]/72" onClick={onClose} />
      <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-[#0a0f1a] ring-1 ring-white/10 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-white font-semibold">
              {mode === "status" ? "Alterar status de produção" : "Editar rastreio"}
            </div>
            <div className="text-xs text-slate-400">Pedido {shortId(order?.id)}</div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl px-3 py-2 text-slate-200 hover:bg-white/4 ring-1 ring-white/10"
            aria-label="Fechar"
          >
            <span className="material-icons text-[18px]">close</span>
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {mode === "status" ? (
            <>
              <label className="block">
                <div className="text-xs text-slate-400 mb-1">Status</div>
                <select
                  value={productionStatus}
                  onChange={(e) => setProductionStatus(e.target.value)}
                  className="w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-slate-100"
                >
                  <option value="editavel">Editável</option>
                  <option value="recebido">Recebido</option>
                  <option value="em_producao">Em produção</option>
                  <option value="pronto">Pronto</option>
                  <option value="enviado">Enviado</option>
                  <option value="entregue">Entregue</option>
                  <option value="cancelado">Cancelado</option>
                  <option value="reembolsado">Reembolsado</option>
                </select>
              </label>

              {String(productionStatus).toLowerCase() === "em_producao" ? (
                <label className="block">
                  <div className="text-xs text-slate-400 mb-1">Estimativa</div>
                  <input
                    value={eta}
                    onChange={(e) => setEta(e.target.value)}
                    className="w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-slate-100"
                    placeholder="Ex: 3 a 7 dias úteis"
                  />
                </label>
              ) : null}

              {String(productionStatus).toLowerCase() === "enviado" ? (
                <>
                  <label className="block">
                    <div className="text-xs text-slate-400 mb-1">Transportadora</div>
                    <select
                      value={shippingCarrier}
                      onChange={(e) => setShippingCarrier(e.target.value)}
                      className="w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-slate-100"
                    >
                      {TRACKING_CARRIERS.map((carrier) => (
                        <option key={carrier.value} value={carrier.value}>{carrier.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <div className="text-xs text-slate-400 mb-1">Rastreio (opcional)</div>
                    <input
                      value={tracking}
                      onChange={(e) => setTracking(e.target.value)}
                      className="w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-slate-100"
                      placeholder="Código de rastreio"
                    />
                  </label>
                </>
              ) : null}
            </>
          ) : (
            <>
              <label className="block">
                <div className="text-xs text-slate-400 mb-1">Transportadora</div>
                <select
                  value={shippingCarrier}
                  onChange={(e) => setShippingCarrier(e.target.value)}
                  className="w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-slate-100"
                >
                  {TRACKING_CARRIERS.map((carrier) => (
                    <option key={carrier.value} value={carrier.value}>{carrier.label}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <div className="text-xs text-slate-400 mb-1">Rastreio</div>
                <input
                  value={tracking}
                  onChange={(e) => setTracking(e.target.value)}
                  className="w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-slate-100"
                  placeholder="Código de rastreio"
                />
                <div className="mt-1 text-[11px] text-slate-500">
                  Dica: ao definir rastreio, o pedido pode ser marcado como <span className="text-slate-300">Enviado</span>.
                </div>
              </label>
            </>
          )}
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-xl px-3 py-2 text-sm text-slate-200 hover:bg-white/4 ring-1 ring-white/10"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            className={mode === "delete" ? "rounded-xl px-3 py-2 text-sm text-red-100 bg-red-500/15 hover:bg-red-500/25 ring-1 ring-red-500/30" : "rounded-xl px-3 py-2 text-sm text-white bg-emerald-500/20 hover:bg-emerald-500/25 ring-1 ring-emerald-500/30"}
          >
            {mode === "delete" ? (busy ? "Excluindo..." : "Excluir permanentemente") : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}


function BulkActionModal({ open, mode, count, busy = false, onClose, onSubmit }) {
  const [productionStatus, setProductionStatus] = React.useState("recebido");
  const [tracking, setTracking] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    setProductionStatus("recebido");
    setTracking("");
  }, [open, mode]);

  if (!open) return null;

  const submit = () => {
    if (mode === "status") {
      const patch = { production_status: String(productionStatus || "recebido").toLowerCase() };
      if (patch.production_status === "enviado" && tracking.trim()) patch.shipping_tracking = tracking.trim();
      onSubmit?.(patch);
      return;
    }
    if (mode === "refund_on") return onSubmit?.({ refund_requested: true });
    if (mode === "refund_off") return onSubmit?.({ refund_requested: false });
    if (mode === "delete") return onSubmit?.({ confirm_delete: true });
  };

  const title =
    mode === "status"
      ? "Atualizar produção em lote"
      : mode === "refund_on"
      ? "Marcar reembolso em lote"
      : mode === "refund_off"
      ? "Limpar reembolso em lote"
      : "Excluir pedidos em lote";

  return (
    <div className="fixed inset-0 z-[10040]">
      <div className="absolute inset-0 bg-[#020b10]/72" onClick={busy ? undefined : onClose} />
      <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-[#0a0f1a] ring-1 ring-white/10 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-white font-semibold">{title}</div>
            <div className="text-xs text-slate-400">{count} pedido(s) selecionado(s)</div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl px-3 py-2 text-slate-200 hover:bg-white/4 ring-1 ring-white/10"
            aria-label="Fechar"
            disabled={busy}
          >
            <span className="material-icons text-[18px]">close</span>
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {mode === "status" ? (
            <>
              <label className="block">
                <div className="text-xs text-slate-400 mb-1">Novo status</div>
                <select
                  value={productionStatus}
                  onChange={(e) => setProductionStatus(e.target.value)}
                  className="w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-slate-100"
                >
                  <option value="editavel">Editável</option>
                  <option value="recebido">Recebido</option>
                  <option value="em_producao">Em produção</option>
                  <option value="pronto">Pronto</option>
                  <option value="enviado">Enviado</option>
                  <option value="entregue">Entregue</option>
                  <option value="cancelado">Cancelado</option>
                  <option value="reembolsado">Reembolsado</option>
                </select>
              </label>

              {String(productionStatus).toLowerCase() === "enviado" ? (
                <label className="block">
                  <div className="text-xs text-slate-400 mb-1">Rastreio comum (opcional)</div>
                  <input
                    value={tracking}
                    onChange={(e) => setTracking(e.target.value)}
                    className="w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-slate-100"
                    placeholder="Preencha só se o mesmo rastreio servir para todos"
                  />
                </label>
              ) : null}
            </>
          ) : (
            <div className={mode === "delete" ? "rounded-2xl bg-red-500/10 ring-1 ring-red-500/20 p-4 text-sm text-red-100" : "rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-4 text-sm text-slate-300"}>
              {mode === "refund_on"
                ? "Isso vai marcar os pedidos selecionados como reembolso solicitado."
                : mode === "refund_off"
                ? "Isso vai remover a marcação de reembolso solicitado dos pedidos selecionados."
                : "Tem certeza? Essa ação é permanente e vai excluir os pedidos selecionados do sistema."}
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-xl px-3 py-2 text-sm text-slate-200 hover:bg-white/4 ring-1 ring-white/10"
            disabled={busy}
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className="rounded-xl px-3 py-2 text-sm text-white bg-emerald-500/20 hover:bg-emerald-500/25 ring-1 ring-emerald-500/30 disabled:opacity-60"
          >
            {busy ? "Aplicando..." : "Aplicar"}
          </button>
        </div>
      </div>
    </div>
  );
}


function CloseVotingModal({ state, onClose, onConfirm, onSelectWinner }) {
  const open = !!state?.open;
  const pollPack = state?.poll;
  const poll = pollPack?.poll;
  const options = pollPack?.options || [];
  const winnerId = state?.winnerId;
  const busy = !!state?.busy;
  const error = state?.error;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[10030]">
      <div className="absolute inset-0 bg-black/70" onClick={() => (!busy ? onClose?.() : null)} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-xl rounded-2xl bg-slate-950 ring-1 ring-white/10 shadow-2xl">
          <div className="p-5 border-b border-white/10 flex items-start justify-between gap-3">
            <div>
              <div className="text-white text-lg font-extrabold">Encerrar votação</div>
              <div className="mt-1 text-sm text-slate-400">
                Selecione o vencedor. Isso vai aparecer para todos os VIPs como “votação encerrada”.
              </div>
              <div className="mt-2 text-xs text-slate-500">
                {poll?.month_key || "—"} • {poll?.title || "Votação"}
              </div>
            </div>
            <button
              onClick={() => (!busy ? onClose?.() : null)}
              className="rounded-xl px-3 py-2 text-sm text-slate-200 hover:bg-white/4 ring-1 ring-white/10"
              disabled={busy}
            >
              Fechar
            </button>
          </div>

          <div className="p-5">
            {error ? <div className="mb-3 rounded-xl bg-red-500/10 ring-1 ring-red-400/20 p-3 text-sm text-red-200">{error}</div> : null}

            <div className="space-y-2">
              {options.map((o) => (
                <label
                  key={o.id}
                  className={`flex items-center gap-3 rounded-xl p-3 ring-1 transition cursor-pointer ${
                    String(winnerId) === String(o.id) ? "bg-emerald-500/10 ring-emerald-400/25" : "bg-white/[0.03] ring-white/10 hover:bg-white/[0.06]"
                  }`}
                >
                  <input
                    type="radio"
                    name="winner"
                    checked={String(winnerId) === String(o.id)}
                    onChange={() => onSelectWinner?.(o.id)}
                    className="accent-emerald-400"
                    disabled={busy}
                  />
                  <div className="min-w-0">
                    <div className="text-slate-100 font-semibold truncate">{o.title}</div>
                    {o.description ? <div className="text-xs text-slate-500 line-clamp-2">{o.description}</div> : null}
                  </div>
                  <div className="ml-auto text-xs text-slate-400 whitespace-nowrap">{o.votes || 0} votos</div>
                </label>
              ))}
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => (!busy ? onClose?.() : null)}
                className="rounded-xl px-4 py-2 text-sm text-slate-200 hover:bg-white/4 ring-1 ring-white/10"
                disabled={busy}
              >
                Cancelar
              </button>
              <button
                onClick={() => onConfirm?.(winnerId)}
                className="rounded-xl px-4 py-2 text-sm font-extrabold bg-emerald-400 text-black ring-4 ring-emerald-400/20 disabled:opacity-50"
                disabled={busy || !winnerId}
              >
                {busy ? "Encerrando…" : "Encerrar e publicar vencedor"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StartVotingModal({ state, imageLibrary, imageLibraryLoading, imageLibraryError, onClose, onChange, onConfirm }) {
  const open = !!state?.open;
  const busy = !!state?.busy;
  const error = state?.error;
  const images = Array.isArray(imageLibrary) ? imageLibrary : [];
  const data = state?.data || { month_key: "", title: "", options: [] };
  const opts = Array.isArray(data.options) ? data.options : [];

  if (!open) return null;

  const setField = (k, v) => onChange?.({ ...data, [k]: v });
  const setOpt = (idx, patch) => {
    const next = opts.map((o, i) => (i === idx ? { ...o, ...patch } : o));
    setField("options", next);
  };
  const addOpt = () => setField("options", [...opts, { title: "", description: "", image_asset_id: "" }]);
  const delOpt = (idx) => setField("options", opts.filter((_, i) => i !== idx));

  return (
    <div className="fixed inset-0 z-[10040]">
      <div className="absolute inset-0 bg-black/70" onClick={() => (!busy ? onClose?.() : null)} />
      {/* Allow scrolling when modal content is taller than the viewport (mobile/small screens). */}
      <div className="absolute inset-0 flex items-start justify-center p-4 overflow-y-auto">
        <div className="w-full max-w-2xl rounded-2xl bg-slate-950 ring-1 ring-white/10 shadow-2xl my-6 max-h-[90vh] flex flex-col">
          <div className="p-5 border-b border-white/10 flex items-start justify-between gap-3 flex-none">
            <div>
              <div className="text-white text-lg font-extrabold">Iniciar nova votação</div>
              <div className="mt-1 text-sm text-slate-400">Crie a votação que vai aparecer para todos os VIPs.</div>
            </div>
            <button
              onClick={() => (!busy ? onClose?.() : null)}
              className="rounded-xl px-3 py-2 text-sm text-slate-200 hover:bg-white/4 ring-1 ring-white/10"
              disabled={busy}
            >
              Fechar
            </button>
          </div>

          <div className="p-5 overflow-y-auto">
            {error ? <div className="mb-3 rounded-xl bg-red-500/10 ring-1 ring-red-400/20 p-3 text-sm text-red-200">{error}</div> : null}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="block">
                <div className="text-xs text-slate-400 mb-1">Mês (YYYY-MM)</div>
                <input
                  value={data.month_key}
                  onChange={(e) => setField("month_key", e.target.value)}
                  className="w-full rounded-xl bg-black/30 ring-1 ring-white/10 px-3 py-2 text-slate-100"
                  placeholder="2026-03"
                  disabled={busy}
                />
              </label>
              <label className="block md:col-span-2">
                <div className="text-xs text-slate-400 mb-1">Pergunta / Título</div>
                <input
                  value={data.title}
                  onChange={(e) => setField("title", e.target.value)}
                  className="w-full rounded-xl bg-black/30 ring-1 ring-white/10 px-3 py-2 text-slate-100"
                  placeholder="Qual tema você quer no próximo mês?"
                  disabled={busy}
                />
              </label>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div className="text-xs uppercase tracking-wide text-slate-400">Opções</div>
              <button
                onClick={() => (!busy ? addOpt() : null)}
                className="rounded-xl px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/4 ring-1 ring-white/10"
                disabled={busy}
              >
                + Adicionar opção
              </button>
            </div>

            <div className="mt-2 mb-3 space-y-2">
              {imageLibraryError ? (
                <div className="rounded-xl bg-red-500/10 ring-1 ring-red-400/20 p-3 text-sm text-red-200">{imageLibraryError}</div>
              ) : null}
              {!imageLibraryLoading && !imageLibraryError && !images.length ? (
                <div className="rounded-xl bg-cyan-500/10 ring-1 ring-cyan-400/20 p-3 text-sm text-amber-100">
                  Nenhuma imagem foi encontrada na biblioteca do Supabase. Cadastre as imagens na tabela <b>vip_theme_image_library</b> para usá-las nas votações.
                </div>
              ) : null}
            </div>

            <div className="mt-2 space-y-2">
              {opts.map((o, idx) => (
                <div key={idx} className="rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-slate-100 font-semibold">Opção {idx + 1}</div>
                    <button
                      onClick={() => (!busy ? delOpt(idx) : null)}
                      className="rounded-xl px-3 py-2 text-xs text-slate-200 hover:bg-white/4 ring-1 ring-white/10 disabled:opacity-50"
                      disabled={busy || opts.length <= 2}
                      title={opts.length <= 2 ? "Mínimo de 2 opções" : "Remover"}
                    >
                      Remover
                    </button>
                  </div>
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <label className="block">
                      <div className="text-xs text-slate-400 mb-1">Título</div>
                      <input
                        value={o.title || ""}
                        onChange={(e) => setOpt(idx, { title: e.target.value })}
                        className="w-full rounded-xl bg-black/30 ring-1 ring-white/10 px-3 py-2 text-slate-100"
                        placeholder="Ex: Vampiros & Caçadores"
                        disabled={busy}
                      />
                    </label>
                    <label className="block">
                      <div className="text-xs text-slate-400 mb-1">Imagem da biblioteca</div>
                      <select
                        value={o.image_asset_id || ""}
                        onChange={(e) => setOpt(idx, { image_asset_id: e.target.value })}
                        className="w-full rounded-xl bg-black/30 ring-1 ring-white/10 px-3 py-2 text-slate-100"
                        disabled={busy || imageLibraryLoading || !images.length}
                      >
                        <option value="">Sem imagem</option>
                        {images.map((img) => (
                          <option key={img.id} value={img.id}>{img.title}</option>
                        ))}
                      </select>
                    </label>
                    <label className="block md:col-span-2">
                      <div className="text-xs text-slate-400 mb-1">Descrição (opcional)</div>
                      <input
                        value={o.description || ""}
                        onChange={(e) => setOpt(idx, { description: e.target.value })}
                        className="w-full rounded-xl bg-black/30 ring-1 ring-white/10 px-3 py-2 text-slate-100"
                        placeholder="Noite, maldições e caçadas."
                        disabled={busy}
                      />
                    </label>
                  </div>

                  {(() => {
                    const selectedImage = images.find((img) => String(img.id) === String(o.image_asset_id || ""));
                    return selectedImage ? (
                      <div className="mt-3 flex items-center gap-3 rounded-xl bg-black/20 ring-1 ring-white/10 p-2">
                        <img src={selectedImage.image_url} alt={selectedImage.title} className="h-16 w-16 rounded-xl object-cover bg-black/30 ring-1 ring-white/10" loading="lazy" />
                        <div className="min-w-0">
                          <div className="text-xs text-slate-500">Imagem selecionada</div>
                          <div className="text-sm font-semibold text-slate-100 truncate">{selectedImage.title}</div>
                        </div>
                      </div>
                    ) : null;
                  })()}
                </div>
              ))}
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => (!busy ? onClose?.() : null)}
                className="rounded-xl px-4 py-2 text-sm text-slate-200 hover:bg-white/4 ring-1 ring-white/10"
                disabled={busy}
              >
                Cancelar
              </button>
              <button
                onClick={() => onConfirm?.(data)}
                className="rounded-xl px-4 py-2 text-sm font-extrabold bg-emerald-400 text-black ring-4 ring-emerald-400/20 disabled:opacity-50"
                disabled={busy}
              >
                {busy ? "Criando…" : "Iniciar votação"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


function NewManualOrderModal({ open, accessToken, onClose, onCreated, showToast }) {
  const emptyForm = React.useMemo(() => ({
    name: '', cpf: '', email: '', phone: '', address_line1: '', address_number: '', address_line2: '', neighborhood: '', city: '', state: '', zip: '',
  }), []);
  const [loadingProducts, setLoadingProducts] = React.useState(false);
  const [products, setProducts] = React.useState([]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [result, setResult] = React.useState(null);
  const [form, setForm] = React.useState(emptyForm);
  const [items, setItems] = React.useState([]);
  const [showFinalizeChoices, setShowFinalizeChoices] = React.useState(false);
  const [customerMode, setCustomerMode] = React.useState('new');
  const [selectedClientId, setSelectedClientId] = React.useState('');
  const [clientSearch, setClientSearch] = React.useState('');
  const [availableClients, setAvailableClients] = React.useState([]);
  const [loadingClients, setLoadingClients] = React.useState(false);
  const [clientsError, setClientsError] = React.useState('');
  const [cepLoading, setCepLoading] = React.useState(false);
  const [cepError, setCepError] = React.useState('');
  const [model3dFile, setModel3dFile] = React.useState(null);
  const [model3dError, setModel3dError] = React.useState('');
  const [vipPlans, setVipPlans] = React.useState([]);
  const [vipOptions, setVipOptions] = React.useState([]);
  const [vipCycleKey, setVipCycleKey] = React.useState('');
  const [loadingVipData, setLoadingVipData] = React.useState(false);
  const [vipDataError, setVipDataError] = React.useState('');

  React.useEffect(() => {
    if (!open) return;
    setError('');
    setResult(null);
    setShowFinalizeChoices(false);
    setCustomerMode('new');
    setSelectedClientId('');
    setClientSearch('');
    setAvailableClients([]);
    setClientsError('');
    setCepLoading(false);
    setCepError('');
    setModel3dFile(null);
    setModel3dError('');
    setVipDataError('');
    setForm(emptyForm);
    setItems([]);
  }, [open, emptyForm]);

  React.useEffect(() => {
    if (!open || !accessToken) return;
    let active = true;
    setLoadingProducts(true);
    fetch('/api/admin?action=manual-order-products', { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.json().catch(() => ({})).then((json) => ({ ok: r.ok, json })))
      .then(({ ok, json }) => {
        if (!active) return;
        if (!ok) throw new Error(json?.error || 'Não foi possível carregar os produtos.');
        setProducts(Array.isArray(json?.products) ? json.products : []);
      })
      .catch((e) => { if (active) setError(e?.message || 'Erro ao carregar produtos.'); })
      .finally(() => active && setLoadingProducts(false));
    return () => { active = false; };
  }, [open, accessToken]);

  React.useEffect(() => {
    if (!open) return;
    let active = true;
    setLoadingVipData(true);
    setVipDataError('');
    Promise.all([
      fetch('/api/vip-plans').then((r) => r.json().catch(() => ({})).then((json) => ({ ok: r.ok, json }))),
      fetch('/api/core?action=vip-cycle').then((r) => r.json().catch(() => ({})).then((json) => ({ ok: r.ok, json }))),
    ])
      .then(([plansResp, cycleResp]) => {
        if (!active) return;
        if (!plansResp.ok) throw new Error(plansResp.json?.error || 'Não foi possível carregar os planos VIP.');
        if (!cycleResp.ok) throw new Error(cycleResp.json?.error || 'Não foi possível carregar as miniaturas VIP.');
        setVipPlans(Array.isArray(plansResp.json?.plans) ? plansResp.json.plans : []);
        setVipOptions(Array.isArray(cycleResp.json?.items) ? cycleResp.json.items : []);
        setVipCycleKey(String(cycleResp.json?.active_cycle_key || '').trim());
      })
      .catch((e) => {
        if (!active) return;
        setVipPlans([]);
        setVipOptions([]);
        setVipDataError(e?.message || 'Erro ao carregar dados da assinatura VIP.');
      })
      .finally(() => active && setLoadingVipData(false));
    return () => { active = false; };
  }, [open]);

  React.useEffect(() => {
    if (!open || !accessToken || customerMode !== 'existing') return;
    let active = true;
    setLoadingClients(true);
    setClientsError('');
    const params = new URLSearchParams({ action: 'clients', q: String(clientSearch || '') });
    fetch(`/api/admin?${params.toString()}`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.json().catch(() => ({})).then((json) => ({ ok: r.ok, json })))
      .then(({ ok, json }) => {
        if (!active) return;
        if (!ok) throw new Error(json?.error || 'Não foi possível carregar os clientes.');
        setAvailableClients(Array.isArray(json?.clients) ? json.clients : []);
      })
      .catch((e) => {
        if (!active) return;
        setAvailableClients([]);
        setClientsError(e?.message || 'Erro ao carregar clientes.');
      })
      .finally(() => active && setLoadingClients(false));
    return () => { active = false; };
  }, [open, accessToken, customerMode, clientSearch]);

  const selectedClient = React.useMemo(
    () => availableClients.find((client) => String(client.id) === String(selectedClientId || '')) || null,
    [availableClients, selectedClientId]
  );

  React.useEffect(() => {
    if (customerMode !== 'existing') return;
    if (!selectedClient) return;
    setForm({
      name: String(selectedClient.full_name || '').trim(),
      cpf: formatCpfInput(selectedClient.cpf || ''),
      email: String(selectedClient.email || '').trim(),
      phone: formatPhoneInput(selectedClient.phone || ''),
      address_line1: String(selectedClient.address_line1 || '').trim(),
      address_number: String(selectedClient.address_number || '').trim(),
      address_line2: String(selectedClient.address_line2 || '').trim(),
      neighborhood: String(selectedClient.neighborhood || '').trim(),
      city: String(selectedClient.city || '').trim(),
      state: String(selectedClient.state || '').trim(),
      zip: formatCepInput(selectedClient.zip || ''),
    });
  }, [customerMode, selectedClient]);

  React.useEffect(() => {
    if (!open || customerMode === 'existing') return;
    const cepDigits = onlyDigits(form.zip);
    if (cepDigits.length !== 8) {
      setCepError('');
      return;
    }
    let active = true;
    setCepLoading(true);
    setCepError('');
    fetchAddressFromCep(cepDigits)
      .then((resp) => {
        if (!active) return;
        if (!resp?.ok) {
          setCepError(resp?.error || 'CEP não encontrado.');
          return;
        }
        setForm((prev) => ({
          ...prev,
          address_line1: resp.data.street || prev.address_line1,
          neighborhood: resp.data.neighborhood || prev.neighborhood,
          city: resp.data.city || prev.city,
          state: resp.data.uf || prev.state,
        }));
      })
      .catch(() => active && setCepError('Erro ao consultar CEP.'))
      .finally(() => active && setCepLoading(false));
    return () => { active = false; };
  }, [open, customerMode, form.zip]);

  function updateForm(key, value) {
    let nextValue = value;
    if (key === 'cpf') nextValue = formatCpfInput(value);
    if (key === 'phone') nextValue = formatPhoneInput(value);
    if (key === 'zip') nextValue = formatCepInput(value);
    if (key === 'state') nextValue = String(value || '').toUpperCase().slice(0, 2);
    setForm((p) => ({ ...p, [key]: nextValue }));
  }
  function isLevel3VipPlan(plan) {
    const raw = [plan?.id, plan?.slug, plan?.short_name, plan?.name].map((value) => String(value || '').toLowerCase()).join(' | ');
    return raw.includes('cubo_l3') || raw.includes('level-3') || raw.includes('level 3') || raw.includes('nível 3') || raw.includes('nivel 3');
  }
  function getVipPlanLimits(plan) {
    const miniatures = Math.max(0, Number(plan?.miniatures_count ?? plan?.items_per_month ?? 0) || 0);
    const bosses = Math.max(0, Number(plan?.boss_count ?? 0) || 0);
    const totalItems = Math.max(0, Number(plan?.items_per_month ?? (miniatures + bosses)) || (miniatures + bosses));
    return { miniatures, bosses, total: totalItems };
  }
  function getVipSelectedCounts(item) {
    const selectedIds = Array.isArray(item?.selected_option_ids) ? item.selected_option_ids.map(String) : [];
    return selectedIds.reduce((acc, optionId) => {
      const option = vipOptions.find((row) => String(row.id) === String(optionId));
      if (String(option?.item_type || 'miniature').toLowerCase() === 'boss') acc.bosses += 1;
      else acc.miniatures += 1;
      acc.total += 1;
      return acc;
    }, { miniatures: 0, bosses: 0, total: 0 });
  }
  function ensureRegularOrderMode() {
    if (items.some((item) => item.mode === 'vip')) {
      setError('A assinatura VIP deve ficar em um pedido separado. Remova a assinatura para adicionar outros itens.');
      return false;
    }
    setError('');
    return true;
  }
  function addRegisteredProduct() {
    if (!ensureRegularOrderMode()) return;
    setItems((p) => [...p, { id: crypto?.randomUUID?.() || String(Date.now()+Math.random()), mode: 'product', product_id: '', qty: 1, scale: '' }]);
  }
  function addCustomItem() {
    if (!ensureRegularOrderMode()) return;
    setItems((p) => [...p, { id: crypto?.randomUUID?.() || String(Date.now()+Math.random()), mode: 'custom', name: '', price: '', scale: '', qty: 1, notes: '' }]);
  }
  function addFreightItem() {
    if (!ensureRegularOrderMode()) return;
    setItems((p) => [...p, { id: crypto?.randomUUID?.() || String(Date.now()+Math.random()), mode: 'freight', carrier: '', price: '', qty: 1, notes: '' }]);
  }
  function addVipItem() {
    if (items.length) {
      setError('A assinatura VIP deve ser criada em um pedido separado. Remova os outros itens antes de continuar.');
      return;
    }
    const plan = vipPlans[0] || null;
    if (!plan) {
      setError(vipDataError || 'Nenhum plano VIP ativo foi encontrado.');
      return;
    }
    const selectedIds = isLevel3VipPlan(plan) ? vipOptions.map((option) => option.id) : [];
    setError('');
    setItems([{ id: crypto?.randomUUID?.() || String(Date.now()+Math.random()), mode: 'vip', vip_plan_id: plan.id, selected_option_ids: selectedIds, cycle_key: vipCycleKey }]);
  }
  function changeVipPlan(itemId, planId) {
    const plan = vipPlans.find((row) => String(row.id) === String(planId));
    const selectedIds = isLevel3VipPlan(plan) ? vipOptions.map((option) => option.id) : [];
    updateItem(itemId, { vip_plan_id: planId, selected_option_ids: selectedIds, cycle_key: vipCycleKey });
    setError('');
  }
  function toggleVipOption(item, optionId) {
    const selectedIds = Array.isArray(item?.selected_option_ids) ? item.selected_option_ids.map(String) : [];
    const optionKey = String(optionId);
    if (selectedIds.includes(optionKey)) {
      updateItem(item.id, { selected_option_ids: selectedIds.filter((id) => id !== optionKey) });
      setError('');
      return;
    }
    const plan = vipPlans.find((row) => String(row.id) === String(item.vip_plan_id));
    if (isLevel3VipPlan(plan)) return;
    const limits = getVipPlanLimits(plan);
    const counts = getVipSelectedCounts(item);
    const option = vipOptions.find((row) => String(row.id) === optionKey);
    const isBoss = String(option?.item_type || 'miniature').toLowerCase() === 'boss';
    if (counts.total >= limits.total || (isBoss ? counts.bosses >= limits.bosses : counts.miniatures >= limits.miniatures)) {
      setError(`O limite deste plano é ${limits.miniatures} miniatura(s)${limits.bosses ? ` e ${limits.bosses} boss(es)` : ''}.`);
      return;
    }
    updateItem(item.id, { selected_option_ids: [...selectedIds, optionKey] });
    setError('');
  }
  function updateItem(id, patch) { setItems((p) => p.map((it) => it.id === id ? { ...it, ...patch } : it)); }
  function removeItem(id) { setItems((p) => p.filter((it) => it.id !== id)); }

  const hasVipItem = items.some((item) => item.mode === 'vip');

  const total = React.useMemo(() => items.reduce((sum, it) => {
    if (it.mode === 'product') {
      const prod = products.find((p) => String(p.id) === String(it.product_id));
      const basePrice = Number(prod?.price || 0);
      return sum + basePrice * Number(it.qty || 1);
    }
    if (it.mode === 'vip') {
      const plan = vipPlans.find((p) => String(p.id) === String(it.vip_plan_id));
      return sum + Number(plan?.price_brl ?? plan?.price ?? 0);
    }
    return sum + Number(it.price || 0) * Number(it.qty || 1);
  }, 0), [items, products, vipPlans]);

  function handleModel3dChange(file) {
    setModel3dError('');
    if (!file) {
      setModel3dFile(null);
      return;
    }
    const name = String(file.name || '').toLowerCase();
    if (!name.endsWith('.glb')) {
      setModel3dFile(null);
      setModel3dError('Selecione apenas arquivos .glb.');
      return;
    }
    const maxBytes = 100 * 1024 * 1024;
    if (Number(file.size || 0) > maxBytes) {
      setModel3dFile(null);
      setModel3dError('O arquivo .glb deve ter no máximo 100 MB.');
      return;
    }
    setModel3dFile(file);
  }

  async function handleSubmit(paymentAction = 'payment_link') {
    setBusy(true);
    setError('');
    try {
      const vipItem = items.find((item) => item.mode === 'vip');
      if (vipItem) {
        const plan = vipPlans.find((row) => String(row.id) === String(vipItem.vip_plan_id));
        if (!plan) throw new Error('Selecione um plano VIP válido.');
        const counts = getVipSelectedCounts(vipItem);
        const limits = getVipPlanLimits(plan);
        if (!vipOptions.length) throw new Error('Nenhuma miniatura está ativa no ciclo VIP atual.');
        if (!isLevel3VipPlan(plan) && (counts.total !== limits.total || counts.miniatures !== limits.miniatures || counts.bosses !== limits.bosses)) {
          throw new Error(`Selecione exatamente ${limits.miniatures} miniatura(s)${limits.bosses ? ` e ${limits.bosses} boss(es)` : ''} para este plano.`);
        }
      }
      let uploadedModel = { url: '', name: '' };
      if (model3dFile) {
        uploadedModel = await uploadOrder3dModel(model3dFile);
        if (!uploadedModel.url) throw new Error('O upload do modelo 3D terminou sem gerar uma URL pública.');
      }
      const payload = {
        customer: {
          ...form,
          existing_user_id: customerMode === 'existing' ? selectedClientId : '',
          account_mode: customerMode,
        },
        existing_user_id: customerMode === 'existing' ? selectedClientId : '',
        account_mode: customerMode,
        payment_action: paymentAction,
        model_3d_url: uploadedModel.url,
        model_3d_name: uploadedModel.name,
        items: items.map((it) => {
          if (it.mode === 'product') return { mode: 'product', product_id: it.product_id, qty: Number(it.qty || 1), scale: it.scale || '' };
          if (it.mode === 'freight') return { mode: 'freight', carrier: it.carrier || '', price: Number(it.price || 0), qty: 1, notes: it.notes || '' };
          if (it.mode === 'vip') return { mode: 'vip', vip_plan_id: it.vip_plan_id, selected_option_ids: Array.isArray(it.selected_option_ids) ? it.selected_option_ids : [], cycle_key: it.cycle_key || vipCycleKey };
          return { mode: 'custom', name: it.name, price: Number(it.price || 0), scale: it.scale || '', qty: Number(it.qty || 1), notes: it.notes || '' };
        }),
      };
      const resp = await fetch('/api/admin?action=manual-order-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(payload),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(json?.error || 'Não foi possível criar o pedido.');
      setResult(json);
      setShowFinalizeChoices(false);
      const createdVip = String(json?.order?.order_type || '').toLowerCase() === 'vip';
      showToast?.(json?.email?.ok
        ? (paymentAction === 'mark_paid' ? (createdVip ? 'Assinatura VIP ativada e boas-vindas enviadas.' : 'Pedido pago lançado e confirmação enviada por e-mail.') : (createdVip ? 'Assinatura VIP criada e link enviado por e-mail.' : 'Pedido criado e link enviado por e-mail.'))
        : (paymentAction === 'mark_paid' ? (createdVip ? 'Assinatura VIP ativada com sucesso.' : 'Pedido lançado como pago com sucesso.') : (createdVip ? 'Assinatura VIP criada com sucesso.' : 'Pedido criado com sucesso.')));
      onCreated?.();
    } catch (e) {
      setError(e?.message || 'Erro ao criar pedido.');
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[10000]">
      <div className="absolute inset-0 bg-[#020b10]/80" onClick={busy ? undefined : onClose} />
      <div className="absolute inset-x-0 top-4 mx-auto w-[min(1100px,calc(100vw-24px))] max-h-[92vh] overflow-y-auto rounded-[28px] bg-[#0a0f1a] ring-1 ring-white/10 p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-2xl font-bold text-white">Novo pedido</div>
            <div className="text-sm text-slate-400">Crie o pedido, gere o link de pagamento e lance tudo no sistema.</div>
          </div>
          <button onClick={onClose} className="rounded-xl px-3 py-2 text-slate-200 hover:bg-white/4 ring-1 ring-white/10">Fechar</button>
        </div>

        {error ? <div className="mt-4 rounded-2xl bg-red-500/10 ring-1 ring-red-500/20 px-4 py-3 text-red-100">{error}</div> : null}

        {result ? (
          <div className="mt-5 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 items-start">
            <div className="rounded-3xl bg-emerald-500/10 ring-1 ring-emerald-400/20 p-5">
              <div className="text-emerald-100 text-xl font-extrabold">{result?.payment_link ? 'Pedido criado' : 'Pedido lançado como pago'}</div>
              <div className="mt-2 text-sm text-emerald-50/90">{result?.payment_link ? (result?.email?.ok ? 'O link de pagamento foi enviado automaticamente para o e-mail do cliente. Você também pode copiá-lo abaixo.' : 'Compartilhe o link abaixo com o cliente para ele pagar com Pix ou cartão.') : (result?.email?.ok ? 'O pedido entrou no sistema como pago e a confirmação foi enviada para o cliente.' : 'O pedido já entrou no sistema como pago e pronto para seguir no fluxo de produção.')}</div>
              {result?.payment_link ? (
                <>
                  <div className="mt-4 rounded-2xl bg-black/20 ring-1 ring-white/10 p-4 break-all text-sm text-slate-100">{result?.payment_link}</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button onClick={() => navigator.clipboard?.writeText(result?.payment_link || '')} className="rounded-xl px-3 py-2 text-sm text-slate-200 hover:bg-white/4 ring-1 ring-white/10">Copiar link</button>
                    <a href={result?.payment_link} target="_blank" rel="noreferrer" className="rounded-xl px-3 py-2 text-sm text-slate-200 hover:bg-white/4 ring-1 ring-white/10">Abrir página</a>
                  </div>
                </>
              ) : null}
              <div className="mt-4 rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-4 text-sm text-slate-200">
                <div><b>{result?.account?.existing ? 'Conta vinculada:' : 'Conta criada:'}</b> {result?.account?.email}</div>
                {!result?.account?.existing ? <div className="mt-1"><b>Senha inicial:</b> CPF do cliente</div> : <div className="mt-1">Pedido associado a um cliente já cadastrado no site.</div>}
              </div>
            </div>
            <div className="rounded-3xl bg-white/[0.03] ring-1 ring-white/10 p-4 min-w-[240px]">
              <div className="text-sm text-slate-400">Pedido</div>
              <div className="mt-2 text-white font-bold">#{result?.order?.order_number}</div>
              <div className="mt-1 text-slate-300">{fmtBRL(result?.order?.total || 0)}</div>
            </div>
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-1 xl:grid-cols-[0.95fr_1.05fr] gap-5">
            <div className="space-y-4">
              <div className="rounded-3xl bg-white/[0.03] ring-1 ring-white/10 p-4 space-y-4">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCustomerMode('new');
                      setSelectedClientId('');
                      setForm(emptyForm);
                    }}
                    className={`rounded-2xl px-4 py-2 text-sm font-semibold ring-1 transition ${customerMode === 'new' ? 'bg-cyan-400 text-[#031116] ring-cyan-300/40' : 'bg-white/[0.03] text-slate-200 ring-white/10 hover:bg-white/[0.06]'}`}
                  >
                    Novo cliente
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomerMode('existing')}
                    className={`rounded-2xl px-4 py-2 text-sm font-semibold ring-1 transition ${customerMode === 'existing' ? 'bg-cyan-400 text-[#031116] ring-cyan-300/40' : 'bg-white/[0.03] text-slate-200 ring-white/10 hover:bg-white/[0.06]'}`}
                  >
                    Cliente já cadastrado
                  </button>
                </div>

                {customerMode === 'existing' ? (
                  <div className="rounded-2xl bg-black/20 ring-1 ring-white/10 p-3 space-y-3">
                    <label className="block text-sm text-slate-300">
                      Buscar cliente
                      <input
                        value={clientSearch}
                        onChange={(e) => setClientSearch(e.target.value)}
                        placeholder="Digite nome, e-mail, CPF ou telefone"
                        className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white"
                      />
                    </label>
                    <label className="block text-sm text-slate-300">
                      Selecionar cliente
                      <select
                        value={selectedClientId}
                        onChange={(e) => setSelectedClientId(e.target.value)}
                        className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white"
                        disabled={loadingClients || !availableClients.length}
                      >
                        <option value="">{loadingClients ? 'Carregando clientes...' : 'Selecione um cliente cadastrado'}</option>
                        {availableClients.map((client) => (
                          <option key={client.id} value={client.id}>
                            {client.full_name || client.email || client.id}{client.email ? ` • ${client.email}` : ''}
                          </option>
                        ))}
                      </select>
                    </label>
                    {clientsError ? <div className="text-sm text-red-200">{clientsError}</div> : null}
                    {selectedClient ? (
                      <div className="rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-3 text-sm text-slate-300">
                        <div className="font-semibold text-slate-100">{selectedClient.full_name || 'Cliente selecionado'}</div>
                        <div>{selectedClient.email || 'Sem e-mail cadastrado'}</div>
                        <div>{selectedClient.phone || 'Sem telefone cadastrado'}</div>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="text-sm text-slate-300">Nome<input value={form.name} onChange={(e)=>updateForm('name', e.target.value)} className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white" /></label>
                  <label className="text-sm text-slate-300">CPF<input value={form.cpf} onChange={(e)=>updateForm('cpf', e.target.value)} placeholder="000.000.000-00" className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white" /></label>
                  <label className="text-sm text-slate-300">E-mail<input value={form.email} onChange={(e)=>updateForm('email', e.target.value)} className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white" /></label>
                  <label className="text-sm text-slate-300">Telefone<input value={form.phone} onChange={(e)=>updateForm('phone', e.target.value)} placeholder="(00) 00000-0000" className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white" /></label>
                  <label className="text-sm text-slate-300 sm:col-span-2">Rua<input value={form.address_line1} onChange={(e)=>updateForm('address_line1', e.target.value)} className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white" /></label>
                  <label className="text-sm text-slate-300">Número<input value={form.address_number} onChange={(e)=>updateForm('address_number', e.target.value)} className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white" /></label>
                  <label className="text-sm text-slate-300">Complemento<input value={form.address_line2} onChange={(e)=>updateForm('address_line2', e.target.value)} className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white" /></label>
                  <label className="text-sm text-slate-300">Bairro<input value={form.neighborhood} onChange={(e)=>updateForm('neighborhood', e.target.value)} className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white" /></label>
                  <label className="text-sm text-slate-300">Cidade<input value={form.city} onChange={(e)=>updateForm('city', e.target.value)} className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white" /></label>
                  <label className="text-sm text-slate-300">Estado<input value={form.state} onChange={(e)=>updateForm('state', e.target.value)} className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white" /></label>
                  <label className="text-sm text-slate-300">CEP<input value={form.zip} onChange={(e)=>updateForm('zip', e.target.value)} placeholder="00000-000" className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white" />{cepLoading ? <span className="mt-1 block text-xs text-cyan-200">Buscando endereço…</span> : null}{cepError ? <span className="mt-1 block text-xs text-red-200">{cepError}</span> : null}</label>
                </div>
              </div>

              <div className="rounded-3xl bg-white/[0.03] ring-1 ring-white/10 p-4">
                <div className="text-white font-bold">Visualizador 3D</div>
                <div className="mt-1 text-sm text-slate-400">Adicione um arquivo .glb para o cliente visualizar o modelo na página de pagamento.</div>
                <label className="mt-4 flex min-h-[104px] cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-cyan-300/30 bg-cyan-400/[0.03] px-4 py-5 text-center hover:bg-cyan-400/[0.06]">
                  <input
                    type="file"
                    accept=".glb,model/gltf-binary"
                    className="sr-only"
                    onChange={(e) => handleModel3dChange(e.target.files?.[0] || null)}
                    disabled={busy}
                  />
                  <span className="text-sm font-bold text-cyan-100">Selecionar arquivo .glb</span>
                  <span className="mt-1 text-xs text-slate-400">Máximo recomendado: 100 MB</span>
                </label>
                {model3dFile ? (
                  <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-black/20 p-3 ring-1 ring-white/10">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-100">{model3dFile.name}</div>
                      <div className="text-xs text-slate-400">{(Number(model3dFile.size || 0) / 1024 / 1024).toFixed(2)} MB</div>
                    </div>
                    <button type="button" onClick={() => handleModel3dChange(null)} disabled={busy} className="rounded-xl px-3 py-2 text-sm text-red-200 hover:bg-red-500/10 ring-1 ring-red-500/30">Remover</button>
                  </div>
                ) : null}
                {model3dError ? <div className="mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-100 ring-1 ring-red-500/20">{model3dError}</div> : null}
                <div className="mt-3 rounded-2xl bg-black/20 p-3 text-xs text-slate-400 ring-1 ring-white/10">
                  Quando o link de pagamento for aberto, o cliente verá o botão <b className="text-slate-200">Ver 3D</b> se este arquivo estiver anexado.
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="rounded-3xl bg-white/[0.03] ring-1 ring-white/10 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-white font-bold">Itens do pedido</div>
                    <div className="text-sm text-slate-400">Adicione produtos, orçamento, frete ou crie uma assinatura VIP com as miniaturas do ciclo.</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={addRegisteredProduct} className="rounded-xl px-3 py-2 text-sm text-slate-200 hover:bg-white/4 ring-1 ring-white/10">Produto cadastrado</button>
                    <button onClick={addCustomItem} className="rounded-xl px-3 py-2 text-sm text-slate-200 hover:bg-white/4 ring-1 ring-white/10">Orçamento personalizado</button>
                    <button onClick={addFreightItem} className="rounded-xl px-3 py-2 text-sm text-cyan-100 hover:bg-cyan-500/10 ring-1 ring-cyan-400/20">Pagamento de frete</button>
                    <button onClick={addVipItem} disabled={loadingVipData} className="rounded-xl px-3 py-2 text-sm font-semibold text-violet-100 hover:bg-violet-500/10 ring-1 ring-violet-400/30 disabled:opacity-50">{loadingVipData ? 'Carregando VIP…' : 'Assinatura VIP'}</button>
                  </div>
                </div>
                {vipDataError ? <div className="mt-3 rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-100 ring-1 ring-amber-400/20">{vipDataError}</div> : null}
                <div className="mt-4 space-y-3">
                  {items.map((it) => it.mode === 'vip' ? (() => {
                    const plan = vipPlans.find((row) => String(row.id) === String(it.vip_plan_id)) || null;
                    const limits = getVipPlanLimits(plan);
                    const counts = getVipSelectedCounts(it);
                    const selectedIds = Array.isArray(it.selected_option_ids) ? it.selected_option_ids.map(String) : [];
                    const level3 = isLevel3VipPlan(plan);
                    return (
                      <div key={it.id} className="rounded-2xl bg-violet-500/5 p-4 ring-1 ring-violet-400/25">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-base font-extrabold text-violet-100">Assinatura VIP</div>
                            <div className="mt-1 text-xs text-slate-400">Ciclo {it.cycle_key || vipCycleKey || 'ativo'} • acesso liberado automaticamente após o pagamento</div>
                          </div>
                          <button onClick={() => removeItem(it.id)} className="rounded-xl px-3 py-2 text-sm text-red-200 hover:bg-red-500/10 ring-1 ring-red-500/30">Remover</button>
                        </div>

                        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                          <label className="text-sm text-slate-300">
                            Plano VIP
                            <select value={it.vip_plan_id || ''} onChange={(e) => changeVipPlan(it.id, e.target.value)} className="mt-1 w-full rounded-xl bg-black/20 px-3 py-2 text-white ring-1 ring-white/10">
                              <option value="">Selecione</option>
                              {vipPlans.map((vipPlan) => <option key={vipPlan.id} value={vipPlan.id}>{vipPlan.name || vipPlan.short_name || vipPlan.id} — {fmtBRL(vipPlan.price_brl ?? vipPlan.price ?? 0)}</option>)}
                            </select>
                          </label>
                          <div className="rounded-xl bg-black/20 px-4 py-3 text-right ring-1 ring-white/10">
                            <div className="text-xs text-slate-400">Valor carregado</div>
                            <div className="text-lg font-extrabold text-white">{fmtBRL(plan?.price_brl ?? plan?.price ?? 0)}</div>
                          </div>
                        </div>

                        <div className="mt-4 rounded-2xl bg-black/20 p-3 ring-1 ring-white/10">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <div className="text-sm font-semibold text-white">Miniaturas da assinatura</div>
                              <div className="text-xs text-slate-400">Selecione {limits.miniatures} miniatura(s){limits.bosses ? ` e ${limits.bosses} boss(es)` : ''}.</div>
                            </div>
                            <div className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ${counts.total === limits.total && counts.miniatures === limits.miniatures && counts.bosses === limits.bosses ? 'bg-emerald-500/10 text-emerald-100 ring-emerald-400/30' : 'bg-violet-500/10 text-violet-100 ring-violet-400/30'}`}>
                              {counts.total}/{limits.total} • Mini {counts.miniatures}/{limits.miniatures}{limits.bosses ? ` • Boss ${counts.bosses}/${limits.bosses}` : ''}
                            </div>
                          </div>
                          {level3 ? <div className="mt-3 rounded-xl bg-violet-500/10 px-3 py-2 text-xs text-violet-100 ring-1 ring-violet-400/20">Este plano inclui automaticamente todas as opções disponíveis no ciclo.</div> : null}
                          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {vipOptions.map((option) => {
                              const selected = selectedIds.includes(String(option.id));
                              const isBoss = String(option?.item_type || 'miniature').toLowerCase() === 'boss';
                              return (
                                <button
                                  key={option.id}
                                  type="button"
                                  disabled={level3}
                                  onClick={() => toggleVipOption(it, option.id)}
                                  className={`flex items-center gap-3 rounded-xl p-2 text-left ring-1 transition ${selected ? 'bg-violet-400/15 ring-violet-300/50' : 'bg-white/[0.03] ring-white/10 hover:bg-white/[0.06]'} disabled:cursor-default`}
                                >
                                  {option.image_url ? <img src={option.image_url} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover ring-1 ring-white/10" loading="lazy" /> : <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-black/30 text-slate-500 ring-1 ring-white/10"><span className="material-icons">image</span></div>}
                                  <div className="min-w-0 flex-1">
                                    <div className="truncate text-sm font-semibold text-slate-100">{option.title || 'Miniatura VIP'}</div>
                                    <div className="mt-1 text-[11px] uppercase tracking-wide text-slate-400">{isBoss ? 'Boss' : 'Miniatura'}</div>
                                  </div>
                                  <span className={`material-icons text-[20px] ${selected ? 'text-violet-200' : 'text-slate-600'}`}>{selected ? 'check_circle' : 'radio_button_unchecked'}</span>
                                </button>
                              );
                            })}
                          </div>
                          {!vipOptions.length ? <div className="mt-3 rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-100 ring-1 ring-amber-400/20">Nenhuma miniatura está ativa no ciclo VIP atual.</div> : null}
                        </div>
                      </div>
                    );
                  })() : it.mode === 'product' ? (
                    <div key={it.id} className="rounded-2xl bg-black/20 ring-1 ring-white/10 p-3 grid grid-cols-1 sm:grid-cols-[1fr_120px_110px_auto] gap-3 items-end">
                      <label className="text-sm text-slate-300">Produto<select value={it.product_id} onChange={(e)=>updateItem(it.id, { product_id: e.target.value, scale: '' })} className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white"><option value="">Selecione</option>{products.map((p)=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
                      <label className="text-sm text-slate-300">Quantidade<input type="number" min="1" value={it.qty} onChange={(e)=>updateItem(it.id, { qty: e.target.value })} className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white" /></label>
                      <label className="text-sm text-slate-300">Escala<input value={it.scale} onChange={(e)=>updateItem(it.id, { scale: e.target.value })} placeholder="Opcional" className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white" /></label>
                      <button onClick={()=>removeItem(it.id)} className="rounded-xl px-3 py-2 text-sm text-red-200 hover:bg-red-500/10 ring-1 ring-red-500/30">Remover</button>
                    </div>
                  ) : it.mode === 'freight' ? (
                    <div key={it.id} className="rounded-2xl bg-cyan-500/5 ring-1 ring-cyan-400/20 p-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className="text-sm text-slate-300">Transportadora<select value={it.carrier} onChange={(e)=>updateItem(it.id, { carrier: e.target.value })} className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white"><option value="">Selecione</option><option value="correios">Correios</option><option value="jadlog">Jadlog</option><option value="loggi">Loggi</option></select></label>
                      <label className="text-sm text-slate-300">Valor do frete<input type="number" min="0" step="0.01" value={it.price} onChange={(e)=>updateItem(it.id, { price: e.target.value })} className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white" /></label>
                      <label className="text-sm text-slate-300 sm:col-span-2">Observações<textarea value={it.notes} onChange={(e)=>updateItem(it.id, { notes: e.target.value })} placeholder="Opcional" className="mt-1 h-20 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white" /></label>
                      <div className="sm:col-span-2 flex items-center justify-between gap-3">
                        <div className="rounded-xl bg-black/20 px-3 py-2 text-xs text-cyan-100 ring-1 ring-cyan-400/20">Item exclusivo para cobrança de frete.</div>
                        <button onClick={()=>removeItem(it.id)} className="rounded-xl px-3 py-2 text-sm text-red-200 hover:bg-red-500/10 ring-1 ring-red-500/30">Remover</button>
                      </div>
                    </div>
                  ) : (
                    <div key={it.id} className="rounded-2xl bg-black/20 ring-1 ring-white/10 p-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className="text-sm text-slate-300">Nome do produto<input value={it.name} onChange={(e)=>updateItem(it.id, { name: e.target.value })} className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white" /></label>
                      <label className="text-sm text-slate-300">Valor<input type="number" min="0" step="0.01" value={it.price} onChange={(e)=>updateItem(it.id, { price: e.target.value })} className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white" /></label>
                      <label className="text-sm text-slate-300">Escala<input value={it.scale} onChange={(e)=>updateItem(it.id, { scale: e.target.value })} className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white" /></label>
                      <label className="text-sm text-slate-300">Quantidade<input type="number" min="1" value={it.qty} onChange={(e)=>updateItem(it.id, { qty: e.target.value })} className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white" /></label>
                      <label className="text-sm text-slate-300 sm:col-span-2">Observações<textarea value={it.notes} onChange={(e)=>updateItem(it.id, { notes: e.target.value })} className="mt-1 h-20 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white" /></label>
                      <div className="sm:col-span-2 flex justify-end"><button onClick={()=>removeItem(it.id)} className="rounded-xl px-3 py-2 text-sm text-red-200 hover:bg-red-500/10 ring-1 ring-red-500/30">Remover</button></div>
                    </div>
                  ))}
                  {!items.length ? <div className="rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-4 text-sm text-slate-400">Nenhum item adicionado ainda.</div> : null}
                </div>
                <div className="mt-4 flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-lg font-extrabold text-white">Total: {fmtBRL(total)}</div>
                  <div className="flex flex-col items-stretch gap-2 sm:items-end">
                    <button onClick={() => setShowFinalizeChoices((v) => !v)} disabled={busy || loadingProducts || (hasVipItem && loadingVipData)} className="rounded-2xl bg-cyan-400 text-[#031116] font-black px-5 py-3 disabled:opacity-60">{busy ? 'Processando…' : 'Finalizar pedido'}</button>
                    {showFinalizeChoices ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button onClick={() => handleSubmit('payment_link')} disabled={busy || loadingProducts || (hasVipItem && loadingVipData)} className="rounded-2xl bg-white/[0.04] text-slate-100 font-semibold px-4 py-3 ring-1 ring-white/10 hover:bg-white/[0.07] disabled:opacity-60">Gerar link de pagamento</button>
                        <button onClick={() => handleSubmit('mark_paid')} disabled={busy || loadingProducts || (hasVipItem && loadingVipData)} className="rounded-2xl bg-emerald-400 text-[#031116] font-black px-4 py-3 disabled:opacity-60">Pedido pago</button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


function CreateClientModal({ open, accessToken, onClose, onCreated, showToast }) {
  const emptyForm = React.useMemo(() => ({
    full_name: '',
    email: '',
    cpf: '',
    phone: '',
    address_line1: '',
    address_number: '',
    address_line2: '',
    neighborhood: '',
    city: '',
    state: '',
    zip: '',
  }), []);
  const [form, setForm] = React.useState(emptyForm);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [created, setCreated] = React.useState(null);
  const [cepLoading, setCepLoading] = React.useState(false);
  const [cepError, setCepError] = React.useState('');
  const [model3dFile, setModel3dFile] = React.useState(null);
  const [model3dError, setModel3dError] = React.useState('');

  React.useEffect(() => {
    if (!open) return;
    setForm(emptyForm);
    setBusy(false);
    setError('');
    setCreated(null);
    setCepLoading(false);
    setCepError('');
  }, [open, emptyForm]);

  React.useEffect(() => {
    if (!open) return;
    const cepDigits = onlyDigits(form.zip);
    if (cepDigits.length !== 8) {
      setCepError('');
      return;
    }
    let active = true;
    setCepLoading(true);
    setCepError('');
    fetchAddressFromCep(cepDigits)
      .then((resp) => {
        if (!active) return;
        if (!resp?.ok) {
          setCepError(resp?.error || 'CEP não encontrado.');
          return;
        }
        setForm((prev) => ({
          ...prev,
          address_line1: resp.data.street || prev.address_line1,
          neighborhood: resp.data.neighborhood || prev.neighborhood,
          city: resp.data.city || prev.city,
          state: resp.data.uf || prev.state,
        }));
      })
      .catch(() => active && setCepError('Erro ao consultar CEP.'))
      .finally(() => active && setCepLoading(false));
    return () => { active = false; };
  }, [open, form.zip]);

  function updateField(key, value) {
    let nextValue = value;
    if (key === 'cpf') nextValue = formatCpfInput(value);
    if (key === 'phone') nextValue = formatPhoneInput(value);
    if (key === 'zip') nextValue = formatCepInput(value);
    if (key === 'state') nextValue = String(value || '').toUpperCase().slice(0, 2);
    setForm((prev) => ({ ...prev, [key]: nextValue }));
  }

  async function handleCreate() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const resp = await fetch('/api/admin?action=create-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(form),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.error || 'Não foi possível cadastrar o cliente.');
      setCreated(data?.client || null);
      showToast?.('Cliente cadastrado com sucesso.');
      onCreated?.(data?.client || null);
    } catch (e) {
      setError(e?.message || 'Erro ao cadastrar cliente.');
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[10001]">
      <div className="absolute inset-0 bg-[#020b10]/80" onClick={busy ? undefined : onClose} />
      <div className="absolute inset-x-0 top-4 mx-auto w-[min(760px,calc(100vw-24px))] max-h-[92vh] overflow-y-auto rounded-[28px] bg-[#0a0f1a] ring-1 ring-white/10 p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-2xl font-bold text-white">Cadastrar cliente</div>
            <div className="text-sm text-slate-400">Crie uma conta de cliente para usar em pedidos e acompanhamento no site.</div>
          </div>
          <button onClick={onClose} disabled={busy} className="rounded-xl px-3 py-2 text-slate-200 hover:bg-white/4 ring-1 ring-white/10 disabled:opacity-60">Fechar</button>
        </div>

        {error ? <div className="mt-4 rounded-2xl bg-red-500/10 ring-1 ring-red-500/20 px-4 py-3 text-red-100">{error}</div> : null}
        {created ? (
          <div className="mt-4 rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-400/20 px-4 py-3 text-emerald-100">
            <div className="font-bold">Cliente cadastrado.</div>
            <div className="mt-1 text-sm">E-mail: <b>{created.email}</b> • Senha inicial: <b>CPF do cliente</b></div>
          </div>
        ) : null}

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-sm text-slate-300">Nome completo<input value={form.full_name} onChange={(e)=>updateField('full_name', e.target.value)} className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white" /></label>
          <label className="text-sm text-slate-300">E-mail<input type="email" value={form.email} onChange={(e)=>updateField('email', e.target.value)} className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white" /></label>
          <label className="text-sm text-slate-300">CPF<input value={form.cpf} onChange={(e)=>updateField('cpf', e.target.value)} placeholder="000.000.000-00" className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white" /><span className="mt-1 block text-xs text-slate-500">A senha inicial será o CPF</span></label>
          <label className="text-sm text-slate-300">Telefone<input value={form.phone} onChange={(e)=>updateField('phone', e.target.value)} placeholder="(00) 00000-0000" className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white" /></label>
          <label className="text-sm text-slate-300 md:col-span-2">Endereço<input value={form.address_line1} onChange={(e)=>updateField('address_line1', e.target.value)} className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white" /></label>
          <label className="text-sm text-slate-300">Número<input value={form.address_number} onChange={(e)=>updateField('address_number', e.target.value)} className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white" /></label>
          <label className="text-sm text-slate-300">Complemento<input value={form.address_line2} onChange={(e)=>updateField('address_line2', e.target.value)} className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white" /></label>
          <label className="text-sm text-slate-300">Bairro<input value={form.neighborhood} onChange={(e)=>updateField('neighborhood', e.target.value)} className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white" /></label>
          <label className="text-sm text-slate-300">Cidade<input value={form.city} onChange={(e)=>updateField('city', e.target.value)} className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white" /></label>
          <label className="text-sm text-slate-300">UF<input value={form.state} onChange={(e)=>updateField('state', e.target.value)} maxLength={2} className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white uppercase" /></label>
          <label className="text-sm text-slate-300">CEP<input value={form.zip} onChange={(e)=>updateField('zip', e.target.value)} placeholder="00000-000" className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white" />{cepLoading ? <span className="mt-1 block text-xs text-cyan-200">Buscando endereço…</span> : null}{cepError ? <span className="mt-1 block text-xs text-red-200">{cepError}</span> : null}</label>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-white/10 pt-4">
          <button onClick={onClose} disabled={busy} className="rounded-xl px-4 py-2 text-sm text-slate-200 hover:bg-white/4 ring-1 ring-white/10 disabled:opacity-60">Cancelar</button>
          <button onClick={handleCreate} disabled={busy} className="rounded-xl px-4 py-2 text-sm font-semibold bg-emerald-400 text-black ring-4 ring-emerald-400/20 disabled:opacity-60 disabled:cursor-wait">{busy ? 'Cadastrando…' : 'Cadastrar'}</button>
        </div>
      </div>
    </div>
  );
}

export default function AdminOrdersPage({ user, accessToken, isAdmin, isAdminLoading = false, onNavigateHome, onRequireLogin }) {
  const { loading: authLoading } = useAuth();
  const [section, setSection] = React.useState("dashboard");

  const [orders, setOrders] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  const [q, setQ] = React.useState("");
  const [qInput, setQInput] = React.useState("");
  const [filterPay, setFilterPay] = React.useState("all");
  const [filterProd, setFilterProd] = React.useState("all");
  const [filterType, setFilterType] = React.useState("all");
  const [filterDateFrom, setFilterDateFrom] = React.useState(() => toDateInputValue(new Date(Date.now() - 29 * 86400000)));
  const [filterDateTo, setFilterDateTo] = React.useState(() => toDateInputValue(new Date()));
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(25);
  const [pagination, setPagination] = React.useState({ page: 1, pageSize: 25, totalCount: 0, totalPages: 1 });
  const [summary, setSummary] = React.useState({ total: 0, paid: 0, pending: 0, revenue: 0, refundReq: 0, vipCount: 0, overdueCount: 0, finance: { paidToday: 0, paidMonth: 0, upgradeRevenue: 0, averageTicket: 0 }, bottlenecks: { paidWaitingProduction: 0, readyWithoutTracking: 0, shippedInTransit: 0, refundRequested: 0, staleOrders: 0, overdueCount: 0, awaitingShipment: 0 } });
  const [selectedOrderIds, setSelectedOrderIds] = React.useState([]);
  const [bulkBusy, setBulkBusy] = React.useState(false);
  const [bulkModal, setBulkModal] = React.useState({ open: false, mode: "status" });

  const [toast, setToast] = React.useState("");
  const [resendEmailBusyId, setResendEmailBusyId] = React.useState(null);
  const [details, setDetails] = React.useState({ open: false, orderId: null });
  const [actionModal, setActionModal] = React.useState({ open: false, mode: "status", orderId: null });

  const [vipPolls, setVipPolls] = React.useState([]);
  const [vipPollsLoading, setVipPollsLoading] = React.useState(false);
  const [vipPollsError, setVipPollsError] = React.useState("");
  const [vipVotingImages, setVipVotingImages] = React.useState([]);
  const [vipVotingImagesLoading, setVipVotingImagesLoading] = React.useState(false);
  const [vipVotingImagesError, setVipVotingImagesError] = React.useState("");
  const [vipControl, setVipControl] = React.useState({ active_cycle_key: "", cycles: [], library: [], setup_required: false, cycle_column_available: true, vip_summary: { activeSubscribers: 0, byCycle: [] } });
  const [vipControlLoading, setVipControlLoading] = React.useState(false);
  const [vipControlError, setVipControlError] = React.useState("");
  const [vipCycleEditor, setVipCycleEditor] = React.useState({ cycle_key: "", selected_ids: [], activate: true });
  const [vipCycleBusy, setVipCycleBusy] = React.useState(false);
  const [vipLibrarySearch, setVipLibrarySearch] = React.useState("");
  const [vipLibraryFilter, setVipLibraryFilter] = React.useState("all");

  const [gameCouponLoading, setGameCouponLoading] = React.useState(false);
  const [gameCouponError, setGameCouponError] = React.useState("");
  const [gameCouponForm, setGameCouponForm] = React.useState({
    discount_type: "percent",
    discount_value: 5,
    min_order_value: 0,
    label: "",
  });
  const [currentGameCoupon, setCurrentGameCoupon] = React.useState(null);
  const [gameCouponMetricsLoading, setGameCouponMetricsLoading] = React.useState(false);
  const [gameCouponMetricsError, setGameCouponMetricsError] = React.useState("");
  const [gameCouponMetrics, setGameCouponMetrics] = React.useState({
    players_count: 0,
    wins_count: 0,
    unique_winners_count: 0,
    coupons_generated_count: 0,
    coupons_applied_count: 0,
    purchases_with_coupon_count: 0,
    revenue_generated_brl: 0,
    discount_granted_brl: 0,
    coupon_conversion_rate: 0,
    coupon_orders_using_fallback: false,
  });

  const [closeVote, setCloseVote] = React.useState({ open: false, poll: null, winnerId: null, busy: false, error: "" });
  const [startVote, setStartVote] = React.useState({ open: false, data: null, busy: false, error: "" });
  const [deleteVote, setDeleteVote] = React.useState({ open: false, poll: null, busy: false, error: "" });
  const [newOrderOpen, setNewOrderOpen] = React.useState(false);
  const [clients, setClients] = React.useState([]);
  const [clientsLoading, setClientsLoading] = React.useState(false);
  const [clientsError, setClientsError] = React.useState('');
  const [clientsQ, setClientsQ] = React.useState('');
  const [clientEditor, setClientEditor] = React.useState(null);
  const [clientVipPlans, setClientVipPlans] = React.useState([]);
  const [clientVipBusy, setClientVipBusy] = React.useState(false);
  const [newClientOpen, setNewClientOpen] = React.useState(false);
  const [adminQuickSearch, setAdminQuickSearch] = React.useState('');
  const [confirmAction, setConfirmAction] = React.useState({ open: false, type: '', payload: null, busy: false, error: '', keywordValue: '' });

  const showToast = (msg) => {
    setToast(msg);
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(""), 2000);
  };

  React.useEffect(() => {
    // Evita abrir login durante a restauração de sessão após refresh.
    if (!user && !authLoading) onRequireLogin?.("Faça login como admin para acessar o painel.");
  }, [user, authLoading]);

  const fetchOrders = React.useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        action: "orders",
        page: String(page),
        page_size: String(pageSize),
        q: String(q || ""),
        pay: String(filterPay || "all"),
        prod: String(filterProd || "all"),
        type: String(filterType || "all"),
        date_from: String(filterDateFrom || ""),
        date_to: String(filterDateTo || ""),
        _: String(Date.now()),
      });
      const resp = await fetch(`/api/admin?${params.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.error || "Não foi possível carregar pedidos.");
      setOrders(Array.isArray(data.orders) ? data.orders : []);
      setPagination({
        page: Number(data?.pagination?.page || page),
        pageSize: Number(data?.pagination?.page_size || pageSize),
        totalCount: Number(data?.pagination?.total_count || 0),
        totalPages: Number(data?.pagination?.total_pages || 1),
      });
      setSummary((prev) => ({ ...prev, ...(data?.summary || {}) }));
    } catch (e) {
      setError(e?.message || "Erro ao carregar pedidos.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, page, pageSize, q, filterPay, filterProd, filterType, filterDateFrom, filterDateTo]);

  const fetchClients = React.useCallback(async () => {
    if (!accessToken) return;
    setClientsLoading(true);
    setClientsError('');
    try {
      const params = new URLSearchParams({ action: 'clients', q: String(clientsQ || '') });
      const resp = await fetch(`/api/admin?${params.toString()}`, { headers: { Authorization: `Bearer ${accessToken}` } });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.error || 'Não foi possível carregar clientes.');
      setClients(Array.isArray(data?.clients) ? data.clients : []);
    } catch (e) {
      setClientsError(e?.message || 'Erro ao carregar clientes.');
    } finally {
      setClientsLoading(false);
    }
  }, [accessToken, clientsQ]);

  const fetchVipVoting = React.useCallback(async () => {
    if (!accessToken) return;
    setVipPollsLoading(true);
    setVipPollsError("");
    try {
      const resp = await fetch("/api/admin?action=vip-voting", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.error || "Não foi possível carregar a votação VIP.");
      setVipPolls(Array.isArray(data.polls) ? data.polls : []);
    } catch (e) {
      setVipPollsError(e?.message || "Erro ao carregar votação VIP.");
    } finally {
      setVipPollsLoading(false);
    }
  }, [accessToken]);



  const fetchVipVotingImages = React.useCallback(async () => {
    if (!accessToken) return;
    setVipVotingImagesLoading(true);
    setVipVotingImagesError("");
    try {
      const resp = await fetch("/api/admin?action=vip-voting-image-library", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.error || "Não foi possível carregar a biblioteca de imagens da votação.");
      setVipVotingImages(Array.isArray(data?.items) ? data.items : []);
      if (data?.setup_required) {
        setVipVotingImagesError(data?.message || "Cadastre a biblioteca de imagens no Supabase.");
      }
    } catch (e) {
      setVipVotingImages([]);
      setVipVotingImagesError(e?.message || "Erro ao carregar a biblioteca de imagens da votação.");
    } finally {
      setVipVotingImagesLoading(false);
    }
  }, [accessToken]);

  const nextMonthKey = React.useCallback(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  }, []);


  const fetchVipControl = React.useCallback(async () => {
    if (!accessToken) return;
    setVipControlLoading(true);
    setVipControlError("");
    try {
      const resp = await fetch("/api/admin?action=vip-control", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.error || "Não foi possível carregar o controle VIP.");
      const nextState = {
        active_cycle_key: String(data?.active_cycle_key || ""),
        cycles: Array.isArray(data?.cycles) ? data.cycles : [],
        library: Array.isArray(data?.library) ? data.library : [],
        setup_required: !!data?.setup_required,
        cycle_column_available: data?.cycle_column_available !== false,
        vip_summary: data?.vip_summary || { activeSubscribers: 0, byCycle: [] },
      };
      setVipControl(nextState);
      setVipCycleEditor((prev) => ({
        cycle_key: prev?.cycle_key || nextState.active_cycle_key || nextMonthKey(),
        selected_ids: Array.isArray(prev?.selected_ids) ? prev.selected_ids : [],
        activate: prev?.activate !== false,
      }));
      if (data?.setup_required) {
        setVipControlError("Rode o SQL de controle VIP antes de ativar ciclos pela tela.");
      } else if (data?.cycle_column_available === false) {
        setVipControlError("A coluna cycle_key ainda não existe em vip_mini_options. Rode o SQL de atualização.");
      }
    } catch (e) {
      setVipControl((prev) => ({ ...prev, cycles: [], library: [] }));
      setVipControlError(e?.message || "Erro ao carregar controle VIP.");
    } finally {
      setVipControlLoading(false);
    }
  }, [accessToken, nextMonthKey]);



  const fetchGameCoupon = React.useCallback(async () => {
    if (!accessToken) return;
    setGameCouponLoading(true);
    setGameCouponError("");
    try {
      const resp = await fetch("/api/admin?action=game-coupon", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.error || "Não foi possível carregar o cupom do jogo.");
      const config = data?.config || null;
      setCurrentGameCoupon(config);
      if (config) {
        setGameCouponForm({
          discount_type: String(config.discount_type || 'percent'),
          discount_value: Number(config.discount_value || 0),
          min_order_value: Number(config.min_order_value || 0),
          label: String(config.label || ''),
        });
      }
    } catch (e) {
      setGameCouponError(e?.message || "Erro ao carregar o cupom do jogo.");
    } finally {
      setGameCouponLoading(false);
    }
  }, [accessToken]);

  const fetchGameCouponMetrics = React.useCallback(async () => {
    if (!accessToken) return;
    setGameCouponMetricsLoading(true);
    setGameCouponMetricsError("");
    try {
      const resp = await fetch("/api/admin?action=game-coupon-metrics", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.error || "Não foi possível carregar as métricas de cupons.");
      setGameCouponMetrics((prev) => ({ ...prev, ...(data?.metrics || {}) }));
    } catch (e) {
      setGameCouponMetricsError(e?.message || "Erro ao carregar métricas de cupons.");
    } finally {
      setGameCouponMetricsLoading(false);
    }
  }, [accessToken]);

  async function startVipVoting(payload) {
    if (!accessToken) return;
    try {
      setStartVote((s) => ({ ...s, busy: true, error: "" }));
      const resp = await fetch("/api/admin?action=vip-start-voting", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.error || "Não foi possível iniciar a votação.");
      showToast("✅ Votação criada e aberta!");
      setStartVote({ open: false, data: null, busy: false, error: "" });
      await fetchVipVoting();
    } catch (e) {
      setStartVote((s) => ({ ...s, busy: false, error: e?.message || "Falha ao criar votação." }));
    }
  }

  async function closeVipVoting(poll, winner_option_id) {
    // API returns items in the shape { poll: {...}, options: [...] }.
    // Accept either a raw poll row (with id) or the wrapped object.
    const pollId = poll?.id || poll?.poll?.id;
    if (!accessToken || !pollId || !winner_option_id) return;
    try {
      setCloseVote((s) => ({ ...s, busy: true, error: "" }));
      const resp = await fetch("/api/admin?action=vip-close-voting", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ poll_id: pollId, winner_option_id }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.error || "Não foi possível encerrar a votação.");
      showToast("✅ Votação encerrada!");
      setCloseVote({ open: false, poll: null, winnerId: null, busy: false, error: "" });
      await fetchVipVoting();
    } catch (e) {
      setCloseVote((s) => ({ ...s, busy: false, error: e?.message || "Falha ao encerrar votação." }));
    }
  }

  async function deleteVipVoting(poll) {
    const pollId = poll?.id || poll?.poll?.id;
    if (!accessToken || !pollId) return;
    try {
      setDeleteVote((s) => ({ ...s, busy: true, error: "" }));
      const resp = await fetch("/api/admin?action=vip-delete-voting", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ poll_id: pollId }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.error || "Não foi possível excluir a votação.");
      showToast("🗑️ Votação excluída!");
      setVipPolls((prev) => (prev || []).filter((x) => String(x?.poll?.id || x?.id) !== String(pollId)));
      setDeleteVote({ open: false, poll: null, busy: false, error: "" });
      await fetchVipVoting();
    } catch (e) {
      setDeleteVote((s) => ({ ...s, busy: false, error: e?.message || "Falha ao excluir votação." }));
    }
  }

  React.useEffect(() => {
    setPage(1);
  }, [q, filterPay, filterProd, filterType, filterDateFrom, filterDateTo, pageSize]);

  React.useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  React.useEffect(() => {
    setSelectedOrderIds([]);
  }, [orders, page, filterPay, filterProd, filterType, filterDateFrom, filterDateTo, q]);

  React.useEffect(() => {
    if (section === "vip") {
      fetchVipVoting();
      fetchVipVotingImages();
      fetchVipControl();
    }
    if (section === "coupons") {
      fetchGameCoupon();
      fetchGameCouponMetrics();
    }
  }, [section, fetchVipVoting, fetchVipVotingImages, fetchVipControl, fetchGameCoupon, fetchGameCouponMetrics]);

  React.useEffect(() => {
    if (section !== "clients" || !accessToken) return;
    const timer = window.setTimeout(() => {
      fetchClients();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [section, accessToken, clientsQ, fetchClients]);

  React.useEffect(() => {
    if (section !== 'clients') return;
    let active = true;
    fetch('/api/vip-plans')
      .then((resp) => resp.json().catch(() => ({})).then((data) => ({ ok: resp.ok, data })))
      .then(({ ok, data }) => {
        if (!active || !ok) return;
        setClientVipPlans(Array.isArray(data?.plans) ? data.plans : []);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [section]);

  React.useEffect(() => {
    setClientEditor((current) => {
      if (!current?.id) return current;
      const next = (clients || []).find((item) => String(item?.id) === String(current.id));
      return next || current;
    });
  }, [clients]);


  function toggleVipCycleItem(itemId) {
    setVipCycleEditor((prev) => {
      const current = Array.isArray(prev?.selected_ids) ? prev.selected_ids : [];
      const exists = current.includes(itemId);
      return {
        ...prev,
        selected_ids: exists ? current.filter((id) => id !== itemId) : [...current, itemId],
      };
    });
  }

  function loadVipCycleIntoEditor(cycleKey) {
    const key = String(cycleKey || "");
    const selectedIds = (vipControl.library || [])
      .filter((item) => String(item?.cycle_key || "") === key)
      .map((item) => String(item.id));
    setVipCycleEditor({ cycle_key: key, selected_ids: selectedIds, activate: key === String(vipControl.active_cycle_key || "") });
  }

  async function saveVipCycle() {
    if (!accessToken) return;
    try {
      setVipCycleBusy(true);
      setVipControlError("");
      const payload = {
        cycle_key: String(vipCycleEditor?.cycle_key || "").trim(),
        option_ids: Array.isArray(vipCycleEditor?.selected_ids) ? vipCycleEditor.selected_ids : [],
        activate: !!vipCycleEditor?.activate,
      };
      const resp = await fetch('/api/admin?action=vip-save-cycle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.error || 'Não foi possível salvar o ciclo VIP.');
      showToast(payload.activate ? '✅ Ciclo VIP salvo e ativado!' : '✅ Ciclo VIP salvo!');
      await fetchVipControl();
    } catch (e) {
      setVipControlError(e?.message || 'Falha ao salvar ciclo VIP.');
    } finally {
      setVipCycleBusy(false);
    }
  }

  async function activateVipCycle(cycleKey) {
    if (!accessToken || !cycleKey) return;
    try {
      setVipCycleBusy(true);
      setVipControlError("");
      const resp = await fetch('/api/admin?action=vip-set-active-cycle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ cycle_key: cycleKey }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.error || 'Não foi possível ativar o ciclo VIP.');
      showToast('✅ Ciclo ativo atualizado!');
      await fetchVipControl();
    } catch (e) {
      setVipControlError(e?.message || 'Falha ao ativar ciclo VIP.');
    } finally {
      setVipCycleBusy(false);
    }
  }

  async function deleteVipCycle(cycleKey) {
    if (!accessToken || !cycleKey) return;
    const confirmed = window.confirm(`Excluir o ciclo ${cycleKey}? Os itens serão desvinculados desse ciclo.`);
    if (!confirmed) return;
    try {
      setVipCycleBusy(true);
      setVipControlError('');
      const resp = await fetch('/api/admin?action=vip-delete-cycle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ cycle_key: cycleKey }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.error || 'Não foi possível excluir o ciclo VIP.');
      setVipCycleEditor((prev) => String(prev?.cycle_key || '') === String(cycleKey) ? { cycle_key: nextMonthKey(), selected_ids: [], activate: true } : prev);
      showToast('🗑️ Ciclo VIP excluído.');
      await fetchVipControl();
    } catch (e) {
      setVipControlError(e?.message || 'Falha ao excluir ciclo VIP.');
    } finally {
      setVipCycleBusy(false);
    }
  }


  async function saveGameCoupon() {
    if (!accessToken) return;
    try {
      setGameCouponLoading(true);
      setGameCouponError("");
      const payload = {
        discount_type: gameCouponForm.discount_type,
        discount_value: Number(gameCouponForm.discount_value || 0),
        min_order_value: Number(gameCouponForm.min_order_value || 0),
        label: String(gameCouponForm.label || '').trim(),
      };

      const resp = await fetch("/api/admin?action=save-game-coupon", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}` ,
        },
        body: JSON.stringify(payload),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.error || "Não foi possível salvar o cupom do jogo.");
      setCurrentGameCoupon(data?.config || null);
      showToast("🎟️ Cupom do Cubo Game atualizado!");
    } catch (e) {
      const msg = e?.message || "Falha ao salvar o cupom do jogo.";
      setGameCouponError(msg);
      showToast(`⚠️ ${msg}`);
    } finally {
      setGameCouponLoading(false);
    }
  }

  async function updateOrder(orderId, patch) {
    try {
      const current = (orders || []).find((o) => o.id === orderId);
      const currentPay = String(current?.status || "").toLowerCase();
      const changingFlow =
        Object.prototype.hasOwnProperty.call(patch || {}, "production_status") ||
        Object.prototype.hasOwnProperty.call(patch || {}, "shipping_tracking") ||
        Object.prototype.hasOwnProperty.call(patch || {}, "refund_requested");

      if (changingFlow && currentPay !== "paid") {
        showToast("⚠️ Só pedidos pagos podem ter status/rastreio alterados.");
        return;
      }

      const resp = await fetch("/api/admin?action=update-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ order_id: orderId, ...patch }),
      });

      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.error || "Não foi possível atualizar.");
      if (data?.email?.ok) showToast("✅ Atualizado e e-mail enviado ao cliente!");
      else if (data?.email && !data.email.skipped) showToast("⚠️ Pedido atualizado, mas o e-mail não foi enviado.");
      else showToast("✅ Atualizado!");
      if (data?.order) {
        setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, ...patch, ...data.order } : o)));
      } else {
        setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, ...patch } : o)));
      }
    } catch (e) {
      showToast(`⚠️ ${e?.message || "Falha"}`);
    }
  }

  async function resendOrderEmail(orderId) {
    if (!orderId || !accessToken) return;
    try {
      setResendEmailBusyId(orderId);
      const resp = await fetch("/api/admin?action=resend-order-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ order_id: orderId }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.error || "Não foi possível reenviar o e-mail.");
      showToast("📨 E-mail reenviado ao cliente!");
      if (data?.order) {
        setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, ...data.order } : o)));
      } else {
        fetchOrders();
      }
    } catch (e) {
      showToast(`⚠️ ${e?.message || "Falha ao reenviar e-mail."}`);
    } finally {
      setResendEmailBusyId(null);
    }
  }

  async function deleteOrder(orderId) {
    if (!orderId) return;
    try {
      const resp = await fetch("/api/admin?action=delete-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ order_id: orderId }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.error || "Não foi possível excluir.");
      showToast("🗑️ Pedido excluído!");
      setOrders((prev) => (prev || []).filter((o) => String(o.id) !== String(orderId)));
      // also refetch to avoid stale UI
      fetchOrders();
      // close details if it was open for this order
      setDetails((d) => (d?.orderId === orderId ? { open: false, orderId: null } : d));
    } catch (e) {
      showToast(`⚠️ ${e?.message || "Falha ao excluir"}`);
    }
  }


  async function addOrderNote(order, note) {
    if (!order?.id || !accessToken) return;
    try {
      const resp = await fetch('/api/admin?action=add-order-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ order_id: order.id, note }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.error || 'Não foi possível salvar a nota.');
      showToast('📝 Nota interna salva.');
      fetchOrders();
    } catch (e) {
      showToast(`⚠️ ${e?.message || 'Falha ao salvar nota.'}`);
    }
  }

  async function saveClientEdits() {
    if (!clientEditor?.id || !accessToken) return;
    try {
      const resp = await fetch('/api/admin?action=update-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ client_id: clientEditor.id, ...clientEditor }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.error || 'Não foi possível salvar o cliente.');
      showToast('✅ Cliente atualizado.');
      fetchClients();
    } catch (e) {
      showToast(`⚠️ ${e?.message || 'Falha ao salvar cliente.'}`);
    }
  }

  async function updateClientVipStatus({ active, extend = false } = {}) {
    if (!clientEditor?.id || !accessToken || clientVipBusy) return;
    const selectedPlanId = String(clientEditor.vip_plan || clientVipPlans[0]?.id || '').trim();
    if (active && !selectedPlanId) {
      showToast('⚠️ Selecione um plano VIP.');
      return;
    }
    setClientVipBusy(true);
    try {
      const resp = await fetch('/api/admin?action=client-vip-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          client_id: clientEditor.id,
          active: Boolean(active),
          extend: Boolean(extend),
          duration_days: 30,
          vip_plan_id: selectedPlanId,
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.error || 'Não foi possível alterar o acesso VIP.');
      setClientEditor((current) => current ? {
        ...current,
        vip_active: Boolean(data?.vip_active),
        vip_until: data?.vip_until || null,
        vip_plan: data?.vip_plan || null,
        vip_cycle_key: data?.vip_cycle_key || null,
      } : current);
      showToast(active ? (extend ? '✅ VIP renovado por mais 30 dias.' : '✅ VIP ativado por 30 dias.') : '✅ VIP desativado.');
      await fetchClients();
    } catch (e) {
      showToast(`⚠️ ${e?.message || 'Falha ao alterar o VIP.'}`);
    } finally {
      setClientVipBusy(false);
    }
  }

  async function deleteClient(client) {
    if (!client?.id || !accessToken) return;
    const resp = await fetch('/api/admin?action=delete-client', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ client_id: client.id }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data?.error || 'Não foi possível excluir o cliente.');
    showToast('🗑️ Cliente excluído.');
    setClientEditor(null);
    fetchClients();
  }

  function toggleOrderSelection(orderId) {
    setSelectedOrderIds((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
    );
  }

  function toggleSelectAllCurrentPage() {
    setSelectedOrderIds((prev) => {
      if (allPageSelected) return prev.filter((id) => !filteredOrders.some((o) => o.id === id));
      const next = new Set(prev);
      filteredOrders.forEach((o) => next.add(o.id));
      return Array.from(next);
    });
  }

  async function bulkUpdateOrders(patch) {
    if (!selectedOrderIds.length || !accessToken) return;
    try {
      setBulkBusy(true);
      const results = await Promise.allSettled(
        selectedOrderIds.map((orderId) =>
          fetch("/api/admin?action=update-order", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ order_id: orderId, ...patch }),
          }).then(async (resp) => {
            const data = await resp.json().catch(() => ({}));
            if (!resp.ok) throw new Error(data?.error || "Falha ao atualizar pedido");
            return data;
          })
        )
      );
      const successCount = results.filter((r) => r.status === "fulfilled").length;
      const failCount = results.length - successCount;
      showToast(failCount ? `⚠️ ${successCount} atualizados, ${failCount} com falha.` : `✅ ${successCount} pedido(s) atualizados.`);
      setBulkModal({ open: false, mode: "status" });
      setSelectedOrderIds([]);
      fetchOrders();
    } catch (e) {
      showToast(`⚠️ ${e?.message || "Falha na ação em lote."}`);
    } finally {
      setBulkBusy(false);
    }
  }

  async function bulkResendEmails() {
    if (!selectedPaidOrders.length || !accessToken) return;
    try {
      setBulkBusy(true);
      const results = await Promise.allSettled(
        selectedPaidOrders.map((order) =>
          fetch("/api/admin?action=resend-order-email", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ order_id: order.id }),
          }).then(async (resp) => {
            const data = await resp.json().catch(() => ({}));
            if (!resp.ok) throw new Error(data?.error || "Falha ao reenviar e-mail");
            return data;
          })
        )
      );
      const successCount = results.filter((r) => r.status === "fulfilled").length;
      const failCount = results.length - successCount;
      showToast(failCount ? `⚠️ ${successCount} e-mail(s) reenviados, ${failCount} falharam.` : `📨 ${successCount} e-mail(s) reenviados.`);
      setSelectedOrderIds([]);
      fetchOrders();
    } catch (e) {
      showToast(`⚠️ ${e?.message || "Falha ao reenviar em lote."}`);
    } finally {
      setBulkBusy(false);
    }
  }

  async function bulkDeleteOrders() {
    if (!selectedOrderIds.length || !accessToken) return;
    try {
      setBulkBusy(true);
      const resp = await fetch("/api/admin?action=bulk-delete-orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ order_ids: selectedOrderIds }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.error || "Falha ao excluir pedidos.");

      const deletedIds = Array.isArray(data?.deleted_order_ids) ? data.deleted_order_ids.map(String) : [];
      const deletedCount = Number(data?.deleted_count || deletedIds.length || 0);
      const failedCount = Number(data?.failed_count || 0);

      if (deletedIds.length) {
        setOrders((prev) => (prev || []).filter((o) => !deletedIds.includes(String(o.id))));
      }
      setSelectedOrderIds([]);
      setBulkModal({ open: false, mode: "status" });
      setDetails((d) => (d?.open && deletedIds.includes(String(d.orderId)) ? { open: false, orderId: null } : d));
      showToast(failedCount ? `⚠️ ${deletedCount} pedido(s) excluídos, ${failedCount} falharam.` : `🗑️ ${deletedCount} pedido(s) excluídos.`);
      fetchOrders();
    } catch (e) {
      showToast(`⚠️ ${e?.message || "Falha ao excluir em lote."}`);
    } finally {
      setBulkBusy(false);
    }
  }

  const orderMatchesInlineSearch = React.useCallback((order, rawQuery) => {
    const needle = String(rawQuery || '').trim().toLowerCase();
    if (!needle) return true;
    const short = String(shortId(order?.id || '')).replace(/…/g, '').toLowerCase();
    const fields = [
      order?.id,
      short,
      order?.customer_name,
      order?.profile?.full_name,
      order?.customer_email,
      order?.customer_phone,
      order?.shipping_tracking,
      order?.provider_payment_id,
    ]
      .map((value) => String(value || '').toLowerCase())
      .filter(Boolean);
    return fields.some((value) => value.includes(needle));
  }, []);

  const filteredOrders = React.useMemo(() => (Array.isArray(orders) ? orders : []).filter((order) => orderMatchesInlineSearch(order, qInput)), [orders, qInput, orderMatchesInlineSearch]);

  const stats = React.useMemo(() => {
    const base = summary || {};
    return {
      total: Number(base.total || 0),
      paid: Number(base.paid || 0),
      pending: Number(base.pending || 0),
      revenue: Number(base.revenue || 0),
      refundReq: Number(base.refundReq || 0),
      vipCount: Number(base.vipCount || 0),
      overdueCount: Number(base.overdueCount || 0),
      paidToday: Number(base?.finance?.paidToday || 0),
      paidMonth: Number(base?.finance?.paidMonth || 0),
      upgradeRevenue: Number(base?.finance?.upgradeRevenue || 0),
      averageTicket: Number(base?.finance?.averageTicket || 0),
    };
  }, [summary]);

  const bottlenecks = React.useMemo(() => {
    const source = summary?.bottlenecks || {};
    return {
      paidWaitingProduction: Number(source.paidWaitingProduction || 0),
      readyWithoutTracking: Number(source.readyWithoutTracking || 0),
      shippedInTransit: Number(source.shippedInTransit || 0),
      refundRequested: Number(source.refundRequested || 0),
      staleOrders: Number(source.staleOrders || 0),
      overdueCount: Number(source.overdueCount || 0),
      awaitingShipment: Number(source.awaitingShipment || 0),
    };
  }, [summary]);

  const quickQueue = React.useMemo(() => {
    return [...(filteredOrders || [])]
      .filter((o) => {
        const prod = String(o.production_status || 'recebido').toLowerCase();
        const paid = String(o.status || '').toLowerCase() === 'paid';
        return (paid && ['recebido', 'editavel', 'pronto', 'enviado'].includes(prod)) || !!o.refund_requested;
      })
      .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime())
      .slice(0, 8);
  }, [filteredOrders]);

  const financeHighlights = React.useMemo(() => {
    const paidOrders = (filteredOrders || []).filter((o) => String(o.status || '').toLowerCase() === 'paid');
    const shippingRevenue = paidOrders
      .flatMap((o) => Array.isArray(o.order_items) ? o.order_items : [])
      .filter((it) => /pagamento de frete/i.test(String(it?.name || '')))
      .reduce((sum, it) => sum + Number(it?.unit_price || it?.unit_price_brl || 0) * Number(it?.qty || 1), 0);
    const pendingRevenue = (filteredOrders || [])
      .filter((o) => String(o.status || '').toLowerCase() === 'pending')
      .reduce((sum, o) => sum + Number((o.effective_total ?? o.total) || 0), 0);
    const deliveredCount = paidOrders.filter((o) => String(o.production_status || '').toLowerCase() === 'entregue').length;
    return {
      shippingRevenue,
      pendingRevenue,
      deliveredCount,
      paidCount: paidOrders.length,
    };
  }, [filteredOrders]);

  const orderQuickPresets = React.useMemo(() => ([
    { key: 'paid_waiting', label: 'Pagos sem produção', apply: () => { setFilterPay('paid'); setFilterProd('recebido'); setFilterType('all'); setPage(1); } },
    { key: 'ready_track', label: 'Prontos sem rastreio', apply: () => { setFilterPay('paid'); setFilterProd('pronto'); setFilterType('all'); setPage(1); } },
    { key: 'overdue', label: 'Atrasados', apply: () => { setFilterPay('paid'); setFilterProd('overdue'); setQ(''); setPage(1); } },
    { key: 'vip', label: 'Somente VIP', apply: () => { setFilterType('vip'); setFilterPay('all'); setFilterProd('all'); setPage(1); } },
  ]), []);

  const openDeleteClientConfirm = React.useCallback((client) => {
    if (!client?.id) return;
    setConfirmAction({
      open: true,
      type: 'client',
      payload: client,
      busy: false,
      error: '',
      keywordValue: '',
    });
  }, []);

  const openDeleteVipCycleConfirm = React.useCallback((cycleKey) => {
    if (!cycleKey) return;
    setConfirmAction({
      open: true,
      type: 'vip_cycle',
      payload: { cycle_key: cycleKey },
      busy: false,
      error: '',
      keywordValue: '',
    });
  }, []);

  const handleConfirmAction = React.useCallback(async () => {
    if (!confirmAction?.open || confirmAction?.busy) return;
    try {
      setConfirmAction((prev) => ({ ...prev, busy: true, error: '' }));
      if (confirmAction.type === 'client') {
        await deleteClient(confirmAction.payload);
      } else if (confirmAction.type === 'vip_cycle') {
        await deleteVipCycle(confirmAction.payload?.cycle_key);
      }
      setConfirmAction({ open: false, type: '', payload: null, busy: false, error: '', keywordValue: '' });
    } catch (e) {
      setConfirmAction((prev) => ({ ...prev, busy: false, error: e?.message || 'Não foi possível concluir a ação.' }));
    }
  }, [confirmAction, deleteClient, deleteVipCycle]);

  const runAdminQuickSearch = React.useCallback(() => {
    const next = String(adminQuickSearch || '').trim();
    setQInput(next);
    setQ(next);
    setClientsQ(next);
    setPage(1);
    if (next) {
      setSection(/@|cpf|pedido|rastreio|track|#|\d{4}/i.test(next) ? 'orders' : 'clients');
    }
  }, [adminQuickSearch]);

  const applyOrderSearch = React.useCallback(() => {
    setPage(1);
    setQ(String(qInput || '').trim());
  }, [qInput]);

  const clearOrderSearchAndFilters = React.useCallback(() => {
    setQ("");
    setQInput("");
    setFilterPay("all");
    setFilterProd("all");
    setFilterType("all");
    setFilterDateFrom(toDateInputValue(new Date(Date.now() - 29 * 86400000)));
    setFilterDateTo(toDateInputValue(new Date()));
    setPage(1);
  }, []);

  const allPageSelected = React.useMemo(() => !!filteredOrders.length && filteredOrders.every((o) => selectedOrderIds.includes(o.id)), [filteredOrders, selectedOrderIds]);
  const selectedOrders = React.useMemo(() => filteredOrders.filter((o) => selectedOrderIds.includes(o.id)), [filteredOrders, selectedOrderIds]);
  const selectedPaidOrders = React.useMemo(() => selectedOrders.filter((o) => String(o.status || '').toLowerCase() === 'paid'), [selectedOrders]);

  const vipSelectedItems = React.useMemo(() => {
    const selectedSet = new Set((vipCycleEditor?.selected_ids || []).map((id) => String(id)));
    return (vipControl?.library || []).filter((item) => selectedSet.has(String(item?.id)));
  }, [vipControl, vipCycleEditor]);

  const vipSelectedSummary = React.useMemo(() => {
    return vipSelectedItems.reduce((acc, item) => {
      if (String(item?.item_type || '').toLowerCase() === 'boss') acc.boss += 1;
      else acc.mini += 1;
      return acc;
    }, { mini: 0, boss: 0 });
  }, [vipSelectedItems]);

  const vipVisibleLibrary = React.useMemo(() => {
    const query = String(vipLibrarySearch || '').trim().toLocaleLowerCase('pt-BR');
    const selectedSet = new Set((vipCycleEditor?.selected_ids || []).map((id) => String(id)));
    return (vipControl?.library || []).filter((item) => {
      const type = String(item?.item_type || '').toLowerCase() === 'boss' ? 'boss' : 'mini';
      const selected = selectedSet.has(String(item?.id));
      if (vipLibraryFilter === 'selected' && !selected) return false;
      if (vipLibraryFilter === 'mini' && type !== 'mini') return false;
      if (vipLibraryFilter === 'boss' && type !== 'boss') return false;
      if (!query) return true;
      const haystack = [item?.title, item?.description, item?.cycle_key, type]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('pt-BR');
      return haystack.includes(query);
    });
  }, [vipControl, vipCycleEditor, vipLibraryFilter, vipLibrarySearch]);

  const vipActiveCycle = React.useMemo(() => {
    return (vipControl?.cycles || []).find((cycle) => cycle.is_active) || null;
  }, [vipControl]);

  const vipCycleAudience = React.useMemo(() => Array.isArray(vipControl?.vip_summary?.byCycle) ? vipControl.vip_summary.byCycle : [], [vipControl]);

  const activeOrder = React.useMemo(() => (orders || []).find((o) => o.id === details.orderId) || null, [orders, details.orderId]);
  const activeActionOrder = React.useMemo(() => (orders || []).find((o) => o.id === actionModal.orderId) || null, [orders, actionModal.orderId]);

  if (authLoading || isAdminLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-6">
          <div className="text-white text-xl font-semibold">Validando acesso…</div>
          <div className="mt-1 text-slate-400">Aguarde enquanto confirmamos suas permissões de administrador.</div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-6">
          <div className="text-white text-xl font-semibold">Acesso restrito</div>
          <div className="mt-1 text-slate-400">
            Este painel é apenas para administradores. Faça login com um email autorizado.
          </div>
          <div className="mt-5 flex items-center gap-2">
            <button
              onClick={() => onNavigateHome?.()}
              className="rounded-xl px-4 py-2 text-sm text-slate-200 hover:bg-white/4 ring-1 ring-white/10"
            >
              Voltar para o site
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1600px] px-3 py-4 sm:px-5 sm:py-6 lg:px-8">
      {/* Topbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="text-2xl font-semibold text-white">Admin</div>
          <div className="text-sm text-slate-400">Pedidos, produtos, produção, rastreio e VIP — tudo em um painel.</div>
        </div>
        <div className="grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto sm:items-center">
          <button
            onClick={() => fetchOrders()}
            disabled={loading}
            className="rounded-xl px-2.5 py-2 text-center text-xs text-slate-200 ring-1 ring-white/10 hover:bg-white/4 disabled:cursor-wait disabled:opacity-60 sm:px-3 sm:text-sm"
          >
            <span className="material-icons text-[18px] align-middle mr-1">refresh</span>
            {loading ? 'Atualizando…' : 'Atualizar'}
          </button>
          <button
            onClick={() => setNewOrderOpen(true)}
            className="rounded-xl px-2.5 py-2 text-center text-xs text-slate-200 ring-1 ring-white/10 hover:bg-white/4 sm:px-3 sm:text-sm"
          >
            <span className="material-icons text-[18px] align-middle mr-1">add_box</span>
            Novo pedido
          </button>
          <button
            onClick={() => onNavigateHome?.()}
            className="rounded-xl px-2.5 py-2 text-center text-xs text-slate-200 ring-1 ring-white/10 hover:bg-white/4 sm:px-3 sm:text-sm"
          >
            <span className="material-icons text-[18px] align-middle mr-1">home</span>
            Site
          </button>
        </div>
      </div>

      {/* Mobile tabs */}
      <div className="sticky top-[68px] z-[80] mt-4 flex gap-2 overflow-x-auto rounded-2xl bg-[#07161d]/95 p-2 shadow-[0_12px_35px_rgba(0,0,0,0.35)] ring-1 ring-white/10 backdrop-blur lg:hidden">
        {[
          ["dashboard", "space_dashboard", "Dashboard"],
          ["orders", "inventory_2", "Pedidos"],
          ["production", "view_kanban", "Produção"],
          ["finance", "payments", "Financeiro"],
          ["clients", "groups", "Clientes"],
          ["products", "inventory", "Produtos"],
          ["reviews", "reviews", "Avaliações"],
          ["coupons", "sell", "Cupons"],
          ["vip", "workspace_premium", "VIP"],
        ].map(([key, icon, label]) => (
          <button
            key={key}
            onClick={() => setSection(key)}
            className={[
              "shrink-0 rounded-full px-3 py-1.5 text-sm ring-1 transition",
              section === key ? "bg-white/[0.08] text-white ring-white/15" : "bg-white/[0.03] text-slate-200 ring-white/10",
            ].join(" ")}
          >
            <span className="material-icons text-[16px] align-middle mr-1">{icon}</span>
            {label}
          </button>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)]">
        {/* Sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto rounded-2xl bg-white/[0.03] p-3 ring-1 ring-white/10">
            <SidebarItem active={section === "dashboard"} icon="space_dashboard" onClick={() => setSection("dashboard")}>
              Dashboard
            </SidebarItem>
            <div className="mt-2">
              <SidebarItem
                active={section === "orders"}
                icon="inventory_2"
                badge={String(stats.total)}
                onClick={() => setSection("orders")}
              >
                Pedidos
              </SidebarItem>
            </div>
            <div className="mt-2">
              <SidebarItem active={section === "production"} icon="view_kanban" onClick={() => setSection("production")}>
                Produção
              </SidebarItem>
            </div>
            <div className="mt-2">
              <SidebarItem active={section === "finance"} icon="payments" onClick={() => setSection("finance")}>
                Centro financeiro
              </SidebarItem>
            </div>
            <div className="mt-2">
              <SidebarItem active={section === "clients"} icon="groups" onClick={() => setSection("clients")}>
                Clientes
              </SidebarItem>
            </div>
            <div className="mt-2">
              <SidebarItem active={section === "products"} icon="inventory" onClick={() => setSection("products")}>
                Produtos
              </SidebarItem>
            </div>
            <div className="mt-2">
              <SidebarItem active={section === "reviews"} icon="reviews" onClick={() => setSection("reviews")}>
                Avaliações
              </SidebarItem>
            </div>
            <div className="mt-2">
              <SidebarItem active={section === "coupons"} icon="sell" onClick={() => setSection("coupons")}>
                Cupons — Cubo Game
              </SidebarItem>
            </div>
            <div className="mt-2">
              <SidebarItem active={section === "vip"} icon="workspace_premium" onClick={() => setSection("vip")}>
                VIP Controle
              </SidebarItem>
            </div>

            <div className="mt-3 rounded-2xl bg-black/20 p-3 ring-1 ring-white/10">
              <div className="text-xs text-slate-500">Conta admin</div>
              <div className="mt-1 break-words text-sm text-slate-200">{user?.email}</div>
            </div>
          </div>
        </aside>

        {/* Content */}
        <main className="min-w-0">
          {toast ? (
            <div className="mb-3 rounded-2xl bg-white/[0.04] ring-1 ring-white/10 px-3 py-2 text-sm text-slate-200">
              {toast}
            </div>
          ) : null}

          {section === "dashboard" ? (
            <div className="space-y-4">
              <SectionTitle
                icon="space_dashboard"
                title="Dashboard"
                subtitle="Visão rápida da operação, gargalos e receita."
                right={
                  <button
                    onClick={() => exportCsv(filteredOrders)}
                    className="rounded-xl px-3 py-2 text-sm text-slate-200 hover:bg-white/4 ring-1 ring-white/10"
                  >
                    <span className="material-icons text-[18px] align-middle mr-1">download</span>
                    Exportar CSV
                  </button>
                }
              />

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <KpiCard label="Pedidos" value={stats.total} hint="Total carregado" />
                <KpiCard label="Pagos" value={stats.paid} hint="Prontos para produção/envio" />
                <KpiCard label="Pendentes" value={stats.pending} hint="Aguardando pagamento" />
                <KpiCard label="Faturamento (pagos)" value={fmtBRL(stats.revenue)} hint="Soma dos pedidos pagos" />
                <KpiCard label="VIP" value={stats.vipCount} hint="Pedidos do tipo VIP" />
                <KpiCard label="Reembolso solicitado" value={stats.refundReq} hint="Monitorar e tratar" />
                <KpiCard label="Atrasados" value={stats.overdueCount} hint="Pedidos fora do prazo operacional" />
                <KpiCard label="Receita hoje" value={fmtBRL(stats.paidToday)} hint="Pagamentos confirmados no dia" />
                <KpiCard label="Receita do mês" value={fmtBRL(stats.paidMonth)} hint="Pagamentos confirmados no mês" />
                <KpiCard label="Ticket médio" value={fmtBRL(stats.averageTicket)} hint="Média dos pedidos pagos" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-4"><div className="text-xs text-slate-500">Pagos sem produção</div><div className="mt-1 text-2xl font-bold text-white">{bottlenecks.paidWaitingProduction}</div></div>
                <div className="rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-4"><div className="text-xs text-slate-500">Prontos sem rastreio</div><div className="mt-1 text-2xl font-bold text-white">{bottlenecks.readyWithoutTracking}</div></div>
                <div className="rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-4"><div className="text-xs text-slate-500">Parados há 5+ dias</div><div className="mt-1 text-2xl font-bold text-white">{bottlenecks.staleOrders}</div></div>
                <div className="rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-4"><div className="text-xs text-slate-500">Aguardando envio</div><div className="mt-1 text-2xl font-bold text-white">{bottlenecks.awaitingShipment}</div></div>
              </div>

              <div className="rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-4">
                <div className="text-sm font-semibold text-white">Fila rápida</div>
                <div className="mt-1 text-sm text-slate-400">Pedidos pagos que ainda não foram enviados.</div>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-slate-400">
                      <tr className="border-b border-white/10">
                        <th className="py-2 pr-3">Pedido</th>
                        <th className="py-2 pr-3">Cliente</th>
                        <th className="py-2 pr-3">Total</th>
                        <th className="py-2 pr-3">Produção</th>
                        <th className="py-2 pr-3">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="text-slate-200">
                      {(orders || [])
                        .filter((o) => String(o.status || "").toLowerCase() === "paid")
                        .filter((o) => !["enviado", "entregue"].includes(String(o.production_status || "").toLowerCase()))
                        .slice(0, 8)
                        .map((o) => (
                          <tr key={o.id} className="border-b border-white/5">
                            <td className="py-2 pr-3 whitespace-nowrap">
                              <button
                                onClick={() => setDetails({ open: true, orderId: o.id })}
                                className="text-slate-100 hover:underline"
                              >
                                {shortId(o.id)}
                              </button>
                              <div className="text-[11px] text-slate-500">{fmtDate(o.created_at)}</div>
                              {o.timeline?.[0]?.title ? <div className="text-[11px] text-slate-500">{o.timeline[0].title}</div> : null}
                            </td>
                            <td className="py-2 pr-3 min-w-[220px]">
                              <div className="text-slate-100">{o.customer_name || o.profile?.full_name || "—"}</div>
                              <div className="text-[11px] text-slate-500">{o.customer_email || ""}</div>
                              {Number(o.related_upgrades_count || 0) > 0 ? <div className="text-[11px] text-violet-200/80">Upgrade VIP vinculado</div> : null}
                            </td>
                            <td className="py-2 pr-3 whitespace-nowrap">{fmtBRL(o.effective_total ?? o.total)}</td>
                            <td className="py-2 pr-3 whitespace-nowrap">
                              {(() => {
                                const b = prodStatusBadge(o.production_status);
                                return <span className={`${badgeBase} ${b.cls}`}>{b.label}</span>;
                              })()}
                            </td>
                            <td className="py-2 pr-3 whitespace-nowrap">
                              <button
                                onClick={() => setActionModal({ open: true, mode: "status", orderId: o.id })}
                                className="rounded-xl px-2 py-1 text-xs text-slate-200 hover:bg-white/4 ring-1 ring-white/10"
                              >
                                Status
                              </button>
                              <button
                                onClick={() => setActionModal({ open: true, mode: "tracking", orderId: o.id })}
                                className="ml-2 rounded-xl px-2 py-1 text-xs text-slate-200 hover:bg-white/4 ring-1 ring-white/10"
                              >
                                Rastreio
                              </button>
                            </td>
                          </tr>
                        ))}
                      {!orders?.length ? (
                        <tr>
                          <td colSpan={5} className="py-4 text-slate-400">
                            Nenhum pedido.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}

          {section === "orders" ? (
            <div className="space-y-4">
              <SectionTitle
                icon="inventory_2"
                title="Pedidos"
                subtitle="Busque, filtre e atualize status/rastreio. (Pedidos pagos liberam ações.)"
                right={
                  <button
                    onClick={() => exportCsv(filteredOrders)}
                    className="rounded-xl px-3 py-2 text-sm text-slate-200 hover:bg-white/4 ring-1 ring-white/10"
                  >
                    <span className="material-icons text-[18px] align-middle mr-1">download</span>
                    Exportar CSV
                  </button>
                }
              />

              <div className="rounded-[28px] bg-gradient-to-br from-white/[0.06] to-white/[0.025] ring-1 ring-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.25)] backdrop-blur-sm p-4 md:p-5">
                <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-white">Busca e filtros</div>
                    <div className="text-xs text-slate-400">Busque por nome do cliente ou número do pedido e refine pelos filtros abaixo.</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={applyOrderSearch}
                      className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-300 to-teal-300 px-4 py-3 text-sm font-bold text-slate-950 shadow-[0_12px_30px_rgba(103,232,249,0.18)] transition hover:-translate-y-0.5"
                    >
                      <span className="material-icons text-[18px]">search</span>
                      Buscar
                    </button>
                    <button
                      onClick={clearOrderSearchAndFilters}
                      className="inline-flex items-center gap-2 rounded-2xl bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-100 ring-1 ring-white/10 transition hover:bg-white/[0.07]"
                    >
                      <span className="material-icons text-[18px]">restart_alt</span>
                      Limpar
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                  <label className="block md:col-span-2">
                    <div className="text-xs text-slate-500 mb-1">Busca</div>
                    <input
                      value={qInput}
                      onChange={(e) => setQInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") applyOrderSearch(); }}
                      placeholder="Nome do cliente ou número do pedido"
                      className="w-full rounded-2xl bg-black/20 ring-1 ring-white/10 px-4 py-3 text-slate-100 placeholder:text-slate-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
                    />
                  </label>

                  <label className="block">
                    <div className="text-xs text-slate-500 mb-1">Pagamento</div>
                    <select
                      value={filterPay}
                      onChange={(e) => setFilterPay(e.target.value)}
                      className="w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-slate-100"
                    >
                      <option value="all">Todos</option>
                      <option value="paid">Pago</option>
                      <option value="pending">Pendente</option>
                      <option value="failed">Falhou</option>
                    </select>
                  </label>

                  <label className="block">
                    <div className="text-xs text-slate-500 mb-1">Produção</div>
                    <select
                      value={filterProd}
                      onChange={(e) => setFilterProd(e.target.value)}
                      className="w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-slate-100"
                    >
                      <option value="all">Todos</option>
                      <option value="editavel">Editável</option>
                      <option value="recebido">Recebido</option>
                      <option value="em_producao">Em produção</option>
                      <option value="pronto">Pronto</option>
                      <option value="overdue">Atrasados</option>
                      <option value="enviado">Enviado</option>
                      <option value="entregue">Entregue</option>
                      <option value="cancelado">Cancelado</option>
                      <option value="reembolsado">Reembolsado</option>
                    </select>
                  </label>

                  <label className="block">
                    <div className="text-xs text-slate-500 mb-1">Tipo</div>
                    <select
                      value={filterType}
                      onChange={(e) => setFilterType(e.target.value)}
                      className="w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-slate-100"
                    >
                      <option value="all">Todos</option>
                      <option value="store">Loja</option>
                      <option value="vip">VIP</option>
                    </select>
                  </label>

                  <label className="block">
                    <div className="text-xs text-slate-500 mb-1">De</div>
                    <input
                      type="date"
                      value={filterDateFrom}
                      onChange={(e) => setFilterDateFrom(e.target.value)}
                      className="w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-slate-100"
                    />
                  </label>

                  <label className="block">
                    <div className="text-xs text-slate-500 mb-1">Até</div>
                    <input
                      type="date"
                      value={filterDateTo}
                      onChange={(e) => setFilterDateTo(e.target.value)}
                      className="w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-slate-100"
                    />
                  </label>

                  <div className="md:col-span-5 flex flex-wrap items-end gap-2">
                    <div className="text-xs text-slate-500">
                      Página <span className="text-slate-200">{pagination.page}</span> de{" "}
                      <span className="text-slate-200">{pagination.totalPages}</span> • exibindo{" "}
                      <span className="text-slate-200">{filteredOrders.length}</span> de{" "}
                      <span className="text-slate-200">{pagination.totalCount}</span>
                    </div>
                    <span className="rounded-full bg-white/[0.04] px-2 py-1 text-[11px] text-slate-300 ring-1 ring-white/10">
                      Pagos: {stats.paid}
                    </span>
                    <span className="rounded-full bg-white/[0.04] px-2 py-1 text-[11px] text-slate-300 ring-1 ring-white/10">
                      Aguardando produção: {bottlenecks.paidWaitingProduction}
                    </span>
                    <span className="rounded-full bg-white/[0.04] px-2 py-1 text-[11px] text-slate-300 ring-1 ring-white/10">
                      Prontos sem rastreio: {bottlenecks.readyWithoutTracking}
                    </span>
                  </div>

                  <div className="flex items-end justify-end" />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {orderQuickPresets.map((preset) => (
                  <button
                    key={preset.key}
                    onClick={preset.apply}
                    className="rounded-full bg-white/[0.04] px-3 py-2 text-xs text-slate-200 ring-1 ring-white/10 hover:bg-white/[0.07]"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                {selectedOrderIds.length ? (
                  <div className="rounded-2xl bg-cyan-500/10 ring-1 ring-cyan-400/20 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="text-sm font-extrabold text-amber-100">{selectedOrderIds.length} pedido(s) selecionado(s)</div>
                        <div className="mt-1 text-xs text-slate-300">Use ações em lote para acelerar produção, reembolso e comunicação.</div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => setBulkModal({ open: true, mode: "status" })}
                          disabled={!selectedPaidOrders.length || bulkBusy}
                          className="rounded-xl px-3 py-2 text-sm text-slate-100 hover:bg-white/4 ring-1 ring-white/10 disabled:opacity-50"
                        >
                          Status em lote
                        </button>
                        <button
                          onClick={() => setBulkModal({ open: true, mode: "refund_on" })}
                          disabled={!selectedOrderIds.length || bulkBusy}
                          className="rounded-xl px-3 py-2 text-sm text-slate-100 hover:bg-white/4 ring-1 ring-white/10 disabled:opacity-50"
                        >
                          Marcar reembolso
                        </button>
                        <button
                          onClick={() => setBulkModal({ open: true, mode: "refund_off" })}
                          disabled={!selectedOrderIds.length || bulkBusy}
                          className="rounded-xl px-3 py-2 text-sm text-slate-100 hover:bg-white/4 ring-1 ring-white/10 disabled:opacity-50"
                        >
                          Limpar reembolso
                        </button>
                        <button
                          onClick={bulkResendEmails}
                          disabled={!selectedPaidOrders.length || bulkBusy}
                          className="rounded-xl px-3 py-2 text-sm text-slate-100 hover:bg-white/4 ring-1 ring-white/10 disabled:opacity-50"
                        >
                          Reenviar e-mails
                        </button>
                        <button
                          onClick={() => setBulkModal({ open: true, mode: "delete" })}
                          disabled={!selectedOrderIds.length || bulkBusy}
                          className="rounded-xl px-3 py-2 text-sm text-red-100 hover:bg-red-500/10 ring-1 ring-red-500/30 disabled:opacity-50"
                        >
                          Excluir pedidos
                        </button>
                        <button
                          onClick={() => setSelectedOrderIds([])}
                          className="rounded-xl px-3 py-2 text-sm text-slate-100 hover:bg-white/4 ring-1 ring-white/10"
                        >
                          Limpar seleção
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="rounded-2xl bg-white/[0.03] ring-1 ring-white/10 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-left text-slate-400 bg-black/10">
                        <tr className="border-b border-white/10">
                          <th className="py-3 px-3 w-10">
                            <input
                              type="checkbox"
                              checked={allPageSelected}
                              onChange={toggleSelectAllCurrentPage}
                              className="h-4 w-4 rounded border-white/20 bg-black/30 accent-cyan-300"
                              aria-label="Selecionar página atual"
                            />
                          </th>
                          <th className="py-3 px-3">Pedido</th>
                          <th className="py-3 px-3">Cliente</th>
                          <th className="py-3 px-3">Total</th>
                          <th className="py-3 px-3">Pagamento</th>
                          <th className="py-3 px-3">Produção</th>
                          <th className="py-3 px-3">Rastreio</th>
                          <th className="py-3 px-3 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="text-slate-200">
                        {filteredOrders.map((o) => {
                          const pay = statusBadge(o.status);
                          const prod = prodStatusBadge(o.production_status);
                          const selectedRow = selectedOrderIds.includes(o.id);
                          return (
                            <tr key={o.id} className={`border-b border-white/5 hover:bg-white/[0.02] ${selectedRow ? 'bg-cyan-500/5' : ''}`}>
                              <td className="py-3 px-3 align-top">
                                <input
                                  type="checkbox"
                                  checked={selectedRow}
                                  onChange={() => toggleOrderSelection(o.id)}
                                  className="mt-1 h-4 w-4 rounded border-white/20 bg-black/30 accent-cyan-300"
                                  aria-label={`Selecionar pedido ${shortId(o.id)}`}
                                />
                              </td>
                              <td className="py-3 px-3 whitespace-nowrap">
                                <button
                                  onClick={() => setDetails({ open: true, orderId: o.id })}
                                  className="text-slate-100 hover:underline"
                                >
                                  {shortId(o.id)}
                                </button>
                                <div className="text-[11px] text-slate-500">{fmtDate(o.created_at)}</div>
                              </td>
                              <td className="py-3 px-3 min-w-[240px]">
                                <div className="text-slate-100">{o.customer_name || o.profile?.full_name || "—"}</div>
                                <div className="text-[11px] text-slate-500">{o.customer_email || ""}</div>
                                <div className="mt-1 flex flex-wrap gap-2">
                                  <span className="rounded-full bg-white/5 px-2 py-1 text-[10px] text-slate-300 ring-1 ring-white/10">{Number(o.days_open || 0)} dia(s) aberto</span>
                                  {o.is_overdue ? <span className="rounded-full bg-red-500/10 px-2 py-1 text-[10px] text-red-200 ring-1 ring-red-500/30">Atrasado</span> : null}
                                </div>
                              </td>
                              <td className="py-3 px-3 whitespace-nowrap">{fmtBRL(o.effective_total ?? o.total)}</td>
                              <td className="py-3 px-3 whitespace-nowrap">
                                <span className={`${badgeBase} ${pay.cls}`}>{pay.label}</span>
                              </td>
                              <td className="py-3 px-3 whitespace-nowrap">
                                <span className={`${badgeBase} ${prod.cls}`}>{prod.label}</span>
                              </td>
                              <td className="py-3 px-3 whitespace-nowrap">
                                {o.shipping_tracking ? (
                                  <div className="space-y-1">
                                    <button
                                      onClick={() => {
                                        copyToClipboard(o.shipping_tracking);
                                        showToast("📋 Rastreio copiado!");
                                      }}
                                      className="text-slate-100 hover:underline"
                                    >
                                      {o.shipping_tracking}
                                    </button>
                                    <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-200/65">{trackingCarrierLabel(o.shipping_carrier || inferTrackingCarrierFromUrl(o.tracking_url))}</div>
                                  </div>
                                ) : (
                                  <span className="text-slate-500">—</span>
                                )}
                              </td>
                              <td className="py-3 px-3 whitespace-nowrap text-right">
                                <button
                                  onClick={() => setDetails({ open: true, orderId: o.id })}
                                  className="rounded-xl px-2 py-1 text-xs text-slate-200 hover:bg-white/4 ring-1 ring-white/10"
                                >
                                  Detalhes
                                </button>
                                <button
                                  onClick={() => setActionModal({ open: true, mode: "status", orderId: o.id })}
                                  className="ml-2 rounded-xl px-2 py-1 text-xs text-slate-200 hover:bg-white/4 ring-1 ring-white/10"
                                  disabled={String(o.status || "").toLowerCase() !== "paid"}
                                >
                                  Status
                                </button>
                                <button
                                  onClick={() => setActionModal({ open: true, mode: "tracking", orderId: o.id })}
                                  className="ml-2 rounded-xl px-2 py-1 text-xs text-slate-200 hover:bg-white/4 ring-1 ring-white/10"
                                  disabled={String(o.status || "").toLowerCase() !== "paid"}
                                >
                                  Rastreio
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                        {loading ? (
                          <tr>
                            <td colSpan={8} className="py-8 px-3 text-slate-400">
                              Carregando...
                            </td>
                          </tr>
                        ) : null}
                        {!loading && error ? (
                          <tr>
                            <td colSpan={8} className="py-8 px-3 text-red-200">
                              {error}
                            </td>
                          </tr>
                        ) : null}
                        {!loading && !error && !filteredOrders.length ? (
                          <tr>
                            <td colSpan={8} className="py-8 px-3 text-slate-400">
                              Nenhum pedido encontrado.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex flex-col gap-3 rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-2 text-sm text-slate-300">
                    <span>Linhas por página</span>
                    <select
                      value={pageSize}
                      onChange={(e) => setPageSize(Number(e.target.value || 25))}
                      className="rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-slate-100"
                    >
                      {[10, 25, 50, 100].map((size) => (
                        <option key={size} value={size}>{size}</option>
                      ))}
                    </select>
                    <span className="text-slate-500">• {pagination.totalCount} pedido(s) no filtro atual</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={pagination.page <= 1 || loading}
                      className="rounded-xl px-3 py-2 text-sm text-slate-200 hover:bg-white/4 ring-1 ring-white/10 disabled:opacity-50"
                    >
                      Anterior
                    </button>
                    <div className="rounded-xl bg-black/20 px-3 py-2 text-sm text-slate-200 ring-1 ring-white/10">
                      Página {pagination.page} / {pagination.totalPages}
                    </div>
                    <button
                      onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                      disabled={pagination.page >= pagination.totalPages || loading}
                      className="rounded-xl px-3 py-2 text-sm text-slate-200 hover:bg-white/4 ring-1 ring-white/10 disabled:opacity-50"
                    >
                      Próxima
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {section === "production" ? (
            <div className="space-y-4">
              <SectionTitle icon="view_kanban" title="Kanban de produção" subtitle="Pedidos pagos organizados por estágio operacional." />
              <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
                {[
                  ['recebido', 'Recebidos'],
                  ['editavel', 'Editáveis'],
                  ['em_producao', 'Em produção'],
                  ['pronto', 'Prontos para envio'],
                ].map(([key, label]) => {
                  const rows = filteredOrders.filter((o) => String(o.status || '').toLowerCase() === 'paid' && String(o.production_status || '').toLowerCase() === key).slice(0, 20);
                  return (
                    <div key={key} className="rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-semibold text-white">{label}</div>
                        <span className="rounded-full bg-white/5 px-2 py-1 text-[11px] text-slate-300 ring-1 ring-white/10">{rows.length}</span>
                      </div>
                      <div className="mt-3 space-y-2">
                        {rows.length ? rows.map((o) => (
                          <button key={o.id} onClick={() => setDetails({ open: true, orderId: o.id })} className="w-full text-left rounded-xl bg-black/20 ring-1 ring-white/10 p-3 hover:bg-black/30">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-slate-100 truncate">{o.customer_name || o.profile?.full_name || shortId(o.id)}</div>
                                <div className="text-[11px] text-slate-400">{shortId(o.id)} • {o.days_open || 0} dia(s)</div>
                              </div>
                              {o.is_overdue ? <span className="rounded-full bg-red-500/10 px-2 py-1 text-[10px] text-red-200 ring-1 ring-red-500/30">Atrasado</span> : null}
                            </div>
                          </button>
                        )) : <div className="text-sm text-slate-500">Nenhum pedido nesta coluna.</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : section === "finance" ? (
            <div className="space-y-4">
              <SectionTitle icon="payments" title="Centro financeiro" subtitle="Receita, upgrades e visão de caixa operacional." />
              <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-3">
                <KpiCard label="Faturamento total" value={fmtBRL(stats.revenue)} hint="Pedidos pagos + upgrades" />
                <KpiCard label="Receita do mês" value={fmtBRL(stats.paidMonth)} hint="Pagamentos aprovados" />
                <KpiCard label="Receita hoje" value={fmtBRL(stats.paidToday)} hint="Movimento diário" />
                <KpiCard label="Upgrades pagos" value={fmtBRL(stats.upgradeRevenue)} hint="Receita incremental VIP" />
                <KpiCard label="Frete pago" value={fmtBRL(financeHighlights.shippingRevenue)} hint="No filtro atual" />
                <KpiCard label="Entregues" value={financeHighlights.deliveredCount} hint="Pedidos pagos concluídos" />
              </div>
              <div className="rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-4">
                <div className="text-sm font-semibold text-white">Resumo financeiro</div>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 text-sm">
                  <div className="rounded-xl bg-black/20 ring-1 ring-white/10 p-4 text-slate-200">Ticket médio: <b>{fmtBRL(stats.averageTicket)}</b></div>
                  <div className="rounded-xl bg-black/20 ring-1 ring-white/10 p-4 text-slate-200">Reembolsos solicitados: <b>{stats.refundReq}</b></div>
                  <div className="rounded-xl bg-black/20 ring-1 ring-white/10 p-4 text-slate-200">Receita pendente: <b>{fmtBRL(financeHighlights.pendingRevenue)}</b></div>
                  <div className="rounded-xl bg-black/20 ring-1 ring-white/10 p-4 text-slate-200">Pedidos pagos no filtro: <b>{financeHighlights.paidCount}</b></div>
                </div>
              </div>
            </div>
          ) : section === "clients" ? (
            <div className="space-y-4">
              <SectionTitle icon="groups" title="Clientes" subtitle="Cadastros, histórico resumido e informações VIP." right={<div className="flex flex-wrap items-center gap-2"><button onClick={() => setNewClientOpen(true)} className="rounded-xl px-3 py-2 text-sm font-semibold bg-emerald-400 text-black ring-4 ring-emerald-400/20"><span className="material-icons text-[18px] align-middle mr-1">person_add</span>Cadastrar</button><button onClick={fetchClients} disabled={clientsLoading} className="rounded-xl px-3 py-2 text-sm text-slate-200 hover:bg-white/4 ring-1 ring-white/10 disabled:opacity-60 disabled:cursor-wait">{clientsLoading ? 'Atualizando…' : 'Atualizar'}</button></div>} />
              <div className="rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-4">
                <input value={clientsQ} onChange={(e)=>setClientsQ(e.target.value)} placeholder="Buscar por nome, e-mail, CPF, cidade ou último pedido" className="w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white" />
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-[1.05fr_0.95fr] gap-4">
                <div className="rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="text-xs text-slate-500">{clientsLoading ? 'Carregando clientes...' : `${(clients || []).length} cliente(s) no resultado`}</div>
                    {clientsQ ? <button onClick={() => setClientsQ('')} className="rounded-xl px-2 py-1 text-xs text-slate-200 hover:bg-white/4 ring-1 ring-white/10">Limpar busca</button> : null}
                  </div>
                  {clientsError ? <div className="mb-3 text-red-200">{clientsError}</div> : null}
                  <div className="space-y-2">
                    {(clients || []).map((client) => (
                      <button key={client.id} onClick={()=>setClientEditor(client)} className={`w-full text-left rounded-xl p-3 ring-1 transition ${String(clientEditor?.id || '') === String(client.id) ? 'bg-cyan-400/10 ring-cyan-300/30' : 'bg-black/20 ring-white/10 hover:bg-black/30'}`}>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-100 truncate">{client.full_name || client.email || client.id}</div>
                            <div className="text-xs text-slate-400 truncate">{client.email || 'Sem e-mail'} • {client.orders_count} pedido(s)</div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-semibold text-white">{fmtBRL(client.total_spent)}</div>
                            <div className="text-[11px] text-slate-500">Último: {fmtDate(client.last_order_at)}</div>
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">{(client.tags || []).map((tag)=><span key={tag} className="rounded-full px-2 py-1 text-[10px] bg-white/6 text-slate-300 ring-1 ring-white/10">{tag}</span>)}</div>
                      </button>
                    ))}
                    {!clientsLoading && !(clients || []).length ? <div className="text-slate-500">Nenhum cliente encontrado.</div> : null}
                  </div>
                </div>
                <div className="rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-4">
                  {clientEditor ? (
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-white">{clientEditor.full_name || clientEditor.email || 'Cliente'}</div>
                          <div className="text-xs text-slate-400">ID {shortId(clientEditor.id)} • último pedido {fmtDate(clientEditor.last_order_at)}</div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {clientEditor.email ? <button onClick={() => copyToClipboard(clientEditor.email)} className="rounded-xl px-2 py-1 text-xs text-slate-200 hover:bg-white/4 ring-1 ring-white/10">Copiar e-mail</button> : null}
                          {onlyDigits(clientEditor.phone) ? <a href={`https://wa.me/55${onlyDigits(clientEditor.phone)}?text=${encodeURIComponent(`Olá ${clientEditor.full_name || ''}!`)}`} target="_blank" rel="noreferrer" className="rounded-xl px-2 py-1 text-xs text-slate-200 hover:bg-white/4 ring-1 ring-white/10">WhatsApp</a> : null}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-xl bg-black/20 ring-1 ring-white/10 p-3 text-sm text-slate-300">Total gasto<br /><b className="text-white">{fmtBRL(clientEditor.total_spent)}</b></div>
                        <div className="rounded-xl bg-black/20 ring-1 ring-white/10 p-3 text-sm text-slate-300">Pedidos pagos<br /><b className="text-white">{clientEditor.paid_orders_count || 0}</b></div>
                        <div className="rounded-xl bg-black/20 ring-1 ring-white/10 p-3 text-sm text-slate-300">Pedidos totais<br /><b className="text-white">{clientEditor.orders_count || 0}</b></div>
                        <div className="rounded-xl bg-black/20 ring-1 ring-white/10 p-3 text-sm text-slate-300">VIP<br /><b className={clientEditor.vip_active ? 'text-emerald-200' : 'text-white'}>{clientEditor.vip_active ? 'Ativo' : 'Não'}</b></div>
                      </div>

                      <div className="rounded-2xl bg-violet-500/5 p-4 ring-1 ring-violet-400/25">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-extrabold text-violet-100">Controle da assinatura VIP</div>
                            <div className="mt-1 text-xs text-slate-400">
                              {clientEditor.vip_active
                                ? `Acesso ativo até ${clientEditor.vip_until ? fmtDate(clientEditor.vip_until) : 'data não informada'}.`
                                : 'O cliente está sem acesso à Área VIP.'}
                            </div>
                          </div>
                          <span className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ${clientEditor.vip_active ? 'bg-emerald-500/10 text-emerald-100 ring-emerald-400/30' : 'bg-white/5 text-slate-300 ring-white/10'}`}>
                            {clientEditor.vip_active ? 'VIP ativo' : 'VIP desativado'}
                          </span>
                        </div>
                        <label className="mt-4 block text-sm text-slate-300">
                          Plano do cliente
                          <select
                            value={clientEditor.vip_plan || clientVipPlans[0]?.id || ''}
                            onChange={(e) => setClientEditor((current) => current ? { ...current, vip_plan: e.target.value } : current)}
                            className="mt-1 w-full rounded-xl bg-black/20 px-3 py-2 text-white ring-1 ring-white/10"
                            disabled={clientVipBusy}
                          >
                            <option value="">Selecione um plano</option>
                            {clientVipPlans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name || plan.short_name || plan.id} — {fmtBRL(plan.price_brl ?? plan.price ?? 0)}</option>)}
                          </select>
                        </label>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {!clientEditor.vip_active ? (
                            <button disabled={clientVipBusy} onClick={() => updateClientVipStatus({ active: true })} className="rounded-xl bg-violet-300 px-4 py-2 text-sm font-extrabold text-black disabled:opacity-50">
                              {clientVipBusy ? 'Processando…' : 'Ativar por 30 dias'}
                            </button>
                          ) : (
                            <>
                              <button disabled={clientVipBusy} onClick={() => updateClientVipStatus({ active: true, extend: true })} className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-extrabold text-black disabled:opacity-50">
                                {clientVipBusy ? 'Processando…' : 'Renovar +30 dias'}
                              </button>
                              <button disabled={clientVipBusy} onClick={() => updateClientVipStatus({ active: false })} className="rounded-xl bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-100 ring-1 ring-red-500/30 disabled:opacity-50">
                                Desativar VIP
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <label className="text-sm text-slate-300">Nome<input value={clientEditor.full_name || ''} onChange={(e)=>setClientEditor((p)=>({...p, full_name:e.target.value}))} className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white" /></label>
                        <label className="text-sm text-slate-300">Email<input value={clientEditor.email || ''} onChange={(e)=>setClientEditor((p)=>({...p, email:e.target.value}))} className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white" /></label>
                        <label className="text-sm text-slate-300">CPF<input value={clientEditor.cpf || ''} onChange={(e)=>setClientEditor((p)=>({...p, cpf:e.target.value}))} className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white" /></label>
                        <label className="text-sm text-slate-300">Telefone<input value={clientEditor.phone || ''} onChange={(e)=>setClientEditor((p)=>({...p, phone:e.target.value}))} className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white" /></label>
                        <label className="text-sm text-slate-300 md:col-span-2">Endereço<input value={clientEditor.address_line1 || ''} onChange={(e)=>setClientEditor((p)=>({...p, address_line1:e.target.value}))} className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white" /></label>
                        <label className="text-sm text-slate-300">Número<input value={clientEditor.address_number || ''} onChange={(e)=>setClientEditor((p)=>({...p, address_number:e.target.value}))} className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white" /></label>
                        <label className="text-sm text-slate-300">Complemento<input value={clientEditor.address_line2 || ''} onChange={(e)=>setClientEditor((p)=>({...p, address_line2:e.target.value}))} className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white" /></label>
                        <label className="text-sm text-slate-300">Bairro<input value={clientEditor.neighborhood || ''} onChange={(e)=>setClientEditor((p)=>({...p, neighborhood:e.target.value}))} className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white" /></label>
                        <label className="text-sm text-slate-300">Cidade<input value={clientEditor.city || ''} onChange={(e)=>setClientEditor((p)=>({...p, city:e.target.value}))} className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white" /></label>
                        <label className="text-sm text-slate-300">UF<input value={clientEditor.state || ''} onChange={(e)=>setClientEditor((p)=>({...p, state:e.target.value}))} className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white" /></label>
                        <label className="text-sm text-slate-300">CEP<input value={clientEditor.zip || ''} onChange={(e)=>setClientEditor((p)=>({...p, zip:e.target.value}))} className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white" /></label>
                      </div>

                      <div className="rounded-2xl bg-black/20 ring-1 ring-white/10 p-3">
                        <div className="text-sm font-semibold text-white">Histórico recente de pedidos</div>
                        <div className="mt-3 space-y-2">
                          {(clientEditor.recent_orders || []).length ? clientEditor.recent_orders.map((order) => {
                            const pay = statusBadge(order.status);
                            const prod = prodStatusBadge(order.production_status);
                            return (
                              <button key={order.id} onClick={() => { setSection('orders'); setDetails({ open: true, orderId: order.id }); }} className="w-full rounded-xl bg-white/[0.03] p-3 text-left ring-1 ring-white/10 hover:bg-white/[0.05]">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div>
                                    <div className="text-sm font-semibold text-slate-100">Pedido {shortId(order.id)}</div>
                                    <div className="text-[11px] text-slate-500">{fmtDate(order.created_at)}</div>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-sm font-semibold text-white">{fmtBRL(order.total)}</div>
                                    <div className="mt-1 flex flex-wrap justify-end gap-2">
                                      <span className={`${badgeBase} ${pay.cls}`}>{pay.label}</span>
                                      <span className={`${badgeBase} ${prod.cls}`}>{prod.label}</span>
                                      {order.refund_requested ? <span className="rounded-full bg-red-500/10 px-2 py-1 text-[10px] text-red-200 ring-1 ring-red-500/30">Reembolso</span> : null}
                                    </div>
                                  </div>
                                </div>
                              </button>
                            );
                          }) : <div className="text-sm text-slate-500">Nenhum pedido recente deste cliente.</div>}
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openDeleteClientConfirm(clientEditor)} className="rounded-xl px-3 py-2 text-sm text-red-100 bg-red-500/10 ring-1 ring-red-500/30">Excluir cliente</button>
                        <button onClick={saveClientEdits} className="rounded-xl px-3 py-2 text-sm font-semibold bg-emerald-400 text-black ring-4 ring-emerald-400/20">Salvar alterações</button>
                      </div>
                    </div>
                  ) : <div className="text-slate-500">Selecione um cliente para editar o cadastro e ver o histórico recente.</div>}
                </div>
              </div>
            </div>
          ) : section === "products" ? (
            <AdminProductsSection onNotify={showToast} />
          ) : section === "reviews" ? (
            <AdminReviewsSection onToast={showToast} />
          ) : section === "coupons" ? (
            <div className="space-y-4">
              <SectionTitle
                icon="sell"
                title="Cupons do Cubo Game"
                subtitle="Defina aqui qual desconto o jogo vai gerar para os usuários vencedores."
                right={
                  <button
                    onClick={() => { fetchGameCoupon(); fetchGameCouponMetrics(); }}
                    className="rounded-xl px-3 py-2 text-sm text-slate-200 hover:bg-white/4 ring-1 ring-white/10"
                  >
                    <span className="material-icons text-[18px] align-middle mr-1">refresh</span>
                    Recarregar
                  </button>
                }
              />

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {[
                  { label: "Pessoas jogaram", value: gameCouponMetrics.players_count, hint: `${gameCouponMetrics.unique_winners_count} vencedores únicos` },
                  { label: "Ganharam", value: gameCouponMetrics.wins_count, hint: `${gameCouponMetrics.coupons_generated_count} cupons gerados` },
                  { label: "Cupons aplicados", value: gameCouponMetrics.coupons_applied_count, hint: "checkout iniciado com cupom" },
                  { label: "Viraram compra", value: gameCouponMetrics.purchases_with_coupon_count, hint: `${gameCouponMetrics.coupon_conversion_rate}% dos ganhos` },
                  { label: "Faturamento gerado", value: fmtBRL(Number(gameCouponMetrics.revenue_generated_brl || 0)), hint: `desconto dado ${fmtBRL(Number(gameCouponMetrics.discount_granted_brl || 0))}` },
                ].map((card) => (
                  <div key={card.label} className="rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-4">
                    <div className="text-xs uppercase tracking-wide text-slate-500">{card.label}</div>
                    <div className="mt-2 text-2xl font-black text-white">{card.value}</div>
                    <div className="mt-1 text-xs text-slate-400">{card.hint}</div>
                  </div>
                ))}
              </div>

              {gameCouponMetricsLoading ? (
                <div className="text-sm text-slate-400">Carregando métricas do Cubo Game…</div>
              ) : null}

              {gameCouponMetricsError ? (
                <div className="rounded-2xl bg-rose-500/10 ring-1 ring-rose-400/20 p-4 text-sm text-rose-100">
                  {gameCouponMetricsError}
                </div>
              ) : null}

              {gameCouponMetrics.coupon_orders_using_fallback ? (
                <div className="rounded-2xl bg-cyan-500/10 ring-1 ring-cyan-400/20 p-4 text-sm text-amber-100">
                  As métricas de aplicação/compra estão em modo compatível. Para contar checkouts iniciados com mais precisão, rode também o SQL do arquivo <code>supabase/coupon_metrics_orders.sql</code>.
                </div>
              ) : null}

              {gameCouponError ? (
                <div className="rounded-2xl bg-rose-500/10 ring-1 ring-rose-400/20 p-4 text-sm text-rose-100">
                  {gameCouponError}
                  <div className="mt-2 text-rose-200/80">
                    Se aparecer erro de tabela ausente, rode o SQL do arquivo <code>supabase/coupon_game_settings.sql</code> no Supabase.
                  </div>
                </div>
              ) : null}

              <div className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
                <div className="rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-4">
                  <div className="text-sm font-semibold text-white">Cupom ativo no jogo</div>
                  <div className="mt-1 text-sm text-slate-400">O jogador vence, e o sistema gera um código único baseado nesta configuração.</div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <div className="text-xs text-slate-400 mb-1">Tipo de desconto</div>
                      <select
                        value={gameCouponForm.discount_type}
                        onChange={(e) => setGameCouponForm((prev) => ({ ...prev, discount_type: e.target.value }))}
                        className="w-full rounded-xl bg-slate-950/60 ring-1 ring-white/10 px-3 py-2 text-sm text-white"
                      >
                        <option value="percent">Porcentagem (%)</option>
                        <option value="fixed_min">Valor fixo (R$)</option>
                        <option value="shipping_reduced">Frete reduzido (R$)</option>
                      </select>
                    </label>

                    <label className="block">
                      <div className="text-xs text-slate-400 mb-1">Valor do desconto</div>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={gameCouponForm.discount_value}
                        onChange={(e) => setGameCouponForm((prev) => ({ ...prev, discount_value: e.target.value }))}
                        className="w-full rounded-xl bg-slate-950/60 ring-1 ring-white/10 px-3 py-2 text-sm text-white"
                        placeholder={gameCouponForm.discount_type === 'percent' ? 'Ex.: 10' : 'Ex.: 15'}
                      />
                    </label>

                    <label className="block">
                      <div className="text-xs text-slate-400 mb-1">Pedido mínimo (R$)</div>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={gameCouponForm.min_order_value}
                        onChange={(e) => setGameCouponForm((prev) => ({ ...prev, min_order_value: e.target.value }))}
                        className="w-full rounded-xl bg-slate-950/60 ring-1 ring-white/10 px-3 py-2 text-sm text-white"
                        placeholder="0"
                      />
                    </label>

                    <label className="block">
                      <div className="text-xs text-slate-400 mb-1">Rótulo exibido no jogo</div>
                      <input
                        type="text"
                        value={gameCouponForm.label}
                        onChange={(e) => setGameCouponForm((prev) => ({ ...prev, label: e.target.value }))}
                        className="w-full rounded-xl bg-slate-950/60 ring-1 ring-white/10 px-3 py-2 text-sm text-white"
                        placeholder="Ex.: 10% OFF hoje"
                      />
                    </label>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button
                      onClick={saveGameCoupon}
                      disabled={gameCouponLoading}
                      className="rounded-xl px-4 py-2 text-sm font-semibold bg-emerald-400 text-black ring-4 ring-emerald-400/20 disabled:opacity-50"
                    >
                      {gameCouponLoading ? 'Salvando…' : 'Salvar cupom atual'}
                    </button>
                    <div className="text-xs text-slate-400">
                      O cupom perfeito de 20% continua separado e só sai em partida perfeita.
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-4">
                    <div className="text-sm font-semibold text-white">Configuração ativa agora</div>
                    {currentGameCoupon ? (
                      <div className="mt-3 space-y-3 text-sm">
                        <div className="rounded-xl bg-emerald-500/10 ring-1 ring-emerald-400/20 p-3">
                          <div className="text-xs text-emerald-200/80 uppercase tracking-wide">Rótulo</div>
                          <div className="mt-1 text-lg font-bold text-emerald-100">{currentGameCoupon.label}</div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-xl bg-white/[0.03] ring-1 ring-white/10 p-3">
                            <div className="text-xs text-slate-500">Tipo</div>
                            <div className="mt-1 text-slate-100">{currentGameCoupon.discount_type}</div>
                          </div>
                          <div className="rounded-xl bg-white/[0.03] ring-1 ring-white/10 p-3">
                            <div className="text-xs text-slate-500">Valor</div>
                            <div className="mt-1 text-slate-100">{currentGameCoupon.discount_value}</div>
                          </div>
                          <div className="rounded-xl bg-white/[0.03] ring-1 ring-white/10 p-3 col-span-2">
                            <div className="text-xs text-slate-500">Pedido mínimo</div>
                            <div className="mt-1 text-slate-100">{fmtBRL(Number(currentGameCoupon.min_order_value || 0))}</div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 text-sm text-slate-400">
                        {gameCouponLoading ? 'Carregando configuração…' : 'Nenhuma configuração ativa encontrada.'}
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-4">
                    <div className="text-sm font-semibold text-white">Como funciona</div>
                    <ul className="mt-3 space-y-2 text-sm text-slate-300">
                      <li>• O admin escolhe o desconto aqui.</li>
                      <li>• O jogo mostra esse rótulo como prêmio atual.</li>
                      <li>• Ao vencer, o usuário recebe um código único na tabela <code>coupons</code>.</li>
                      <li>• O carrinho continua validando o código normalmente.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          ) : section === "vip" ? (
            <div className="space-y-4">
              <SectionTitle
                icon="workspace_premium"
                title="VIP Controle"
                subtitle="Organize ciclos VIP, acompanhe base ativa e mantenha a votação do próximo tema."
                right={
                  <div className="flex w-full gap-2 sm:w-auto sm:items-center">
                    <button
                      onClick={() => fetchVipVoting()}
                      className="flex-1 rounded-xl px-3 py-2 text-sm text-slate-200 ring-1 ring-white/10 hover:bg-white/4 sm:flex-none"
                    >
                      Atualizar
                    </button>

                    {!vipPolls.some((x) => String(x?.poll?.status || "").toLowerCase() === "open") ? (
                      <button
                        onClick={() =>
                          setStartVote({
                            open: true,
                            busy: false,
                            error: "",
                            data: {
                              month_key: nextMonthKey(),
                              title: "Qual tema você quer no próximo mês?",
                              options: [
                                { title: "", description: "", image_asset_id: "" },
                                { title: "", description: "", image_asset_id: "" },
                                { title: "", description: "", image_asset_id: "" },
                              ],
                            },
                          })
                        }
                        className="flex-1 rounded-xl bg-emerald-400 px-3 py-2 text-sm font-semibold text-black ring-4 ring-emerald-400/20 sm:flex-none"
                      >
                        + Nova votação
                      </button>
                    ) : null}
                  </div>
                }
              />

              <div className="grid grid-cols-1 gap-4">
                <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-3xl bg-gradient-to-br from-cyan-500/15 via-cyan-400/8 to-transparent ring-1 ring-cyan-400/20 p-4 shadow-[0_12px_40px_rgba(6,182,212,0.08)]">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-200/80">Ciclo ativo</div>
                    <div className="mt-2 text-2xl font-black text-white">{vipControl.active_cycle_key || '—'}</div>
                    <div className="mt-2 text-sm text-slate-300">Esse é o mês exibido agora para os assinantes VIP.</div>
                  </div>
                  <div className="rounded-3xl bg-gradient-to-br from-violet-500/15 via-violet-400/8 to-transparent ring-1 ring-violet-400/20 p-4 shadow-[0_12px_40px_rgba(139,92,246,0.08)]">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-violet-200/80">Assinantes ativos</div>
                    <div className="mt-2 text-2xl font-black text-white">{Number(vipControl?.vip_summary?.activeSubscribers || 0)}</div>
                    <div className="mt-2 text-sm text-slate-300">Base atual apta a visualizar ciclos e participar das votações.</div>
                  </div>
                  <div className="rounded-3xl bg-gradient-to-br from-emerald-500/15 via-emerald-400/8 to-transparent ring-1 ring-emerald-400/20 p-4 shadow-[0_12px_40px_rgba(16,185,129,0.08)]">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-emerald-200/80">Ciclos montados</div>
                    <div className="mt-2 text-2xl font-black text-white">{vipControl.cycles.length}</div>
                    <div className="mt-2 text-sm text-slate-300">Meses prontos para ativar, editar ou duplicar rapidamente.</div>
                  </div>
                  <div className="rounded-3xl bg-gradient-to-br from-amber-500/15 via-amber-400/8 to-transparent ring-1 ring-amber-400/20 p-4 shadow-[0_12px_40px_rgba(245,158,11,0.08)]">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-amber-200/80">Biblioteca VIP</div>
                    <div className="mt-2 text-2xl font-black text-white">{vipControl.library.length}</div>
                    <div className="mt-2 text-sm text-slate-300">Miniaturas e bosses disponíveis para montar os próximos ciclos.</div>
                  </div>
                </div>

                {vipControlLoading ? <div className="rounded-2xl bg-white/[0.03] ring-1 ring-white/10 px-4 py-3 text-slate-400">Carregando controle VIP...</div> : null}
                {vipControlError ? <div className="rounded-2xl bg-red-500/10 ring-1 ring-red-500/30 px-4 py-3 text-sm text-red-200">{vipControlError}</div> : null}

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.82fr)]">
                  <div className="rounded-3xl bg-white/[0.03] ring-1 ring-white/10 p-4 md:p-5">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="max-w-2xl">
                        <div className="text-lg font-bold text-white">Montagem do ciclo VIP</div>
                        <div className="mt-1 text-sm text-slate-400">Monte o mês, escolha as minis e mantenha claro o que está no editor e o que já está ativo. Tudo fica concentrado aqui.</div>
                      </div>
                      <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-3 xl:w-auto xl:min-w-[430px]">
                        <button
                          onClick={() => setVipCycleEditor({ cycle_key: nextMonthKey(), selected_ids: [], activate: true })}
                          className="rounded-2xl px-4 py-2.5 text-sm font-semibold text-slate-100 bg-white/[0.04] hover:bg-white/[0.08] ring-1 ring-white/10"
                        >
                          + Novo ciclo
                        </button>
                        <button
                          onClick={() => {
                            const active = (vipControl.cycles || []).find((cycle) => cycle.is_active) || (vipControl.cycles || [])[0];
                            if (!active) return;
                            setVipCycleEditor({ cycle_key: nextMonthKey(), selected_ids: (active.items || []).map((item) => String(item.id)), activate: true });
                          }}
                          disabled={vipCycleBusy || !(vipControl.cycles || []).length}
                          className="rounded-2xl px-4 py-2.5 text-sm font-semibold text-slate-100 bg-white/[0.04] hover:bg-white/[0.08] ring-1 ring-white/10 disabled:opacity-60"
                        >
                          Duplicar ativo
                        </button>
                        <button
                          onClick={saveVipCycle}
                          disabled={vipCycleBusy}
                          className="col-span-2 rounded-2xl bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-black ring-4 ring-emerald-400/20 disabled:opacity-60 sm:col-span-1"
                        >
                          {vipCycleBusy ? 'Salvando...' : 'Salvar ciclo'}
                        </button>
                      </div>
                    </div>

                    <div className="mt-5 grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
                      <div className="space-y-4 lg:col-span-4 2xl:col-span-3">
                        <div className="rounded-2xl bg-black/20 ring-1 ring-white/10 p-4">
                          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Configuração do ciclo</div>
                          <label className="mt-4 block">
                            <div className="text-xs text-slate-400 mb-1.5">Mês de referência</div>
                            <input
                              value={vipCycleEditor.cycle_key}
                              onChange={(e) => setVipCycleEditor((prev) => ({ ...prev, cycle_key: e.target.value }))}
                              placeholder="YYYY-MM"
                              className="w-full rounded-2xl bg-black/20 ring-1 ring-white/10 px-3.5 py-3 text-slate-100"
                            />
                          </label>
                          <label className="mt-4 flex items-start gap-3 rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-3 text-sm text-slate-200">
                            <input
                              type="checkbox"
                              checked={!!vipCycleEditor.activate}
                              onChange={(e) => setVipCycleEditor((prev) => ({ ...prev, activate: e.target.checked }))}
                              className="mt-1"
                            />
                            <span>
                              <span className="font-semibold text-white">Ativar ao salvar</span>
                              <span className="mt-1 block text-xs text-slate-400">Use quando esse mês já deve aparecer imediatamente para os assinantes.</span>
                            </span>
                          </label>
                          {vipCycleEditor.cycle_key ? (
                            <button
                              onClick={() => openDeleteVipCycleConfirm(vipCycleEditor.cycle_key)}
                              disabled={vipCycleBusy}
                              className="mt-4 w-full rounded-2xl px-4 py-3 text-sm font-semibold text-red-100 bg-red-500/10 ring-1 ring-red-500/30 disabled:opacity-60"
                            >
                              Excluir ciclo atual do editor
                            </button>
                          ) : null}
                        </div>

                        <div className="rounded-2xl bg-black/20 ring-1 ring-white/10 p-4">
                          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Resumo da seleção</div>
                          <div className="mt-4 grid grid-cols-3 gap-2">
                            <div className="rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-3">
                              <div className="text-[11px] text-slate-500 uppercase tracking-wide">Itens</div>
                              <div className="mt-1 text-xl font-black text-white">{vipSelectedItems.length}</div>
                            </div>
                            <div className="rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-3">
                              <div className="text-[11px] text-slate-500 uppercase tracking-wide">Minis</div>
                              <div className="mt-1 text-xl font-black text-white">{vipSelectedSummary.mini}</div>
                            </div>
                            <div className="rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-3">
                              <div className="text-[11px] text-slate-500 uppercase tracking-wide">Boss</div>
                              <div className="mt-1 text-xl font-black text-white">{vipSelectedSummary.boss}</div>
                            </div>
                          </div>
                          <div className="mt-4 text-xs leading-5 text-slate-400">Toque nos cards da biblioteca para adicionar ou remover itens deste ciclo.</div>
                        </div>
                      </div>

                      <div className="min-w-0 space-y-4 lg:col-span-8 2xl:col-span-9">
                        <div className="rounded-2xl bg-black/20 ring-1 ring-white/10 p-4">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                              <div className="text-sm font-semibold text-white">Ciclos disponíveis</div>
                              <div className="mt-1 text-xs text-slate-400">Clique em um mês para carregar no editor e ajustar rapidamente.</div>
                            </div>
                            <div className="rounded-full bg-white/[0.04] px-3 py-1.5 text-xs text-slate-300 ring-1 ring-white/10 self-start lg:self-auto">
                              {vipControl.cycles.length} ciclo(s)
                            </div>
                          </div>
                          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 md:max-h-[320px] md:overflow-y-auto md:pr-1 2xl:grid-cols-3">
                            {(vipControl.cycles || []).map((cycle) => {
                              const isCurrentCycle = String(vipCycleEditor.cycle_key || '') === String(cycle.cycle_key);
                              return (
                                <button
                                  key={cycle.cycle_key}
                                  type="button"
                                  onClick={() => loadVipCycleIntoEditor(cycle.cycle_key)}
                                  className={[
                                    'min-w-0 rounded-2xl p-4 text-left ring-1 transition-all duration-200',
                                    'bg-white/[0.03] hover:bg-white/[0.05] hover:-translate-y-[1px]',
                                    isCurrentCycle
                                      ? 'ring-cyan-400/35 bg-cyan-400/10 shadow-[0_10px_30px_rgba(34,211,238,0.12)]'
                                      : 'ring-white/10'
                                  ].join(' ')}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                      <div className="text-sm font-semibold text-white truncate">{cycle.cycle_key}</div>
                                      <div className="mt-1 text-[11px] text-slate-400 leading-5">
                                        {cycle.is_active ? 'Ciclo ativo para assinantes' : 'Clique para carregar no editor'}
                                      </div>
                                    </div>
                                    <span className="material-icons text-slate-500 text-lg shrink-0">calendar_month</span>
                                  </div>
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {cycle.is_active ? (
                                      <span className="rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/20">
                                        Ativo
                                      </span>
                                    ) : null}
                                    {isCurrentCycle ? (
                                      <span className="rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-500/20">
                                        No editor
                                      </span>
                                    ) : null}
                                    <span className="rounded-full px-2 py-1 text-[10px] bg-white/6 text-slate-300 ring-1 ring-white/10">
                                      {cycle.total_items} item(ns)
                                    </span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="rounded-2xl bg-black/20 ring-1 ring-white/10 p-4">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                              <div className="text-sm font-semibold text-white">Biblioteca do ciclo</div>
                              <div className="mt-1 text-xs text-slate-400">Busque e filtre antes de tocar nos cards que entrarão neste mês.</div>
                            </div>
                            <div className="rounded-full bg-white/[0.04] px-3 py-1.5 text-xs text-slate-300 ring-1 ring-white/10 self-start lg:self-auto">
                              {vipVisibleLibrary.length} de {(vipControl.library || []).length} item(ns)
                            </div>
                          </div>

                          <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                            <div className="relative block">
                              <span className="material-icons pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[19px] text-slate-500">search</span>
                              <input
                                value={vipLibrarySearch}
                                onChange={(event) => setVipLibrarySearch(event.target.value)}
                                placeholder="Buscar por nome, descrição ou ciclo..."
                                aria-label="Buscar na biblioteca VIP"
                                className="w-full rounded-2xl bg-black/25 py-3 pl-10 pr-10 text-sm text-slate-100 ring-1 ring-white/10 placeholder:text-slate-600 focus:outline-none focus:ring-cyan-400/35"
                              />
                              {vipLibrarySearch ? (
                                <button
                                  type="button"
                                  onClick={() => setVipLibrarySearch('')}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:bg-white/5 hover:text-white"
                                  aria-label="Limpar busca"
                                >
                                  <span className="material-icons text-[18px]">close</span>
                                </button>
                              ) : null}
                            </div>
                            <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0">
                              {[
                                ['all', 'Todos'],
                                ['selected', 'Selecionados'],
                                ['mini', 'Minis'],
                                ['boss', 'Bosses'],
                              ].map(([value, label]) => (
                                <button
                                  key={value}
                                  type="button"
                                  onClick={() => setVipLibraryFilter(value)}
                                  className={[
                                    'shrink-0 rounded-full px-3 py-2 text-xs font-semibold ring-1 transition',
                                    vipLibraryFilter === value
                                      ? 'bg-cyan-400/15 text-cyan-100 ring-cyan-400/30'
                                      : 'bg-white/[0.03] text-slate-300 ring-white/10 hover:bg-white/[0.06]',
                                  ].join(' ')}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 md:max-h-[720px] md:overflow-y-auto md:pr-1">
                            {vipVisibleLibrary.map((item) => {
                              const selected = (vipCycleEditor.selected_ids || []).includes(String(item.id));
                              const assignedCycle = String(item?.cycle_key || '');
                              const isBoss = String(item?.item_type || '').toLowerCase() === 'boss';
                              return (
                                <button
                                  type="button"
                                  key={item.id}
                                  onClick={() => toggleVipCycleItem(String(item.id))}
                                  aria-pressed={selected}
                                  className={[
                                    'w-full text-left rounded-3xl p-3.5 ring-1 transition shadow-[0_8px_30px_rgba(0,0,0,0.14)]',
                                    selected
                                      ? 'bg-cyan-400/10 ring-cyan-400/30 shadow-[0_10px_35px_rgba(34,211,238,0.12)]'
                                      : 'bg-white/[0.03] ring-white/10 hover:bg-white/[0.05]'
                                  ].join(' ')}
                                >
                                  <div className="flex items-start gap-3 min-w-0">
                                    <div className="h-16 w-16 rounded-2xl overflow-hidden bg-black/20 ring-1 ring-white/10 shrink-0">
                                      {item.image_url ? <img src={item.image_url} alt={item.title} className="h-full w-full object-cover" loading="lazy" /> : null}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="text-sm font-bold text-slate-100 break-words leading-5">{item.title}</div>
                                      <div className="mt-2 flex flex-wrap gap-2">
                                        <span className={isBoss ? 'rounded-full px-2 py-0.5 text-[10px] bg-fuchsia-500/15 text-fuchsia-200 ring-1 ring-fuchsia-500/20' : 'rounded-full px-2 py-0.5 text-[10px] bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-500/20'}>
                                          {isBoss ? 'Boss' : 'Mini'}
                                        </span>
                                        {selected ? <span className="rounded-full px-2 py-0.5 text-[10px] bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/20">Selecionado</span> : null}
                                        {assignedCycle ? (
                                          <span className="rounded-full px-2 py-0.5 text-[10px] bg-white/6 text-slate-300 ring-1 ring-white/10">
                                            {assignedCycle}
                                          </span>
                                        ) : null}
                                      </div>
                                      {item.description ? <div className="mt-2 text-xs text-slate-400 leading-5 line-clamp-2">{item.description}</div> : null}
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                            {!vipVisibleLibrary.length ? (
                              <div className="rounded-2xl bg-white/[0.03] p-5 text-center text-sm text-slate-400 ring-1 ring-white/10 md:col-span-2">
                                Nenhum item encontrado com esses filtros.
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="sticky bottom-3 z-30 mt-4 flex items-center justify-between gap-3 rounded-2xl bg-[#0a202a]/95 p-3 shadow-[0_16px_45px_rgba(0,0,0,0.45)] ring-1 ring-cyan-300/20 backdrop-blur lg:hidden">
                      <div className="min-w-0">
                        <div className="text-xs text-slate-400">Ciclo {vipCycleEditor.cycle_key || 'novo'}</div>
                        <div className="truncate text-sm font-semibold text-white">{vipSelectedItems.length} item(ns) selecionado(s)</div>
                      </div>
                      <button
                        type="button"
                        onClick={saveVipCycle}
                        disabled={vipCycleBusy}
                        className="shrink-0 rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-bold text-black ring-4 ring-emerald-400/15 disabled:opacity-60"
                      >
                        {vipCycleBusy ? 'Salvando...' : 'Salvar'}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-3xl bg-white/[0.03] ring-1 ring-white/10 p-4 md:p-5">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="text-lg font-bold text-white">Radar VIP</div>
                          <div className="mt-1 text-sm text-slate-400">Acompanhe o ciclo ativo e a distribuição dos assinantes por mês.</div>
                        </div>
                        {vipActiveCycle ? <span className="rounded-full px-3 py-1.5 text-xs bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/20">Ativo: {vipActiveCycle.cycle_key}</span> : null}
                      </div>

                      <div className="mt-4 rounded-2xl bg-black/20 ring-1 ring-white/10 p-4">
                        <div className="text-xs text-slate-500 uppercase tracking-[0.16em]">Resumo do ciclo ativo</div>
                        {vipActiveCycle ? (
                          <div className="mt-3 grid grid-cols-3 gap-3">
                            <div className="rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-3">
                              <div className="text-[11px] text-slate-500 uppercase tracking-wide">Itens</div>
                              <div className="mt-1 text-xl font-black text-white">{vipActiveCycle.total_items}</div>
                            </div>
                            <div className="rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-3">
                              <div className="text-[11px] text-slate-500 uppercase tracking-wide">Minis</div>
                              <div className="mt-1 text-xl font-black text-white">{vipActiveCycle.miniatures_count}</div>
                            </div>
                            <div className="rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-3">
                              <div className="text-[11px] text-slate-500 uppercase tracking-wide">Boss</div>
                              <div className="mt-1 text-xl font-black text-white">{vipActiveCycle.boss_count}</div>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-3 text-sm text-slate-400">Nenhum ciclo ativo no momento.</div>
                        )}
                      </div>

                      <div className="mt-4 rounded-2xl bg-black/20 ring-1 ring-white/10 p-4">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm font-semibold text-white">Assinantes por ciclo</div>
                          <div className="text-xs text-slate-500">Leitura rápida da base</div>
                        </div>
                        <div className="mt-3 space-y-2">
                          {vipCycleAudience.length ? vipCycleAudience.map((row, idx) => {
                            const count = Number(row?.count || row?.total || 0);
                            const pct = Math.max(6, Math.min(100, vipControl?.vip_summary?.activeSubscribers ? (count / Number(vipControl.vip_summary.activeSubscribers || 1)) * 100 : 0));
                            return (
                              <div key={`${row?.cycle_key || 'none'}-${idx}`} className="rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-3">
                                <div className="flex items-center justify-between gap-3 text-sm">
                                  <div className="font-semibold text-slate-100">{row?.cycle_key || 'Sem ciclo'}</div>
                                  <div className="text-slate-300">{count} assinante(s)</div>
                                </div>
                                <div className="mt-2 h-2 rounded-full bg-black/30 overflow-hidden ring-1 ring-white/10">
                                  <div className="h-full rounded-full bg-white/30" style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            );
                          }) : <div className="text-sm text-slate-400">Sem dados de distribuição por ciclo.</div>}
                        </div>
                      </div>

                      <div className="mt-4 space-y-2">
                        {(vipControl.cycles || []).map((cycle) => (
                          <div key={cycle.cycle_key} className="rounded-2xl bg-black/20 ring-1 ring-white/10 p-3 flex flex-col gap-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-sm font-bold text-slate-100">{cycle.cycle_key}</div>
                                <div className="mt-1 text-xs text-slate-400">{cycle.miniatures_count} minis • {cycle.boss_count} boss • {cycle.total_items} itens</div>
                              </div>
                              {cycle.is_active ? <span className="rounded-full px-2.5 py-1 text-[11px] bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/20">Ativo</span> : null}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={() => loadVipCycleIntoEditor(cycle.cycle_key)}
                                className="rounded-2xl px-3 py-2 text-xs font-semibold text-slate-100 bg-white/[0.04] hover:bg-white/[0.08] ring-1 ring-white/10"
                              >
                                Editar
                              </button>
                              {!cycle.is_active ? (
                                <button
                                  onClick={() => activateVipCycle(cycle.cycle_key)}
                                  disabled={vipCycleBusy}
                                  className="rounded-2xl px-3 py-2 text-xs font-semibold text-emerald-100 bg-emerald-500/10 hover:bg-emerald-500/20 ring-1 ring-emerald-500/30 disabled:opacity-60"
                                >
                                  Ativar
                                </button>
                              ) : null}
                              <button
                                onClick={() => openDeleteVipCycleConfirm(cycle.cycle_key)}
                                disabled={vipCycleBusy}
                                className="rounded-2xl px-3 py-2 text-xs font-semibold text-red-100 bg-red-500/10 hover:bg-red-500/20 ring-1 ring-red-500/30 disabled:opacity-60"
                              >
                                Excluir
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-3xl bg-white/[0.03] ring-1 ring-white/10 p-4 md:p-5">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-lg font-bold text-white">Votações do próximo tema</div>
                          <div className="mt-1 text-sm text-slate-400">Crie, acompanhe e encerre as votações do mês seguinte sem sair desta área.</div>
                        </div>
                      </div>
                      {vipPollsLoading ? <div className="mt-4 text-slate-400">Carregando...</div> : null}
                      {vipPollsError ? <div className="mt-4 text-red-200">{vipPollsError}</div> : null}

                      {!vipPollsLoading && !vipPollsError && !vipPolls.length ? (
                        <div className="mt-4 rounded-2xl bg-black/20 ring-1 ring-white/10 p-4 text-slate-400">Nenhuma votação encontrada.</div>
                      ) : null}

                      <div className="mt-4 space-y-4">
                      {vipPolls.map((p, idx) => (
                        <div key={idx} className="rounded-2xl bg-black/20 ring-1 ring-white/10 p-3.5">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <div className="break-words text-white font-semibold">{p?.poll?.title || "Votação"}</div>
                              <div className="text-xs text-slate-500">
                                {p?.poll?.month_key || "—"} • {p?.total_votes || 0} votos • {p?.poll?.status || "—"}
                              </div>
                            </div>

                            <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:items-center">
                              {String(p?.poll?.status || "").toLowerCase() === "closed" ? (
                                <span className="rounded-full px-2 py-1 text-[11px] bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/20">
                                  Encerrada
                                </span>
                              ) : (
                                <span className="rounded-full px-2 py-1 text-[11px] bg-violet-500/15 text-violet-200 ring-1 ring-violet-400/20">
                                  Aberta
                                </span>
                              )}

                              {String(p?.poll?.status || "").toLowerCase() === "open" ? (
                                <button
                                  onClick={() =>
                                    setCloseVote({
                                      open: true,
                                      poll: p,
                                      winnerId: null,
                                      busy: false,
                                      error: "",
                                    })
                                  }
                                  className="w-full rounded-2xl px-3 py-2 text-xs font-semibold text-slate-200 ring-1 ring-white/10 hover:bg-white/4 sm:w-auto"
                                >
                                  Encerrar votação
                                </button>
                              ) : null}

                              {String(p?.poll?.status || "").toLowerCase() === "closed" ? (
                                <button
                                  onClick={() => setDeleteVote({ open: true, poll: p, busy: false, error: "" })}
                                  className="w-full rounded-2xl px-3 py-2 text-xs font-semibold text-red-200 ring-1 ring-red-500/30 hover:bg-red-500/10 sm:w-auto"
                                >
                                  Excluir votação
                                </button>
                              ) : null}
                            </div>
                          </div>

                          {String(p?.poll?.status || "").toLowerCase() === "closed" ? (
                            (() => {
                              const winnerId = p?.poll?.winner_option_id;
                              const winner = (p?.options || []).find((o) => String(o.id) === String(winnerId));
                              return winner ? (
                                <div className="mt-3 rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-400/20 p-3">
                                  <div className="text-xs uppercase tracking-wide text-emerald-200/90">Vencedor</div>
                                  <div className="mt-1 text-slate-100 font-extrabold">{winner.title}</div>
                                </div>
                              ) : (
                                <div className="mt-3 rounded-2xl bg-cyan-500/10 ring-1 ring-cyan-400/20 p-3 text-sm text-cyan-200">
                                  Votação encerrada, mas o vencedor não está salvo no banco (adicione a coluna <b>winner_option_id</b> em <b>vip_theme_polls</b>).
                                </div>
                              );
                            })()
                          ) : null}

                          <div className="mt-3 space-y-2">
                            {(p?.options || []).map((o) => (
                              <div key={o.id} className="rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-2.5">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="min-w-0 flex flex-1 items-center gap-3">
                                    {o.image_url ? (
                                      <div className="h-12 w-12 rounded-xl overflow-hidden bg-black/20 ring-1 ring-white/10 shrink-0">
                                        <img src={o.image_url} alt={o.title} className="h-full w-full object-cover" loading="lazy" />
                                      </div>
                                    ) : null}
                                    <div className="min-w-0">
                                      <div className="text-slate-100 truncate">{o.title}</div>
                                      {o.description ? <div className="text-xs text-slate-500 line-clamp-2">{o.description}</div> : null}
                                    </div>
                                  </div>
                                  <div className="text-xs text-slate-300 whitespace-nowrap">
                                    {o.votes} • {o.pct}%
                                  </div>
                                </div>
                                <div className="mt-2 h-2 rounded-full bg-black/30 overflow-hidden ring-1 ring-white/10">
                                  <div className="h-full bg-white/30" style={{ width: `${o.pct || 0}%` }} />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </main>
      </div>

      <OrderDetailsModal
        open={details.open}
        order={activeOrder}
        onClose={() => setDetails({ open: false, orderId: null })}
        onUpdateStatus={(o) => setActionModal({ open: true, mode: "status", orderId: o?.id })}
        onUpdateTracking={(o) => setActionModal({ open: true, mode: "tracking", orderId: o?.id })}
        onUpdateCreatedAt={(o, createdAt) => updateOrder(o?.id, { created_at: createdAt })}
        onRequestRefund={(o) => updateOrder(o?.id, { refund_requested: true, refund_requested_at: new Date().toISOString() })}
        onDeleteOrder={(o) => deleteOrder(o?.id || o?.order_id)}
        onResendEmail={(o) => resendOrderEmail(o?.id || o?.order_id)}
        resendBusy={resendEmailBusyId && String(resendEmailBusyId) === String(activeOrder?.id)}
        toast={toast}
        adminQuickSearch={adminQuickSearch}
        setAdminQuickSearch={setAdminQuickSearch}
        runAdminQuickSearch={runAdminQuickSearch}
      />

      <StatusModal
        open={actionModal.open}
        mode={actionModal.mode}
        order={activeActionOrder}
        onClose={() => setActionModal({ open: false, mode: "status", orderId: null })}
        onSubmit={(patch) => {
          const id = activeActionOrder?.id;
          setActionModal({ open: false, mode: "status", orderId: null });
          if (id) updateOrder(id, patch);
        }}
      />

      <BulkActionModal
        open={bulkModal.open}
        mode={bulkModal.mode}
        count={selectedOrderIds.length}
        busy={bulkBusy}
        onClose={() => setBulkModal({ open: false, mode: "status" })}
        onSubmit={(patch) => {
          if (bulkModal.mode === "delete") {
            bulkDeleteOrders();
            return;
          }
          const nextPatch =
            bulkModal.mode === "refund_on" && patch?.refund_requested
              ? { ...patch, refund_requested_at: new Date().toISOString() }
              : bulkModal.mode === "refund_off"
              ? { ...patch, refund_requested_at: null }
              : patch;
          bulkUpdateOrders(nextPatch);
        }}
      />

      <NewManualOrderModal open={newOrderOpen} accessToken={accessToken} onClose={() => setNewOrderOpen(false)} onCreated={() => { fetchOrders(); }} showToast={showToast} />
      <CreateClientModal open={newClientOpen} accessToken={accessToken} onClose={() => setNewClientOpen(false)} onCreated={(client) => { fetchClients(); if (client) setClientEditor(client); }} showToast={showToast} />

      <CloseVotingModal
        state={closeVote}
        onClose={() => setCloseVote({ open: false, poll: null, winnerId: null, busy: false, error: "" })}
        onSelectWinner={(id) => setCloseVote((s) => ({ ...s, winnerId: id }))}
        onConfirm={(winnerId) => closeVipVoting(closeVote.poll, winnerId)}
      />

      <StartVotingModal
        state={startVote}
        imageLibrary={vipVotingImages}
        imageLibraryLoading={vipVotingImagesLoading}
        imageLibraryError={vipVotingImagesError}
        onClose={() => setStartVote({ open: false, data: null, busy: false, error: "" })}
        onChange={(data) => setStartVote((s) => ({ ...s, data }))}
        onConfirm={(data) => startVipVoting(data)}
      />

      <ConfirmDeleteVotingModal
        state={deleteVote}
        onClose={() => setDeleteVote({ open: false, poll: null, busy: false, error: "" })}
        onConfirm={() => deleteVipVoting(deleteVote.poll)}
      />

      <ConfirmDangerModal
        open={confirmAction.open}
        title={confirmAction.type === 'client' ? 'Excluir cliente' : 'Excluir ciclo VIP'}
        message={confirmAction.type === 'client'
          ? 'Essa ação remove o cliente do sistema. Use apenas quando tiver certeza.'
          : 'Essa ação remove o ciclo VIP e desvincula os itens desse ciclo.'}
        details={confirmAction.type === 'client'
          ? `${confirmAction.payload?.full_name || confirmAction.payload?.email || confirmAction.payload?.id || 'Cliente'}`
          : `Ciclo ${confirmAction.payload?.cycle_key || '—'}`}
        confirmLabel={confirmAction.type === 'client' ? 'Excluir cliente' : 'Excluir ciclo'}
        busy={confirmAction.busy}
        error={confirmAction.error}
        keyword={confirmAction.type === 'client' ? 'EXCLUIR' : ''}
        keywordValue={confirmAction.keywordValue}
        onKeywordChange={(value) => setConfirmAction((prev) => ({ ...prev, keywordValue: value }))}
        onClose={() => setConfirmAction({ open: false, type: '', payload: null, busy: false, error: '', keywordValue: '' })}
        onConfirm={handleConfirmAction}
      />
    </div>
  );
}