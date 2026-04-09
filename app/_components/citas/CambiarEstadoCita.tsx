'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { EstadoCita } from '@/types/database'
import { updateCitaEstadoAction } from '@/app/actions/citas'

const ESTADO_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pendiente_contactar: { label: 'Por contactar', color: 'text-yellow-700', bg: 'bg-yellow-100 border-yellow-300' },
  contactada:          { label: 'Contactada',    color: 'text-sky-700',    bg: 'bg-sky-100 border-sky-300' },
  confirmada:          { label: 'Confirmada',    color: 'text-blue-700',   bg: 'bg-blue-100 border-blue-300' },
  en_agencia:          { label: 'En agencia',    color: 'text-indigo-700', bg: 'bg-indigo-100 border-indigo-300' },
  show:                { label: 'Show',          color: 'text-purple-700', bg: 'bg-purple-100 border-purple-300' },
  no_show:             { label: 'No show',       color: 'text-red-700',    bg: 'bg-red-100 border-red-300' },
  terminada:           { label: 'Terminada',     color: 'text-green-700',  bg: 'bg-green-100 border-green-300' },
  cancelada:           { label: 'Cancelada',     color: 'text-gray-600',   bg: 'bg-gray-100 border-gray-300' },
  // legacy values kept for compatibility
  pendiente:   { label: 'Pendiente',   color: 'text-yellow-700', bg: 'bg-yellow-100 border-yellow-300' },
  llegada:     { label: 'Llegó',       color: 'text-indigo-700', bg: 'bg-indigo-100 border-indigo-300' },
  en_proceso:  { label: 'En proceso',  color: 'text-purple-700', bg: 'bg-purple-100 border-purple-300' },
  'no-show':   { label: 'No show',     color: 'text-red-700',    bg: 'bg-red-100 border-red-300' },
}

interface CambiarEstadoCitaProps {
  citaId: string
  estadoActual: EstadoCita
  transitions: EstadoCita[]
}

export function CambiarEstadoCita({ citaId, estadoActual, transitions }: CambiarEstadoCitaProps) {
  const router = useRouter()
  const [loading, setLoading] = useState<EstadoCita | null>(null)
  const [error, setError] = useState<string | null>(null)
  const config = ESTADO_CONFIG[estadoActual] ?? { label: estadoActual, color: 'text-gray-700', bg: 'bg-gray-100 border-gray-300' }

  async function cambiar(newEstado: EstadoCita) {
    setLoading(newEstado)
    setError(null)
    const result = await updateCitaEstadoAction(citaId, newEstado)
    if (result?.error) {
      setError(result.error)
    } else {
      router.refresh()
    }
    setLoading(null)
  }

  return (
    <div className="space-y-4">
      {/* Current state */}
      <div className={cn('inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium', config.bg, config.color)}>
        <span className="w-2 h-2 rounded-full bg-current" />
        {config.label}
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
      )}

      {/* Transition buttons */}
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
                    cfg.bg,
                    cfg.color
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
        <p className="text-xs text-gray-400">Esta cita está en estado final</p>
      )}
    </div>
  )
}
