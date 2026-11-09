import React from 'react'
import LegalDocument from '../components/LegalDocument.jsx'

export default function TrocasPage({ onGoHome }) {
  return <LegalDocument kind="returns" onGoHome={onGoHome} />
}
