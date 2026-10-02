import React from 'react'
import { lazyWithReload } from '../lib/lazyWithReload.js'
import useDialog from '../lib/useDialog.js'
import './admin/admin.css'
import { useAuth } from '../auth/AuthProvider.jsx'
import {
  DetailRow,
  OrderBadgeCluster,
  TimelineList,
} from './admin/orders/AdminOrdersComponents.jsx'
import {
  copyToClipboard,
  emailAuditBadge,
  fmtAddress,
  fmtBRL,
  fmtDate,
  onlyDigits,
  shortId,
  toDateInputValue,
} from './admin/orders/adminOrdersUtils.js'
import {
  TRACKING_CARRIERS,
  normalizeTrackingCarrier,
  resolveTrackingCarrier,
} from '../lib/tracking'
import { fetchAddressFromCep } from '../lib/cep.js'
import { supabase } from '../lib/supabaseClient.js'
import {
  ADMIN_LEVEL,
  adminLevelLabel,
  normalizeAdminLevel,
} from '../lib/admin.js'

const NewManualOrderModal = lazyWithReload(
  () => import('./admin/orders/NewManualOrderModal.jsx')
)
const AdminProductsSection = lazyWithReload(
  () => import('./admin/products/AdminProductsSection.jsx')
)
const AdminReviewsSection = lazyWithReload(
  () => import('./admin/reviews/AdminReviewsSection.jsx')
)
const AdminManagementSection = lazyWithReload(
  () => import('./admin/admins/AdminManagementSection.jsx')
)
const AdminDashboardSection = lazyWithReload(
  () => import('./admin/dashboard/AdminDashboardSection.jsx')
)
const AdminOrdersSection = lazyWithReload(
  () => import('./admin/orders/AdminOrdersSection.jsx')
)
const AdminProductionSection = lazyWithReload(
  () => import('./admin/production/AdminProductionSection.jsx')
)
const AdminFinanceSection = lazyWithReload(
  () => import('./admin/finance/AdminFinanceSection.jsx')
)
const AdminClientsSection = lazyWithReload(
  () => import('./admin/clients/AdminClientsSection.jsx')
)
const AdminCouponsSection = lazyWithReload(
  () => import('./admin/coupons/AdminCouponsSection.jsx')
)
const AdminVipSection = lazyWithReload(
  () => import('./admin/vip/AdminVipSection.jsx')
)
const AdminAffiliatesSection = lazyWithReload(
  () => import('./admin/affiliates/AdminAffiliatesSection.jsx')
)

function formatCpfInput(value) {
  const d = onlyDigits(value).slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

function formatPhoneInput(value) {
  const d = onlyDigits(value).slice(0, 11)
  if (d.length <= 2) return d ? `(${d}` : ''
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

function formatCepInput(value) {
  const d = onlyDigits(value).slice(0, 8)
  if (d.length <= 5) return d
  return `${d.slice(0, 5)}-${d.slice(5)}`
}

function dateTimeLocalValue(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function dateTimeLocalToIso(value) {
  if (!value) return ''
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '' : d.toISOString()
}

function OrderDetailsModal({
  open,
  order,
  canManageBusiness = false,
  onClose,
  onUpdateStatus,
  onUpdateTracking,
  onUpdateCreatedAt,
  onRequestRefund,
  onDeleteOrder,
  onResendEmail,
  onAddNote,
  resendBusy,
  toast,
}) {
  const panelRef = useDialog(open, onClose)
  const p = order?.profile || null
  const address = fmtAddress(p)

  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false)
  const [deleteKeyword, setDeleteKeyword] = React.useState('')
  const phone = order?.customer_phone || p?.phone || ''
  const [noteDraft, setNoteDraft] = React.useState('')
  const [launchDateDraft, setLaunchDateDraft] = React.useState(() =>
    dateTimeLocalValue(order?.created_at)
  )
  const isVipOrder =
    String(order?.order_type || '')
      .trim()
      .toLowerCase() === 'vip'
  const vipSelectedOptions = Array.isArray(
    order?.vip_selection?.selected_options
  )
    ? order.vip_selection.selected_options
    : []
  const vipSelectedTitles = Array.isArray(order?.vip_selection?.selected_titles)
    ? order.vip_selection.selected_titles
    : []
  const vipSelectedIds = Array.isArray(
    order?.vip_selection?.selected_option_ids
  )
    ? order.vip_selection.selected_option_ids
    : []

  React.useEffect(() => {
    setLaunchDateDraft(dateTimeLocalValue(order?.created_at))
    setConfirmDeleteOpen(false)
    setDeleteKeyword('')
    setNoteDraft('')
  }, [order?.id, order?.created_at])
  if (!open) return null
  const waPhone = onlyDigits(phone)
  const waMsg = encodeURIComponent(
    `Olá! Sobre seu pedido ${shortId(order?.id)}:\nStatus: ${String(order?.production_status || 'recebido')}\n\nQualquer dúvida, me responda aqui.`
  )
  const waUrl = waPhone ? `https://wa.me/55${waPhone}?text=${waMsg}` : null

  return (
    <>
      <div className="fixed inset-0 z-[9999]">
        <div className="absolute inset-0 bg-[#020b10]/72" onClick={onClose} />
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="Detalhes do pedido"
          tabIndex={-1}
          className="absolute right-0 top-0 flex h-full w-full flex-col sm:w-[560px] bg-[#0a0f1a] border-l border-white/10"
        >
          <div className="p-4 border-b border-white/10 flex items-start justify-between gap-3">
            <div>
              <div className="text-white font-semibold">
                Pedido {shortId(order?.id)}
              </div>
              <div className="text-xs text-slate-400">
                {fmtDate(order?.created_at)}
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-xl px-3 py-2 text-slate-200 hover:bg-white/4 ring-1 ring-white/10"
              aria-label="Fechar"
            >
              <span className="material-icons text-[18px]">close</span>
            </button>
          </div>

          <div className="min-h-0 flex-1 p-4 overflow-y-auto overscroll-contain">
            {toast ? (
              <div className="mb-3 rounded-2xl bg-white/[0.04] ring-1 ring-white/10 px-3 py-2 text-sm text-slate-200">
                {toast}
              </div>
            ) : null}

            <div className="rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-3">
              <OrderBadgeCluster order={order} />

              <div className="mt-3 rounded-2xl bg-black/20 ring-1 ring-white/10 p-3">
                <div className="text-[11px] text-slate-500">
                  Data de lançamento
                </div>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    type="datetime-local"
                    value={launchDateDraft}
                    onChange={(e) => setLaunchDateDraft(e.target.value)}
                    className="w-full rounded-xl bg-black/30 ring-1 ring-white/10 px-3 py-2 text-sm text-white"
                  />
                  <button
                    onClick={() => {
                      const iso = dateTimeLocalToIso(launchDateDraft)
                      if (!iso) return
                      onUpdateCreatedAt?.(order, iso)
                    }}
                    disabled={
                      !canManageBusiness ||
                      !launchDateDraft ||
                      dateTimeLocalToIso(launchDateDraft) === order?.created_at
                    }
                    title={
                      !canManageBusiness ? 'Exige nível 2 (Gerente)' : undefined
                    }
                    className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-white/4 ring-1 ring-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Alterar data
                  </button>
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Atual: {fmtDate(order?.created_at)}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[11px] text-slate-500">Total</div>
                  <div className="text-lg font-semibold text-white">
                    {fmtBRL(order?.effective_total ?? order?.total)}
                  </div>
                  {Number(order?.upgrade_total || 0) > 0 ? (
                    <div className="text-[11px] text-violet-200/80">
                      Inclui upgrade
                      {Number(order?.related_upgrades_count || 0) > 1
                        ? 's'
                        : ''}{' '}
                      de {fmtBRL(order?.upgrade_total)}
                    </div>
                  ) : null}
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">Pagamento</div>
                  <div className="text-sm text-slate-200">
                    {order?.payment_provider || '—'}
                  </div>
                  <div className="text-xs text-slate-500 break-words">
                    {order?.provider_payment_id || ''}
                  </div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                <button
                  onClick={() => onUpdateStatus?.(order)}
                  className="rounded-2xl bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-100 ring-1 ring-white/10 transition hover:bg-white/[0.08] hover:-translate-y-0.5"
                >
                  <span className="material-icons text-[16px] align-middle mr-1">
                    sync_alt
                  </span>
                  Alterar status
                </button>
                <button
                  onClick={() => onUpdateTracking?.(order)}
                  className="rounded-2xl bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-100 ring-1 ring-white/10 transition hover:bg-white/[0.08] hover:-translate-y-0.5"
                >
                  <span className="material-icons text-[16px] align-middle mr-1">
                    local_shipping
                  </span>
                  Atualizar rastreio
                </button>
                <button
                  onClick={() => onResendEmail?.(order)}
                  disabled={!!resendBusy}
                  className="rounded-2xl bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-100 ring-1 ring-white/10 transition hover:bg-white/[0.08] hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <span className="material-icons text-[16px] align-middle mr-1">
                    forward_to_inbox
                  </span>
                  {resendBusy ? 'Reenviando…' : 'Reenviar e-mail'}
                </button>
                <button
                  onClick={() => copyToClipboard(order?.customer_email || '')}
                  className="rounded-2xl bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-100 ring-1 ring-white/10 transition hover:bg-white/[0.08] hover:-translate-y-0.5"
                >
                  <span className="material-icons text-[16px] align-middle mr-1">
                    content_copy
                  </span>
                  Copiar e-mail
                </button>
                <button
                  onClick={() => copyToClipboard(order?.id)}
                  className="rounded-2xl bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-100 ring-1 ring-white/10 transition hover:bg-white/[0.08] hover:-translate-y-0.5"
                >
                  <span className="material-icons text-[16px] align-middle mr-1">
                    fingerprint
                  </span>
                  Copiar ID
                </button>
                <button
                  onClick={() => copyToClipboard(order?.provider_payment_id)}
                  className="rounded-2xl bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-100 ring-1 ring-white/10 transition hover:bg-white/[0.08] hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!order?.provider_payment_id}
                >
                  <span className="material-icons text-[16px] align-middle mr-1">
                    payments
                  </span>
                  Copiar ID pagamento
                </button>
                {canManageBusiness ? (
                  <button
                    onClick={() => setConfirmDeleteOpen(true)}
                    className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-100 ring-1 ring-red-500/30 transition hover:bg-red-500/15 hover:-translate-y-0.5"
                  >
                    <span className="material-icons text-[16px] align-middle mr-1">
                      delete
                    </span>
                    Excluir
                  </button>
                ) : null}
              </div>
            </div>

            <div className="mt-4 rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-3">
              <div className="text-sm font-semibold text-white">
                Último e-mail
              </div>
              <DetailRow label="Tipo" value={order?.last_email_type || '—'} />
              <DetailRow
                label="Status"
                value={emailAuditBadge(order?.last_email_status).label}
              />
              <DetailRow
                label="Enviado em"
                value={fmtDate(order?.last_email_sent_at)}
              />
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
                    <div
                      key={idx}
                      className="flex items-center gap-3 rounded-xl bg-black/20 ring-1 ring-white/10 p-2"
                    >
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-white/4 ring-1 ring-white/10 shrink-0">
                        {it?.img ? (
                          <img
                            src={it.img}
                            alt=""
                            className="w-full h-full object-contain"
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm text-slate-100 truncate">
                          {it.name}
                        </div>
                        <div className="text-xs text-slate-400">
                          {it.qty || 1}x{' '}
                          {it.scale ? `• escala ${it.scale}` : ''}{' '}
                          {it.unit_price != null
                            ? `• ${fmtBRL(it.unit_price)}`
                            : ''}
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
                      <div className="text-xs text-violet-200/80 uppercase tracking-wide">
                        Miniaturas escolhidas pelo assinante
                      </div>
                      <div className="mt-1 text-[11px] text-slate-400">
                        Ciclo:{' '}
                        {order?.vip_selection?.cycle_key ||
                          order?.profile?.vip_cycle_key ||
                          String(order?.created_at || '').slice(0, 7) ||
                          '—'}
                      </div>
                    </div>
                    <span className="rounded-full bg-violet-300/10 px-2 py-1 text-[11px] font-semibold text-violet-100 ring-1 ring-violet-300/20">
                      {vipSelectedOptions.length ||
                        vipSelectedTitles.length ||
                        vipSelectedIds.length}{' '}
                      item(ns)
                    </span>
                  </div>

                  {vipSelectedOptions.length ? (
                    <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {vipSelectedOptions.map((opt) => (
                        <div
                          key={String(opt?.id || opt?.title)}
                          className="rounded-xl bg-black/20 ring-1 ring-white/10 p-2"
                          title={opt?.title || ''}
                        >
                          <div className="w-full aspect-square rounded-lg overflow-hidden bg-white/4 ring-1 ring-white/10">
                            {opt?.image_url ? (
                              <img
                                src={opt.image_url}
                                alt={opt?.title || ''}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full grid place-items-center text-[10px] text-slate-500">
                                sem imagem
                              </div>
                            )}
                          </div>
                          <div
                            className="mt-2 text-[11px] text-slate-200 leading-snug break-words"
                            style={{
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                            }}
                          >
                            {opt?.title || 'Miniatura VIP'}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : vipSelectedTitles.length ? (
                    <div className="mt-2 text-xs text-slate-200">
                      {vipSelectedTitles.join(', ')}
                    </div>
                  ) : vipSelectedIds.length ? (
                    <div className="mt-2 text-xs text-slate-300">
                      IDs escolhidos: {vipSelectedIds.join(', ')}
                    </div>
                  ) : (
                    <div className="mt-3 rounded-xl bg-black/20 ring-1 ring-white/10 p-3 text-sm text-slate-300">
                      Nenhuma miniatura escolhida foi encontrada para este ciclo
                      VIP.
                    </div>
                  )}
                </div>
              ) : null}

              {order?.vip_present_roll ? (
                <div className="mt-3 rounded-2xl bg-violet-500/10 ring-1 ring-violet-300/20 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs text-violet-200/80 uppercase tracking-wide">
                        Presente VIP
                      </div>
                      <div className="mt-1 text-sm font-extrabold text-white">
                        Resultado {order.vip_present_roll.roll_value}
                      </div>
                      <div className="mt-1 text-xs text-slate-200">
                        {order.vip_present_roll.reward_label}
                      </div>
                    </div>
                    <div className="rounded-xl px-3 py-2 text-sm font-black ring-1 ring-white/10 bg-black/30 text-violet-100">
                      d20 {order.vip_present_roll.roll_value}
                    </div>
                  </div>

                  {order.vip_present_roll.coupon?.code ? (
                    <div className="mt-3 rounded-xl bg-black/25 ring-1 ring-white/10 p-3">
                      <div className="text-[11px] uppercase tracking-wide text-slate-400">
                        Cupom gerado
                      </div>
                      <div className="mt-1 text-sm font-bold text-slate-100">
                        {order.vip_present_roll.coupon.code}
                      </div>
                      <div className="mt-1 text-xs text-slate-300">
                        {order.vip_present_roll.coupon.label}
                      </div>
                    </div>
                  ) : null}

                  {order.vip_present_roll.roll_value === 20 ? (
                    <div className="mt-3 rounded-xl bg-amber-400/10 ring-1 ring-cyan-300/20 p-3 text-xs text-cyan-50">
                      Solicitação do prêmio:{' '}
                      <b>
                        {order.vip_present_roll.claim_status || 'available'}
                      </b>
                      {order.vip_present_roll.claimed_at
                        ? ` • ${new Date(order.vip_present_roll.claimed_at).toLocaleString('pt-BR')}`
                        : ''}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            {Array.isArray(order?.related_upgrades) &&
            order.related_upgrades.length ? (
              <div className="mt-4 rounded-2xl bg-violet-500/10 ring-1 ring-violet-300/20 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">
                      Upgrade vinculado ao pedido
                    </div>
                    <div className="text-xs text-violet-100/80">
                      Os upgrades não aparecem mais como pedido separado. Eles
                      ficam agrupados aqui.
                    </div>
                  </div>
                  <div className="rounded-full bg-black/25 px-3 py-1 text-[11px] font-semibold text-violet-100 ring-1 ring-white/10">
                    {order.related_upgrades.length} upgrade
                    {order.related_upgrades.length === 1 ? '' : 's'}
                  </div>
                </div>
                <div className="mt-3 space-y-3">
                  {order.related_upgrades.map((up) => (
                    <div
                      key={up.id}
                      className="rounded-2xl bg-black/20 ring-1 ring-white/10 p-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-bold text-white">
                            Plano atualizado para{' '}
                            {up.plan_label || up.vip_plan_id || 'VIP'}
                          </div>
                          <div className="mt-1 text-xs text-slate-300">
                            Upgrade em {fmtDate(up.created_at)} • pedido{' '}
                            {shortId(up.id)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-extrabold text-violet-100">
                            {fmtBRL(up.total)}
                          </div>
                          <div className="mt-1 inline-flex rounded-full px-2 py-1 text-[11px] ring-1 ring-white/10 text-slate-200 bg-white/5">
                            {String(up.status || 'pending').toLowerCase() ===
                            'paid'
                              ? 'Pago'
                              : String(up.status || 'pending')}
                          </div>
                        </div>
                      </div>
                      {Array.isArray(up.order_items) &&
                      up.order_items.length ? (
                        <div className="mt-2 text-xs text-slate-300">
                          {up.order_items
                            .map(
                              (it) =>
                                `${it.name}${Number(it.qty || 1) > 1 ? ` ×${it.qty}` : ''}`
                            )
                            .join(' • ')}
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
                  <div className="text-[11px] text-slate-500">
                    Dias em aberto
                  </div>
                  <div className="text-lg font-semibold text-white">
                    {Number(order?.days_open || 0)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">Prazo</div>
                  <div
                    className={
                      order?.is_overdue
                        ? 'text-sm font-semibold text-red-200'
                        : 'text-sm font-semibold text-emerald-200'
                    }
                  >
                    {order?.is_overdue ? 'Atrasado' : 'No prazo'}
                  </div>
                </div>
              </div>
              {order?.latest_admin_note ? (
                <div className="mt-3 rounded-xl bg-black/20 ring-1 ring-white/10 p-3">
                  <div className="text-[11px] text-slate-500">
                    Última nota interna
                  </div>
                  <div className="mt-1 text-sm text-slate-100">
                    {order.latest_admin_note}
                  </div>
                </div>
              ) : null}
              <div className="mt-3">
                <div className="text-[11px] text-slate-500">
                  Nova nota interna
                </div>
                <textarea
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  className="mt-2 h-24 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-sm text-white"
                  placeholder="Ex: cliente pediu urgência, revisar escala, aguarda resposta..."
                />
                <div className="mt-2 flex justify-end">
                  <button
                    onClick={() => {
                      const note = String(noteDraft || '').trim()
                      if (!note) return
                      onAddNote?.(order, note)
                      setNoteDraft('')
                    }}
                    className="rounded-xl px-3 py-2 text-sm text-slate-200 hover:bg-white/4 ring-1 ring-white/10"
                  >
                    Salvar nota
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-white">
                    Timeline do pedido
                  </div>
                  <div className="text-xs text-slate-500">
                    {order?.timeline_source === 'order_events'
                      ? 'Histórico persistido a cada alteração feita no admin.'
                      : 'Resumo automático com base no estado atual do pedido.'}
                  </div>
                </div>
                <span className="rounded-full bg-white/[0.04] px-2 py-1 text-[11px] text-slate-300 ring-1 ring-white/10">
                  {(order?.timeline || []).length} evento
                  {(order?.timeline || []).length === 1 ? '' : 's'}
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
          setConfirmDeleteOpen(false)
          setDeleteKeyword('')
        }}
        onConfirm={() => {
          setConfirmDeleteOpen(false)
          setDeleteKeyword('')
          onDeleteOrder?.(order)
        }}
      />
    </>
  )
}

function ConfirmDeleteModal({
  open,
  order,
  keywordValue = '',
  onKeywordChange,
  onClose,
  onConfirm,
}) {
  const panelRef = useDialog(open, onClose, { busy: false })
  if (!open) return null
  const id = shortId(order?.id || order?.order_id || '')
  const total = fmtBRL(order?.total)
  const email = order?.customer_email || order?.profile?.email || ''
  const keywordOk =
    String(keywordValue || '')
      .trim()
      .toLowerCase() === 'excluir'

  return (
    <div className="fixed inset-0 z-[10010] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Confirmar ação"
        tabIndex={-1}
        className="relative w-full max-w-lg rounded-3xl bg-[#0b0f18] ring-1 ring-white/10 shadow-2xl overflow-hidden"
      >
        <div className="p-5 border-b border-white/10">
          <p className="text-sm font-semibold text-slate-100">Excluir pedido</p>
          <p className="text-xs text-slate-400 mt-1">
            Tem certeza? Essa ação é{' '}
            <span className="text-red-200 font-semibold">PERMANENTE</span> e não
            pode ser desfeita.
          </p>
        </div>

        <div className="p-5 space-y-3">
          <div className="rounded-2xl bg-white/4 ring-1 ring-white/10 p-4">
            <p className="text-xs text-slate-400">Pedido</p>
            <p className="text-sm text-slate-100 mt-1">
              <span className="font-semibold">#{id}</span>
              {email ? ` • ${email}` : ''}
              {total ? ` • ${total}` : ''}
            </p>
          </div>
          <p className="text-xs text-slate-400">
            Dica: se você só quer “sumir” com ele da operação, prefira marcar
            como <b>Cancelado</b> em vez de excluir.
          </p>
          <label className="block">
            <div className="text-xs text-slate-400 mb-1">
              Digite <span className="font-semibold text-red-200">excluir</span>{' '}
              para confirmar
            </div>
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
  )
}

function ConfirmDeleteVotingModal({ state, onClose, onConfirm }) {
  const open = !!state?.open
  const pollWrap = state?.poll
  const poll = pollWrap?.poll || pollWrap
  if (!open) return null

  const id = shortId(poll?.id || '')
  const month = poll?.month_key || '—'
  const title = poll?.title || 'Votação'
  const busy = !!state?.busy
  const err = state?.error || ''

  return (
    <div className="fixed inset-0 z-[10020] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={busy ? undefined : onClose}
      />
      <div className="relative w-full max-w-lg rounded-3xl bg-[#0b0f18] ring-1 ring-white/10 shadow-2xl overflow-hidden">
        <div className="p-5 border-b border-white/10">
          <p className="text-sm font-semibold text-slate-100">
            Excluir votação
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Tem certeza? Isso vai remover a votação do admin e também vai sumir
            para os VIPs. Essa ação é{' '}
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

          {err ? (
            <div className="rounded-xl bg-red-500/10 ring-1 ring-red-500/30 p-3 text-sm text-red-200">
              {err}
            </div>
          ) : null}
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
            {busy ? 'Excluindo...' : 'Excluir permanentemente'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ConfirmDangerModal({
  open,
  title,
  message,
  details,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  busy = false,
  error = '',
  keyword = '',
  keywordValue = '',
  onKeywordChange,
  onClose,
  onConfirm,
}) {
  const panelRef = useDialog(open, onClose, { busy: busy })
  if (!open) return null
  const needsKeyword = !!keyword
  const keywordOk =
    !needsKeyword ||
    String(keywordValue || '')
      .trim()
      .toUpperCase() === String(keyword).trim().toUpperCase()

  return (
    <div className="fixed inset-0 z-[10030] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={busy ? undefined : onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Confirmar ação"
        tabIndex={-1}
        className="relative w-full max-w-lg rounded-3xl bg-[#0b0f18] ring-1 ring-white/10 shadow-2xl overflow-hidden"
      >
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
              <div className="text-xs text-slate-400 mb-1">
                Digite{' '}
                <span className="font-semibold text-red-200">{keyword}</span>{' '}
                para confirmar
              </div>
              <input
                value={keywordValue}
                onChange={(e) => onKeywordChange?.(e.target.value)}
                className="w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-slate-100"
                placeholder={keyword}
                autoFocus
              />
            </label>
          ) : null}

          {error ? (
            <div className="rounded-xl bg-red-500/10 ring-1 ring-red-500/30 p-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}
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
  )
}

function StatusModal({
  open,
  mode,
  order,
  canManageBusiness = false,
  onClose,
  onSubmit,
}) {
  const [busy, setBusy] = React.useState(false)
  const panelRef = useDialog(open, onClose, { busy })
  const [productionStatus, setProductionStatus] = React.useState('recebido')
  const [eta, setEta] = React.useState('3 a 7 dias úteis')
  const [tracking, setTracking] = React.useState('')
  const [shippingCarrier, setShippingCarrier] = React.useState('correios')

  React.useEffect(() => {
    if (!open) return
    setProductionStatus(String(order?.production_status || 'recebido'))
    setEta(String(order?.production_eta || '3 a 7 dias úteis'))
    setTracking(String(order?.shipping_tracking || ''))
    setShippingCarrier(
      resolveTrackingCarrier({
        carrier: order?.shipping_carrier,
        trackingUrl: order?.tracking_url,
      })
    )
  }, [open, order])

  if (!open) return null

  const submit = async () => {
    if (busy) return
    const next = String(productionStatus || 'recebido').toLowerCase()
    const patch =
      mode === 'status'
        ? {
            production_status: next,
            ...(next === 'em_producao' ? { production_eta: eta } : {}),
            ...(next === 'enviado' && tracking.trim()
              ? {
                  shipping_tracking: tracking.trim(),
                  shipping_carrier: normalizeTrackingCarrier(shippingCarrier),
                }
              : {}),
          }
        : {
            shipping_tracking: tracking.trim(),
            shipping_carrier: normalizeTrackingCarrier(shippingCarrier),
            ...(tracking.trim() ? { production_status: 'enviado' } : {}),
          }
    setBusy(true)
    try {
      await onSubmit?.(patch)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[9999]">
      <div
        className="absolute inset-0 bg-[#020b10]/72"
        onClick={busy ? undefined : onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Atualizar pedido"
        tabIndex={-1}
        className="absolute left-1/2 top-1/2 w-[92vw] max-w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-[#0a0f1a] ring-1 ring-white/10 p-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-white font-semibold">
              {mode === 'status'
                ? 'Alterar status de produção'
                : 'Editar rastreio'}
            </div>
            <div className="text-xs text-slate-400">
              Pedido {shortId(order?.id)}
            </div>
          </div>
          <button
            onClick={busy ? undefined : onClose}
            className="rounded-xl px-3 py-2 text-slate-200 hover:bg-white/4 ring-1 ring-white/10"
            aria-label="Fechar"
          >
            <span className="material-icons text-[18px]">close</span>
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {mode === 'status' ? (
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
                  {canManageBusiness ? (
                    <option value="cancelado">Cancelado</option>
                  ) : null}
                  {canManageBusiness ? (
                    <option value="reembolsado">Reembolsado</option>
                  ) : null}
                </select>
              </label>

              {String(productionStatus).toLowerCase() === 'em_producao' ? (
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

              {String(productionStatus).toLowerCase() === 'enviado' ? (
                <>
                  <label className="block">
                    <div className="text-xs text-slate-400 mb-1">
                      Transportadora
                    </div>
                    <select
                      value={shippingCarrier}
                      onChange={(e) => setShippingCarrier(e.target.value)}
                      className="w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-slate-100"
                    >
                      {TRACKING_CARRIERS.map((carrier) => (
                        <option key={carrier.value} value={carrier.value}>
                          {carrier.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <div className="text-xs text-slate-400 mb-1">
                      Rastreio (opcional)
                    </div>
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
                <div className="text-xs text-slate-400 mb-1">
                  Transportadora
                </div>
                <select
                  value={shippingCarrier}
                  onChange={(e) => setShippingCarrier(e.target.value)}
                  className="w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-slate-100"
                >
                  {TRACKING_CARRIERS.map((carrier) => (
                    <option key={carrier.value} value={carrier.value}>
                      {carrier.label}
                    </option>
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
                  Dica: ao definir rastreio, o pedido pode ser marcado como{' '}
                  <span className="text-slate-300">Enviado</span>.
                </div>
              </label>
            </>
          )}
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            onClick={busy ? undefined : onClose}
            className="rounded-xl px-3 py-2 text-sm text-slate-200 hover:bg-white/4 ring-1 ring-white/10"
          >
            Cancelar
          </button>
          <button
            disabled={busy}
            onClick={submit}
            className={
              mode === 'delete'
                ? 'rounded-xl px-3 py-2 text-sm text-red-100 bg-red-500/15 hover:bg-red-500/25 ring-1 ring-red-500/30'
                : 'rounded-xl px-3 py-2 text-sm text-white bg-emerald-500/20 hover:bg-emerald-500/25 ring-1 ring-emerald-500/30'
            }
          >
            {busy ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function BulkActionModal({
  open,
  mode,
  count,
  busy = false,
  canManageBusiness = false,
  onClose,
  onSubmit,
}) {
  const panelRef = useDialog(open, onClose, { busy: busy })
  const [productionStatus, setProductionStatus] = React.useState('recebido')
  const [tracking, setTracking] = React.useState('')

  React.useEffect(() => {
    if (!open) return
    setProductionStatus('recebido')
    setTracking('')
  }, [open, mode])

  if (!open) return null

  const submit = () => {
    if (mode === 'status') {
      const patch = {
        production_status: String(productionStatus || 'recebido').toLowerCase(),
      }
      if (patch.production_status === 'enviado' && tracking.trim())
        patch.shipping_tracking = tracking.trim()
      onSubmit?.(patch)
      return
    }
    if (mode === 'refund_on') return onSubmit?.({ refund_requested: true })
    if (mode === 'refund_off') return onSubmit?.({ refund_requested: false })
    if (mode === 'delete') return onSubmit?.({ confirm_delete: true })
  }

  const title =
    mode === 'status'
      ? 'Atualizar produção em lote'
      : mode === 'refund_on'
        ? 'Marcar reembolso em lote'
        : mode === 'refund_off'
          ? 'Limpar reembolso em lote'
          : 'Excluir pedidos em lote'

  return (
    <div className="fixed inset-0 z-[10040]">
      <div
        className="absolute inset-0 bg-[#020b10]/72"
        onClick={busy ? undefined : onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Janela administrativa"
        tabIndex={-1}
        className="absolute left-1/2 top-1/2 w-[92vw] max-w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-[#0a0f1a] ring-1 ring-white/10 p-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-white font-semibold">{title}</div>
            <div className="text-xs text-slate-400">
              {count} pedido(s) selecionado(s)
            </div>
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
          {mode === 'status' ? (
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
                  {canManageBusiness ? (
                    <option value="cancelado">Cancelado</option>
                  ) : null}
                  {canManageBusiness ? (
                    <option value="reembolsado">Reembolsado</option>
                  ) : null}
                </select>
              </label>

              {String(productionStatus).toLowerCase() === 'enviado' ? (
                <label className="block">
                  <div className="text-xs text-slate-400 mb-1">
                    Rastreio comum (opcional)
                  </div>
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
            <div
              className={
                mode === 'delete'
                  ? 'rounded-2xl bg-red-500/10 ring-1 ring-red-500/20 p-4 text-sm text-red-100'
                  : 'rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-4 text-sm text-slate-300'
              }
            >
              {mode === 'refund_on'
                ? 'Isso vai marcar os pedidos selecionados como reembolso solicitado.'
                : mode === 'refund_off'
                  ? 'Isso vai remover a marcação de reembolso solicitado dos pedidos selecionados.'
                  : 'Tem certeza? Essa ação é permanente e vai excluir os pedidos selecionados do sistema.'}
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
            {busy ? 'Aplicando...' : 'Aplicar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function CloseVotingModal({ state, onClose, onConfirm, onSelectWinner }) {
  const open = !!state?.open
  const pollPack = state?.poll
  const poll = pollPack?.poll
  const options = pollPack?.options || []
  const winnerId = state?.winnerId
  const busy = !!state?.busy
  const error = state?.error

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[10030]">
      <div
        className="absolute inset-0 bg-black/70"
        onClick={() => (!busy ? onClose?.() : null)}
      />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-xl rounded-2xl bg-slate-950 ring-1 ring-white/10 shadow-2xl">
          <div className="p-5 border-b border-white/10 flex items-start justify-between gap-3">
            <div>
              <div className="text-white text-lg font-extrabold">
                Encerrar votação
              </div>
              <div className="mt-1 text-sm text-slate-400">
                Selecione o vencedor. Isso vai aparecer para todos os VIPs como
                “votação encerrada”.
              </div>
              <div className="mt-2 text-xs text-slate-500">
                {poll?.month_key || '—'} • {poll?.title || 'Votação'}
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
            {error ? (
              <div className="mb-3 rounded-xl bg-red-500/10 ring-1 ring-red-400/20 p-3 text-sm text-red-200">
                {error}
              </div>
            ) : null}

            <div className="space-y-2">
              {options.map((o) => (
                <label
                  key={o.id}
                  className={`flex items-center gap-3 rounded-xl p-3 ring-1 transition cursor-pointer ${
                    String(winnerId) === String(o.id)
                      ? 'bg-emerald-500/10 ring-emerald-400/25'
                      : 'bg-white/[0.03] ring-white/10 hover:bg-white/[0.06]'
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
                    <div className="text-slate-100 font-semibold truncate">
                      {o.title}
                    </div>
                    {o.description ? (
                      <div className="text-xs text-slate-500 line-clamp-2">
                        {o.description}
                      </div>
                    ) : null}
                  </div>
                  <div className="ml-auto text-xs text-slate-400 whitespace-nowrap">
                    {o.votes || 0} votos
                  </div>
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
                {busy ? 'Encerrando…' : 'Encerrar e publicar vencedor'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StartVotingModal({
  state,
  imageLibrary,
  imageLibraryLoading,
  imageLibraryError,
  onClose,
  onChange,
  onConfirm,
}) {
  const open = !!state?.open
  const busy = !!state?.busy
  const error = state?.error
  const images = Array.isArray(imageLibrary) ? imageLibrary : []
  const data = state?.data || { month_key: '', title: '', options: [] }
  const opts = Array.isArray(data.options) ? data.options : []

  if (!open) return null

  const setField = (k, v) => onChange?.({ ...data, [k]: v })
  const setOpt = (idx, patch) => {
    const next = opts.map((o, i) => (i === idx ? { ...o, ...patch } : o))
    setField('options', next)
  }
  const addOpt = () =>
    setField('options', [
      ...opts,
      { title: '', description: '', image_asset_id: '' },
    ])
  const delOpt = (idx) =>
    setField(
      'options',
      opts.filter((_, i) => i !== idx)
    )

  return (
    <div className="fixed inset-0 z-[10040]">
      <div
        className="absolute inset-0 bg-black/70"
        onClick={() => (!busy ? onClose?.() : null)}
      />
      {/* Allow scrolling when modal content is taller than the viewport (mobile/small screens). */}
      <div className="absolute inset-0 flex items-start justify-center p-4 overflow-y-auto">
        <div className="w-full max-w-2xl rounded-2xl bg-slate-950 ring-1 ring-white/10 shadow-2xl my-6 max-h-[90vh] flex flex-col">
          <div className="p-5 border-b border-white/10 flex items-start justify-between gap-3 flex-none">
            <div>
              <div className="text-white text-lg font-extrabold">
                Iniciar nova votação
              </div>
              <div className="mt-1 text-sm text-slate-400">
                Crie a votação que vai aparecer para todos os VIPs.
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

          <div className="p-5 overflow-y-auto">
            {error ? (
              <div className="mb-3 rounded-xl bg-red-500/10 ring-1 ring-red-400/20 p-3 text-sm text-red-200">
                {error}
              </div>
            ) : null}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="block">
                <div className="text-xs text-slate-400 mb-1">Mês (YYYY-MM)</div>
                <input
                  value={data.month_key}
                  onChange={(e) => setField('month_key', e.target.value)}
                  className="w-full rounded-xl bg-black/30 ring-1 ring-white/10 px-3 py-2 text-slate-100"
                  placeholder="2026-03"
                  disabled={busy}
                />
              </label>
              <label className="block md:col-span-2">
                <div className="text-xs text-slate-400 mb-1">
                  Pergunta / Título
                </div>
                <input
                  value={data.title}
                  onChange={(e) => setField('title', e.target.value)}
                  className="w-full rounded-xl bg-black/30 ring-1 ring-white/10 px-3 py-2 text-slate-100"
                  placeholder="Qual tema você quer no próximo mês?"
                  disabled={busy}
                />
              </label>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div className="text-xs uppercase tracking-wide text-slate-400">
                Opções
              </div>
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
                <div className="rounded-xl bg-red-500/10 ring-1 ring-red-400/20 p-3 text-sm text-red-200">
                  {imageLibraryError}
                </div>
              ) : null}
              {!imageLibraryLoading && !imageLibraryError && !images.length ? (
                <div className="rounded-xl bg-cyan-500/10 ring-1 ring-cyan-400/20 p-3 text-sm text-amber-100">
                  Nenhuma imagem foi encontrada na biblioteca do Supabase.
                  Cadastre as imagens na tabela <b>vip_theme_image_library</b>{' '}
                  para usá-las nas votações.
                </div>
              ) : null}
            </div>

            <div className="mt-2 space-y-2">
              {opts.map((o, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-slate-100 font-semibold">
                      Opção {idx + 1}
                    </div>
                    <button
                      onClick={() => (!busy ? delOpt(idx) : null)}
                      className="rounded-xl px-3 py-2 text-xs text-slate-200 hover:bg-white/4 ring-1 ring-white/10 disabled:opacity-50"
                      disabled={busy || opts.length <= 2}
                      title={
                        opts.length <= 2 ? 'Mínimo de 2 opções' : 'Remover'
                      }
                    >
                      Remover
                    </button>
                  </div>
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <label className="block">
                      <div className="text-xs text-slate-400 mb-1">Título</div>
                      <input
                        value={o.title || ''}
                        onChange={(e) => setOpt(idx, { title: e.target.value })}
                        className="w-full rounded-xl bg-black/30 ring-1 ring-white/10 px-3 py-2 text-slate-100"
                        placeholder="Ex: Vampiros & Caçadores"
                        disabled={busy}
                      />
                    </label>
                    <label className="block">
                      <div className="text-xs text-slate-400 mb-1">
                        Imagem da biblioteca
                      </div>
                      <select
                        value={o.image_asset_id || ''}
                        onChange={(e) =>
                          setOpt(idx, { image_asset_id: e.target.value })
                        }
                        className="w-full rounded-xl bg-black/30 ring-1 ring-white/10 px-3 py-2 text-slate-100"
                        disabled={busy || imageLibraryLoading || !images.length}
                      >
                        <option value="">Sem imagem</option>
                        {images.map((img) => (
                          <option key={img.id} value={img.id}>
                            {img.title}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block md:col-span-2">
                      <div className="text-xs text-slate-400 mb-1">
                        Descrição (opcional)
                      </div>
                      <input
                        value={o.description || ''}
                        onChange={(e) =>
                          setOpt(idx, { description: e.target.value })
                        }
                        className="w-full rounded-xl bg-black/30 ring-1 ring-white/10 px-3 py-2 text-slate-100"
                        placeholder="Noite, maldições e caçadas."
                        disabled={busy}
                      />
                    </label>
                  </div>

                  {(() => {
                    const selectedImage = images.find(
                      (img) => String(img.id) === String(o.image_asset_id || '')
                    )
                    return selectedImage ? (
                      <div className="mt-3 flex items-center gap-3 rounded-xl bg-black/20 ring-1 ring-white/10 p-2">
                        <img
                          src={selectedImage.image_url}
                          alt={selectedImage.title}
                          className="h-16 w-16 rounded-xl object-cover bg-black/30 ring-1 ring-white/10"
                          loading="lazy"
                        />
                        <div className="min-w-0">
                          <div className="text-xs text-slate-500">
                            Imagem selecionada
                          </div>
                          <div className="text-sm font-semibold text-slate-100 truncate">
                            {selectedImage.title}
                          </div>
                        </div>
                      </div>
                    ) : null
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
                {busy ? 'Criando…' : 'Iniciar votação'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function CreateClientModal({
  open,
  accessToken,
  onClose,
  onCreated,
  showToast,
}) {
  const emptyForm = React.useMemo(
    () => ({
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
    }),
    []
  )
  const [form, setForm] = React.useState(emptyForm)
  const [busy, setBusy] = React.useState(false)
  const panelRef = useDialog(open, onClose, { busy })
  const [error, setError] = React.useState('')
  const [created, setCreated] = React.useState(null)
  const [cepLoading, setCepLoading] = React.useState(false)
  const [cepError, setCepError] = React.useState('')

  React.useEffect(() => {
    if (!open) return
    setForm(emptyForm)
    setBusy(false)
    setError('')
    setCreated(null)
    setCepLoading(false)
    setCepError('')
  }, [open, emptyForm])

  React.useEffect(() => {
    if (!open) return
    const cepDigits = onlyDigits(form.zip)
    if (cepDigits.length !== 8) {
      setCepError('')
      return
    }
    let active = true
    setCepLoading(true)
    setCepError('')
    fetchAddressFromCep(cepDigits)
      .then((resp) => {
        if (!active) return
        if (!resp?.ok) {
          setCepError(resp?.error || 'CEP não encontrado.')
          return
        }
        setForm((prev) => ({
          ...prev,
          address_line1: resp.data.street || prev.address_line1,
          neighborhood: resp.data.neighborhood || prev.neighborhood,
          city: resp.data.city || prev.city,
          state: resp.data.uf || prev.state,
        }))
      })
      .catch(() => active && setCepError('Erro ao consultar CEP.'))
      .finally(() => active && setCepLoading(false))
    return () => {
      active = false
    }
  }, [open, form.zip])

  function updateField(key, value) {
    let nextValue = value
    if (key === 'cpf') nextValue = formatCpfInput(value)
    if (key === 'phone') nextValue = formatPhoneInput(value)
    if (key === 'zip') nextValue = formatCepInput(value)
    if (key === 'state')
      nextValue = String(value || '')
        .toUpperCase()
        .slice(0, 2)
    setForm((prev) => ({ ...prev, [key]: nextValue }))
  }

  async function handleCreate() {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const resp = await fetch('/api/admin?action=create-client', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(form),
      })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok)
        throw new Error(data?.error || 'Não foi possível cadastrar o cliente.')
      setCreated(data?.client || null)
      showToast?.('Cliente cadastrado com sucesso.')
      onCreated?.(data?.client || null)
    } catch (e) {
      setError(e?.message || 'Erro ao cadastrar cliente.')
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null
  return (
    <div className="fixed inset-0 z-[10001]">
      <div
        className="absolute inset-0 bg-[#020b10]/80"
        onClick={busy ? undefined : onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Janela administrativa"
        tabIndex={-1}
        className="absolute inset-x-0 top-4 mx-auto w-[min(760px,calc(100vw-24px))] max-h-[92vh] overflow-y-auto rounded-[28px] bg-[#0a0f1a] ring-1 ring-white/10 p-4 sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-2xl font-bold text-white">
              Cadastrar cliente
            </div>
            <div className="text-sm text-slate-400">
              Crie uma conta de cliente para usar em pedidos e acompanhamento no
              site.
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded-xl px-3 py-2 text-slate-200 hover:bg-white/4 ring-1 ring-white/10 disabled:opacity-60"
          >
            Fechar
          </button>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl bg-red-500/10 ring-1 ring-red-500/20 px-4 py-3 text-red-100">
            {error}
          </div>
        ) : null}
        {created ? (
          <div className="mt-4 rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-400/20 px-4 py-3 text-emerald-100">
            <div className="font-bold">Cliente cadastrado.</div>
            <div className="mt-1 text-sm">
              E-mail: <b>{created.email}</b> • Senha inicial:{' '}
              <b>CPF do cliente</b>
            </div>
          </div>
        ) : null}

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-sm text-slate-300">
            Nome completo
            <input
              value={form.full_name}
              onChange={(e) => updateField('full_name', e.target.value)}
              className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white"
            />
          </label>
          <label className="text-sm text-slate-300">
            E-mail
            <input
              type="email"
              value={form.email}
              onChange={(e) => updateField('email', e.target.value)}
              className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white"
            />
          </label>
          <label className="text-sm text-slate-300">
            CPF
            <input
              value={form.cpf}
              onChange={(e) => updateField('cpf', e.target.value)}
              placeholder="000.000.000-00"
              className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white"
            />
            <span className="mt-1 block text-xs text-slate-500">
              A senha inicial será o CPF
            </span>
          </label>
          <label className="text-sm text-slate-300">
            Telefone
            <input
              value={form.phone}
              onChange={(e) => updateField('phone', e.target.value)}
              placeholder="(00) 00000-0000"
              className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white"
            />
          </label>
          <label className="text-sm text-slate-300 md:col-span-2">
            Endereço
            <input
              value={form.address_line1}
              onChange={(e) => updateField('address_line1', e.target.value)}
              className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white"
            />
          </label>
          <label className="text-sm text-slate-300">
            Número
            <input
              value={form.address_number}
              onChange={(e) => updateField('address_number', e.target.value)}
              className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white"
            />
          </label>
          <label className="text-sm text-slate-300">
            Complemento
            <input
              value={form.address_line2}
              onChange={(e) => updateField('address_line2', e.target.value)}
              className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white"
            />
          </label>
          <label className="text-sm text-slate-300">
            Bairro
            <input
              value={form.neighborhood}
              onChange={(e) => updateField('neighborhood', e.target.value)}
              className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white"
            />
          </label>
          <label className="text-sm text-slate-300">
            Cidade
            <input
              value={form.city}
              onChange={(e) => updateField('city', e.target.value)}
              className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white"
            />
          </label>
          <label className="text-sm text-slate-300">
            UF
            <input
              value={form.state}
              onChange={(e) => updateField('state', e.target.value)}
              maxLength={2}
              className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white uppercase"
            />
          </label>
          <label className="text-sm text-slate-300">
            CEP
            <input
              value={form.zip}
              onChange={(e) => updateField('zip', e.target.value)}
              placeholder="00000-000"
              className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white"
            />
            {cepLoading ? (
              <span className="mt-1 block text-xs text-cyan-200">
                Buscando endereço…
              </span>
            ) : null}
            {cepError ? (
              <span className="mt-1 block text-xs text-red-200">
                {cepError}
              </span>
            ) : null}
          </label>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-white/10 pt-4">
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded-xl px-4 py-2 text-sm text-slate-200 hover:bg-white/4 ring-1 ring-white/10 disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            onClick={handleCreate}
            disabled={busy}
            className="rounded-xl px-4 py-2 text-sm font-semibold bg-emerald-400 text-black ring-4 ring-emerald-400/20 disabled:opacity-60 disabled:cursor-wait"
          >
            {busy ? 'Cadastrando…' : 'Cadastrar'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminOrdersPage({
  user,
  accessToken,
  isAdmin,
  adminLevel = 0,
  adminRole = '',
  isAdminLoading = false,
  onNavigateHome,
  onRequireLogin,
}) {
  const { loading: authLoading } = useAuth()
  const normalizedAdminLevel = normalizeAdminLevel(adminLevel)
  const canOperate = normalizedAdminLevel >= ADMIN_LEVEL.OPERATOR
  const canManageBusiness = normalizedAdminLevel >= ADMIN_LEVEL.MANAGER
  const canManageAdmins = normalizedAdminLevel >= ADMIN_LEVEL.OWNER
  const [sectionRevision, setSectionRevision] = React.useState(0)
  const [section, setSection] = React.useState(() => {
    try {
      return sessionStorage.getItem('cc_admin_section') || 'dashboard'
    } catch {
      return 'dashboard'
    }
  })
  React.useEffect(() => {
    try {
      sessionStorage.setItem('cc_admin_section', section)
    } catch {}
  }, [section])

  const [orders, setOrders] = React.useState([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState('')

  const [q, setQ] = React.useState('')
  const [qInput, setQInput] = React.useState('')
  const [filterPay, setFilterPay] = React.useState('all')
  const [filterProd, setFilterProd] = React.useState('all')
  const [filterType, setFilterType] = React.useState('all')
  const [filterDateFrom, setFilterDateFrom] = React.useState(() =>
    toDateInputValue(new Date(Date.now() - 29 * 86400000))
  )
  const [filterDateTo, setFilterDateTo] = React.useState(() =>
    toDateInputValue(new Date())
  )
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(25)
  const [pagination, setPagination] = React.useState({
    page: 1,
    pageSize: 25,
    totalCount: 0,
    totalPages: 1,
  })
  const [summary, setSummary] = React.useState({
    total: 0,
    paid: 0,
    pending: 0,
    revenue: 0,
    refundReq: 0,
    vipCount: 0,
    overdueCount: 0,
    finance: {
      paidToday: 0,
      paidMonth: 0,
      upgradeRevenue: 0,
      averageTicket: 0,
    },
    bottlenecks: {
      paidWaitingProduction: 0,
      readyWithoutTracking: 0,
      shippedInTransit: 0,
      refundRequested: 0,
      staleOrders: 0,
      overdueCount: 0,
      awaitingShipment: 0,
    },
  })
  const [selectedOrderIds, setSelectedOrderIds] = React.useState([])
  const [bulkBusy, setBulkBusy] = React.useState(false)
  const [bulkModal, setBulkModal] = React.useState({
    open: false,
    mode: 'status',
  })

  const [toast, setToast] = React.useState('')
  const toastTimerRef = React.useRef(null)
  const ordersRequestRef = React.useRef(null)
  const clientsRequestRef = React.useRef(null)
  const [resendEmailBusyId, setResendEmailBusyId] = React.useState(null)
  const [details, setDetails] = React.useState({ open: false, orderId: null })
  const [actionModal, setActionModal] = React.useState({
    open: false,
    mode: 'status',
    orderId: null,
  })

  const [vipPolls, setVipPolls] = React.useState([])
  const [vipPollsLoading, setVipPollsLoading] = React.useState(false)
  const [vipPollsError, setVipPollsError] = React.useState('')
  const [vipVotingImages, setVipVotingImages] = React.useState([])
  const [vipVotingImagesLoading, setVipVotingImagesLoading] =
    React.useState(false)
  const [vipVotingImagesError, setVipVotingImagesError] = React.useState('')
  const [vipControl, setVipControl] = React.useState({
    active_cycle_key: '',
    cycles: [],
    library: [],
    setup_required: false,
    cycle_column_available: true,
    vip_summary: { activeSubscribers: 0, byCycle: [] },
  })
  const [vipControlLoading, setVipControlLoading] = React.useState(false)
  const [vipControlError, setVipControlError] = React.useState('')
  const [vipCycleEditor, setVipCycleEditor] = React.useState({
    cycle_key: '',
    selected_ids: [],
    activate: false,
  })
  const [vipCycleBusy, setVipCycleBusy] = React.useState(false)
  const [vipMiniForm, setVipMiniForm] = React.useState({
    title: '',
    description: '',
    cycle_key: '',
    item_type: 'miniature',
    sort_order: 1000,
  })
  const [vipMiniFiles, setVipMiniFiles] = React.useState([])
  const [vipMiniBusy, setVipMiniBusy] = React.useState(false)
  const [vipMiniError, setVipMiniError] = React.useState('')
  const [vipLibrarySearch, setVipLibrarySearch] = React.useState('')
  const [vipLibraryFilter, setVipLibraryFilter] = React.useState('all')

  const [gameCouponLoading, setGameCouponLoading] = React.useState(false)
  const [gameCouponError, setGameCouponError] = React.useState('')
  const [gameCouponForm, setGameCouponForm] = React.useState({
    discount_type: 'percent',
    discount_value: 5,
    min_order_value: 0,
    label: '',
  })
  const [currentGameCoupon, setCurrentGameCoupon] = React.useState(null)
  const [gameCouponMetricsLoading, setGameCouponMetricsLoading] =
    React.useState(false)
  const [gameCouponMetricsError, setGameCouponMetricsError] = React.useState('')
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
  })

  const [closeVote, setCloseVote] = React.useState({
    open: false,
    poll: null,
    winnerId: null,
    busy: false,
    error: '',
  })
  const [startVote, setStartVote] = React.useState({
    open: false,
    data: null,
    busy: false,
    error: '',
  })
  const [deleteVote, setDeleteVote] = React.useState({
    open: false,
    poll: null,
    busy: false,
    error: '',
  })
  const [newOrderOpen, setNewOrderOpen] = React.useState(false)
  const [clients, setClients] = React.useState([])
  const [clientsLoading, setClientsLoading] = React.useState(false)
  const [clientsError, setClientsError] = React.useState('')
  const [clientsQ, setClientsQ] = React.useState('')
  const [clientEditor, setClientEditor] = React.useState(null)
  const [clientVipPlans, setClientVipPlans] = React.useState([])
  const [clientVipBusy, setClientVipBusy] = React.useState(false)
  const [newClientOpen, setNewClientOpen] = React.useState(false)
  const [adminQuickSearch, setAdminQuickSearch] = React.useState('')
  const [confirmAction, setConfirmAction] = React.useState({
    open: false,
    type: '',
    payload: null,
    busy: false,
    error: '',
    keywordValue: '',
  })

  const showToast = React.useCallback((msg) => {
    setToast(msg)
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => setToast(''), 4500)
  }, [])

  React.useEffect(
    () => () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
      ordersRequestRef.current?.abort()
      clientsRequestRef.current?.abort()
    },
    []
  )

  React.useEffect(() => {
    const businessSections = new Set([
      'finance',
      'clients',
      'products',
      'reviews',
      'coupons',
      'affiliates',
      'vip',
    ])
    const knownSections = new Set([
      'dashboard',
      'orders',
      'production',
      'finance',
      'clients',
      'products',
      'reviews',
      'coupons',
      'affiliates',
      'vip',
      'admins',
    ])
    if (!knownSections.has(section)) setSection('dashboard')
    if (businessSections.has(section) && !canManageBusiness)
      setSection('dashboard')
    if (section === 'admins' && !canManageAdmins) setSection('dashboard')
  }, [section, canManageBusiness, canManageAdmins])

  React.useEffect(() => {
    // Evita abrir login durante a restauração de sessão após refresh.
    if (!user && !authLoading)
      onRequireLogin?.('Faça login como admin para acessar o painel.')
  }, [user, authLoading, onRequireLogin])

  const fetchOrders = React.useCallback(async () => {
    if (!accessToken || !isAdmin) return
    ordersRequestRef.current?.abort()
    const controller = new AbortController()
    ordersRequestRef.current = controller
    if (filterDateFrom && filterDateTo && filterDateFrom > filterDateTo) {
      setError('A data inicial não pode ser posterior à data final.')
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({
        action: 'orders',
        page: String(page),
        page_size: String(pageSize),
        q: String(q || ''),
        pay: String(filterPay || 'all'),
        prod: String(filterProd || 'all'),
        type: String(filterType || 'all'),
        date_from: String(filterDateFrom || ''),
        date_to: String(filterDateTo || ''),
        _: String(Date.now()),
      })
      const resp = await fetch(`/api/admin?${params.toString()}`, {
        signal: controller.signal,
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const data = await resp.json().catch(() => ({}))
      if (controller.signal.aborted) return
      if (!resp.ok)
        throw new Error(data?.error || 'Não foi possível carregar pedidos.')
      setOrders(Array.isArray(data.orders) ? data.orders : [])
      setPagination({
        page: Number(data?.pagination?.page || page),
        pageSize: Number(data?.pagination?.page_size || pageSize),
        totalCount: Number(data?.pagination?.total_count || 0),
        totalPages: Number(data?.pagination?.total_pages || 1),
      })
      setSummary((prev) => ({ ...prev, ...(data?.summary || {}) }))
    } catch (e) {
      if (controller.signal.aborted) return
      setError(e?.message || 'Erro ao carregar pedidos.')
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [
    accessToken,
    isAdmin,
    page,
    pageSize,
    q,
    filterPay,
    filterProd,
    filterType,
    filterDateFrom,
    filterDateTo,
  ])

  const fetchClients = React.useCallback(async () => {
    if (!accessToken || !isAdmin) return
    clientsRequestRef.current?.abort()
    const controller = new AbortController()
    clientsRequestRef.current = controller
    setClientsLoading(true)
    setClientsError('')
    try {
      const params = new URLSearchParams({
        action: 'clients',
        q: String(clientsQ || ''),
      })
      const resp = await fetch(`/api/admin?${params.toString()}`, {
        signal: controller.signal,
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const data = await resp.json().catch(() => ({}))
      if (controller.signal.aborted) return
      if (!resp.ok)
        throw new Error(data?.error || 'Não foi possível carregar clientes.')
      setClients(Array.isArray(data?.clients) ? data.clients : [])
    } catch (e) {
      if (controller.signal.aborted) return
      setClientsError(e?.message || 'Erro ao carregar clientes.')
    } finally {
      if (!controller.signal.aborted) setClientsLoading(false)
    }
  }, [accessToken, isAdmin, clientsQ])

  const fetchVipVoting = React.useCallback(async () => {
    if (!accessToken) return
    setVipPollsLoading(true)
    setVipPollsError('')
    try {
      const resp = await fetch('/api/admin?action=vip-voting', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok)
        throw new Error(
          data?.error || 'Não foi possível carregar a votação VIP.'
        )
      setVipPolls(Array.isArray(data.polls) ? data.polls : [])
    } catch (e) {
      setVipPollsError(e?.message || 'Erro ao carregar votação VIP.')
    } finally {
      setVipPollsLoading(false)
    }
  }, [accessToken])

  const fetchVipVotingImages = React.useCallback(async () => {
    if (!accessToken) return
    setVipVotingImagesLoading(true)
    setVipVotingImagesError('')
    try {
      const resp = await fetch('/api/admin?action=vip-voting-image-library', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok)
        throw new Error(
          data?.error ||
            'Não foi possível carregar a biblioteca de imagens da votação.'
        )
      setVipVotingImages(Array.isArray(data?.items) ? data.items : [])
      if (data?.setup_required) {
        setVipVotingImagesError(
          data?.message || 'Cadastre a biblioteca de imagens no Supabase.'
        )
      }
    } catch (e) {
      setVipVotingImages([])
      setVipVotingImagesError(
        e?.message || 'Erro ao carregar a biblioteca de imagens da votação.'
      )
    } finally {
      setVipVotingImagesLoading(false)
    }
  }, [accessToken])

  const nextMonthKey = React.useCallback(() => {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() + 1)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    return `${y}-${m}`
  }, [])

  const fetchVipControl = React.useCallback(async () => {
    if (!accessToken) return
    setVipControlLoading(true)
    setVipControlError('')
    try {
      const resp = await fetch('/api/admin?action=vip-control', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok)
        throw new Error(
          data?.error || 'Não foi possível carregar o controle VIP.'
        )
      const nextState = {
        active_cycle_key: String(data?.active_cycle_key || ''),
        cycles: Array.isArray(data?.cycles) ? data.cycles : [],
        library: Array.isArray(data?.library) ? data.library : [],
        setup_required: !!data?.setup_required,
        cycle_column_available: data?.cycle_column_available !== false,
        vip_summary: data?.vip_summary || { activeSubscribers: 0, byCycle: [] },
      }
      setVipControl(nextState)
      setVipCycleEditor((prev) => {
        const cycleKey =
          prev?.cycle_key || nextState.active_cycle_key || nextMonthKey()
        return {
          ...prev,
          cycle_key: cycleKey,
          selected_ids: prev?.cycle_key
            ? prev.selected_ids || []
            : nextState.library
                .filter((item) => String(item.cycle_key) === cycleKey)
                .map((item) => String(item.id)),
          activate: prev?.activate === true,
        }
      })
      if (data?.setup_required) {
        setVipControlError(
          'Rode o SQL de controle VIP antes de ativar ciclos pela tela.'
        )
      } else if (data?.cycle_column_available === false) {
        setVipControlError(
          'A coluna cycle_key ainda não existe em vip_mini_options. Rode o SQL de atualização.'
        )
      }
    } catch (e) {
      setVipControl((prev) => ({ ...prev, cycles: [], library: [] }))
      setVipControlError(e?.message || 'Erro ao carregar controle VIP.')
    } finally {
      setVipControlLoading(false)
    }
  }, [accessToken, nextMonthKey])

  const fetchGameCoupon = React.useCallback(async () => {
    if (!accessToken) return
    setGameCouponLoading(true)
    setGameCouponError('')
    try {
      const resp = await fetch('/api/admin?action=game-coupon', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok)
        throw new Error(
          data?.error || 'Não foi possível carregar o cupom do jogo.'
        )
      const config = data?.config || null
      setCurrentGameCoupon(config)
      if (config) {
        setGameCouponForm({
          discount_type: String(config.discount_type || 'percent'),
          discount_value: Number(config.discount_value || 0),
          min_order_value: Number(config.min_order_value || 0),
          label: String(config.label || ''),
        })
      }
    } catch (e) {
      setGameCouponError(e?.message || 'Erro ao carregar o cupom do jogo.')
    } finally {
      setGameCouponLoading(false)
    }
  }, [accessToken])

  const fetchGameCouponMetrics = React.useCallback(async () => {
    if (!accessToken) return
    setGameCouponMetricsLoading(true)
    setGameCouponMetricsError('')
    try {
      const resp = await fetch('/api/admin?action=game-coupon-metrics', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok)
        throw new Error(
          data?.error || 'Não foi possível carregar as métricas de cupons.'
        )
      setGameCouponMetrics((prev) => ({ ...prev, ...(data?.metrics || {}) }))
    } catch (e) {
      setGameCouponMetricsError(
        e?.message || 'Erro ao carregar métricas de cupons.'
      )
    } finally {
      setGameCouponMetricsLoading(false)
    }
  }, [accessToken])

  async function startVipVoting(payload) {
    if (!accessToken) return
    try {
      setStartVote((s) => ({ ...s, busy: true, error: '' }))
      const resp = await fetch('/api/admin?action=vip-start-voting', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok)
        throw new Error(data?.error || 'Não foi possível iniciar a votação.')
      showToast('✅ Votação criada e aberta!')
      setStartVote({ open: false, data: null, busy: false, error: '' })
      await fetchVipVoting()
    } catch (e) {
      setStartVote((s) => ({
        ...s,
        busy: false,
        error: e?.message || 'Falha ao criar votação.',
      }))
    }
  }

  async function closeVipVoting(poll, winner_option_id) {
    // API returns items in the shape { poll: {...}, options: [...] }.
    // Accept either a raw poll row (with id) or the wrapped object.
    const pollId = poll?.id || poll?.poll?.id
    if (!accessToken || !pollId || !winner_option_id) return
    try {
      setCloseVote((s) => ({ ...s, busy: true, error: '' }))
      const resp = await fetch('/api/admin?action=vip-close-voting', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ poll_id: pollId, winner_option_id }),
      })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok)
        throw new Error(data?.error || 'Não foi possível encerrar a votação.')
      showToast('✅ Votação encerrada!')
      setCloseVote({
        open: false,
        poll: null,
        winnerId: null,
        busy: false,
        error: '',
      })
      await fetchVipVoting()
    } catch (e) {
      setCloseVote((s) => ({
        ...s,
        busy: false,
        error: e?.message || 'Falha ao encerrar votação.',
      }))
    }
  }

  async function deleteVipVoting(poll) {
    const pollId = poll?.id || poll?.poll?.id
    if (!accessToken || !pollId) return
    try {
      setDeleteVote((s) => ({ ...s, busy: true, error: '' }))
      const resp = await fetch('/api/admin?action=vip-delete-voting', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ poll_id: pollId }),
      })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok)
        throw new Error(data?.error || 'Não foi possível excluir a votação.')
      showToast('🗑️ Votação excluída!')
      setVipPolls((prev) =>
        (prev || []).filter(
          (x) => String(x?.poll?.id || x?.id) !== String(pollId)
        )
      )
      setDeleteVote({ open: false, poll: null, busy: false, error: '' })
      await fetchVipVoting()
    } catch (e) {
      setDeleteVote((s) => ({
        ...s,
        busy: false,
        error: e?.message || 'Falha ao excluir votação.',
      }))
    }
  }

  React.useEffect(() => {
    setPage(1)
  }, [
    q,
    filterPay,
    filterProd,
    filterType,
    filterDateFrom,
    filterDateTo,
    pageSize,
  ])

  React.useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  React.useEffect(() => {
    setSelectedOrderIds([])
  }, [
    orders,
    page,
    filterPay,
    filterProd,
    filterType,
    filterDateFrom,
    filterDateTo,
    q,
  ])

  React.useEffect(() => {
    if (section === 'vip') {
      fetchVipVoting()
      fetchVipVotingImages()
      fetchVipControl()
    }
    if (section === 'coupons') {
      fetchGameCoupon()
      fetchGameCouponMetrics()
    }
  }, [
    section,
    fetchVipVoting,
    fetchVipVotingImages,
    fetchVipControl,
    fetchGameCoupon,
    fetchGameCouponMetrics,
  ])

  React.useEffect(() => {
    if (section !== 'clients' || !accessToken) return
    const timer = window.setTimeout(() => {
      fetchClients()
    }, 250)
    return () => window.clearTimeout(timer)
  }, [section, accessToken, clientsQ, fetchClients])

  React.useEffect(() => {
    if (section !== 'clients') return
    let active = true
    fetch('/api/vip-plans')
      .then((resp) =>
        resp
          .json()
          .catch(() => ({}))
          .then((data) => ({ ok: resp.ok, data }))
      )
      .then(({ ok, data }) => {
        if (!active || !ok) return
        setClientVipPlans(Array.isArray(data?.plans) ? data.plans : [])
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [section])

  React.useEffect(() => {
    setClientEditor((current) => {
      if (!current?.id) return current
      const next = (clients || []).find(
        (item) => String(item?.id) === String(current.id)
      )
      return next || current
    })
  }, [clients])

  async function uploadVipMiniImage(file, index = 0) {
    if (!file) return ''
    if (!String(file.type || '').startsWith('image/'))
      throw new Error('Envie apenas arquivos de imagem.')
    if (Number(file.size || 0) > 10 * 1024 * 1024)
      throw new Error('Cada imagem deve ter no máximo 10 MB.')
    const ext =
      String(file.name || 'jpg')
        .split('.')
        .pop()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '') || 'jpg'
    const path = `vip-miniatures/${Date.now()}-${index}-${Math.random().toString(36).slice(2, 9)}.${ext}`
    const { error } = await supabase.storage
      .from('product-images')
      .upload(path, file, {
        cacheControl: '31536000',
        upsert: false,
        contentType: file.type || 'image/jpeg',
      })
    if (error)
      throw new Error(error.message || 'Não foi possível enviar a imagem.')
    const { data } = supabase.storage.from('product-images').getPublicUrl(path)
    const url = String(data?.publicUrl || '')
    if (!url) throw new Error('O Supabase não retornou a URL da imagem.')
    return url
  }

  async function createVipMiniature(event) {
    event?.preventDefault?.()
    if (!accessToken || vipMiniBusy) return
    try {
      setVipMiniBusy(true)
      setVipMiniError('')
      const cycleKey = String(vipMiniForm.cycle_key || '').trim()
      if (!/^\d{4}-\d{2}$/.test(cycleKey))
        throw new Error('Informe o ciclo no formato YYYY-MM.')
      if (!String(vipMiniForm.title || '').trim())
        throw new Error('Informe o nome da miniatura.')
      if (!vipMiniFiles.length)
        throw new Error('Selecione pelo menos uma imagem.')
      const urls = []
      for (let i = 0; i < vipMiniFiles.length; i += 1)
        urls.push(await uploadVipMiniImage(vipMiniFiles[i], i))
      const resp = await fetch('/api/admin?action=vip-create-option', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          ...vipMiniForm,
          title: String(vipMiniForm.title).trim(),
          cycle_key: cycleKey,
          image_url: urls[0],
          gallery_images: urls,
        }),
      })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok)
        throw new Error(
          data?.error || 'Não foi possível cadastrar a miniatura VIP.'
        )
      setVipMiniForm((prev) => ({
        ...prev,
        title: '',
        description: '',
        sort_order: Number(prev.sort_order || 1000) + 1,
      }))
      setVipMiniFiles([])
      const input = document.getElementById('vip-mini-images-input')
      if (input) input.value = ''
      showToast('✅ Miniatura VIP cadastrada!')
      await fetchVipControl()
    } catch (e) {
      setVipMiniError(e?.message || 'Falha ao cadastrar miniatura VIP.')
    } finally {
      setVipMiniBusy(false)
    }
  }

  async function deleteVipMiniature(item) {
    if (!accessToken || !item?.id) return
    if (!window.confirm(`Excluir “${item.title || 'esta miniatura'}”?`)) return
    try {
      setVipMiniBusy(true)
      setVipMiniError('')
      const resp = await fetch('/api/admin?action=vip-delete-option', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ id: item.id }),
      })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok)
        throw new Error(data?.error || 'Não foi possível excluir a miniatura.')
      showToast('🗑️ Miniatura excluída.')
      await fetchVipControl()
    } catch (e) {
      setVipMiniError(e?.message || 'Falha ao excluir miniatura.')
    } finally {
      setVipMiniBusy(false)
    }
  }

  function toggleVipCycleItem(itemId) {
    setVipCycleEditor((prev) => {
      const current = Array.isArray(prev?.selected_ids) ? prev.selected_ids : []
      itemId = String(itemId)
      const exists = current.map(String).includes(itemId)
      return {
        ...prev,
        selected_ids: exists
          ? current.filter((id) => String(id) !== itemId)
          : [...current, itemId],
      }
    })
  }

  function loadVipCycleIntoEditor(cycleKey) {
    const key = String(cycleKey || '')
    const selectedIds = (vipControl.library || [])
      .filter((item) => String(item?.cycle_key || '') === key)
      .map((item) => String(item.id))
    setVipCycleEditor({
      cycle_key: key,
      selected_ids: selectedIds,
      activate: key === String(vipControl.active_cycle_key || ''),
    })
  }

  async function saveVipCycle() {
    if (!accessToken) return
    if (
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(String(vipCycleEditor?.cycle_key || ''))
    ) {
      setVipControlError('Selecione um mês válido para o ciclo.')
      return
    }
    if (!(vipCycleEditor?.selected_ids || []).length) {
      setVipControlError(
        'Selecione pelo menos uma miniatura para salvar o ciclo.'
      )
      return
    }
    try {
      setVipCycleBusy(true)
      setVipControlError('')
      const payload = {
        cycle_key: String(vipCycleEditor?.cycle_key || '').trim(),
        option_ids: Array.isArray(vipCycleEditor?.selected_ids)
          ? vipCycleEditor.selected_ids
          : [],
        activate: !!vipCycleEditor?.activate,
        duplicate: !!vipCycleEditor?.duplicate,
      }
      const resp = await fetch('/api/admin?action=vip-save-cycle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok)
        throw new Error(data?.error || 'Não foi possível salvar o ciclo VIP.')
      setVipCycleEditor((prev) => ({
        ...prev,
        duplicate: false,
        selected_ids: data.option_ids || prev.selected_ids,
      }))
      showToast(
        payload.activate
          ? '✅ Ciclo VIP salvo e ativado!'
          : '✅ Ciclo VIP salvo!'
      )
      await fetchVipControl()
    } catch (e) {
      setVipControlError(e?.message || 'Falha ao salvar ciclo VIP.')
    } finally {
      setVipCycleBusy(false)
    }
  }

  async function activateVipCycle(cycleKey) {
    if (!accessToken || !cycleKey) return
    try {
      setVipCycleBusy(true)
      setVipControlError('')
      const resp = await fetch('/api/admin?action=vip-set-active-cycle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ cycle_key: cycleKey }),
      })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok)
        throw new Error(data?.error || 'Não foi possível ativar o ciclo VIP.')
      showToast('✅ Ciclo ativo atualizado!')
      await fetchVipControl()
    } catch (e) {
      setVipControlError(e?.message || 'Falha ao ativar ciclo VIP.')
    } finally {
      setVipCycleBusy(false)
    }
  }

  async function deleteVipCycle(cycleKey) {
    if (!accessToken || !cycleKey) return
    try {
      setVipCycleBusy(true)
      setVipControlError('')
      const resp = await fetch('/api/admin?action=vip-delete-cycle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ cycle_key: cycleKey }),
      })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok)
        throw new Error(data?.error || 'Não foi possível excluir o ciclo VIP.')
      setVipCycleEditor((prev) =>
        String(prev?.cycle_key || '') === String(cycleKey)
          ? { cycle_key: nextMonthKey(), selected_ids: [], activate: false }
          : prev
      )
      showToast('🗑️ Ciclo VIP excluído.')
      await fetchVipControl()
    } catch (e) {
      setVipControlError(e?.message || 'Falha ao excluir ciclo VIP.')
    } finally {
      setVipCycleBusy(false)
    }
  }

  async function saveGameCoupon() {
    if (!accessToken) return
    try {
      setGameCouponLoading(true)
      setGameCouponError('')
      const payload = {
        discount_type: gameCouponForm.discount_type,
        discount_value: Number(gameCouponForm.discount_value || 0),
        min_order_value: Number(gameCouponForm.min_order_value || 0),
        label: String(gameCouponForm.label || '').trim(),
      }

      const resp = await fetch('/api/admin?action=save-game-coupon', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok)
        throw new Error(
          data?.error || 'Não foi possível salvar o cupom do jogo.'
        )
      setCurrentGameCoupon(data?.config || null)
      showToast('🎟️ Cupom do Cubo Game atualizado!')
    } catch (e) {
      const msg = e?.message || 'Falha ao salvar o cupom do jogo.'
      setGameCouponError(msg)
      showToast(`⚠️ ${msg}`)
    } finally {
      setGameCouponLoading(false)
    }
  }

  async function updateOrder(orderId, patch) {
    try {
      const current = (orders || []).find((o) => o.id === orderId)
      const currentPay = String(current?.status || '').toLowerCase()
      const changingFlow =
        Object.prototype.hasOwnProperty.call(
          patch || {},
          'production_status'
        ) ||
        Object.prototype.hasOwnProperty.call(
          patch || {},
          'shipping_tracking'
        ) ||
        Object.prototype.hasOwnProperty.call(patch || {}, 'refund_requested')

      if (changingFlow && currentPay !== 'paid') {
        showToast('⚠️ Só pedidos pagos podem ter status/rastreio alterados.')
        return false
      }

      const resp = await fetch('/api/admin?action=update-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ order_id: orderId, ...patch }),
      })

      const data = await resp.json().catch(() => ({}))
      if (!resp.ok)
        throw new Error(data?.error || 'Não foi possível atualizar.')
      if (data?.email?.ok)
        showToast('✅ Atualizado e e-mail enviado ao cliente!')
      else if (data?.email && !data.email.skipped)
        showToast('⚠️ Pedido atualizado, mas o e-mail não foi enviado.')
      else showToast('✅ Atualizado!')
      if (data?.order) {
        setOrders((prev) =>
          prev.map((o) =>
            o.id === orderId ? { ...o, ...patch, ...data.order } : o
          )
        )
      } else {
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, ...patch } : o))
        )
      }
      return true
    } catch (e) {
      showToast(`⚠️ ${e?.message || 'Falha'}`)
      return false
    }
  }

  async function resendOrderEmail(orderId) {
    if (!orderId || !accessToken) return
    try {
      setResendEmailBusyId(orderId)
      const resp = await fetch('/api/admin?action=resend-order-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ order_id: orderId }),
      })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok)
        throw new Error(data?.error || 'Não foi possível reenviar o e-mail.')
      showToast('📨 E-mail reenviado ao cliente!')
      if (data?.order) {
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, ...data.order } : o))
        )
      } else {
        fetchOrders()
      }
    } catch (e) {
      showToast(`⚠️ ${e?.message || 'Falha ao reenviar e-mail.'}`)
    } finally {
      setResendEmailBusyId(null)
    }
  }

  async function deleteOrder(orderId) {
    if (!orderId) return
    try {
      const resp = await fetch('/api/admin?action=delete-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ order_id: orderId }),
      })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) throw new Error(data?.error || 'Não foi possível excluir.')
      showToast('🗑️ Pedido excluído!')
      setOrders((prev) =>
        (prev || []).filter((o) => String(o.id) !== String(orderId))
      )
      // also refetch to avoid stale UI
      fetchOrders()
      // close details if it was open for this order
      setDetails((d) =>
        d?.orderId === orderId ? { open: false, orderId: null } : d
      )
    } catch (e) {
      showToast(`⚠️ ${e?.message || 'Falha ao excluir'}`)
    }
  }

  async function addOrderNote(order, note) {
    if (!order?.id || !accessToken) return
    try {
      const resp = await fetch('/api/admin?action=add-order-note', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ order_id: order.id, note }),
      })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok)
        throw new Error(data?.error || 'Não foi possível salvar a nota.')
      showToast('📝 Nota interna salva.')
      fetchOrders()
    } catch (e) {
      showToast(`⚠️ ${e?.message || 'Falha ao salvar nota.'}`)
    }
  }

  async function saveClientEdits() {
    if (!clientEditor?.id || !accessToken) return
    try {
      const resp = await fetch('/api/admin?action=update-client', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ client_id: clientEditor.id, ...clientEditor }),
      })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok)
        throw new Error(data?.error || 'Não foi possível salvar o cliente.')
      showToast('✅ Cliente atualizado.')
      fetchClients()
    } catch (e) {
      showToast(`⚠️ ${e?.message || 'Falha ao salvar cliente.'}`)
    }
  }

  async function updateClientVipStatus({ active, extend = false } = {}) {
    if (!clientEditor?.id || !accessToken || clientVipBusy) return
    const selectedPlanId = String(
      clientEditor.vip_plan || clientVipPlans[0]?.id || ''
    ).trim()
    if (active && !selectedPlanId) {
      showToast('⚠️ Selecione um plano VIP.')
      return
    }
    setClientVipBusy(true)
    try {
      const resp = await fetch('/api/admin?action=client-vip-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          client_id: clientEditor.id,
          active: Boolean(active),
          extend: Boolean(extend),
          duration_days: 30,
          vip_plan_id: selectedPlanId,
        }),
      })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok)
        throw new Error(data?.error || 'Não foi possível alterar o acesso VIP.')
      setClientEditor((current) =>
        current
          ? {
              ...current,
              vip_active: Boolean(data?.vip_active),
              vip_until: data?.vip_until || null,
              vip_plan: data?.vip_plan || null,
              vip_cycle_key: data?.vip_cycle_key || null,
            }
          : current
      )
      showToast(
        active
          ? extend
            ? '✅ VIP renovado por mais 30 dias.'
            : '✅ VIP ativado por 30 dias.'
          : '✅ VIP desativado.'
      )
      await fetchClients()
    } catch (e) {
      showToast(`⚠️ ${e?.message || 'Falha ao alterar o VIP.'}`)
    } finally {
      setClientVipBusy(false)
    }
  }

  async function deleteClient(client) {
    if (!client?.id || !accessToken) return
    const resp = await fetch('/api/admin?action=delete-client', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ client_id: client.id }),
    })
    const data = await resp.json().catch(() => ({}))
    if (!resp.ok)
      throw new Error(data?.error || 'Não foi possível excluir o cliente.')
    showToast('🗑️ Cliente excluído.')
    setClientEditor(null)
    fetchClients()
  }

  function toggleOrderSelection(orderId) {
    setSelectedOrderIds((prev) =>
      prev.includes(orderId)
        ? prev.filter((id) => id !== orderId)
        : [...prev, orderId]
    )
  }

  function toggleSelectAllCurrentPage() {
    setSelectedOrderIds((prev) => {
      if (allPageSelected)
        return prev.filter((id) => !filteredOrders.some((o) => o.id === id))
      const next = new Set(prev)
      filteredOrders.forEach((o) => next.add(o.id))
      return Array.from(next)
    })
  }

  async function bulkUpdateOrders(patch) {
    if (!selectedOrderIds.length || !accessToken) return
    try {
      setBulkBusy(true)
      const results = await Promise.allSettled(
        selectedOrderIds.map((orderId) =>
          fetch('/api/admin?action=update-order', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ order_id: orderId, ...patch }),
          }).then(async (resp) => {
            const data = await resp.json().catch(() => ({}))
            if (!resp.ok)
              throw new Error(data?.error || 'Falha ao atualizar pedido')
            return data
          })
        )
      )
      const successCount = results.filter(
        (r) => r.status === 'fulfilled'
      ).length
      const failCount = results.length - successCount
      showToast(
        failCount
          ? `⚠️ ${successCount} atualizados, ${failCount} com falha.`
          : `✅ ${successCount} pedido(s) atualizados.`
      )
      setBulkModal({ open: false, mode: 'status' })
      setSelectedOrderIds([])
      fetchOrders()
    } catch (e) {
      showToast(`⚠️ ${e?.message || 'Falha na ação em lote.'}`)
    } finally {
      setBulkBusy(false)
    }
  }

  async function bulkResendEmails() {
    if (!selectedPaidOrders.length || !accessToken) return
    try {
      setBulkBusy(true)
      const results = await Promise.allSettled(
        selectedPaidOrders.map((order) =>
          fetch('/api/admin?action=resend-order-email', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ order_id: order.id }),
          }).then(async (resp) => {
            const data = await resp.json().catch(() => ({}))
            if (!resp.ok)
              throw new Error(data?.error || 'Falha ao reenviar e-mail')
            return data
          })
        )
      )
      const successCount = results.filter(
        (r) => r.status === 'fulfilled'
      ).length
      const failCount = results.length - successCount
      showToast(
        failCount
          ? `⚠️ ${successCount} e-mail(s) reenviados, ${failCount} falharam.`
          : `📨 ${successCount} e-mail(s) reenviados.`
      )
      setSelectedOrderIds([])
      fetchOrders()
    } catch (e) {
      showToast(`⚠️ ${e?.message || 'Falha ao reenviar em lote.'}`)
    } finally {
      setBulkBusy(false)
    }
  }

  async function bulkDeleteOrders() {
    if (!selectedOrderIds.length || !accessToken) return
    try {
      setBulkBusy(true)
      const resp = await fetch('/api/admin?action=bulk-delete-orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ order_ids: selectedOrderIds }),
      })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) throw new Error(data?.error || 'Falha ao excluir pedidos.')

      const deletedIds = Array.isArray(data?.deleted_order_ids)
        ? data.deleted_order_ids.map(String)
        : []
      const deletedCount = Number(data?.deleted_count || deletedIds.length || 0)
      const failedCount = Number(data?.failed_count || 0)

      if (deletedIds.length) {
        setOrders((prev) =>
          (prev || []).filter((o) => !deletedIds.includes(String(o.id)))
        )
      }
      setSelectedOrderIds([])
      setBulkModal({ open: false, mode: 'status' })
      setDetails((d) =>
        d?.open && deletedIds.includes(String(d.orderId))
          ? { open: false, orderId: null }
          : d
      )
      showToast(
        failedCount
          ? `⚠️ ${deletedCount} pedido(s) excluídos, ${failedCount} falharam.`
          : `🗑️ ${deletedCount} pedido(s) excluídos.`
      )
      fetchOrders()
    } catch (e) {
      showToast(`⚠️ ${e?.message || 'Falha ao excluir em lote.'}`)
    } finally {
      setBulkBusy(false)
    }
  }

  const orderMatchesInlineSearch = React.useCallback((order, rawQuery) => {
    const needle = String(rawQuery || '')
      .trim()
      .toLowerCase()
    if (!needle) return true
    const short = String(shortId(order?.id || ''))
      .replace(/…/g, '')
      .toLowerCase()
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
      .filter(Boolean)
    return fields.some((value) => value.includes(needle))
  }, [])

  const filteredOrders = React.useMemo(
    () =>
      (Array.isArray(orders) ? orders : []).filter((order) =>
        orderMatchesInlineSearch(order, qInput)
      ),
    [orders, qInput, orderMatchesInlineSearch]
  )

  const stats = React.useMemo(() => {
    const base = summary || {}
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
    }
  }, [summary])

  const bottlenecks = React.useMemo(() => {
    const source = summary?.bottlenecks || {}
    return {
      paidWaitingProduction: Number(source.paidWaitingProduction || 0),
      readyWithoutTracking: Number(source.readyWithoutTracking || 0),
      shippedInTransit: Number(source.shippedInTransit || 0),
      refundRequested: Number(source.refundRequested || 0),
      staleOrders: Number(source.staleOrders || 0),
      overdueCount: Number(source.overdueCount || 0),
      awaitingShipment: Number(source.awaitingShipment || 0),
    }
  }, [summary])

  const quickQueue = React.useMemo(() => {
    return [...(filteredOrders || [])]
      .filter((o) => {
        const prod = String(o.production_status || 'recebido').toLowerCase()
        const paid = String(o.status || '').toLowerCase() === 'paid'
        return (
          (paid &&
            ['recebido', 'editavel', 'pronto', 'enviado'].includes(prod)) ||
          !!o.refund_requested
        )
      })
      .sort(
        (a, b) =>
          new Date(a.created_at || 0).getTime() -
          new Date(b.created_at || 0).getTime()
      )
      .slice(0, 8)
  }, [filteredOrders])

  const financeHighlights = React.useMemo(() => {
    const paidOrders = (filteredOrders || []).filter(
      (o) => String(o.status || '').toLowerCase() === 'paid'
    )
    const shippingRevenue = paidOrders
      .flatMap((o) => (Array.isArray(o.order_items) ? o.order_items : []))
      .filter((it) => /pagamento de frete/i.test(String(it?.name || '')))
      .reduce(
        (sum, it) =>
          sum +
          Number(it?.unit_price || it?.unit_price_brl || 0) *
            Number(it?.qty || 1),
        0
      )
    const pendingRevenue = (filteredOrders || [])
      .filter((o) => String(o.status || '').toLowerCase() === 'pending')
      .reduce((sum, o) => sum + Number((o.effective_total ?? o.total) || 0), 0)
    const deliveredCount = paidOrders.filter(
      (o) => String(o.production_status || '').toLowerCase() === 'entregue'
    ).length
    return {
      shippingRevenue,
      pendingRevenue,
      deliveredCount,
      paidCount: paidOrders.length,
    }
  }, [filteredOrders])

  const orderQuickPresets = React.useMemo(
    () => [
      {
        key: 'paid_waiting',
        label: 'Pagos sem produção',
        apply: () => {
          setFilterPay('paid')
          setFilterProd('recebido')
          setFilterType('all')
          setPage(1)
        },
      },
      {
        key: 'ready_track',
        label: 'Prontos sem rastreio',
        apply: () => {
          setFilterPay('paid')
          setFilterProd('pronto')
          setFilterType('all')
          setPage(1)
        },
      },
      {
        key: 'overdue',
        label: 'Atrasados',
        apply: () => {
          setFilterPay('paid')
          setFilterProd('overdue')
          setQ('')
          setPage(1)
        },
      },
      {
        key: 'vip',
        label: 'Somente VIP',
        apply: () => {
          setFilterType('vip')
          setFilterPay('all')
          setFilterProd('all')
          setPage(1)
        },
      },
    ],
    []
  )

  const openDeleteClientConfirm = React.useCallback((client) => {
    if (!client?.id) return
    setConfirmAction({
      open: true,
      type: 'client',
      payload: client,
      busy: false,
      error: '',
      keywordValue: '',
    })
  }, [])

  const openDeleteVipCycleConfirm = React.useCallback((cycleKey) => {
    if (!cycleKey) return
    setConfirmAction({
      open: true,
      type: 'vip_cycle',
      payload: { cycle_key: cycleKey },
      busy: false,
      error: '',
      keywordValue: '',
    })
  }, [])

  const handleConfirmAction = React.useCallback(async () => {
    if (!confirmAction?.open || confirmAction?.busy) return
    try {
      setConfirmAction((prev) => ({ ...prev, busy: true, error: '' }))
      if (confirmAction.type === 'client') {
        await deleteClient(confirmAction.payload)
      } else if (confirmAction.type === 'vip_cycle') {
        await deleteVipCycle(confirmAction.payload?.cycle_key)
      }
      setConfirmAction({
        open: false,
        type: '',
        payload: null,
        busy: false,
        error: '',
        keywordValue: '',
      })
    } catch (e) {
      setConfirmAction((prev) => ({
        ...prev,
        busy: false,
        error: e?.message || 'Não foi possível concluir a ação.',
      }))
    }
  }, [confirmAction, deleteClient, deleteVipCycle])

  const runAdminQuickSearch = React.useCallback(() => {
    const next = String(adminQuickSearch || '').trim()
    setQInput(next)
    setQ(next)
    setClientsQ(next)
    setPage(1)
    if (next) {
      setSection(
        !canManageBusiness || /@|cpf|pedido|rastreio|track|#|\d{4}/i.test(next)
          ? 'orders'
          : 'clients'
      )
    }
  }, [adminQuickSearch, canManageBusiness])

  const applyOrderSearch = React.useCallback(() => {
    setPage(1)
    setQ(String(qInput || '').trim())
  }, [qInput])

  const clearOrderSearchAndFilters = React.useCallback(() => {
    setQ('')
    setQInput('')
    setFilterPay('all')
    setFilterProd('all')
    setFilterType('all')
    setFilterDateFrom(toDateInputValue(new Date(Date.now() - 29 * 86400000)))
    setFilterDateTo(toDateInputValue(new Date()))
    setPage(1)
  }, [])

  const allPageSelected = React.useMemo(
    () =>
      !!filteredOrders.length &&
      filteredOrders.every((o) => selectedOrderIds.includes(o.id)),
    [filteredOrders, selectedOrderIds]
  )
  const selectedOrders = React.useMemo(
    () => filteredOrders.filter((o) => selectedOrderIds.includes(o.id)),
    [filteredOrders, selectedOrderIds]
  )
  const selectedPaidOrders = React.useMemo(
    () =>
      selectedOrders.filter(
        (o) => String(o.status || '').toLowerCase() === 'paid'
      ),
    [selectedOrders]
  )

  const vipSelectedItems = React.useMemo(() => {
    const selectedSet = new Set(
      (vipCycleEditor?.selected_ids || []).map((id) => String(id))
    )
    return (vipControl?.library || []).filter((item) =>
      selectedSet.has(String(item?.id))
    )
  }, [vipControl, vipCycleEditor])

  const vipSelectedSummary = React.useMemo(() => {
    return vipSelectedItems.reduce(
      (acc, item) => {
        if (String(item?.item_type || '').toLowerCase() === 'boss')
          acc.boss += 1
        else acc.mini += 1
        return acc
      },
      { mini: 0, boss: 0 }
    )
  }, [vipSelectedItems])

  const vipVisibleLibrary = React.useMemo(() => {
    const query = String(vipLibrarySearch || '')
      .trim()
      .toLocaleLowerCase('pt-BR')
    const selectedSet = new Set(
      (vipCycleEditor?.selected_ids || []).map((id) => String(id))
    )
    return (vipControl?.library || []).filter((item) => {
      const type =
        String(item?.item_type || '').toLowerCase() === 'boss' ? 'boss' : 'mini'
      const selected = selectedSet.has(String(item?.id))
      if (vipLibraryFilter === 'selected' && !selected) return false
      if (vipLibraryFilter === 'mini' && type !== 'mini') return false
      if (vipLibraryFilter === 'boss' && type !== 'boss') return false
      if (!query) return true
      const haystack = [item?.title, item?.description, item?.cycle_key, type]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('pt-BR')
      return haystack.includes(query)
    })
  }, [vipControl, vipCycleEditor, vipLibraryFilter, vipLibrarySearch])

  const vipActiveCycle = React.useMemo(() => {
    return (vipControl?.cycles || []).find((cycle) => cycle.is_active) || null
  }, [vipControl])

  const vipCycleAudience = React.useMemo(
    () =>
      Array.isArray(vipControl?.vip_summary?.byCycle)
        ? vipControl.vip_summary.byCycle
        : [],
    [vipControl]
  )

  const activeOrder = React.useMemo(
    () => (orders || []).find((o) => o.id === details.orderId) || null,
    [orders, details.orderId]
  )
  const activeActionOrder = React.useMemo(
    () => (orders || []).find((o) => o.id === actionModal.orderId) || null,
    [orders, actionModal.orderId]
  )

  // Contexto único do painel: cada módulo administrativo recebe apenas uma referência estável
  // ao estado/ações já existentes, evitando duplicar lógica ou consultas ao banco.
  const adminContext = {
    user,
    accessToken,
    isAdmin,
    adminLevel,
    adminRole,
    isAdminLoading,
    onNavigateHome,
    onRequireLogin,
    section,
    setSection,
    orders,
    setOrders,
    loading,
    setLoading,
    error,
    setError,
    q,
    setQ,
    qInput,
    setQInput,
    filterPay,
    setFilterPay,
    filterProd,
    setFilterProd,
    filterType,
    setFilterType,
    filterDateFrom,
    setFilterDateFrom,
    filterDateTo,
    setFilterDateTo,
    page,
    setPage,
    pageSize,
    setPageSize,
    pagination,
    setPagination,
    summary,
    setSummary,
    selectedOrderIds,
    setSelectedOrderIds,
    bulkBusy,
    setBulkBusy,
    bulkModal,
    setBulkModal,
    toast,
    setToast,
    resendEmailBusyId,
    setResendEmailBusyId,
    details,
    setDetails,
    actionModal,
    setActionModal,
    vipPolls,
    setVipPolls,
    vipPollsLoading,
    setVipPollsLoading,
    vipPollsError,
    setVipPollsError,
    vipVotingImages,
    setVipVotingImages,
    vipVotingImagesLoading,
    setVipVotingImagesLoading,
    vipVotingImagesError,
    setVipVotingImagesError,
    vipControl,
    setVipControl,
    vipControlLoading,
    setVipControlLoading,
    vipControlError,
    setVipControlError,
    vipCycleEditor,
    setVipCycleEditor,
    vipCycleBusy,
    setVipCycleBusy,
    vipMiniForm,
    setVipMiniForm,
    vipMiniFiles,
    setVipMiniFiles,
    vipMiniBusy,
    setVipMiniBusy,
    vipMiniError,
    setVipMiniError,
    vipLibrarySearch,
    setVipLibrarySearch,
    vipLibraryFilter,
    setVipLibraryFilter,
    gameCouponLoading,
    setGameCouponLoading,
    gameCouponError,
    setGameCouponError,
    gameCouponForm,
    setGameCouponForm,
    currentGameCoupon,
    setCurrentGameCoupon,
    gameCouponMetricsLoading,
    setGameCouponMetricsLoading,
    gameCouponMetricsError,
    setGameCouponMetricsError,
    gameCouponMetrics,
    setGameCouponMetrics,
    closeVote,
    setCloseVote,
    startVote,
    setStartVote,
    deleteVote,
    setDeleteVote,
    newOrderOpen,
    setNewOrderOpen,
    clients,
    setClients,
    clientsLoading,
    setClientsLoading,
    clientsError,
    setClientsError,
    clientsQ,
    setClientsQ,
    clientEditor,
    setClientEditor,
    clientVipPlans,
    setClientVipPlans,
    clientVipBusy,
    setClientVipBusy,
    newClientOpen,
    setNewClientOpen,
    adminQuickSearch,
    setAdminQuickSearch,
    confirmAction,
    setConfirmAction,
    normalizedAdminLevel,
    canOperate,
    canManageBusiness,
    canManageAdmins,
    showToast,
    fetchOrders,
    fetchClients,
    fetchVipVoting,
    fetchVipVotingImages,
    nextMonthKey,
    fetchVipControl,
    fetchGameCoupon,
    fetchGameCouponMetrics,
    startVipVoting,
    closeVipVoting,
    deleteVipVoting,
    uploadVipMiniImage,
    createVipMiniature,
    deleteVipMiniature,
    toggleVipCycleItem,
    loadVipCycleIntoEditor,
    saveVipCycle,
    activateVipCycle,
    deleteVipCycle,
    saveGameCoupon,
    updateOrder,
    resendOrderEmail,
    deleteOrder,
    addOrderNote,
    saveClientEdits,
    updateClientVipStatus,
    deleteClient,
    toggleOrderSelection,
    toggleSelectAllCurrentPage,
    bulkUpdateOrders,
    bulkResendEmails,
    bulkDeleteOrders,
    orderMatchesInlineSearch,
    filteredOrders,
    stats,
    bottlenecks,
    quickQueue,
    financeHighlights,
    orderQuickPresets,
    openDeleteClientConfirm,
    openDeleteVipCycleConfirm,
    handleConfirmAction,
    runAdminQuickSearch,
    applyOrderSearch,
    clearOrderSearchAndFilters,
    allPageSelected,
    selectedOrders,
    selectedPaidOrders,
    vipSelectedItems,
    vipSelectedSummary,
    vipVisibleLibrary,
    vipActiveCycle,
    vipCycleAudience,
    activeOrder,
    activeActionOrder,
  }

  if (authLoading || isAdminLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-6">
          <div className="text-white text-xl font-semibold">
            Validando acesso…
          </div>
          <div className="mt-1 text-slate-400">
            Aguarde enquanto confirmamos suas permissões de administrador.
          </div>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-6">
          <div className="text-white text-xl font-semibold">
            Acesso restrito
          </div>
          <div className="mt-1 text-slate-400">
            Este painel é apenas para administradores. Faça login com um email
            autorizado.
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
    )
  }

  const navigationGroups = [
    {
      label: 'Operação',
      items: [
        ['dashboard', 'space_dashboard', 'Visão geral', true],
        ['orders', 'inventory_2', 'Pedidos', canOperate],
        ['production', 'view_kanban', 'Produção', canOperate],
      ],
    },
    {
      label: 'Gestão comercial',
      items: [
        ['finance', 'payments', 'Financeiro', canManageBusiness],
        ['clients', 'groups', 'Clientes', canManageBusiness],
        ['products', 'inventory', 'Produtos', canManageBusiness],
        ['reviews', 'reviews', 'Avaliações', canManageBusiness],
        ['coupons', 'sell', 'Cupons e campanhas', canManageBusiness],
        ['affiliates', 'handshake', 'Vendedores', canManageBusiness],
      ],
    },
    {
      label: 'Comunidade',
      items: [
        ['vip', 'workspace_premium', 'Controle VIP', canManageBusiness],
        ['admins', 'admin_panel_settings', 'Administradores', canManageAdmins],
      ],
    },
  ]
  const visibleNavigation = navigationGroups
    .flatMap((group) => group.items)
    .filter((item) => item[3])
  const activeLabel =
    visibleNavigation.find((item) => item[0] === section)?.[2] || 'Visão geral'
  const refreshSection = () => {
    if (section === 'vip') {
      fetchVipControl()
      fetchVipVoting()
      fetchVipVotingImages()
    } else if (section === 'clients') fetchClients()
    else if (section === 'coupons') {
      fetchGameCoupon()
      fetchGameCouponMetrics()
    } else if (
      ['products', 'reviews', 'affiliates', 'admins'].includes(section)
    )
      setSectionRevision((revision) => revision + 1)
    else fetchOrders()
  }
  const renderNavItem = ([key, icon, label]) => (
    <button
      key={key}
      type="button"
      onClick={() => setSection(key)}
      aria-current={section === key ? 'page' : undefined}
      className={`admin-nav-link ${section === key ? 'is-active' : ''}`}
    >
      <span className="material-icons" aria-hidden="true">
        {icon}
      </span>
      <span>{label}</span>
      {key === 'orders' && stats.total > 0 ? (
        <span className="admin-nav-count">{stats.total}</span>
      ) : null}
    </button>
  )

  return (
    <div className="admin-workspace mx-auto w-full max-w-[1660px] px-4 pb-8 sm:px-6 lg:px-8">
      <header className="admin-topbar">
        <div>
          <p className="admin-eyebrow">CUBO CRIATIVO / ADMINISTRAÇÃO</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">
            Painel de gestão
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Acompanhe a operação e organize as próximas entregas.
          </p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <button
            type="button"
            onClick={onNavigateHome}
            className="admin-secondary"
          >
            <span className="material-icons text-[18px]" aria-hidden="true">
              storefront
            </span>
            Ver loja
          </button>
          <button
            type="button"
            onClick={refreshSection}
            disabled={loading || clientsLoading || vipControlLoading}
            className="admin-secondary"
          >
            <span className="material-icons text-[18px]" aria-hidden="true">
              refresh
            </span>
            Atualizar
          </button>
          {canOperate && (
            <button
              type="button"
              onClick={() => setNewOrderOpen(true)}
              className="admin-primary"
            >
              <span className="material-icons text-[18px]" aria-hidden="true">
                add
              </span>
              Novo pedido
            </button>
          )}
        </div>
      </header>
      <nav
        aria-label="Seções administrativas"
        className="admin-mobile-nav no-scrollbar"
      >
        {visibleNavigation.map(renderNavItem)}
      </nav>
      <div className="admin-layout">
        <aside className="admin-sidebar">
          <nav aria-label="Menu administrativo">
            {navigationGroups.map((group) =>
              group.items.some((item) => item[3]) ? (
                <div key={group.label}>
                  <p className="admin-nav-group">{group.label}</p>
                  {group.items.filter((item) => item[3]).map(renderNavItem)}
                </div>
              ) : null
            )}
          </nav>
          <div className="mt-6 border-t border-white/10 px-3 pt-4">
            <p className="truncate text-xs text-slate-300" title={user?.email}>
              {user?.email}
            </p>
            <p className="mt-1 text-xs text-teal-200">
              {adminRole || adminLevelLabel(normalizedAdminLevel)} • Nível{' '}
              {normalizedAdminLevel}
            </p>
          </div>
        </aside>
        <main
          id="admin-content"
          className="admin-section-content"
          aria-label={activeLabel}
        >
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-400">
              Administração <span className="mx-2 text-slate-500">/</span>
              <span className="text-slate-200">{activeLabel}</span>
            </p>
            <form
              onSubmit={(event) => {
                event.preventDefault()
                runAdminQuickSearch()
              }}
              className="flex w-full max-w-md gap-2"
            >
              <label className="relative min-w-0 flex-1">
                <span className="sr-only">
                  Busca geral de pedidos e clientes
                </span>
                <span
                  aria-hidden="true"
                  className="material-icons absolute left-3 top-3 text-[18px] text-slate-400"
                >
                  search
                </span>
                <input
                  type="search"
                  value={adminQuickSearch}
                  onChange={(event) => setAdminQuickSearch(event.target.value)}
                  placeholder="Buscar pedido, cliente ou e-mail"
                  className="w-full rounded-xl bg-white/[0.03] py-2 pl-10 pr-3 text-sm text-white ring-1 ring-white/10"
                />
              </label>
              <button type="submit" className="admin-secondary">
                Buscar
              </button>
            </form>
          </div>
          {error && section !== 'orders' && (
            <div
              role="alert"
              className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-100"
            >
              <span>{error}</span>
              <button
                type="button"
                onClick={fetchOrders}
                className="admin-secondary"
              >
                Tentar novamente
              </button>
            </div>
          )}
          <div key={sectionRevision}>
            <React.Suspense
              fallback={
                <div
                  role="status"
                  aria-label="Carregando seção"
                  className="admin-skeleton"
                />
              }
            >
              {section === 'dashboard' && (
                <AdminDashboardSection admin={adminContext} />
              )}

              {section === 'orders' && (
                <AdminOrdersSection admin={adminContext} />
              )}

              {section === 'production' && (
                <AdminProductionSection admin={adminContext} />
              )}
              {section === 'finance' && canManageBusiness && (
                <AdminFinanceSection admin={adminContext} />
              )}
              {section === 'clients' && canManageBusiness && (
                <AdminClientsSection admin={adminContext} />
              )}
              {section === 'products' && canManageBusiness && (
                <AdminProductsSection onNotify={showToast} />
              )}
              {section === 'reviews' && canManageBusiness && (
                <AdminReviewsSection onToast={showToast} />
              )}
              {section === 'coupons' && canManageBusiness && (
                <AdminCouponsSection admin={adminContext} />
              )}
              {section === 'affiliates' && canManageBusiness && (
                <AdminAffiliatesSection accessToken={accessToken} />
              )}
              {section === 'admins' && canManageAdmins && (
                <AdminManagementSection
                  accessToken={accessToken}
                  currentUserId={user?.id}
                  currentLevel={normalizedAdminLevel}
                  onToast={showToast}
                />
              )}
              {section === 'vip' && canManageBusiness && (
                <AdminVipSection admin={adminContext} />
              )}
            </React.Suspense>
          </div>
        </main>
      </div>
      {toast && (
        <div role="status" aria-live="polite" className="admin-notification">
          {toast}
        </div>
      )}

      <OrderDetailsModal
        open={details.open}
        order={activeOrder}
        canManageBusiness={canManageBusiness}
        onClose={() => setDetails({ open: false, orderId: null })}
        onUpdateStatus={(o) =>
          setActionModal({ open: true, mode: 'status', orderId: o?.id })
        }
        onUpdateTracking={(o) =>
          setActionModal({ open: true, mode: 'tracking', orderId: o?.id })
        }
        onUpdateCreatedAt={(o, createdAt) =>
          updateOrder(o?.id, { created_at: createdAt })
        }
        onRequestRefund={(o) =>
          updateOrder(o?.id, {
            refund_requested: true,
            refund_requested_at: new Date().toISOString(),
          })
        }
        onDeleteOrder={(o) => deleteOrder(o?.id || o?.order_id)}
        onResendEmail={(o) => resendOrderEmail(o?.id || o?.order_id)}
        resendBusy={
          resendEmailBusyId &&
          String(resendEmailBusyId) === String(activeOrder?.id)
        }
        toast={toast}
      />

      <StatusModal
        open={actionModal.open}
        mode={actionModal.mode}
        order={activeActionOrder}
        canManageBusiness={canManageBusiness}
        onClose={() =>
          setActionModal({ open: false, mode: 'status', orderId: null })
        }
        onSubmit={async (patch) => {
          const id = activeActionOrder?.id
          const saved = id ? await updateOrder(id, patch) : false
          if (saved)
            setActionModal({ open: false, mode: 'status', orderId: null })
          return saved
        }}
      />

      <BulkActionModal
        open={bulkModal.open}
        mode={bulkModal.mode}
        count={selectedOrderIds.length}
        busy={bulkBusy}
        canManageBusiness={canManageBusiness}
        onClose={() => setBulkModal({ open: false, mode: 'status' })}
        onSubmit={(patch) => {
          if (bulkModal.mode === 'delete') {
            bulkDeleteOrders()
            return
          }
          const nextPatch =
            bulkModal.mode === 'refund_on' && patch?.refund_requested
              ? { ...patch, refund_requested_at: new Date().toISOString() }
              : bulkModal.mode === 'refund_off'
                ? { ...patch, refund_requested_at: null }
                : patch
          bulkUpdateOrders(nextPatch)
        }}
      />

      {newOrderOpen && (
        <React.Suspense
          fallback={
            <div role="status" className="admin-notification">
              Abrindo novo pedido…
            </div>
          }
        >
          <NewManualOrderModal
            open={newOrderOpen}
            accessToken={accessToken}
            canManageBusiness={canManageBusiness}
            onClose={() => setNewOrderOpen(false)}
            onCreated={() => {
              fetchOrders()
            }}
            showToast={showToast}
          />
        </React.Suspense>
      )}
      <CreateClientModal
        open={newClientOpen}
        accessToken={accessToken}
        onClose={() => setNewClientOpen(false)}
        onCreated={(client) => {
          fetchClients()
          if (client) setClientEditor(client)
        }}
        showToast={showToast}
      />

      <CloseVotingModal
        state={closeVote}
        onClose={() =>
          setCloseVote({
            open: false,
            poll: null,
            winnerId: null,
            busy: false,
            error: '',
          })
        }
        onSelectWinner={(id) => setCloseVote((s) => ({ ...s, winnerId: id }))}
        onConfirm={(winnerId) => closeVipVoting(closeVote.poll, winnerId)}
      />

      <StartVotingModal
        state={startVote}
        imageLibrary={vipVotingImages}
        imageLibraryLoading={vipVotingImagesLoading}
        imageLibraryError={vipVotingImagesError}
        onClose={() =>
          setStartVote({ open: false, data: null, busy: false, error: '' })
        }
        onChange={(data) => setStartVote((s) => ({ ...s, data }))}
        onConfirm={(data) => startVipVoting(data)}
      />

      <ConfirmDeleteVotingModal
        state={deleteVote}
        onClose={() =>
          setDeleteVote({ open: false, poll: null, busy: false, error: '' })
        }
        onConfirm={() => deleteVipVoting(deleteVote.poll)}
      />

      <ConfirmDangerModal
        open={confirmAction.open}
        title={
          confirmAction.type === 'client'
            ? 'Excluir cliente'
            : 'Excluir ciclo VIP'
        }
        message={
          confirmAction.type === 'client'
            ? 'Essa ação remove o cliente do sistema. Use apenas quando tiver certeza.'
            : 'Essa ação remove o ciclo VIP e desvincula os itens desse ciclo.'
        }
        details={
          confirmAction.type === 'client'
            ? `${confirmAction.payload?.full_name || confirmAction.payload?.email || confirmAction.payload?.id || 'Cliente'}`
            : `Ciclo ${confirmAction.payload?.cycle_key || '—'}`
        }
        confirmLabel={
          confirmAction.type === 'client' ? 'Excluir cliente' : 'Excluir ciclo'
        }
        busy={confirmAction.busy}
        error={confirmAction.error}
        keyword={confirmAction.type === 'client' ? 'EXCLUIR' : ''}
        keywordValue={confirmAction.keywordValue}
        onKeywordChange={(value) =>
          setConfirmAction((prev) => ({ ...prev, keywordValue: value }))
        }
        onClose={() =>
          setConfirmAction({
            open: false,
            type: '',
            payload: null,
            busy: false,
            error: '',
            keywordValue: '',
          })
        }
        onConfirm={handleConfirmAction}
      />
    </div>
  )
}
