import Link from 'next/link'
import { Plus } from 'lucide-react'
import { CitasMonthCalendar } from '@/app/_components/citas/CitasMonthCalendar'
import { CitasKanban } from '@/app/_components/citas/CitasKanban'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'
import type { EstadoCita } from '@/types/database'

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>
type CitasVista = 'hoy' | 'semana' | 'mes' | 'todas'
type MonthDisplayMode = 'calendario' | 'kanban'

const VISTAS_CONFIG: Record<CitasVista, { label: string }> = {
  hoy: { label: 'Hoy' },
  semana: { label: 'Semana actual' },
  mes: { label: 'Mes' },
  todas: { label: 'Todas' },
}

type CitaRow = {
  id: string
  fecha_cita: string
  hora_cita: string
  estado: EstadoCita
  servicio: string | null
  notas: string | null
  cliente: { id: string; nombre: string; apellido: string; whatsapp: string } | null
  vehiculo: { id: string; marca: string; modelo: string; anio: number; placa: string | null } | null
  asesor?: null
}

function getMexicoNow() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Mexico_City' }))
}

function pad2(value: number) {
  return value.toString().padStart(2, '0')
}

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function startOfOperationalWeek(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  start.setDate(date.getDate() - date.getDay())
  return start
}

function endOfOperationalWeek(date: Date) {
  const start = startOfOperationalWeek(date)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  return end
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

function formatRangeDate(date: Date) {
  return date.toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    timeZone: 'America/Mexico_City',
  }).replace('.', '')
}

function resolveVista(rawVista: string | string[] | undefined): CitasVista {
  const value = Array.isArray(rawVista) ? rawVista[0] : rawVista
  return value === 'hoy' || value === 'semana' || value === 'mes' || value === 'todas'
    ? value
    : 'todas'
}

function resolveMonthMode(rawMode: string | string[] | undefined): MonthDisplayMode {
  const value = Array.isArray(rawMode) ? rawMode[0] : rawMode
  return value === 'kanban' ? 'kanban' : 'calendario'
}

function getVistaRange(vista: CitasVista) {
  const nowMX = getMexicoNow()

  if (vista === 'hoy') {
    const today = formatDateKey(nowMX)
    return {
      start: today,
      end: today,
      rangeLabel: formatRangeDate(nowMX),
      monthDate: startOfMonth(nowMX),
    }
  }

  if (vista === 'semana') {
    const start = startOfOperationalWeek(nowMX)
    const end = endOfOperationalWeek(nowMX)
    return {
      start: formatDateKey(start),
      end: formatDateKey(end),
      rangeLabel: `${formatRangeDate(start)} - ${formatRangeDate(end)}`,
      monthDate: startOfMonth(nowMX),
    }
  }

  if (vista === 'mes') {
    const start = startOfMonth(nowMX)
    const end = endOfMonth(nowMX)
    return {
      start: formatDateKey(start),
      end: formatDateKey(end),
      rangeLabel: `${formatRangeDate(start)} - ${formatRangeDate(end)}`,
      monthDate: start,
    }
  }

  return {
    start: null,
    end: null,
    rangeLabel: 'Sin filtro de fecha',
    monthDate: startOfMonth(nowMX),
  }
}

export default async function CitasPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createClient()
  const resolvedSearchParams = await searchParams
  const vistaActiva = resolveVista(resolvedSearchParams.vista)
  const monthMode = resolveMonthMode(resolvedSearchParams.modo)
  const visibleRange = getVistaRange(vistaActiva)

  let query = supabase
    .from('citas')
    .select(`
      id, fecha_cita, hora_cita, estado, servicio, notas,
      cliente:clientes ( id, nombre, apellido, whatsapp ),
      vehiculo:vehiculos ( id, marca, modelo, anio, placa )
    `)
    .order('fecha_cita', { ascending: true })
    .order('hora_cita', { ascending: true })

  if (visibleRange.start && visibleRange.end) {
    query = query
      .gte('fecha_cita', visibleRange.start)
      .lte('fecha_cita', visibleRange.end)
  }

  const { data: citas } = await query
  const filteredCitas = (citas as unknown as CitaRow[]) ?? []
  const summaryLabel = `${VISTAS_CONFIG[vistaActiva].label} - ${visibleRange.rangeLabel} - ${filteredCitas.length} cita${filteredCitas.length !== 1 ? 's' : ''}`
  const kanbanKey = [
    vistaActiva,
    visibleRange.start ?? 'all',
    visibleRange.end ?? 'all',
    monthMode,
  ].join(':')

  function buildHref(updates: Partial<{ vista: CitasVista; modo: MonthDisplayMode }>) {
    const params = new URLSearchParams()

    for (const [key, value] of Object.entries(resolvedSearchParams)) {
      if ((key === 'vista' || key === 'modo') || value == null) continue

      if (Array.isArray(value)) {
        for (const item of value) params.append(key, item)
      } else {
        params.set(key, value)
      }
    }

    const nextVista = updates.vista ?? vistaActiva
    params.set('vista', nextVista)

    const nextMode = updates.modo ?? monthMode
    if (nextVista === 'mes') params.set('modo', nextMode)

    return `/citas?${params.toString()}`
  }

  return (
    <div className="flex h-full flex-col space-y-5">
      <div className="flex shrink-0 items-start justify-between gap-4">
        <div className="space-y-3">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Citas</h1>
            <p className="mt-0.5 text-sm text-gray-500">{summaryLabel}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(Object.keys(VISTAS_CONFIG) as CitasVista[]).map((vista) => {
              const isActive = vista === vistaActiva

              return (
                <Link
                  key={vista}
                  href={buildHref({ vista, modo: vista === 'mes' ? 'calendario' : monthMode })}
                  className={[
                    'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'border border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:text-blue-700',
                  ].join(' ')}
                >
                  {VISTAS_CONFIG[vista].label}
                </Link>
              )
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="w-fit rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600">
              <span className="font-medium text-gray-900">{VISTAS_CONFIG[vistaActiva].label}</span>
              {' - '}
              <span>{visibleRange.rangeLabel}</span>
              {' - '}
              <span>{filteredCitas.length} cita{filteredCitas.length !== 1 ? 's' : ''}</span>
            </div>

            {vistaActiva === 'mes' && (
              <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1">
                {(['calendario', 'kanban'] as MonthDisplayMode[]).map((mode) => {
                  const isActive = mode === monthMode
                  return (
                    <Link
                      key={mode}
                      href={buildHref({ vista: 'mes', modo: mode })}
                      className={cn(
                        'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                        isActive ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                      )}
                    >
                      {mode === 'calendario' ? 'Calendario' : 'Kanban'}
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <Link
          href="/citas/nuevo"
          className="flex shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          <Plus size={16} />
          Nueva Cita
        </Link>
      </div>

      {vistaActiva === 'mes' && monthMode === 'calendario'
        ? <CitasMonthCalendar citas={filteredCitas} monthDate={visibleRange.monthDate} />
        : <CitasKanban key={kanbanKey} citas={filteredCitas} />
      }
    </div>
  )
}
