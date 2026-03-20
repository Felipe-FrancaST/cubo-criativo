import React from "react";
import { useAuth } from "../auth/AuthProvider.jsx";
import { DetailRow, KpiCard, OrderBadgeCluster, SectionTitle, SidebarItem, TimelineList } from "./admin/orders/AdminOrdersComponents.jsx";
import { badgeBase, copyToClipboard, daysBetween, emailAuditBadge, endOfDay, exportCsv, fmtAddress, fmtBRL, fmtDate, onlyDigits, prodStatusBadge, shortId, startOfDay, statusBadge, toDateInputValue } from "./admin/orders/adminOrdersUtils.js";

function OrderDetailsModal({ open, order, onClose, onUpdateStatus, onUpdateTracking, onRequestRefund, onDeleteOrder, onResendEmail, resendBusy, toast }) {
  if (!open) return null;
  const p = order?.profile || null;
  const address = fmtAddress(p);

  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);
  const phone = order?.customer_phone || p?.phone || "";
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

          <div className="rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-3">
            <OrderBadgeCluster order={order} />

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

            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                onClick={() => onUpdateStatus?.(order)}
                className="rounded-xl px-3 py-2 text-sm text-slate-200 hover:bg-white/4 ring-1 ring-white/10"
              >
                <span className="material-icons text-[16px] align-middle mr-1">sync_alt</span>
                Alterar status
              </button>
              <button
                onClick={() => onUpdateTracking?.(order)}
                className="rounded-xl px-3 py-2 text-sm text-slate-200 hover:bg-white/4 ring-1 ring-white/10"
              >
                <span className="material-icons text-[16px] align-middle mr-1">local_shipping</span>
                Atualizar rastreio
              </button>
              <button
                onClick={() => onResendEmail?.(order)}
                disabled={!!resendBusy}
                className="rounded-xl px-3 py-2 text-sm text-slate-200 hover:bg-white/4 ring-1 ring-white/10 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <span className="material-icons text-[16px] align-middle mr-1">forward_to_inbox</span>
                {resendBusy ? 'Reenviando…' : 'Reenviar e-mail'}
              </button>
              <button
                onClick={() => copyToClipboard(order?.customer_email || '')}
                className="rounded-xl px-3 py-2 text-sm text-slate-200 hover:bg-white/4 ring-1 ring-white/10"
              >
                <span className="material-icons text-[16px] align-middle mr-1">content_copy</span>
                Copiar e-mail
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

            {order?.vip_selection?.selected_titles?.length ? (
              <div className="mt-3">
                <div className="text-xs text-slate-500">Seleção VIP:</div>
                {Array.isArray(order?.vip_selection?.selected_options) && order.vip_selection.selected_options.length ? (
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {order.vip_selection.selected_options.map((opt) => (
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
                          {opt?.title}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-1 text-xs text-slate-300">{order.vip_selection.selected_titles.join(", ")}</div>
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
            <div className="text-sm font-semibold text-white">Ações</div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                onClick={() => copyToClipboard(order?.id)}
                className="rounded-xl px-3 py-2 text-sm text-slate-200 hover:bg-white/4 ring-1 ring-white/10"
              >
                Copiar ID
              </button>

              <button
                onClick={() => copyToClipboard(order?.provider_payment_id)}
                className="rounded-xl px-3 py-2 text-sm text-slate-200 hover:bg-white/4 ring-1 ring-white/10"
                disabled={!order?.provider_payment_id}
              >
                Copiar ID pagamento
              </button>

              <button
                onClick={() => onUpdateTracking?.(order)}
                className="rounded-xl px-3 py-2 text-sm text-slate-200 hover:bg-white/4 ring-1 ring-white/10"
                disabled={String(order?.status || "").toLowerCase() !== "paid"}
                title={String(order?.status || "").toLowerCase() !== "paid" ? "Apenas pedidos pagos" : ""}
              >
                Editar rastreio
              </button>

              <button
                onClick={() => onUpdateStatus?.(order)}
                className="rounded-xl px-3 py-2 text-sm text-slate-200 hover:bg-white/4 ring-1 ring-white/10"
                disabled={String(order?.status || "").toLowerCase() !== "paid"}
                title={String(order?.status || "").toLowerCase() !== "paid" ? "Apenas pedidos pagos" : ""}
              >
                Alterar status
              </button>

              <button
                onClick={() => onRequestRefund?.(order)}
                className="rounded-xl px-3 py-2 text-sm text-red-200 hover:bg-red-500/10 ring-1 ring-red-500/30 col-span-2"
              >
                Marcar reembolso solicitado
              </button>

              <button
                onClick={() => setConfirmDeleteOpen(true)}
                className="rounded-xl px-3 py-2 text-sm text-red-200 hover:bg-red-500/10 ring-1 ring-red-500/30 col-span-2"
              >
                Excluir pedido
              </button>

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
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={() => {
          setConfirmDeleteOpen(false);
          onDeleteOrder?.(order);
        }}
      />
    </>
  );
}

function ConfirmDeleteModal({ open, order, onClose, onConfirm }) {
  if (!open) return null;
  const id = shortId(order?.id || order?.order_id || "");
  const total = fmtBRL(order?.total);
  const email = order?.customer_email || order?.profile?.email || "";

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

        <div className="p-5 space-y-2">
          <div className="rounded-2xl bg-white/4 ring-1 ring-white/10 p-4">
            <p className="text-xs text-slate-400">Pedido</p>
            <p className="text-sm text-slate-100 mt-1">
              <span className="font-semibold">#{id}</span>{email ? ` • ${email}` : ""}{total ? ` • ${total}` : ""}
            </p>
          </div>
          <p className="text-xs text-slate-400">
            Dica: se você só quer “sumir” com ele da operação, prefira marcar como <b>Cancelado</b> em vez de excluir.
          </p>
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
            className="rounded-xl px-4 py-2 text-sm font-semibold text-red-100 bg-red-500/15 hover:bg-red-500/25 ring-1 ring-red-500/30"
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

function StatusModal({ open, mode, order, onClose, onSubmit }) {
  const [productionStatus, setProductionStatus] = React.useState("recebido");
  const [eta, setEta] = React.useState("3 a 7 dias úteis");
  const [tracking, setTracking] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    setProductionStatus(String(order?.production_status || "recebido"));
    setEta("3 a 7 dias úteis");
    setTracking(String(order?.shipping_tracking || ""));
  }, [open, order]);

  if (!open) return null;

  const submit = () => {
    if (mode === "status") {
      const next = String(productionStatus || "recebido").toLowerCase();
      const patch = { production_status: next };
      if (next === "em_producao") patch.production_eta = eta;
      if (next === "enviado" && tracking.trim()) patch.shipping_tracking = tracking.trim();
      onSubmit?.(patch);
      return;
    }
    if (mode === "tracking") {
      onSubmit?.({ shipping_tracking: tracking.trim(), ...(tracking.trim() ? { production_status: "enviado" } : {}) });
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
                <label className="block">
                  <div className="text-xs text-slate-400 mb-1">Rastreio (opcional)</div>
                  <input
                    value={tracking}
                    onChange={(e) => setTracking(e.target.value)}
                    className="w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-slate-100"
                    placeholder="Código de rastreio"
                  />
                </label>
              ) : null}
            </>
          ) : (
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
  const emptyForm = React.useMemo(() => ({ name: '', cpf: '', email: '', phone: '', address_line1: '', address_number: '', address_line2: '', neighborhood: '', city: '', state: '', zip: '' }), []);
  const [loadingProducts, setLoadingProducts] = React.useState(false);
  const [loadingClients, setLoadingClients] = React.useState(false);
  const [products, setProducts] = React.useState([]);
  const [clients, setClients] = React.useState([]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [result, setResult] = React.useState(null);
  const [customerMode, setCustomerMode] = React.useState('new');
  const [selectedClientId, setSelectedClientId] = React.useState('');
  const [form, setForm] = React.useState(emptyForm);
  const [items, setItems] = React.useState([]);

  React.useEffect(() => {
    if (!open || !accessToken) return;
    let active = true;
    setLoadingProducts(true);
    setLoadingClients(true);
    setError('');
    Promise.all([
      fetch('/api/admin?action=manual-order-products', { headers: { Authorization: `Bearer ${accessToken}` } }).then((r) => r.json().catch(() => ({})).then((json) => ({ ok: r.ok, json }))),
      fetch('/api/admin?action=clients', { headers: { Authorization: `Bearer ${accessToken}` } }).then((r) => r.json().catch(() => ({})).then((json) => ({ ok: r.ok, json }))),
    ])
      .then(([prodResp, clientResp]) => {
        if (!active) return;
        if (!prodResp.ok) throw new Error(prodResp.json?.error || 'Não foi possível carregar os produtos.');
        if (!clientResp.ok) throw new Error(clientResp.json?.error || 'Não foi possível carregar os clientes.');
        setProducts(Array.isArray(prodResp.json?.products) ? prodResp.json.products : []);
        setClients(Array.isArray(clientResp.json?.clients) ? clientResp.json.clients : []);
      })
      .catch((e) => { if (active) setError(e?.message || 'Erro ao carregar dados.'); })
      .finally(() => { if (active) { setLoadingProducts(false); setLoadingClients(false); } });
    return () => { active = false; };
  }, [open, accessToken]);

  React.useEffect(() => {
    if (!open) return;
    if (customerMode !== 'existing') {
      setSelectedClientId('');
      return;
    }
    const client = clients.find((c) => String(c.id) === String(selectedClientId));
    if (!client) return;
    setForm({
      name: client.full_name || '', cpf: client.cpf || '', email: client.email || '', phone: client.phone || '',
      address_line1: client.address_line1 || '', address_number: client.address_number || '', address_line2: client.address_line2 || '',
      neighborhood: client.neighborhood || '', city: client.city || '', state: client.state || '', zip: client.zip || '',
    });
  }, [customerMode, selectedClientId, clients, open]);

  function updateForm(key, value) { setForm((p) => ({ ...p, [key]: value })); }
  function newId() { return crypto?.randomUUID?.() || String(Date.now() + Math.random()); }
  function addRegisteredProduct() { setItems((p) => [...p, { id: newId(), mode: 'product', product_id: '', qty: 1, scale: '' }]); }
  function addCustomItem() { setItems((p) => [...p, { id: newId(), mode: 'custom', name: '', price: '', scale: '', qty: 1, notes: '' }]); }
  function addFreightItem() { setItems((p) => [...p, { id: newId(), mode: 'freight', price: '', notes: '' }]); }
  function updateItem(id, patch) { setItems((p) => p.map((it) => it.id === id ? { ...it, ...patch } : it)); }
  function removeItem(id) { setItems((p) => p.filter((it) => it.id !== id)); }

  const total = React.useMemo(() => items.reduce((sum, it) => {
    if (it.mode === 'product') {
      const prod = products.find((p) => String(p.id) === String(it.product_id));
      return sum + Number(prod?.price || 0) * Number(it.qty || 1);
    }
    if (it.mode === 'freight') return sum + Number(it.price || 0);
    return sum + Number(it.price || 0) * Number(it.qty || 1);
  }, 0), [items, products]);

  async function handleSubmit() {
    setBusy(true);
    setError('');
    try {
      const payload = {
        existing_customer_id: customerMode === 'existing' ? selectedClientId : '',
        customer: form,
        items: items.map((it) => {
          if (it.mode === 'product') return { mode: 'product', product_id: it.product_id, qty: Number(it.qty || 1), scale: it.scale || '' };
          if (it.mode === 'freight') return { mode: 'freight', price: Number(it.price || 0), notes: it.notes || '' };
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
      showToast?.('Pedido criado com sucesso.');
      onCreated?.();
    } catch (e) {
      setError(e?.message || 'Erro ao criar pedido.');
    } finally { setBusy(false); }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[10000]">
      <div className="absolute inset-0 bg-[#020b10]/80" onClick={busy ? undefined : onClose} />
      <div className="absolute inset-x-0 top-4 mx-auto w-[min(1180px,calc(100vw-24px))] max-h-[92vh] overflow-y-auto rounded-[28px] bg-[#0a0f1a] ring-1 ring-white/10 p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-2xl font-bold text-white">Novo pedido</div>
            <div className="text-sm text-slate-400">Crie o pedido, gere o link de pagamento e vincule ao cliente certo.</div>
          </div>
          <button onClick={onClose} className="rounded-xl px-3 py-2 text-slate-200 hover:bg-white/4 ring-1 ring-white/10">Fechar</button>
        </div>
        {error ? <div className="mt-4 rounded-2xl bg-red-500/10 ring-1 ring-red-500/20 px-4 py-3 text-red-100">{error}</div> : null}
        {result ? (
          <div className="mt-5 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 items-start">
            <div className="rounded-3xl bg-emerald-500/10 ring-1 ring-emerald-400/20 p-5">
              <div className="text-emerald-100 text-xl font-extrabold">Pedido criado</div>
              <div className="mt-2 text-sm text-emerald-50/90">Compartilhe o link abaixo com o cliente para ele pagar com Pix ou cartão.</div>
              <div className="mt-4 rounded-2xl bg-black/20 ring-1 ring-white/10 p-4 break-all text-sm text-slate-100">{result?.payment_link}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={() => navigator.clipboard?.writeText(result?.payment_link || '')} className="rounded-xl px-3 py-2 text-sm text-slate-200 hover:bg-white/4 ring-1 ring-white/10">Copiar link</button>
                <a href={result?.payment_link} target="_blank" rel="noreferrer" className="rounded-xl px-3 py-2 text-sm text-slate-200 hover:bg-white/4 ring-1 ring-white/10">Abrir página</a>
              </div>
              <div className="mt-4 rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-4 text-sm text-slate-200">
                <div><b>Conta:</b> {result?.account?.email}</div>
                <div className="mt-1"><b>{result?.account?.existing ? 'Acesso:' : 'Senha inicial:'}</b> CPF do cliente</div>
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
              <div className="rounded-3xl bg-white/[0.03] ring-1 ring-white/10 p-4">
                <div className="text-sm font-semibold text-white">Cliente</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={() => { setCustomerMode('new'); setForm(emptyForm); }} className={["rounded-xl px-3 py-2 text-sm ring-1", customerMode === 'new' ? 'bg-cyan-400 text-[#031116] ring-cyan-300/30' : 'text-slate-200 ring-white/10 hover:bg-white/4'].join(' ')}>Novo cliente</button>
                  <button onClick={() => setCustomerMode('existing')} className={["rounded-xl px-3 py-2 text-sm ring-1", customerMode === 'existing' ? 'bg-cyan-400 text-[#031116] ring-cyan-300/30' : 'text-slate-200 ring-white/10 hover:bg-white/4'].join(' ')}>Cliente já cadastrado</button>
                </div>
                {customerMode === 'existing' ? (
                  <label className="mt-4 block text-sm text-slate-300">Selecionar cliente
                    <select value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)} className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white" disabled={loadingClients}>
                      <option value="">Selecione um cliente</option>
                      {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name || c.email} — {c.email}</option>)}
                    </select>
                  </label>
                ) : null}
              </div>
              <div className="rounded-3xl bg-white/[0.03] ring-1 ring-white/10 p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="text-sm text-slate-300">Nome<input value={form.name} onChange={(e)=>updateForm('name', e.target.value)} className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white" /></label>
                <label className="text-sm text-slate-300">CPF<input value={form.cpf} onChange={(e)=>updateForm('cpf', e.target.value)} className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white" /></label>
                <label className="text-sm text-slate-300">E-mail<input value={form.email} onChange={(e)=>updateForm('email', e.target.value)} className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white" /></label>
                <label className="text-sm text-slate-300">Telefone<input value={form.phone} onChange={(e)=>updateForm('phone', e.target.value)} className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white" /></label>
                <label className="text-sm text-slate-300 sm:col-span-2">Rua<input value={form.address_line1} onChange={(e)=>updateForm('address_line1', e.target.value)} className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white" /></label>
                <label className="text-sm text-slate-300">Número<input value={form.address_number} onChange={(e)=>updateForm('address_number', e.target.value)} className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white" /></label>
                <label className="text-sm text-slate-300">Complemento<input value={form.address_line2} onChange={(e)=>updateForm('address_line2', e.target.value)} className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white" /></label>
                <label className="text-sm text-slate-300">Bairro<input value={form.neighborhood} onChange={(e)=>updateForm('neighborhood', e.target.value)} className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white" /></label>
                <label className="text-sm text-slate-300">Cidade<input value={form.city} onChange={(e)=>updateForm('city', e.target.value)} className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white" /></label>
                <label className="text-sm text-slate-300">Estado<input value={form.state} onChange={(e)=>updateForm('state', e.target.value)} className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white" /></label>
                <label className="text-sm text-slate-300">CEP<input value={form.zip} onChange={(e)=>updateForm('zip', e.target.value)} className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white" /></label>
              </div>
            </div>
            <div className="space-y-4">
              <div className="rounded-3xl bg-white/[0.03] ring-1 ring-white/10 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-white font-bold">Itens do pedido</div>
                    <div className="text-sm text-slate-400">Use produto cadastrado, orçamento personalizado ou pagamento de frete.</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={addRegisteredProduct} className="rounded-xl px-3 py-2 text-sm text-slate-200 hover:bg-white/4 ring-1 ring-white/10">Produto cadastrado</button>
                    <button onClick={addCustomItem} className="rounded-xl px-3 py-2 text-sm text-slate-200 hover:bg-white/4 ring-1 ring-white/10">Orçamento personalizado</button>
                    <button onClick={addFreightItem} className="rounded-xl px-3 py-2 text-sm text-slate-200 hover:bg-white/4 ring-1 ring-white/10">Pagamento de frete</button>
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  {items.map((it) => it.mode === 'product' ? (
                    <div key={it.id} className="rounded-2xl bg-black/20 ring-1 ring-white/10 p-3 grid grid-cols-1 sm:grid-cols-[1fr_120px_110px_auto] gap-3 items-end">
                      <label className="text-sm text-slate-300">Produto<select value={it.product_id} onChange={(e)=>updateItem(it.id, { product_id: e.target.value, scale: '' })} className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white"><option value="">Selecione</option>{products.map((p)=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
                      <label className="text-sm text-slate-300">Quantidade<input type="number" min="1" value={it.qty} onChange={(e)=>updateItem(it.id, { qty: e.target.value })} className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white" /></label>
                      <label className="text-sm text-slate-300">Escala<input value={it.scale} onChange={(e)=>updateItem(it.id, { scale: e.target.value })} placeholder="Opcional" className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white" /></label>
                      <button onClick={()=>removeItem(it.id)} className="rounded-xl px-3 py-2 text-sm text-red-200 hover:bg-red-500/10 ring-1 ring-red-500/30">Remover</button>
                    </div>
                  ) : it.mode === 'freight' ? (
                    <div key={it.id} className="rounded-2xl bg-black/20 ring-1 ring-white/10 p-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className="text-sm text-slate-300">Valor do frete<input type="number" min="0" step="0.01" value={it.price} onChange={(e)=>updateItem(it.id, { price: e.target.value })} className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white" /></label>
                      <label className="text-sm text-slate-300">Observações<textarea value={it.notes} onChange={(e)=>updateItem(it.id, { notes: e.target.value })} className="mt-1 h-20 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white" /></label>
                      <div className="sm:col-span-2 rounded-xl bg-cyan-500/10 ring-1 ring-cyan-400/20 px-3 py-2 text-sm text-cyan-50">Na página de pagamento o cliente verá o endereço de envio e o valor do frete.</div>
                      <div className="sm:col-span-2 flex justify-end"><button onClick={()=>removeItem(it.id)} className="rounded-xl px-3 py-2 text-sm text-red-200 hover:bg-red-500/10 ring-1 ring-red-500/30">Remover</button></div>
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
                <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/10 pt-4">
                  <div className="text-lg font-extrabold text-white">Total: {fmtBRL(total)}</div>
                  <button onClick={handleSubmit} disabled={busy || loadingProducts || loadingClients} className="rounded-2xl bg-cyan-400 text-[#031116] font-black px-5 py-3 disabled:opacity-60">{busy ? 'Criando…' : 'Finalizar pedido'}</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ClientEditModal({ open, client, accessToken, onClose, onSaved, showToast }) {
  const [form, setForm] = React.useState(client || null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  React.useEffect(() => { setForm(client || null); setError(''); }, [client, open]);
  if (!open || !form) return null;
  const update = (key, value) => setForm((p) => ({ ...p, [key]: value }));
  async function save() {
    setBusy(true); setError('');
    try {
      const resp = await fetch('/api/admin?action=clients', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` }, body: JSON.stringify(form) });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(json?.error || 'Não foi possível salvar.');
      showToast?.('Cliente atualizado.');
      onSaved?.();
      onClose?.();
    } catch (e) { setError(e?.message || 'Erro ao salvar.'); } finally { setBusy(false); }
  }
  async function remove() {
    if (!window.confirm(`Excluir o cliente ${form.full_name || form.email}?`)) return;
    setBusy(true); setError('');
    try {
      const resp = await fetch('/api/admin?action=clients', { method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ id: form.id }) });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(json?.error || 'Não foi possível excluir.');
      showToast?.('Cliente excluído.');
      onSaved?.();
      onClose?.();
    } catch (e) { setError(e?.message || 'Erro ao excluir.'); } finally { setBusy(false); }
  }
  return (
    <div className="fixed inset-0 z-[10001]">
      <div className="absolute inset-0 bg-black/70" onClick={busy ? undefined : onClose} />
      <div className="absolute inset-x-0 top-6 mx-auto w-[min(760px,calc(100vw-24px))] rounded-[28px] bg-[#0a0f1a] ring-1 ring-white/10 p-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3"><div><div className="text-2xl font-bold text-white">Editar cliente</div><div className="text-sm text-slate-400">Altere cadastro, contato e endereço.</div></div><button onClick={onClose} className="rounded-xl px-3 py-2 text-slate-200 hover:bg-white/4 ring-1 ring-white/10">Fechar</button></div>
        {error ? <div className="mt-4 rounded-2xl bg-red-500/10 ring-1 ring-red-500/20 px-4 py-3 text-red-100">{error}</div> : null}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-sm text-slate-300">Nome<input value={form.full_name || ''} onChange={(e)=>update('full_name', e.target.value)} className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white" /></label>
          <label className="text-sm text-slate-300">CPF<input value={form.cpf || ''} onChange={(e)=>update('cpf', e.target.value)} className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white" /></label>
          <label className="text-sm text-slate-300">E-mail<input value={form.email || ''} onChange={(e)=>update('email', e.target.value)} className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white" /></label>
          <label className="text-sm text-slate-300">Telefone<input value={form.phone || ''} onChange={(e)=>update('phone', e.target.value)} className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white" /></label>
          <label className="text-sm text-slate-300 sm:col-span-2">Rua<input value={form.address_line1 || ''} onChange={(e)=>update('address_line1', e.target.value)} className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white" /></label>
          <label className="text-sm text-slate-300">Número<input value={form.address_number || ''} onChange={(e)=>update('address_number', e.target.value)} className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white" /></label>
          <label className="text-sm text-slate-300">Complemento<input value={form.address_line2 || ''} onChange={(e)=>update('address_line2', e.target.value)} className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white" /></label>
          <label className="text-sm text-slate-300">Bairro<input value={form.neighborhood || ''} onChange={(e)=>update('neighborhood', e.target.value)} className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white" /></label>
          <label className="text-sm text-slate-300">Cidade<input value={form.city || ''} onChange={(e)=>update('city', e.target.value)} className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white" /></label>
          <label className="text-sm text-slate-300">Estado<input value={form.state || ''} onChange={(e)=>update('state', e.target.value)} className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white" /></label>
          <label className="text-sm text-slate-300">CEP<input value={form.zip || ''} onChange={(e)=>update('zip', e.target.value)} className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white" /></label>
        </div>
        <div className="mt-5 flex items-center justify-between gap-3"><button onClick={remove} disabled={busy} className="rounded-xl px-4 py-2 text-sm text-red-200 hover:bg-red-500/10 ring-1 ring-red-500/30">Excluir cliente</button><div className="flex gap-2"><button onClick={onClose} className="rounded-xl px-4 py-2 text-sm text-slate-200 hover:bg-white/4 ring-1 ring-white/10">Cancelar</button><button onClick={save} disabled={busy} className="rounded-xl px-4 py-2 text-sm font-semibold bg-emerald-400 text-black ring-4 ring-emerald-400/20 disabled:opacity-50">{busy ? 'Salvando…' : 'Salvar'}</button></div></div>
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
  const [filterPay, setFilterPay] = React.useState("all");
  const [filterProd, setFilterProd] = React.useState("all");
  const [filterType, setFilterType] = React.useState("all");
  const [filterDateFrom, setFilterDateFrom] = React.useState(() => toDateInputValue(new Date(Date.now() - 29 * 86400000)));
  const [filterDateTo, setFilterDateTo] = React.useState(() => toDateInputValue(new Date()));
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(25);
  const [pagination, setPagination] = React.useState({ page: 1, pageSize: 25, totalCount: 0, totalPages: 1 });
  const [summary, setSummary] = React.useState({ total: 0, paid: 0, pending: 0, revenue: 0, refundReq: 0, vipCount: 0, bottlenecks: { paidWaitingProduction: 0, readyWithoutTracking: 0, shippedInTransit: 0, refundRequested: 0 } });
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
  const [vipControl, setVipControl] = React.useState({ active_cycle_key: "", cycles: [], library: [], setup_required: false, cycle_column_available: true });
  const [vipControlLoading, setVipControlLoading] = React.useState(false);
  const [vipControlError, setVipControlError] = React.useState("");
  const [vipCycleEditor, setVipCycleEditor] = React.useState({ cycle_key: "", selected_ids: [], activate: true });
  const [vipCycleBusy, setVipCycleBusy] = React.useState(false);

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
  const [clientEditor, setClientEditor] = React.useState({ open: false, client: null });
  const [clientSearch, setClientSearch] = React.useState('');

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
      const resp = await fetch('/api/admin?action=clients', { headers: { Authorization: `Bearer ${accessToken}` } });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.error || 'Não foi possível carregar os clientes.');
      setClients(Array.isArray(data.clients) ? data.clients : []);
    } catch (e) {
      setClientsError(e?.message || 'Erro ao carregar clientes.');
    } finally {
      setClientsLoading(false);
    }
  }, [accessToken]);

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
      showToast("✅ Atualizado!");
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

  const filteredOrders = React.useMemo(() => Array.isArray(orders) ? orders : [], [orders]);

  const stats = React.useMemo(() => {
    const base = summary || {};
    return {
      total: Number(base.total || 0),
      paid: Number(base.paid || 0),
      pending: Number(base.pending || 0),
      revenue: Number(base.revenue || 0),
      refundReq: Number(base.refundReq || 0),
      vipCount: Number(base.vipCount || 0),
    };
  }, [summary]);

  const bottlenecks = React.useMemo(() => {
    const source = summary?.bottlenecks || {};
    return {
      paidWaitingProduction: Number(source.paidWaitingProduction || 0),
      readyWithoutTracking: Number(source.readyWithoutTracking || 0),
      shippedInTransit: Number(source.shippedInTransit || 0),
      refundRequested: Number(source.refundRequested || 0),
      staleOrders: 0,
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

  const allPageSelected = React.useMemo(() => !!filteredOrders.length && filteredOrders.every((o) => selectedOrderIds.includes(o.id)), [filteredOrders, selectedOrderIds]);
  const selectedOrders = React.useMemo(() => filteredOrders.filter((o) => selectedOrderIds.includes(o.id)), [filteredOrders, selectedOrderIds]);
  const selectedPaidOrders = React.useMemo(() => selectedOrders.filter((o) => String(o.status || '').toLowerCase() === 'paid'), [selectedOrders]);

  const activeOrder = React.useMemo(() => (orders || []).find((o) => o.id === details.orderId) || null, [orders, details.orderId]);
  const activeActionOrder = React.useMemo(() => (orders || []).find((o) => o.id === actionModal.orderId) || null, [orders, actionModal.orderId]);
  const filteredClients = React.useMemo(() => {
    const qn = String(clientSearch || '').trim().toLowerCase();
    if (!qn) return clients || [];
    return (clients || []).filter((c) => [c.full_name, c.email, c.cpf, c.phone, c.city].some((v) => String(v || '').toLowerCase().includes(qn)));
  }, [clients, clientSearch]);

  React.useEffect(() => {
    if (section === 'clients') fetchClients();
  }, [section, fetchClients]);


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
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6">
      {/* Topbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="text-2xl font-semibold text-white">Admin</div>
          <div className="text-sm text-slate-400">Pedidos, produção, rastreio e votação VIP — tudo em um painel.</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchOrders()}
            className="rounded-xl px-3 py-2 text-sm text-slate-200 hover:bg-white/4 ring-1 ring-white/10"
          >
            <span className="material-icons text-[18px] align-middle mr-1">refresh</span>
            Atualizar
          </button>
          <button
            onClick={() => setNewOrderOpen(true)}
            className="rounded-xl px-3 py-2 text-sm text-slate-200 hover:bg-white/4 ring-1 ring-white/10"
          >
            <span className="material-icons text-[18px] align-middle mr-1">add_box</span>
            Novo pedido
          </button>
          <button
            onClick={() => onNavigateHome?.()}
            className="rounded-xl px-3 py-2 text-sm text-slate-200 hover:bg-white/4 ring-1 ring-white/10"
          >
            <span className="material-icons text-[18px] align-middle mr-1">home</span>
            Site
          </button>
        </div>
      </div>

      {/* Mobile tabs */}
      <div className="mt-4 sm:hidden flex gap-2 overflow-x-auto pb-1">
        {[
          ["dashboard", "space_dashboard", "Dashboard"],
          ["orders", "inventory_2", "Pedidos"],
          ["clients", "groups", "Clientes"],
          ["coupons", "sell", "Cupons"],
          ["vip", "workspace_premium", "VIP"],
          ["help", "help", "Atalhos"],
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

      <div className="mt-5 grid grid-cols-1 sm:grid-cols-[260px_1fr] gap-4">
        {/* Sidebar */}
        <aside className="hidden sm:block">
          <div className="rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-3">
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
              <SidebarItem active={section === "clients"} icon="groups" onClick={() => setSection("clients")}>
                Clientes
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
            <div className="mt-2">
              <SidebarItem active={section === "help"} icon="help" onClick={() => setSection("help")}>
                Atalhos / Processo
              </SidebarItem>
            </div>
          </div>

          <div className="mt-3 rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-3">
            <div className="text-xs text-slate-500">Conta admin</div>
            <div className="mt-1 text-sm text-slate-200 break-words">{user?.email}</div>
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
                subtitle="Visão rápida (últimos 300 pedidos carregados)."
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
                              {o.timeline?.[0]?.title ? <div className="text-[11px] text-slate-500">{o.timeline[0].title}</div> : null}
                            </td>
                            <td className="py-2 pr-3 min-w-[220px]">
                              <div className="text-slate-100">{o.customer_name || o.profile?.full_name || "—"}</div>
                              <div className="text-[11px] text-slate-500">{o.customer_email || ""}</div>
                              {Number(o.related_upgrades_count || 0) > 0 ? <div className="text-[11px] text-violet-200/80">Upgrade VIP vinculado</div> : null}
                            </td>
                            <td className="py-2 pr-3 whitespace-nowrap">{fmtBRL(o.total)}</td>
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

              <div className="rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-3">
                <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
                  <label className="block md:col-span-2">
                    <div className="text-xs text-slate-500 mb-1">Busca</div>
                    <input
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="ID, email, nome, telefone, item, rastreio..."
                      className="w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-slate-100"
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

                  <div className="flex items-end justify-end">
                    <button
                      onClick={() => {
                        setQ("");
                        setFilterPay("all");
                        setFilterProd("all");
                        setFilterType("all");
                        setFilterDateFrom(toDateInputValue(new Date(Date.now() - 29 * 86400000)));
                        setFilterDateTo(toDateInputValue(new Date()));
                      }}
                      className="rounded-xl px-3 py-2 text-sm text-slate-200 hover:bg-white/4 ring-1 ring-white/10"
                    >
                      Limpar filtros
                    </button>
                  </div>
                </div>
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
                              </td>
                              <td className="py-3 px-3 whitespace-nowrap">{fmtBRL(o.total)}</td>
                              <td className="py-3 px-3 whitespace-nowrap">
                                <span className={`${badgeBase} ${pay.cls}`}>{pay.label}</span>
                              </td>
                              <td className="py-3 px-3 whitespace-nowrap">
                                <span className={`${badgeBase} ${prod.cls}`}>{prod.label}</span>
                              </td>
                              <td className="py-3 px-3 whitespace-nowrap">
                                {o.shipping_tracking ? (
                                  <button
                                    onClick={() => {
                                      copyToClipboard(o.shipping_tracking);
                                      showToast("📋 Rastreio copiado!");
                                    }}
                                    className="text-slate-100 hover:underline"
                                  >
                                    {o.shipping_tracking}
                                  </button>
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



          {section === "clients" ? (
            <div className="space-y-4">
              <SectionTitle
                icon="groups"
                title="Clientes"
                subtitle="Gerencie cadastros, endereços e acesso dos usuários."
                right={
                  <div className="flex items-center gap-2">
                    <input value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} placeholder="Buscar por nome, e-mail, CPF..." className="rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-sm text-white min-w-[260px]" />
                    <button onClick={() => fetchClients()} className="rounded-xl px-3 py-2 text-sm text-slate-200 hover:bg-white/4 ring-1 ring-white/10">Atualizar</button>
                  </div>
                }
              />
              {clientsError ? <div className="rounded-2xl bg-red-500/10 ring-1 ring-red-500/20 px-4 py-3 text-red-100">{clientsError}</div> : null}
              <div className="rounded-2xl bg-white/[0.03] ring-1 ring-white/10 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-slate-400 bg-white/[0.02]">
                      <tr className="border-b border-white/10">
                        <th className="py-3 px-4">Cliente</th>
                        <th className="py-3 px-4">Contato</th>
                        <th className="py-3 px-4">CPF</th>
                        <th className="py-3 px-4">Cidade</th>
                        <th className="py-3 px-4">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="text-slate-200">
                      {clientsLoading ? <tr><td colSpan={5} className="px-4 py-6 text-slate-400">Carregando clientes…</td></tr> : null}
                      {!clientsLoading && !filteredClients.length ? <tr><td colSpan={5} className="px-4 py-6 text-slate-400">Nenhum cliente encontrado.</td></tr> : null}
                      {!clientsLoading && filteredClients.map((c) => (
                        <tr key={c.id} className="border-b border-white/5">
                          <td className="px-4 py-3"><div className="font-semibold text-white">{c.full_name || '—'}</div><div className="text-[11px] text-slate-500">{shortId(c.id)}</div></td>
                          <td className="px-4 py-3"><div>{c.email || '—'}</div><div className="text-[11px] text-slate-500">{c.phone || '—'}</div></td>
                          <td className="px-4 py-3">{c.cpf || '—'}</td>
                          <td className="px-4 py-3">{[c.city, c.state].filter(Boolean).join(' / ') || '—'}</td>
                          <td className="px-4 py-3"><button onClick={() => setClientEditor({ open: true, client: c })} className="rounded-xl px-3 py-2 text-sm text-slate-200 hover:bg-white/4 ring-1 ring-white/10">Editar</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}

          {section === "coupons" ? (
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
                subtitle="Organize ciclos VIP ativos e acompanhe as votações do próximo tema."
                right={
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => fetchVipVoting()}
                      className="rounded-xl px-3 py-2 text-sm text-slate-200 hover:bg-white/4 ring-1 ring-white/10"
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
                        className="rounded-xl px-3 py-2 text-sm font-semibold bg-emerald-400 text-black ring-4 ring-emerald-400/20"
                      >
                        + Nova votação
                      </button>
                    ) : null}
                  </div>
                }
              />

              <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-4">
                <div className="rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-white">Ciclo ativo exibido para o usuário</div>
                      <div className="mt-1 text-sm text-slate-400">Escolha quais miniaturas/bosses entram em cada ciclo e defina qual mês está valendo na Área VIP.</div>
                    </div>
                    <button
                      onClick={() => setVipCycleEditor({ cycle_key: nextMonthKey(), selected_ids: [], activate: true })}
                      className="rounded-xl px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/4 ring-1 ring-white/10"
                    >
                      + Novo ciclo
                    </button>
                  </div>

                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="rounded-xl bg-black/20 ring-1 ring-white/10 p-3">
                      <div className="text-[11px] text-slate-500 uppercase tracking-wide">Ativo agora</div>
                      <div className="mt-1 text-lg font-semibold text-white">{vipControl.active_cycle_key || '—'}</div>
                    </div>
                    <div className="rounded-xl bg-black/20 ring-1 ring-white/10 p-3">
                      <div className="text-[11px] text-slate-500 uppercase tracking-wide">Ciclos montados</div>
                      <div className="mt-1 text-lg font-semibold text-white">{vipControl.cycles.length}</div>
                    </div>
                    <div className="rounded-xl bg-black/20 ring-1 ring-white/10 p-3">
                      <div className="text-[11px] text-slate-500 uppercase tracking-wide">Itens disponíveis</div>
                      <div className="mt-1 text-lg font-semibold text-white">{vipControl.library.length}</div>
                    </div>
                  </div>

                  {vipControlLoading ? <div className="mt-4 text-slate-400">Carregando controle VIP...</div> : null}
                  {vipControlError ? <div className="mt-4 rounded-xl bg-red-500/10 ring-1 ring-red-500/30 px-3 py-2 text-sm text-red-200">{vipControlError}</div> : null}

                  <div className="mt-4 rounded-2xl bg-black/20 ring-1 ring-white/10 p-4">
                    <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                      <label className="block sm:max-w-[180px]">
                        <div className="text-xs text-slate-400 mb-1">Ciclo</div>
                        <input
                          value={vipCycleEditor.cycle_key}
                          onChange={(e) => setVipCycleEditor((prev) => ({ ...prev, cycle_key: e.target.value }))}
                          placeholder="YYYY-MM"
                          className="w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-slate-100"
                        />
                      </label>
                      <label className="inline-flex items-center gap-2 text-sm text-slate-200">
                        <input
                          type="checkbox"
                          checked={!!vipCycleEditor.activate}
                          onChange={(e) => setVipCycleEditor((prev) => ({ ...prev, activate: e.target.checked }))}
                        />
                        Definir como ciclo ativo ao salvar
                      </label>
                      <div className="sm:ml-auto flex items-center gap-2">
                        {vipCycleEditor.cycle_key ? (
                          <button
                            onClick={() => deleteVipCycle(vipCycleEditor.cycle_key)}
                            disabled={vipCycleBusy}
                            className="rounded-xl px-4 py-2 text-sm font-semibold text-red-100 bg-red-500/10 ring-1 ring-red-500/30 disabled:opacity-60"
                          >
                            Excluir ciclo
                          </button>
                        ) : null}
                        <button
                          onClick={saveVipCycle}
                          disabled={vipCycleBusy}
                          className="rounded-xl px-4 py-2 text-sm font-semibold bg-emerald-400 text-black ring-4 ring-emerald-400/20 disabled:opacity-60"
                        >
                          {vipCycleBusy ? 'Salvando...' : 'Salvar ciclo'}
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {(vipControl.cycles || []).map((cycle) => (
                        <button
                          key={cycle.cycle_key}
                          onClick={() => loadVipCycleIntoEditor(cycle.cycle_key)}
                          className={[
                            'rounded-full px-3 py-1.5 text-xs ring-1 transition',
                            String(vipCycleEditor.cycle_key || '') === String(cycle.cycle_key)
                              ? 'bg-cyan-400/15 text-cyan-100 ring-cyan-400/30'
                              : 'bg-white/[0.03] text-slate-200 ring-white/10 hover:bg-white/[0.06]'
                          ].join(' ')}
                        >
                          {cycle.cycle_key} • {cycle.total_items} itens
                          {cycle.is_active ? ' • ativo' : ''}
                        </button>
                      ))}
                    </div>

                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[520px] overflow-y-auto pr-1">
                      {(vipControl.library || []).map((item) => {
                        const selected = (vipCycleEditor.selected_ids || []).includes(String(item.id));
                        const assignedCycle = String(item?.cycle_key || '');
                        const isBoss = String(item?.item_type || '').toLowerCase() === 'boss';
                        return (
                          <button
                            type="button"
                            key={item.id}
                            onClick={() => toggleVipCycleItem(String(item.id))}
                            className={[
                              'text-left rounded-2xl p-3 ring-1 transition',
                              selected ? 'bg-cyan-400/10 ring-cyan-400/30' : 'bg-white/[0.03] ring-white/10 hover:bg-white/[0.05]'
                            ].join(' ')}
                          >
                            <div className="flex items-start gap-3">
                              <div className="h-16 w-16 rounded-xl overflow-hidden bg-black/20 ring-1 ring-white/10 shrink-0">
                                {item.image_url ? <img src={item.image_url} alt={item.title} className="h-full w-full object-cover" loading="lazy" /> : null}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <div className="text-sm font-semibold text-slate-100 truncate">{item.title}</div>
                                  <span className={isBoss ? 'rounded-full px-2 py-0.5 text-[10px] bg-fuchsia-500/15 text-fuchsia-200 ring-1 ring-fuchsia-500/20' : 'rounded-full px-2 py-0.5 text-[10px] bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-500/20'}>
                                    {isBoss ? 'Boss' : 'Mini'}
                                  </span>
                                  {assignedCycle ? (
                                    <span className="rounded-full px-2 py-0.5 text-[10px] bg-white/6 text-slate-300 ring-1 ring-white/10">
                                      {assignedCycle}
                                    </span>
                                  ) : null}
                                </div>
                                {item.description ? <div className="mt-1 text-xs text-slate-500 line-clamp-2">{item.description}</div> : null}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    {(vipControl.cycles || []).map((cycle) => (
                      <div key={cycle.cycle_key} className="rounded-xl bg-black/20 ring-1 ring-white/10 p-3 flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-slate-100">{cycle.cycle_key}</div>
                          <div className="text-xs text-slate-400">{cycle.miniatures_count} minis • {cycle.boss_count} boss • {cycle.total_items} itens</div>
                        </div>
                        <div className="flex items-center gap-2">
                          {cycle.is_active ? <span className="rounded-full px-2 py-1 text-[11px] bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/20">Ativo</span> : null}
                          <button
                            onClick={() => loadVipCycleIntoEditor(cycle.cycle_key)}
                            className="rounded-xl px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/4 ring-1 ring-white/10"
                          >
                            Editar ciclo
                          </button>
                          {!cycle.is_active ? (
                            <button
                              onClick={() => activateVipCycle(cycle.cycle_key)}
                              disabled={vipCycleBusy}
                              className="rounded-xl px-3 py-2 text-xs font-semibold text-emerald-100 bg-emerald-500/10 hover:bg-emerald-500/20 ring-1 ring-emerald-500/30 disabled:opacity-60"
                            >
                              Ativar ciclo
                            </button>
                          ) : null}
                          <button
                            onClick={() => deleteVipCycle(cycle.cycle_key)}
                            disabled={vipCycleBusy}
                            className="rounded-xl px-3 py-2 text-xs font-semibold text-red-100 bg-red-500/10 hover:bg-red-500/20 ring-1 ring-red-500/30 disabled:opacity-60"
                          >
                            Excluir ciclo
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-white">Votações do próximo tema</div>
                      <div className="mt-1 text-sm text-slate-400">Continue criando e encerrando votações por aqui.</div>
                    </div>
                  </div>
                  {vipPollsLoading ? <div className="mt-4 text-slate-400">Carregando...</div> : null}
                  {vipPollsError ? <div className="mt-4 text-red-200">{vipPollsError}</div> : null}

                  {!vipPollsLoading && !vipPollsError && !vipPolls.length ? (
                    <div className="mt-4 text-slate-400">Nenhuma votação encontrada.</div>
                  ) : null}

                  <div className="mt-4 space-y-4">
                  {vipPolls.map((p, idx) => (
                    <div key={idx} className="rounded-2xl bg-black/20 ring-1 ring-white/10 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-white font-semibold">{p?.poll?.title || "Votação"}</div>
                          <div className="text-xs text-slate-500">
                            {p?.poll?.month_key || "—"} • {p?.total_votes || 0} votos • {p?.poll?.status || "—"}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
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
                              className="rounded-xl px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/4 ring-1 ring-white/10"
                            >
                              Encerrar votação
                            </button>
                          ) : null}

                          {String(p?.poll?.status || "").toLowerCase() === "closed" ? (
                            <button
                              onClick={() => setDeleteVote({ open: true, poll: p, busy: false, error: "" })}
                              className="rounded-xl px-3 py-2 text-xs font-semibold text-red-200 hover:bg-red-500/10 ring-1 ring-red-500/30"
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
                            <div className="mt-3 rounded-xl bg-emerald-500/10 ring-1 ring-emerald-400/20 p-3">
                              <div className="text-xs uppercase tracking-wide text-emerald-200/90">Vencedor</div>
                              <div className="mt-1 text-slate-100 font-extrabold">{winner.title}</div>
                            </div>
                          ) : (
                            <div className="mt-3 rounded-xl bg-cyan-500/10 ring-1 ring-cyan-400/20 p-3 text-sm text-cyan-200">
                              Votação encerrada, mas o vencedor não está salvo no banco (adicione a coluna <b>winner_option_id</b> em <b>vip_theme_polls</b>).
                            </div>
                          );
                        })()
                      ) : null}

                      <div className="mt-3 space-y-2">
                        {(p?.options || []).map((o) => (
                          <div key={o.id} className="rounded-xl bg-white/[0.03] ring-1 ring-white/10 p-2">
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0 flex items-center gap-3">
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
          ) : null}

          {section === "help" ? (
            <div className="space-y-4">
              <SectionTitle icon="help" title="Atalhos / Processo" subtitle="Checklist rápido para operar o admin sem esquecer nada." />
              <div className="rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-4 space-y-3">
                <div className="text-sm text-slate-200">
                  <span className="text-white font-semibold">Fluxo recomendado:</span>
                </div>
                <ol className="list-decimal pl-5 text-sm text-slate-300 space-y-1">
                  <li>Abra <b>Pedidos</b> e filtre por <b>Pagamento: Pago</b>.</li>
                  <li>Em cada pedido pago, coloque <b>Em produção</b> (com estimativa) e depois <b>Pronto</b>.</li>
                  <li>Quando postar, adicione o <b>Rastreio</b> e marque como <b>Enviado</b>.</li>
                  <li>Ao entregar, marque como <b>Entregue</b>.</li>
                  <li>Se houver solicitação de reembolso, marque como <b>Reembolso solicitado</b> (e trate no provedor).</li>
                </ol>
                <div className="text-sm text-slate-300">
                  <b>Dicas:</b> clique no rastreio para copiar; use o botão WhatsApp nos detalhes para avisar o cliente.
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
        onRequestRefund={(o) => updateOrder(o?.id, { refund_requested: true, refund_requested_at: new Date().toISOString() })}
        onDeleteOrder={(o) => deleteOrder(o?.id || o?.order_id)}
        onResendEmail={(o) => resendOrderEmail(o?.id || o?.order_id)}
        resendBusy={resendEmailBusyId && String(resendEmailBusyId) === String(activeOrder?.id)}
        toast={toast}
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

      <ClientEditModal
        open={clientEditor.open}
        client={clientEditor.client}
        accessToken={accessToken}
        onClose={() => setClientEditor({ open: false, client: null })}
        onSaved={() => fetchClients()}
        showToast={showToast}
      />

      <NewManualOrderModal open={newOrderOpen} accessToken={accessToken} onClose={() => setNewOrderOpen(false)} onCreated={() => { fetchOrders(); fetchClients(); }} showToast={showToast} />

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
    </div>
  );
}