export default function VipSelectionBar({
  counts,
  miniLimit,
  bossLimit,
  totalLimit,
  complete,
  editable,
  editing,
  saving,
  onSave,
  onEdit,
  message,
}) {
  const remaining = Math.max(0, totalLimit - counts.total)
  return (
    <div className="vip-selection-bar" aria-label="Resumo das escolhas">
      <div className="vip-selection-bar-inner">
        <div className="min-w-0">
          <p>
            {editing ? (
              <>
                <strong>{counts.total}</strong> de {totalLimit} escolhidas
              </>
            ) : (
              <strong>Escolhas salvas</strong>
            )}
          </p>
          <span>
            {counts.mini}/{miniLimit} miniaturas
            {bossLimit > 0 ? ` · ${counts.boss}/${bossLimit} bosses` : ''}
          </span>
          {message && (
            <p className="vip-save-feedback" role="status">
              {message}
            </p>
          )}
        </div>
        <button
          type="button"
          className={editing ? 'customer-primary' : 'customer-secondary'}
          onClick={editing ? onSave : onEdit}
          disabled={
            !editable || saving || (editing && (!complete || !totalLimit))
          }
        >
          {saving
            ? 'Salvando…'
            : !editable
              ? 'Escolhas fechadas'
              : !editing
                ? 'Editar escolhas'
                : complete
                  ? 'Salvar escolhas'
                  : remaining
                    ? `Faltam ${remaining}`
                    : 'Ajuste os tipos'}
        </button>
      </div>
    </div>
  )
}
