import React from "react";
import { DetailRow, KpiCard, OrderBadgeCluster, SectionTitle, SidebarItem, TimelineList } from "../orders/AdminOrdersComponents.jsx";
import { badgeBase, copyToClipboard, daysBetween, emailAuditBadge, endOfDay, exportCsv, fmtAddress, fmtBRL, fmtDate, onlyDigits, prodStatusBadge, shortId, startOfDay, statusBadge, toDateInputValue } from "../orders/adminOrdersUtils.js";
import AdminProductsSection from "../products/AdminProductsSection.jsx";
import AdminReviewsSection from "../reviews/AdminReviewsSection.jsx";
import AdminManagementSection from "../admins/AdminManagementSection.jsx";
import { TRACKING_CARRIERS, inferTrackingCarrierFromUrl, normalizeTrackingCarrier, resolveTrackingCarrier, trackingCarrierLabel } from "../../../lib/tracking.js";

export default function AdminClientsSection({ admin }) {
  const {
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
  } = admin;

  return (
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
  );
}
