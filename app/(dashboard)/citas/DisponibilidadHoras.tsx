'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface CitaOcupada {
  hora_cita: string
  estado: string
}

interface Props {
  fecha: string
  citasOcupadas: CitaOcupada[]
  onSelect: (hora: string) => void
  horaSeleccionada?: string
}

// MVP: slots fijos 08:00–18:00 cada 30 min. TODO: leer horario desde configuracion_sucursal cuando exista esa tabla
const HORAS = [
  '08:00','08:30','09:00','09:30','10:00','10:30',
  '11:00','11:30','12:00','12:30','13:00','13:30',
  '14:00','14:30','15:00','15:30','16:00','16:30',
  '17:00','17:30','18:00',
]

export function DisponibilidadHoras({ fecha, citasOcupadas, onSelect, horaSeleccionada }: Props) {
  const [seleccionada, setSeleccionada] = useState(horaSeleccionada ?? '')

  useEffect(() => {
    if (horaSeleccionada) setSeleccionada(horaSeleccionada)
  }, [horaSeleccionada])

  const horasOcupadas = new Set(
    citasOcupadas
      .filter(c => !['cancelada','no_show'].includes(c.estado))
      .map(c => c.hora_cita.slice(0, 5))
  )

  function handleSelect(h: string) {
    if (horasOcupadas.has(h)) return
    setSeleccionada(h)
    onSelect(h)
  }

  const ocupadas = HORAS.filter(h => horasOcupadas.has(h)).length
  const disponibles = HORAS.length - ocupadas

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-white border border-gray-300" />
          Disponible ({disponibles})
        </span>
        <span className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-gray-100 border border-gray-200" />
          Ocupado ({ocupadas})
        </span>
        <span className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-blue-600" />
          Seleccionado
        </span>
      </div>

      {!fecha ? (
        <p className="text-sm text-gray-400 italic">Selecciona una fecha para ver disponibilidad</p>
      ) : (
        <div className="grid grid-cols-7 gap-1.5">
          {HORAS.map(h => {
            const ocupada = horasOcupadas.has(h)
            const esSel = seleccionada === h
            return (
              <button
                key={h}
                type="button"
                disabled={ocupada}
                onClick={() => handleSelect(h)}
                className={cn(
                  'py-2 text-xs font-medium rounded-lg border transition-colors',
                  esSel
                    ? 'bg-blue-600 text-white border-blue-600'
                    : ocupada
                    ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:text-blue-600'
                )}
              >
                {h}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
