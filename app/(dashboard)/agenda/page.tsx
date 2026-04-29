import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ensureUsuario } from '@/lib/ensure-usuario'
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

  let sucursal_id: string | null = null
  try {
    const ctx = await ensureUsuario(supabase, user.id, user.email ?? '')
    sucursal_id = ctx.sucursal_id
  } catch {
    // sucursal_id stays null
  }

  const admin = createAdminClient()

  // Leer vista default desde config solo cuando no viene en URL
  let vistaDefault: Vista = 'semana'
  if (!vistaParam && sucursal_id) {
    const { data: cfgVista } = await admin
      .from('configuracion_citas_sucursal')
      .select('agenda_vista_default')
      .eq('sucursal_id', sucursal_id)
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

  let citasQuery = admin
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
    .limit(200)

  if (sucursal_id) {
    citasQuery = citasQuery.eq('sucursal_id', sucursal_id)
  }

  const [{ data: actividades }, { data: citas }] = await Promise.all([
    admin
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
    citasQuery,
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
