import React from 'react'

export default function VipAreaTabs({ tabs, activeTab, onChange }) {
  const buttons = React.useRef({})
  const activate = (key) => {
    onChange(key)
    buttons.current[key]?.focus({ preventScroll: true })
  }
  return (
    <nav className="vip-tabs" aria-label="Navegação da área VIP">
      <div
        role="tablist"
        aria-label="Áreas do clube"
        style={{
          gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))`,
        }}
      >
        {tabs.map((tab, index) => (
          <button
            key={tab.k}
            ref={(node) => {
              buttons.current[tab.k] = node
            }}
            type="button"
            role="tab"
            id={`vip-tab-${tab.k}`}
            aria-selected={activeTab === tab.k}
            aria-controls={`vip-panel-${tab.k}`}
            tabIndex={activeTab === tab.k ? 0 : -1}
            onClick={() => onChange(tab.k)}
            onKeyDown={(event) => {
              const target =
                event.key === 'ArrowRight'
                  ? (index + 1) % tabs.length
                  : event.key === 'ArrowLeft'
                    ? (index - 1 + tabs.length) % tabs.length
                    : event.key === 'Home'
                      ? 0
                      : event.key === 'End'
                        ? tabs.length - 1
                        : -1
              if (target >= 0) {
                event.preventDefault()
                activate(tabs[target].k)
              }
            }}
          >
            <span className="material-icons" aria-hidden="true">
              {tab.ic}
            </span>
            <span>{tab.mobileLabel || tab.label}</span>
            <small>{tab.badge}</small>
          </button>
        ))}
      </div>
    </nav>
  )
}
