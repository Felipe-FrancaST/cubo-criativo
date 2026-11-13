import React from 'react'

export default function StorefrontSearch({ id, value, onChange, placeholder }) {
  return (
    <div className="storefront-search-field">
      <label htmlFor={id} className="storefront-search-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="21" height="21">
          <circle cx="10.8" cy="10.8" r="6.8" />
          <path d="m16 16 4.4 4.4" strokeLinecap="round" />
        </svg>
      </label>
      <input
        id={id}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        enterKeyHint="search"
        aria-label="Buscar produtos"
      />
      {value ? (
        <button type="button" className="storefront-search-clear" onClick={() => onChange('')} aria-label="Limpar busca">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16" aria-hidden="true">
            <path d="M6 6 18 18M18 6 6 18" strokeLinecap="round" />
          </svg>
        </button>
      ) : null}
    </div>
  )
}
