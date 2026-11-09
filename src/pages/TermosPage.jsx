import React from 'react'
import LegalDocument from '../components/LegalDocument.jsx'

export default function TermosPage({ onGoHome }) {
  return <LegalDocument kind="terms" onGoHome={onGoHome} />
}
