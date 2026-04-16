'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Wrench, Link2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { EstadoOT } from '@/types/database'
import { vincularOTCitaAction } from '@/app/actions/taller'

interface OTOpcion {
  id: string
  numero_ot: string
  numero_ot_dms: string | null
  estado: EstadoOT
}

interface Props {
  citaId: string
  otVinculada: OTOpcion | null     // OT ya ligada a esta cita (si existe)
  otsDisponibles: OTOpcion[]       // OTs del mismo cliente/vehículo sin cita, no cerradas
}

const ESTADO_LABEL: Partial<Record<EstadoOT, string>> = {
  recibido:    'Recibido',
  diagnostico: 'Diagnóstico',
  en_proceso:  'En proceso',
  listo:       'Listo',
}

const ESTADO_COLOR: Partial<Record<EstadoOT, string>> = {
  recibido:    'bg-blue-100 text-blue-700',
  diagnostico: 'bg-yellow-100 text-yellow-700',
  en_proceso:  'bg-purple-100 text-purple-700',
  listo:       'bg-green-100 text-green-700',
}

export function VincularOTCita({ citaId, otVinculada, otsDisponibles }: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Si ya hay OT vinculada, solo mostrar el link
  if (otVinculada) {
    return (
      <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
        <Wrench size={15} className="text-purple-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-purple-600 font-medium">OT vinculada</p>
          <p className="text-sm font-mono font-semibold text-purple-800">{otVinculada.numero_ot}</p>
          {otVinculada.numero_ot_dms && (
            <p className="text-xs text-purple-500 font-mono">DMS: {otVinculada.numero_ot_dms}</p>
          )}
        </div>
        <Link
          href={`/taller/${otVinculada.id}`}
          className="text-xs text-purple-600 hover:underline shrink-0 font-medium"
        >
          Ver OT →
        </Link>
      </div>
    )
  }

  // Sin OT vinculada y sin opciones disponibles
  if (otsDisponibles.length === 0) {
    return null
  }

  async function handleVincular() {
    if (!selected) return
    setLoading(true)
    setError(null)
    const result = await vincularOTCitaAction(citaId, selected)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    } else {
      router.refresh()
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">
        Vincular OT existente
      </p>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
      )}

      <div className="space-y-2">
        {otsDisponibles.map((ot) => {
          const isSelected = selected === ot.id
          const estadoLabel = ESTADO_LABEL[ot.estado] ?? ot.estado
          const estadoColor = ESTADO_COLOR[ot.estado] ?? 'bg-gray-100 text-gray-600'
          return (
            <button
              key={ot.id}
              type="button"
              onClick={() => setSelected(ot.id)}
              className={cn(
                'w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all',
                isSelected
                  ? 'border-purple-400 bg-purple-50'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              )}
            >
              <Wrench size={14} className={isSelected ? 'text-purple-600' : 'text-gray-400'} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-mono font-medium text-gray-900">{ot.numero_ot}</p>
                {ot.numero_ot_dms && (
                  <p className="text-xs text-gray-400 font-mono">DMS: {ot.numero_ot_dms}</p>
                )}
              </div>
              <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium shrink-0', estadoColor)}>
                {estadoLabel}
              </span>
            </button>
          )
        })}
      </div>

      <button
        type="button"
        onClick={handleVincular}
        disabled={!selected || loading}
        className="flex items-center gap-2 w-full justify-center px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:bg-purple-300 disabled:cursor-not-allowed transition-colors"
      >
        <Link2 size={14} />
        {loading ? 'Vinculando...' : 'Vincular OT seleccionada'}
      </button>
    </div>
  )
}
