import React from 'react'

const TABS = [
  { key: 'profile', label: 'Dados e entrega', icon: 'person_outline' },
  { key: 'security', label: 'Segurança', icon: 'lock_outline' },
  { key: 'favorites', label: 'Favoritos', icon: 'favorite_border' },
  { key: 'coupons', label: 'Cupons', icon: 'confirmation_number' },
  { key: 'reviews', label: 'Avaliações', icon: 'star_outline' },
]

export default function AccountSettingsTabs({ active, onChange }) {
  const refs = React.useRef({})
  return (
    <nav className="account-navigation" aria-label="Seções da conta">
      <div role="tablist" aria-label="Configurações da conta">
        {TABS.map((tab, index) => (
          <button
            key={tab.key}
            ref={(node) => {
              refs.current[tab.key] = node
            }}
            type="button"
            role="tab"
            id={`account-tab-${tab.key}`}
            aria-controls={`account-panel-${tab.key}`}
            aria-selected={active === tab.key}
            tabIndex={active === tab.key ? 0 : -1}
            onClick={() => onChange(tab.key)}
            onKeyDown={(event) => {
              const direction = ['ArrowRight', 'ArrowDown'].includes(event.key)
                ? 1
                : ['ArrowLeft', 'ArrowUp'].includes(event.key)
                  ? -1
                  : 0
              const target = direction
                ? (index + direction + TABS.length) % TABS.length
                : event.key === 'Home'
                  ? 0
                  : event.key === 'End'
                    ? TABS.length - 1
                    : -1
              if (target < 0) return
              event.preventDefault()
              onChange(TABS[target].key)
              refs.current[TABS[target].key]?.focus({ preventScroll: true })
            }}
          >
            <span className="material-icons" aria-hidden="true">
              {tab.icon}
            </span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}
