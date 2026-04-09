'use client'

import { useState, useOptimistic } from 'react'
import Link from 'next/link'
import { Car, Phone, Clock, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { EstadoCita } from '@/types/database'
import { updateCitaEstadoAction } from '@/app/actions/citas'

type CitaData = {
  id: string
  fecha_cita: string
  hora_cita: string
  estado: EstadoCita
  servicio: string | null
  notas: string | null
  cliente: { id: string; nombre: string; apellido: string; whatsapp: string } | null
  vehiculo: { id: string; marca: string; modelo: string; anio: number; placa: string | null } | null
  asesor: { id: string; nombre: string; apellido: string } | null
}

type Column = {
  id: EstadoCita
  label: string
  color: string
  headerBg: string
  dotColor: string
}

const COLUMNS: Column[] = [
  { id: 'pendiente_contactar', label: 'Por contactar', color: 'border-yellow-300', headerBg: 'bg-yellow-50',  dotColor: 'bg-yellow-400' },
  { id: 'contactada',          label: 'Contactada',    color: 'border-sky-300',    headerBg: 'bg-sky-50',     dotColor: 'bg-sky-500' },
  { id: 'confirmada',          label: 'Confirmada',    color: 'border-blue-300',   headerBg: 'bg-blue-50',    dotColor: 'bg-blue-500' },
  { id: 'en_agencia',          label: 'En agencia',    color: 'border-indigo-300', headerBg: 'bg-indigo-50',  dotColor: 'bg-indigo-500' },
  { id: 'no_show',             label: 'No show',       color: 'border-red-300',    headerBg: 'bg-red-50',     dotColor: 'bg-red-500' },
]

// Which estado can move to which
const ALLOWED_TRANSITIONS: Record<string, EstadoCita[]> = {
  pendiente_contactar: ['contactada', 'confirmada', 'no_show', 'cancelada'],
  contactada:          ['confirmada', 'no_show', 'cancelada'],
  confirmada:          ['en_agencia', 'no_show', 'cancelada'],
  en_agencia:          ['show', 'no_show', 'cancelada'],
  show:                [],
  no_show:             ['confirmada'],
  cancelada:           [],
}

interface CitasKanbanProps {
  citas: CitaData[]
}

export function CitasKanban({ citas: initialCitas }: CitasKanbanProps) {
  const [citas, setCitas] = useState(initialCitas)
  const [dragging, setDragging] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<EstadoCita | null>(null)
  const [loading, setLoading] = useState<string | null>(null)

  const byColumn = (estado: string) => citas.filter((c) => c.estado === estado)

  async function moveCita(citaId: string, newEstado: EstadoCita) {
    const cita = citas.find((c) => c.id === citaId)
    if (!cita) return
    const allowed = ALLOWED_TRANSITIONS[cita.estado] ?? []
    if (!allowed.includes(newEstado)) return

    // Optimistic update
    setCitas((prev) =>
      prev.map((c) => (c.id === citaId ? { ...c, estado: newEstado } : c))
    )
    setLoading(citaId)

    const result = await updateCitaEstadoAction(citaId, newEstado)
    if (result?.error) {
      // Rollback
      setCitas((prev) =>
        prev.map((c) => (c.id === citaId ? { ...c, estado: cita.estado } : c))
      )
    }
    setLoading(null)
  }

  function onDragStart(e: React.DragEvent, citaId: string) {
    e.dataTransfer.setData('citaId', citaId)
    setDragging(citaId)
  }

  function onDragEnd() {
    setDragging(null)
    setDragOver(null)
  }

  function onDragOver(e: React.DragEvent, estado: EstadoCita) {
    e.preventDefault()
    setDragOver(estado)
  }

  async function onDrop(e: React.DragEvent, estado: EstadoCita) {
    e.preventDefault()
    const citaId = e.dataTransfer.getData('citaId')
    setDragOver(null)
    if (citaId) await moveCita(citaId, estado)
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 flex-1 min-h-0">
      {COLUMNS.map((col) => {
        const columnCitas = byColumn(col.id as string)
        const isDropTarget = dragOver === col.id

        return (
          <div
            key={col.id}
            className={cn(
              'flex flex-col rounded-xl border-2 transition-colors min-w-[260px] w-[260px] shrink-0',
              isDropTarget ? 'border-blue-400 bg-blue-50/50' : col.color
            )}
            onDragOver={(e) => onDragOver(e, col.id)}
            onDragLeave={() => setDragOver(null)}
            onDrop={(e) => onDrop(e, col.id)}
          >
            {/* Column header */}
            <div className={cn('flex items-center justify-between px-3 py-2.5 rounded-t-lg', col.headerBg)}>
              <div className="flex items-center gap-2">
                <span className={cn('w-2 h-2 rounded-full', col.dotColor)} />
                <span className="text-sm font-semibold text-gray-800">{col.label}</span>
              </div>
              <span className="text-xs font-medium text-gray-500 bg-white/60 px-1.5 py-0.5 rounded-full">
                {columnCitas.length}
              </span>
            </div>

            {/* Cards */}
            <div className="flex flex-col gap-2 p-2 overflow-y-auto flex-1">
              {columnCitas.length === 0 && (
                <div className="flex items-center justify-center py-8 text-xs text-gray-400">
                  Sin citas
                </div>
              )}
              {columnCitas.map((cita) => (
                <CitaCard
                  key={cita.id}
                  cita={cita}
                  isDragging={dragging === cita.id}
                  isLoading={loading === cita.id}
                  allowedTransitions={ALLOWED_TRANSITIONS[cita.estado]}
                  onMove={(newEstado) => moveCita(cita.id, newEstado)}
                  onDragStart={(e) => onDragStart(e, cita.id)}
                  onDragEnd={onDragEnd}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function CitaCard({
  cita,
  isDragging,
  isLoading,
  allowedTransitions,
  onMove,
  onDragStart,
  onDragEnd,
}: {
  cita: CitaData
  isDragging: boolean
  isLoading: boolean
  allowedTransitions: EstadoCita[]
  onMove: (estado: EstadoCita) => void
  onDragStart: (e: React.DragEvent) => void
  onDragEnd: () => void
}) {
  const [showMoveMenu, setShowMoveMenu] = useState(false)

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        'bg-white rounded-lg border border-gray-200 p-3 shadow-sm cursor-grab active:cursor-grabbing transition-all',
        isDragging && 'opacity-40 scale-95',
        isLoading && 'opacity-60 pointer-events-none'
      )}
    >
      {/* Time + date */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <Clock size={11} />
          <span>
            {cita.hora_cita.slice(0, 5)} · {new Date(cita.fecha_cita + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
          </span>
        </div>
        {allowedTransitions.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setShowMoveMenu((v) => !v)}
              className="text-xs text-gray-400 hover:text-gray-600 px-1 transition-colors"
            >
              ···
            </button>
            {showMoveMenu && (
              <div className="absolute right-0 top-5 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1 min-w-[140px]">
                {allowedTransitions.map((estado) => {
                  const col = COLUMNS.find((c) => c.id === estado)
                  return (
                    <button
                      key={estado}
                      onClick={() => { onMove(estado); setShowMoveMenu(false) }}
                      className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <span className={cn('w-1.5 h-1.5 rounded-full', col?.dotColor)} />
                      {col?.label ?? estado}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Client */}
      {cita.cliente && (
        <div className="flex items-center gap-1.5 mb-1.5">
          <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold shrink-0">
            {cita.cliente.nombre.slice(0, 1)}
          </div>
          <Link
            href={`/crm/clientes/${cita.cliente.id}`}
            className="text-sm font-medium text-gray-900 hover:text-blue-600 transition-colors truncate"
            onClick={(e) => e.stopPropagation()}
          >
            {cita.cliente.nombre} {cita.cliente.apellido}
          </Link>
        </div>
      )}

      {/* Vehicle */}
      {cita.vehiculo && (
        <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
          <Car size={11} className="shrink-0" />
          <span className="truncate">
            {cita.vehiculo.marca} {cita.vehiculo.modelo} {cita.vehiculo.anio}
            {cita.vehiculo.placa ? ` · ${cita.vehiculo.placa}` : ''}
          </span>
        </div>
      )}

      {/* Servicio */}
      {cita.servicio && (
        <p className="text-xs text-gray-500 mt-1.5 line-clamp-2">{cita.servicio}</p>
      )}

      {/* Asesor */}
      {cita.asesor && (
        <div className="flex items-center gap-1 mt-2 pt-2 border-t border-gray-100">
          <User size={10} className="text-gray-300 shrink-0" />
          <span className="text-xs text-gray-400 truncate">
            {cita.asesor.nombre} {cita.asesor.apellido}
          </span>
        </div>
      )}

      {/* WhatsApp link */}
      {cita.cliente?.whatsapp && (
        <div className="mt-2 flex gap-1.5">
          <Link
            href={`/citas/${cita.id}`}
            className="flex-1 text-center text-xs text-blue-600 hover:bg-blue-50 py-1 rounded transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            Ver detalle
          </Link>
        </div>
      )}

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/60 rounded-lg">
          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  )
}
