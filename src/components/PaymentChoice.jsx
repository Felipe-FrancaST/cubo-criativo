import React from 'react'
import './payment-choice.css'

/** O mesmo seletor de cobrança em carrinho, assinatura e encomenda personalizada. */
export function PaymentChoice({ value, onChange, disabled = false }) {
  return (
    <div className="checkout-choice">
      <p className="checkout-choice-title">FORMA DE PAGAMENTO</p>
      <div className="checkout-choice-group" role="group" aria-label="Forma de pagamento">
        {[
          { id: 'pix', icon: 'qr_code_2', title: 'Pix', detail: 'QR Code ou copia e cola' },
          { id: 'card', icon: 'credit_card', title: 'Cartão', detail: 'Checkout seguro Mercado Pago' },
        ].map((option) => (
          <button
            key={option.id}
            type="button"
            className={`checkout-choice-option ${value === option.id ? 'is-selected' : ''}`}
            aria-pressed={value === option.id}
            disabled={disabled}
            onClick={() => onChange(option.id)}
          >
            <span className="material-icons checkout-choice-icon" aria-hidden="true">{option.icon}</span>
            <span className="checkout-choice-copy">
              <strong>{option.title}</strong>
              <small>{option.detail}</small>
            </span>
            <span className="material-icons checkout-choice-radio" aria-hidden="true">
              {value === option.id ? 'radio_button_checked' : 'radio_button_unchecked'}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

export function PaymentActionButton({ method, loading = false, disabled = false, onClick, label, loadingLabel, className = '' }) {
  return (
    <button
      type="button"
      className={`checkout-action ${className}`.trim()}
      onClick={onClick}
      disabled={disabled || loading}
      aria-busy={loading}
    >
      {loading ? <span className="checkout-action-spinner" aria-hidden="true" /> : (
        <span className="material-icons checkout-action-icon" aria-hidden="true">{method === 'pix' ? 'qr_code_2' : 'credit_card'}</span>
      )}
      <span aria-live="polite">{loading ? loadingLabel || 'Preparando pagamento…' : label || (method === 'pix' ? 'Pagar com Pix' : 'Pagar com cartão')}</span>
      {!loading ? <span className="material-icons checkout-action-arrow" aria-hidden="true">arrow_forward</span> : null}
    </button>
  )
}
