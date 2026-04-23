'use client'

import { useState } from 'react'
import { toggleAutomationRuleAction } from '@/app/actions/automatizaciones'
import { Play, Pause } from 'lucide-react'

export function ToggleRuleButton({ id, activa }: { id: string; activa: boolean }) {
  const [loading, setLoading] = useState(false)

  async function handleToggle() {
    setLoading(true)
    await toggleAutomationRuleAction(id, !activa)
    setLoading(false)
  }

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0 ${
        activa
          ? 'text-gray-600 border border-gray-300 hover:bg-gray-50'
          : 'bg-green-600 text-white hover:bg-green-700'
      } disabled:opacity-50`}
    >
      {activa ? <><Pause size={12} /> Pausar</> : <><Play size={12} /> Activar</>}
    </button>
  )
}
