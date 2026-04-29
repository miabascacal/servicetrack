'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { EstadoCita } from '@/types/database'

type CitaCalendarItem = {
  id: string
  fecha_cita: string
  hora_cita: string
  estado: EstadoCita
  servicio: string | null
  cliente: { id: string; nombre: string; apellido: string; whatsapp: string } | null
}

const ESTADO_BADGE: Record<EstadoCita, string> = {
  pendiente_contactar: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  contactada: 'bg-sky-100 text-sky-800 border-sky-200',
  confirmada: 'bg-blue-100 text-blue-800 border-blue-200',
  en_agencia: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  show: 'bg-purple-100 text-purple-800 border-purple-200',
  no_show: 'bg-red-100 text-red-800 border-red-200',
  cancelada: 'bg-gray-100 text-gray-700 border-gray-200',
}

const ESTADO_LABEL: Record<EstadoCita, string> = {
  pendiente_contactar: 'Por contactar',
  contactada: 'Contactada',
  confirmada: 'Confirmada',
  en_agencia: 'En agencia',
  show: 'Show',
  no_show: 'No show',
  cancelada: 'Cancelada',
}

type CalendarDay = {
  date: Date
  dateKey: string
  inCurrentMonth: boolean
}

function pad2(value: number) {
  return value.toString().padStart(2, '0')
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

// Accepts YYYY-MM-DD string to avoid UTC midnight → browser timezone deserialization shift
function formatMonthTitle(monthStr: string) {
  const [yearPart, monthPart] = monthStr.split('-')
  return new Date(Number(yearPart), Number(monthPart) - 1, 15).toLocaleDateString('es-MX', {
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Mexico_City',
  })
}

function buildMonthGrid(monthStr: string): CalendarDay[] {
  const [yearPart, monthPart] = monthStr.split('-')
  const year = Number(yearPart)
  const month = Number(monthPart) // 1-based

  const firstDay = new Date(year, month - 1, 1)
  const lastDay = new Date(year, month, 0)

  const startOffset = firstDay.getDay()
  const gridStart = new Date(firstDay)
  gridStart.setDate(firstDay.getDate() - startOffset)

  const endOffset = 6 - lastDay.getDay()
  const gridEnd = new Date(lastDay)
  gridEnd.setDate(lastDay.getDate() + endOffset)

  const days: CalendarDay[] = []
  for (const cursor = new Date(gridStart); cursor <= gridEnd; cursor.setDate(cursor.getDate() + 1)) {
    const current = new Date(cursor)
    days.push({
      date: current,
      dateKey: toDateKey(current),
      inCurrentMonth: current.getMonth() === month - 1,
    })
  }

  return days
}

export function CitasMonthCalendar({
  citas,
  monthDate,
}: {
  citas: CitaCalendarItem[]
  monthDate: string
}) {
  const days = buildMonthGrid(monthDate)
  const todayKey = toDateKey(new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Mexico_City' })))
  const citasByDate = new Map<string, CitaCalendarItem[]>()

  for (const cita of citas) {
    const list = citasByDate.get(cita.fecha_cita) ?? []
    list.push(cita)
    citasByDate.set(cita.fecha_cita, list)
  }

  const dayHeaders = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab']

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-900 capitalize">{formatMonthTitle(monthDate)}</h2>
      </div>

      <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
        {dayHeaders.map((day) => (
          <div key={day} className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-gray-500">
            {day}
          </div>
        ))}
      </div>

      <div className="grid flex-1 grid-cols-7">
        {days.map((day) => {
          const citasDelDia = citasByDate.get(day.dateKey) ?? []
          const isToday = day.dateKey === todayKey

          return (
            <div
              key={day.dateKey}
              className={cn(
                'min-h-[170px] border-b border-r border-gray-200 p-2 align-top',
                !day.inCurrentMonth && 'bg-gray-50/80',
                isToday && 'bg-blue-50/50',
              )}
            >
              <div className="mb-2 flex items-center justify-between">
                <span
                  className={cn(
                    'inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold',
                    isToday ? 'bg-blue-600 text-white' : day.inCurrentMonth ? 'text-gray-900' : 'text-gray-400',
                  )}
                >
                  {day.date.getDate()}
                </span>
                <span className="text-[11px] text-gray-400">{citasDelDia.length || ''}</span>
              </div>

              <div className="space-y-1.5">
                {citasDelDia.length === 0 && (
                  <div className="text-[11px] text-gray-350">{day.inCurrentMonth ? 'Sin citas' : ''}</div>
                )}

                {citasDelDia.map((cita) => (
                  <Link
                    key={cita.id}
                    href={`/citas/${cita.id}`}
                    className="block rounded-lg border border-gray-200 bg-white p-2 shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50/40"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[11px] font-semibold text-gray-900">{cita.hora_cita.slice(0, 5)}</span>
                      <span className={cn('rounded-full border px-1.5 py-0.5 text-[10px] font-medium', ESTADO_BADGE[cita.estado])}>
                        {ESTADO_LABEL[cita.estado]}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-[11px] font-medium text-gray-800">
                      {cita.cliente ? `${cita.cliente.nombre} ${cita.cliente.apellido}` : 'Cliente sin nombre'}
                    </p>
                    <p className="truncate text-[11px] text-gray-500">
                      {cita.servicio ?? 'Servicio pendiente'}
                    </p>
                    <p className="mt-1 text-[10px] font-medium text-blue-600">Ver detalle</p>
                  </Link>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
