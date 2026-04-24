'use client'

import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export type Vista = 'mes' | 'semana' | 'dia'

export interface CalActividad {
  id: string
  tipo: string
  descripcion: string
  estado: string
  prioridad: string | null
  fecha_vencimiento: string | null
  cliente: { id: string; nombre: string; apellido: string } | null
}

export interface CalCita {
  id: string
  fecha_cita: string
  hora_cita: string | null
  estado: string
  servicio: string | null
  cliente: { id: string; nombre: string; apellido: string } | null
}

interface Props {
  actividades: CalActividad[]
  citas: CalCita[]
  vista: Vista
  fechaBase: string
}

const DIAS_ES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MESES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

function parseDate(s: string): Date {
  return new Date(s + 'T00:00:00')
}

function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function getMondayOfWeek(d: Date): Date {
  const day = d.getDay()
  return addDays(d, day === 0 ? -6 : 1 - day)
}

function getNavFecha(vista: Vista, fechaBase: string, delta: -1 | 0 | 1): string {
  if (delta === 0) return toDateStr(new Date())
  const d = parseDate(fechaBase)
  if (vista === 'mes') {
    return toDateStr(new Date(d.getFullYear(), d.getMonth() + delta, 1))
  }
  if (vista === 'semana') return toDateStr(addDays(d, delta * 7))
  return toDateStr(addDays(d, delta))
}

function getPeriodLabel(vista: Vista, fechaBase: string): string {
  const d = parseDate(fechaBase)
  if (vista === 'mes') {
    return `${MESES_ES[d.getMonth()]} ${d.getFullYear()}`
  }
  if (vista === 'semana') {
    const lun = getMondayOfWeek(d)
    const dom = addDays(lun, 6)
    const lunLabel = `${lun.getDate()} ${MESES_ES[lun.getMonth()].slice(0, 3)}`
    const domLabel =
      lun.getMonth() === dom.getMonth()
        ? `${dom.getDate()}`
        : `${dom.getDate()} ${MESES_ES[dom.getMonth()].slice(0, 3)}`
    return `${lunLabel} – ${domLabel} ${dom.getFullYear()}`
  }
  return `${DIAS_ES[(d.getDay() + 6) % 7]}, ${d.getDate()} de ${MESES_ES[d.getMonth()]} ${d.getFullYear()}`
}

function getEventsForDay(dateStr: string, actividades: CalActividad[], citas: CalCita[]) {
  return {
    acts: actividades.filter((a) => a.fecha_vencimiento?.startsWith(dateStr)),
    cts: citas.filter((c) => c.fecha_cita === dateStr),
  }
}

function isHoyPeriod(vista: Vista, fechaBase: string): boolean {
  const hoy = toDateStr(new Date())
  if (vista === 'dia') return fechaBase === hoy
  if (vista === 'mes') return fechaBase.startsWith(hoy.slice(0, 7))
  return toDateStr(getMondayOfWeek(parseDate(fechaBase))) === toDateStr(getMondayOfWeek(new Date()))
}

// ── Sub-views ────────────────────────────────────────────────────────────────

function ActChip({ a }: { a: CalActividad }) {
  const color =
    a.prioridad === 'urgente'
      ? 'bg-red-100 text-red-700'
      : a.prioridad === 'alta'
      ? 'bg-yellow-100 text-yellow-700'
      : 'bg-blue-100 text-blue-700'
  return (
    <span className={cn('block truncate text-xs px-1.5 py-0.5 rounded font-medium leading-tight', color)}>
      {a.descripcion || a.tipo}
    </span>
  )
}

function CitaChip({ c }: { c: CalCita }) {
  return (
    <Link
      href={`/citas/${c.id}`}
      className="block truncate text-xs px-1.5 py-0.5 rounded font-medium leading-tight bg-green-100 text-green-700 hover:bg-green-200"
    >
      {c.hora_cita?.slice(0, 5)} {c.servicio || c.cliente?.nombre || 'Cita'}
    </Link>
  )
}

function MesView({
  actividades,
  citas,
  fechaBase,
}: {
  actividades: CalActividad[]
  citas: CalCita[]
  fechaBase: string
}) {
  const d = parseDate(fechaBase)
  const year = d.getFullYear()
  const month = d.getMonth()
  const firstDay = new Date(year, month, 1)
  const startDay = getMondayOfWeek(firstDay)

  const cells: Date[] = []
  for (let i = 0; i < 42; i++) cells.push(addDays(startDay, i))

  const today = toDateStr(new Date())

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
        {DIAS_ES.map((label) => (
          <div key={label} className="py-2 text-center text-xs font-medium text-gray-500">
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((cell, i) => {
          const dateStr = toDateStr(cell)
          const isToday = dateStr === today
          const isCurrentMonth = cell.getMonth() === month
          const { acts, cts } = getEventsForDay(dateStr, actividades, citas)
          const MAX_SHOW = 2
          const allEvents = [
            ...cts.map((c) => ({ key: c.id, node: <CitaChip key={c.id} c={c} /> })),
            ...acts.map((a) => ({ key: a.id, node: <ActChip key={a.id} a={a} /> })),
          ]
          const shown = allEvents.slice(0, MAX_SHOW)
          const extra = allEvents.length - MAX_SHOW

          return (
            <div
              key={i}
              className={cn(
                'min-h-[88px] border-r border-b border-gray-200 p-1.5 last:border-r-0',
                !isCurrentMonth && 'bg-gray-50/60',
                (i + 1) % 7 === 0 && 'border-r-0'
              )}
            >
              <div
                className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center text-xs mb-1 ml-auto font-medium',
                  isToday
                    ? 'bg-blue-600 text-white'
                    : isCurrentMonth
                    ? 'text-gray-800'
                    : 'text-gray-400'
                )}
              >
                {cell.getDate()}
              </div>
              <div className="space-y-0.5">
                {shown.map((e) => e.node)}
                {extra > 0 && (
                  <span className="text-xs text-gray-400 px-1">+{extra} más</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SemanaView({
  actividades,
  citas,
  fechaBase,
}: {
  actividades: CalActividad[]
  citas: CalCita[]
  fechaBase: string
}) {
  const d = parseDate(fechaBase)
  const monday = getMondayOfWeek(d)
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
  const today = toDateStr(new Date())

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const dateStr = toDateStr(day)
          const isToday = dateStr === today
          const { acts, cts } = getEventsForDay(dateStr, actividades, citas)

          return (
            <div
              key={i}
              className={cn(
                'border-r border-gray-200 last:border-r-0',
                isToday && 'bg-blue-50/40'
              )}
            >
              <div
                className={cn(
                  'text-center py-2.5 border-b border-gray-200',
                  isToday ? 'bg-blue-50' : 'bg-gray-50'
                )}
              >
                <p className="text-xs text-gray-500">{DIAS_ES[i]}</p>
                <p
                  className={cn(
                    'text-lg font-semibold leading-tight',
                    isToday ? 'text-blue-600' : 'text-gray-800'
                  )}
                >
                  {day.getDate()}
                </p>
              </div>
              <div className="p-1.5 min-h-[160px] space-y-1">
                {cts.map((c) => (
                  <Link
                    key={c.id}
                    href={`/citas/${c.id}`}
                    className="block p-1.5 rounded bg-green-50 border border-green-200 hover:bg-green-100 transition-colors"
                  >
                    <p className="text-xs font-medium text-green-700 truncate">
                      {c.hora_cita?.slice(0, 5)} {c.servicio || 'Cita'}
                    </p>
                    {c.cliente && (
                      <p className="text-xs text-green-600 truncate">
                        {c.cliente.nombre} {c.cliente.apellido}
                      </p>
                    )}
                  </Link>
                ))}
                {acts.map((a) => {
                  const border =
                    a.prioridad === 'urgente'
                      ? 'bg-red-50 border-red-200 text-red-700'
                      : a.prioridad === 'alta'
                      ? 'bg-yellow-50 border-yellow-200 text-yellow-700'
                      : 'bg-blue-50 border-blue-200 text-blue-700'
                  return (
                    <div key={a.id} className={cn('p-1.5 rounded border', border)}>
                      <p className="text-xs font-medium truncate">{a.descripcion || a.tipo}</p>
                      {a.cliente && (
                        <p className="text-xs truncate opacity-80">
                          {a.cliente.nombre} {a.cliente.apellido}
                        </p>
                      )}
                    </div>
                  )
                })}
                {cts.length === 0 && acts.length === 0 && (
                  <p className="text-xs text-gray-300 text-center pt-6">—</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DiaView({
  actividades,
  citas,
  fechaBase,
}: {
  actividades: CalActividad[]
  citas: CalCita[]
  fechaBase: string
}) {
  const { acts, cts } = getEventsForDay(fechaBase, actividades, citas)

  if (cts.length === 0 && acts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 bg-gray-50 rounded-xl border border-gray-200">
        <p className="text-sm text-gray-500">Sin eventos para este día</p>
      </div>
    )
  }

  // Group by hour
  const byHour: Record<number, { cts: CalCita[]; acts: CalActividad[] }> = {}

  for (const c of cts) {
    const h = c.hora_cita ? parseInt(c.hora_cita.split(':')[0]) : 9
    if (!byHour[h]) byHour[h] = { cts: [], acts: [] }
    byHour[h].cts.push(c)
  }
  for (const a of acts) {
    const h = a.fecha_vencimiento ? new Date(a.fecha_vencimiento).getHours() : 9
    if (!byHour[h]) byHour[h] = { cts: [], acts: [] }
    byHour[h].acts.push(a)
  }

  const hours = Object.keys(byHour).map(Number).sort((a, b) => a - b)

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {hours.map((hour) => {
        const slot = byHour[hour]
        return (
          <div key={hour} className="flex border-b border-gray-100 last:border-0">
            <div className="w-16 shrink-0 px-3 py-3 text-xs text-gray-400 font-medium border-r border-gray-100 self-start pt-3">
              {String(hour).padStart(2, '0')}:00
            </div>
            <div className="flex-1 p-2 space-y-2">
              {slot.cts.map((c) => (
                <Link
                  key={c.id}
                  href={`/citas/${c.id}`}
                  className="block p-2 rounded bg-green-50 border border-green-200 hover:bg-green-100 transition-colors"
                >
                  <p className="text-sm font-medium text-green-700">
                    {c.hora_cita?.slice(0, 5)} — {c.servicio || 'Cita de servicio'}
                  </p>
                  {c.cliente && (
                    <p className="text-xs text-green-600">
                      {c.cliente.nombre} {c.cliente.apellido}
                    </p>
                  )}
                </Link>
              ))}
              {slot.acts.map((a) => {
                const style =
                  a.prioridad === 'urgente'
                    ? 'bg-red-50 border-red-200 text-red-700'
                    : a.prioridad === 'alta'
                    ? 'bg-yellow-50 border-yellow-200 text-yellow-700'
                    : 'bg-blue-50 border-blue-200 text-blue-700'
                return (
                  <div key={a.id} className={cn('p-2 rounded border', style)}>
                    <p className="text-sm font-medium">{a.descripcion || a.tipo}</p>
                    {a.cliente && (
                      <p className="text-xs opacity-80">
                        {a.cliente.nombre} {a.cliente.apellido}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export function CalendarioGrid({ actividades, citas, vista, fechaBase }: Props) {
  const periodLabel = getPeriodLabel(vista, fechaBase)
  const prevUrl = `/agenda?vista=${vista}&fecha=${getNavFecha(vista, fechaBase, -1)}`
  const nextUrl = `/agenda?vista=${vista}&fecha=${getNavFecha(vista, fechaBase, 1)}`
  const hoyUrl = `/agenda?vista=${vista}&fecha=${getNavFecha(vista, fechaBase, 0)}`
  const esHoy = isHoyPeriod(vista, fechaBase)

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        {/* Vista toggle */}
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          {(['mes', 'semana', 'dia'] as Vista[]).map((v) => (
            <Link
              key={v}
              href={`/agenda?vista=${v}&fecha=${fechaBase}`}
              className={cn(
                'px-3 py-1.5 text-sm font-medium transition-colors',
                vista === v ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'
              )}
            >
              {v === 'mes' ? 'Mes' : v === 'semana' ? 'Semana' : 'Día'}
            </Link>
          ))}
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-1">
          <Link
            href={prevUrl}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-600 transition-colors"
          >
            <ChevronLeft size={16} />
          </Link>
          <span className="text-sm font-medium text-gray-800 min-w-[160px] text-center px-1">
            {periodLabel}
          </span>
          <Link
            href={nextUrl}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-600 transition-colors"
          >
            <ChevronRight size={16} />
          </Link>
          {!esHoy && (
            <Link
              href={hoyUrl}
              className="ml-1 px-2.5 py-1 text-xs font-medium rounded border border-gray-200 hover:bg-gray-50 text-gray-600 transition-colors"
            >
              Hoy
            </Link>
          )}
        </div>
      </div>

      {/* Grid */}
      {vista === 'mes' ? (
        <MesView actividades={actividades} citas={citas} fechaBase={fechaBase} />
      ) : vista === 'semana' ? (
        <SemanaView actividades={actividades} citas={citas} fechaBase={fechaBase} />
      ) : (
        <DiaView actividades={actividades} citas={citas} fechaBase={fechaBase} />
      )}
    </div>
  )
}
