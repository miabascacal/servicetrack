'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { EstadoOT } from '@/types/database'
import { updateEstadoOTAction } from '@/app/actions/taller'

const ESTADO_CONFIG: Record<EstadoOT, { label: string; color: string; bg: string }> = {
  abierta:          { label: 'Abierta',        color: 'text-blue-700',    bg: 'bg-blue-100 border-blue-300' },
  en_proceso:       { label: 'En proceso',      color: 'text-purple-700',  bg: 'bg-purple-100 border-purple-300' },
  en_espera_partes: { label: 'Espera partes',   color: 'text-orange-700',  bg: 'bg-orange-100 border-orange-300' },
  lista:            { label: 'Lista',           color: 'text-green-700',   bg: 'bg-green-100 border-green-300' },
  entregada:        { label: 'Entregada',       color: 'text-gray-600',    bg: 'bg-gray-100 border-gray-300' },
  cancelada:        { label: 'Cancelada',       color: 'text-red-600',     bg: 'bg-red-100 border-red-300' },
}

const ALLOWED_TRANSITIONS: Record<EstadoOT, EstadoOT[]> = {
  abierta:          ['en_proceso', 'cancelada'],
  en_proceso:       ['en_espera_partes', 'lista', 'cancelada'],
  en_espera_partes: ['en_proceso', 'lista', 'cancelada'],
  lista:            ['entregada'],
  entregada:        [],
  cancelada:        [],
}

interface CambiarEstadoOTProps {
  otId: string
  estadoActual: EstadoOT
}

export function CambiarEstadoOT({ otId, estadoActual }: CambiarEstadoOTProps) {
  const router = useRouter()
  const [loading, setLoading] = useState<EstadoOT | null>(null)
  const [error, setError] = useState<string | null>(null)

  const config = ESTADO_CONFIG[estadoActual]
  const transitions = ALLOWED_TRANSITIONS[estadoActual]

  async function cambiar(newEstado: EstadoOT) {
    setLoading(newEstado)
    setError(null)
    const result = await updateEstadoOTAction(otId, newEstado)
    if (result?.error) {
      setError(result.error)
    } else {
      router.refresh()
    }
    setLoading(null)
  }

  return (
    <div className="space-y-4">
      <div className={cn('inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium', config.bg, config.color)}>
        <span className="w-2 h-2 rounded-full bg-current" />
        {config.label}
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
      )}

      {transitions.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Mover a:</p>
          <div className="flex flex-wrap gap-2">
            {transitions.map((estado) => {
              const cfg = ESTADO_CONFIG[estado]
              const isLoading = loading === estado
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
                  {isLoading ? (
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
        <p className="text-xs text-gray-400">Esta OT está en estado final</p>
      )}
    </div>
  )
}
