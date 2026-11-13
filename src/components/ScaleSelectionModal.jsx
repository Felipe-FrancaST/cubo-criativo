import React from 'react'
import Modal from './Modal.jsx'
import { fmtBRL, centsToBRL } from '../lib/pricing.js'
import { getScaleChoices, findChosenScale } from '../lib/scaleSelection.js'
import './scale-selection.css'

export default function ScaleSelectionModal({ product, action, initialScale = '', onClose, onConfirm }) {
  const open = !!product && !!action
  const choices = React.useMemo(() => getScaleChoices(product), [product])
  const [selected, setSelected] = React.useState('')

  React.useEffect(() => {
    setSelected(findChosenScale(choices, initialScale)?.label || '')
  }, [product?.id, action, initialScale])

  const chosen = findChosenScale(choices, selected)
  const isPurchase = action === 'buy'
  const buttonText = isPurchase ? 'Comprar agora' : 'Adicionar ao carrinho'

  return (
    <Modal open={open} onClose={onClose} title="Escolha a escala da sua peça" maxWidth="max-w-lg" widthClass="w-[94vw] sm:w-[480px]" zIndexClass="z-[230]" bodyClassName="scale-modal-body">
      <div className="scale-modal-intro">
        {product?.img ? <img src={product.img} alt="" /> : <span className="material-icons" aria-hidden="true">view_in_ar</span>}
        <div>
          <strong>{product?.nome || 'Produto'}</strong>
          <p>Selecione a escala desejada para esta peça antes de {isPurchase ? 'comprar' : 'adicionar ao carrinho'}.</p>
        </div>
      </div>
      <div className="scale-modal-section">
        <p id="scale-modal-hint" className="scale-modal-label">ESCALAS DISPONÍVEIS</p>
        <div role="radiogroup" aria-labelledby="scale-modal-hint" className="scale-modal-options">
          {choices.map(choice => (
            <button key={choice.label} type="button" role="radio" aria-checked={selected === choice.label}
              className={`scale-modal-option ${selected === choice.label ? 'is-selected' : ''}`}
              onClick={() => setSelected(choice.label)}>
              <span className="material-icons scale-modal-radio" aria-hidden="true">{selected === choice.label ? 'radio_button_checked' : 'radio_button_unchecked'}</span>
              <span className="scale-modal-option-label">{choice.label}</span>
              <strong>{fmtBRL(centsToBRL(choice.priceCents))}</strong>
            </button>
          ))}
          {!choices.length && <p className="scale-modal-unavailable" role="status">Não há escalas com preço disponível para esta peça. Consulte a loja antes de comprar.</p>}
        </div>
      </div>
      {chosen ? (
        <div className="scale-modal-total"><span>Total da peça</span><strong>{fmtBRL(centsToBRL(chosen.priceCents))}</strong></div>
      ) : <p className="scale-modal-choose">Escolha uma opção para continuar.</p>}
      <button type="button" className="scale-modal-confirm" disabled={!chosen}
        onClick={() => {
          if (!chosen) return
          onConfirm?.({ escala: chosen.label, unitPrice: centsToBRL(chosen.priceCents) })
          onClose?.()
        }}>
        <span className="material-icons" aria-hidden="true">{isPurchase ? 'shopping_bag' : 'add_shopping_cart'}</span>
        {buttonText}
        <span className="material-icons" aria-hidden="true">arrow_forward</span>
      </button>
    </Modal>
  )
}
