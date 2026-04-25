'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, X } from 'lucide-react'
import { simularNoShowAction } from '@/app/actions/citas'

interface DemoNoShowButtonProps {
  citaId: string
}

export function DemoNoShowButton({ citaId }: DemoNoShowButtonProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [result,  setResult]       = useState<{ wa_mensaje?: string; error?: string } | null>(null)
  const [visible, setVisible]      = useState(false)

  function handleNoShow() {
    startTransition(async () => {
      const res = await simularNoShowAction(citaId)
      if (res.ok) {
        setResult({ wa_mensaje: res.wa_mensaje })
        router.refresh()
      } else {
        setResult({ error: res.error })
      }
    })
  }

  if (result) {
    return (
      <div className={`rounded-lg p-4 text-sm space-y-2 ${result.error ? 'bg-red-50 border border-red-200' : 'bg-orange-50 border border-orange-200'}`}>
        <div className="flex items-center justify-between">
          <p className={`font-medium text-xs ${result.error ? 'text-red-700' : 'text-orange-700'}`}>
            {result.error ? result.error : 'Cita marcada como no-show'}
          </p>
          <button onClick={() => setResult(null)} className="text-gray-400 hover:text-gray-600">
            <X size={14} />
          </button>
        </div>
        {result.wa_mensaje && (
          <div className="bg-white rounded border border-orange-200 p-3">
            <p className="text-[11px] text-gray-500 mb-1 font-medium">Mensaje WA que se enviará al cliente:</p>
            <p className="text-xs text-gray-700 whitespace-pre-wrap">{result.wa_mensaje}</p>
          </div>
        )}
      </div>
    )
  }

  return visible ? (
    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm text-orange-700">
        <AlertTriangle size={14} />
        <span className="font-medium">¿Simular no-show para demo?</span>
      </div>
      <p className="text-xs text-gray-500">
        Marcará la cita como no-show y mostrará el mensaje WA de seguimiento que se enviaría al cliente.
      </p>
      <div className="flex gap-2">
        <button
          onClick={handleNoShow}
          disabled={pending}
          className="px-3 py-1.5 bg-orange-500 text-white text-xs font-medium rounded-lg hover:bg-orange-600 disabled:opacity-50"
        >
          {pending ? 'Procesando…' : 'Confirmar no-show'}
        </button>
        <button
          onClick={() => setVisible(false)}
          className="px-3 py-1.5 border border-gray-300 text-gray-600 text-xs rounded-lg hover:bg-gray-50"
        >
          Cancelar
        </button>
      </div>
    </div>
  ) : (
    <button
      onClick={() => setVisible(true)}
      className="flex items-center gap-1.5 px-3 py-1.5 border border-orange-300 text-orange-600 text-xs rounded-lg hover:bg-orange-50 transition-colors"
    >
      <AlertTriangle size={12} />
      Demo: Simular no-show
    </button>
  )
}
