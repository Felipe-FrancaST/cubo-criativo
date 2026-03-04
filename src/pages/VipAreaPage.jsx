import React from "react";
import VipAreaModal from "../components/VipAreaModal.jsx";

/**
 * Página dedicada da Área VIP (mais espaço e organização).
 * Reusa o mesmo componente do modal em modo "asPage".
 */
export default function VipAreaPage({ onGoHome, onGoVip, onRequireLogin }) {
  return (
    <div className="min-h-[calc(100vh-72px)]">
      <VipAreaModal
        asPage
        open
        onClose={() => {}}
        onGoHome={onGoHome}
        onGoVip={onGoVip}
        onRequireLogin={onRequireLogin}
      />

      {/* respiro final */}
      <div className="h-10" />
    </div>
  );
}
