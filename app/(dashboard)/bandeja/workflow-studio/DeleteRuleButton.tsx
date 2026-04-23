'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { deleteAutomationRuleAction } from '@/app/actions/automatizaciones'

export function DeleteRuleButton({ id }: { id: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    if (!confirm('¿Eliminar esta regla? Esta acción no se puede deshacer.')) return
    setLoading(true)
    await deleteAutomationRuleAction(id)
    router.refresh()
    setLoading(false)
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 border border-red-200 hover:bg-red-50 transition-colors disabled:opacity-50 shrink-0"
    >
      <Trash2 size={12} />
      {loading ? '...' : 'Eliminar'}
    </button>
  )
}
