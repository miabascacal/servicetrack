import { createClient } from '@/lib/supabase/server'
import { NuevaActividad } from '../crm/agenda/NuevaActividad'
import { CalendarioGrid } from './CalendarioGrid'
import type { Vista, CalActividad, CalCita } from './CalendarioGrid'

interface PageProps {
  searchParams: Promise<{ vista?: string; fecha?: string }>
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

function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default async function MiAgendaPage({ searchParams }: PageProps) {
  const { vista: vistaParam, fecha: fechaParam } = await searchParams

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  // Leer vista default desde config solo cuando no viene en URL
  let vistaDefault: Vista = 'semana'
  if (!vistaParam) {
    const { data: cfgVista } = await supabase
      .from('configuracion_citas_sucursal')
      .select('agenda_vista_default')
      .limit(1)
      .maybeSingle()
    const raw = (cfgVista as unknown as { agenda_vista_default?: string } | null)?.agenda_vista_default
    if (raw === 'mes' || raw === 'semana' || raw === 'dia') vistaDefault = raw
  }

  const vista: Vista =
    vistaParam === 'mes' || vistaParam === 'semana' || vistaParam === 'dia'
      ? vistaParam
      : vistaDefault

  // Parse and normalize anchor date
  const raw = fechaParam ? new Date(fechaParam + 'T00:00:00') : new Date()
  raw.setHours(0, 0, 0, 0)

  let anchor: Date
  if (vista === 'mes') {
    anchor = new Date(raw.getFullYear(), raw.getMonth(), 1)
  } else if (vista === 'semana') {
    anchor = getMondayOfWeek(raw)
  } else {
    anchor = raw
  }
  const fechaBase = toDateStr(anchor)

  // Compute query date range
  let rangeStart: Date
  let rangeEnd: Date
  if (vista === 'mes') {
    rangeStart = anchor
    rangeEnd = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)
  } else if (vista === 'semana') {
    rangeStart = anchor
    rangeEnd = addDays(anchor, 6)
  } else {
    rangeStart = anchor
    rangeEnd = anchor
  }

  const startStr = toDateStr(rangeStart)
  const endStr = toDateStr(rangeEnd)
  const startISO = rangeStart.toISOString()
  const endISO = new Date(rangeEnd.getTime() + 24 * 60 * 60 * 1000).toISOString()

  const [{ data: actividades }, { data: citas }] = await Promise.all([
    supabase
      .from('actividades')
      .select(`
        id, tipo, descripcion, estado, prioridad, fecha_vencimiento,
        cliente:clientes ( id, nombre, apellido )
      `)
      .eq('usuario_asignado_id', user.id)
      .not('estado', 'in', '("realizada","cancelada")')
      .gte('fecha_vencimiento', startISO)
      .lt('fecha_vencimiento', endISO)
      .order('fecha_vencimiento', { ascending: true })
      .limit(200),
    supabase
      .from('citas')
      .select(`
        id, fecha_cita, hora_cita, estado, servicio,
        cliente:clientes ( id, nombre, apellido )
      `)
      .eq('asesor_id', user.id)
      .not('estado', 'in', '("cancelada","no_show")')
      .gte('fecha_cita', startStr)
      .lte('fecha_cita', endStr)
      .order('fecha_cita', { ascending: true })
      .order('hora_cita', { ascending: true })
      .limit(200),
  ])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Mi Agenda</h1>
          <p className="text-sm text-gray-500 mt-0.5">Actividades y citas asignadas a ti</p>
        </div>
        <NuevaActividad />
      </div>

      <CalendarioGrid
        actividades={(actividades ?? []) as unknown as CalActividad[]}
        citas={(citas ?? []) as unknown as CalCita[]}
        vista={vista}
        fechaBase={fechaBase}
      />
    </div>
  )
}
