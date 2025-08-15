import * as React from "react";

export default function Modal({ open, onClose, title, children }) {
  return (
    <div className={`fixed inset-0 z-[70] ${open ? "visible" : "invisible"}`}>
      {/* backdrop */}
      <div
        className={`absolute inset-0 bg-black/60 transition-opacity ${open ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
      />
      {/* painel */}
      <div
        className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
                    w-[94vw] sm:w-[90vw] lg:w-[70vw] max-w-[1100px]
                    bg-slate-900 ring-1 ring-white/10 rounded-2xl
                    transition-transform ${open ? "scale-100" : "scale-95"}`}
      >
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-white/10">
          <h3 className="font-bold">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-2 ring-1 ring-white/15">
            <span className="material-icons">close</span>
          </button>
        </div>
        <div className="p-3 sm:p-4">
          {children}
        </div>
      </div>
    </div>
  );
}
