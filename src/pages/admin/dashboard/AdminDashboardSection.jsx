import React from "react";
import { DetailRow, KpiCard, OrderBadgeCluster, SectionTitle, SidebarItem, TimelineList } from "../orders/AdminOrdersComponents.jsx";
import { badgeBase, copyToClipboard, daysBetween, emailAuditBadge, endOfDay, exportCsv, fmtAddress, fmtBRL, fmtDate, onlyDigits, prodStatusBadge, shortId, startOfDay, statusBadge, toDateInputValue } from "../orders/adminOrdersUtils.js";
import AdminProductsSection from "../products/AdminProductsSection.jsx";
import AdminReviewsSection from "../reviews/AdminReviewsSection.jsx";
import AdminManagementSection from "../admins/AdminManagementSection.jsx";
import { TRACKING_CARRIERS, inferTrackingCarrierFromUrl, normalizeTrackingCarrier, resolveTrackingCarrier, trackingCarrierLabel } from "../../../lib/tracking.js";

export default function AdminDashboardSection({ admin }) {
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
              <SectionTitle
                icon="space_dashboard"
                title="Dashboard"
                subtitle={canManageBusiness ? "Visão rápida da operação, gargalos e receita." : "Visão rápida dos pedidos e da operação."}
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
                {canManageBusiness ? <KpiCard label="Faturamento (pagos)" value={fmtBRL(stats.revenue)} hint="Soma dos pedidos pagos" /> : null}
                {canManageBusiness ? <KpiCard label="VIP" value={stats.vipCount} hint="Pedidos do tipo VIP" /> : null}
                {canManageBusiness ? <KpiCard label="Reembolso solicitado" value={stats.refundReq} hint="Monitorar e tratar" /> : null}
                <KpiCard label="Atrasados" value={stats.overdueCount} hint="Pedidos fora do prazo operacional" />
                {canManageBusiness ? <KpiCard label="Receita hoje" value={fmtBRL(stats.paidToday)} hint="Pagamentos confirmados no dia" /> : null}
                {canManageBusiness ? <KpiCard label="Receita do mês" value={fmtBRL(stats.paidMonth)} hint="Pagamentos confirmados no mês" /> : null}
                {canManageBusiness ? <KpiCard label="Ticket médio" value={fmtBRL(stats.averageTicket)} hint="Média dos pedidos pagos" /> : null}
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
  );
}
