'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { updateEstadoCotizacionAction } from '@/app/actions/refacciones'

const ESTADOS: Record<string, { label: string; color: string; bg: string }> = {
  borrador:  { label: 'Borrador',  color: 'text-gray-600',    bg: 'bg-gray-100 border-gray-300' },
  enviada:   { label: 'Enviada',   color: 'text-blue-700',    bg: 'bg-blue-100 border-blue-300' },
  abierta:   { label: 'Abierta',   color: 'text-indigo-700',  bg: 'bg-indigo-100 border-indigo-300' },
  aprobada:  { label: 'Aprobada',  color: 'text-green-700',   bg: 'bg-green-100 border-green-300' },
  rechazada: { label: 'Rechazada', color: 'text-red-600',     bg: 'bg-red-100 border-red-300' },
  vencida:   { label: 'Vencida',   color: 'text-yellow-700',  bg: 'bg-yellow-100 border-yellow-300' },
}

const TRANSITIONS: Record<string, string[]> = {
  borrador:  ['enviada', 'aprobada', 'rechazada'],
  enviada:   ['abierta', 'aprobada', 'rechazada', 'vencida'],
  abierta:   ['aprobada', 'rechazada', 'vencida'],
  aprobada:  [],
  rechazada: [],
  vencida:   [],
}

interface CambiarEstadoCotizacionProps {
  cotId: string
  estadoActual: string
}

export function CambiarEstadoCotizacion({ cotId, estadoActual }: CambiarEstadoCotizacionProps) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const config = ESTADOS[estadoActual] ?? { label: estadoActual, color: 'text-gray-600', bg: 'bg-gray-100 border-gray-300' }
  const transitions = TRANSITIONS[estadoActual] ?? []

  async function cambiar(nuevoEstado: string) {
    setLoading(nuevoEstado)
    setError(null)
    const result = await updateEstadoCotizacionAction(cotId, nuevoEstado)
    if (result?.error) setError(result.error)
    else router.refresh()
    setLoading(null)
  }

  return (
    <div className="space-y-4">
      <div className={cn('inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium', config.bg, config.color)}>
        <span className="w-2 h-2 rounded-full bg-current" />
        {config.label}
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      {transitions.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Mover a:</p>
          <div className="flex flex-wrap gap-2">
            {transitions.map((estado) => {
              const cfg = ESTADOS[estado]
              if (!cfg) return null
              return (
                <button
                  key={estado}
                  onClick={() => cambiar(estado)}
                  disabled={!!loading}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all',
                    'hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed',
                    cfg.bg, cfg.color
                  )}
                >
                  {loading === estado ? (
                    <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-current" />
                  )}
                  {cfg.label}
                </button>
              )
            })}
          </div>
        </div>
      ) : (
        <p className="text-xs text-gray-400">Estado final</p>
      )}
    </div>
  )
}
