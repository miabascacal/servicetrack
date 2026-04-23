import { createClient } from '@/lib/supabase/server'
import { formatDate, formatDateTime, cn } from '@/lib/utils'
import { Calendar, Clock, User, Car, Phone, CheckCircle2, Circle, AlertCircle, CalendarDays } from 'lucide-react'
import Link from 'next/link'
import { NuevaActividad } from '../crm/agenda/NuevaActividad'

const TIPO_CONFIG: Record<string, { label: string; icon: React.ComponentType<{ size?: number; className?: string }> }> = {
  llamada:            { label: 'Llamada',            icon: Phone },
  contacto:           { label: 'Contacto',           icon: User },
  seguimiento:        { label: 'Seguimiento',        icon: Clock },
  tarea:              { label: 'Tarea',              icon: CheckCircle2 },
  reunion:            { label: 'Reunión',            icon: Calendar },
  recordatorio:       { label: 'Recordatorio',       icon: AlertCircle },
  cita_agendada:      { label: 'Cita agendada',      icon: Calendar },
  cotizacion_enviada: { label: 'Cotización enviada', icon: Car },
  wa_enviado:         { label: 'WhatsApp enviado',   icon: Phone },
  csi_enviado:        { label: 'CSI enviado',        icon: CheckCircle2 },
}

const PRIORIDAD_CONFIG: Record<string, string> = {
  normal:  'border-l-gray-300',
  alta:    'border-l-yellow-400',
  urgente: 'border-l-red-500',
}

const ESTADO_CITA_LABEL: Record<string, string> = {
  pendiente_contactar: 'Pendiente contactar',
  confirmada:   'Confirmada',
  en_agencia:   'En agencia',
  show:         'Show',
  no_show:      'No show',
  cancelada:    'Cancelada',
  completada:   'Completada',
}

interface PageProps {
  searchParams: Promise<{ filtro?: string }>
}

export default async function MiAgendaPage({ searchParams }: PageProps) {
  const { filtro = 'hoy' } = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const todayEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString()
  const weekEnd    = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7).toISOString()
  const weekEndDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7).toISOString().split('T')[0]

  // ── Actividades ────────────────────────────────────────────────────────────
  let actQuery = supabase
    .from('actividades')
    .select(`
      id, tipo, descripcion, estado, prioridad, fecha_vencimiento, realizada_at, creado_at,
      cliente:clientes ( id, nombre, apellido, whatsapp ),
      vehiculo:vehiculos ( id, marca, modelo, anio )
    `)
    .eq('usuario_asignado_id', user.id)
    .order('fecha_vencimiento', { ascending: true, nullsFirst: false })
    .limit(100)

  if (filtro === 'hoy') {
    actQuery = actQuery.gte('fecha_vencimiento', todayStart).lt('fecha_vencimiento', todayEnd)
      .not('estado', 'eq', 'realizada').not('estado', 'eq', 'cancelada')
  } else if (filtro === 'semana') {
    actQuery = actQuery.gte('fecha_vencimiento', todayStart).lt('fecha_vencimiento', weekEnd)
      .not('estado', 'eq', 'realizada').not('estado', 'eq', 'cancelada')
  } else if (filtro === 'pendientes') {
    actQuery = actQuery.eq('estado', 'pendiente')
  }

  // ── Citas como asesor ──────────────────────────────────────────────────────
  let citasQuery = supabase
    .from('citas')
    .select(`
      id, fecha_cita, hora_cita, estado, servicio,
      cliente:clientes ( id, nombre, apellido ),
      vehiculo:vehiculos ( id, marca, modelo, anio )
    `)
    .eq('asesor_id', user.id)
    .not('estado', 'in', '("cancelada","no_show")')
    .order('fecha_cita', { ascending: true })
    .order('hora_cita', { ascending: true })
    .limit(50)

  if (filtro === 'hoy') {
    citasQuery = citasQuery.eq('fecha_cita', today)
  } else if (filtro === 'semana') {
    citasQuery = citasQuery.gte('fecha_cita', today).lte('fecha_cita', weekEndDate)
  }

  const [{ data: actividades }, { data: citas }] = await Promise.all([actQuery, citasQuery])

  const tabs = [
    { key: 'hoy',       label: 'Hoy' },
    { key: 'semana',    label: 'Esta semana' },
    { key: 'pendientes',label: 'Pendientes' },
    { key: 'todas',     label: 'Todas' },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Mi Agenda</h1>
          <p className="text-sm text-gray-500 mt-0.5">Actividades y citas asignadas a ti</p>
        </div>
        <NuevaActividad />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={`/agenda?filtro=${tab.key}`}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              filtro === tab.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {/* Citas como asesor */}
      {(citas ?? []).length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Mis citas</h2>
          {(citas ?? []).map((cita) => {
            type CitaRow = typeof cita & {
              cliente: { id: string; nombre: string; apellido: string } | null
              vehiculo: { id: string; marca: string; modelo: string; anio: number } | null
            }
            const c = cita as unknown as CitaRow
            return (
              <Link
                key={c.id}
                href={`/citas/${c.id}`}
                className="bg-white rounded-lg border border-green-200 border-l-4 border-l-green-500 p-4 flex items-start gap-4 hover:border-green-300 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-green-100">
                  <CalendarDays size={15} className="text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Cita</span>
                    <span className="text-xs text-green-600 font-medium">{ESTADO_CITA_LABEL[c.estado] ?? c.estado}</span>
                  </div>
                  {c.servicio && <p className="text-sm text-gray-900 mt-0.5">{c.servicio}</p>}
                  <div className="flex flex-wrap gap-3 mt-2">
                    {c.cliente && (
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <User size={11} />{c.cliente.nombre} {c.cliente.apellido}
                      </span>
                    )}
                    {c.vehiculo && (
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <Car size={11} />{c.vehiculo.marca} {c.vehiculo.modelo} {c.vehiculo.anio}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                    <Clock size={11} />
                    {formatDate(c.fecha_cita)}{c.hora_cita ? ` · ${c.hora_cita.slice(0, 5)}` : ''}
                  </p>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {/* Actividades */}
      {(actividades ?? []).length > 0 && (
        <div className="space-y-2">
          {(citas ?? []).length > 0 && (
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Actividades</h2>
          )}
          {(actividades ?? []).map((a) => {
            type ActRow = typeof a & {
              cliente: { id: string; nombre: string; apellido: string; whatsapp: string } | null
              vehiculo: { id: string; marca: string; modelo: string; anio: number } | null
            }
            const act = a as unknown as ActRow
            const tipoCfg = TIPO_CONFIG[act.tipo] ?? { label: act.tipo, icon: Circle }
            const Icon = tipoCfg.icon
            const prioridadBorder = PRIORIDAD_CONFIG[act.prioridad ?? 'normal'] ?? 'border-l-gray-300'
            const isVencida = act.fecha_vencimiento && new Date(act.fecha_vencimiento) < now && act.estado !== 'realizada'
            const isRealizada = act.estado === 'realizada'

            return (
              <div
                key={act.id}
                className={cn(
                  'bg-white rounded-lg border border-gray-200 border-l-4 p-4 flex items-start gap-4',
                  prioridadBorder,
                  isRealizada && 'opacity-60'
                )}
              >
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', isRealizada ? 'bg-green-100' : 'bg-gray-100')}>
                  <Icon size={15} className={isRealizada ? 'text-green-600' : 'text-gray-500'} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">{tipoCfg.label}</span>
                      <p className="text-sm text-gray-900 mt-0.5">{act.descripcion}</p>
                    </div>
                    {act.prioridad === 'urgente' && (
                      <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full shrink-0">Urgente</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-3 mt-2">
                    {act.cliente && (
                      <Link href={`/crm/clientes/${act.cliente.id}`} className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                        <User size={11} />{act.cliente.nombre} {act.cliente.apellido}
                      </Link>
                    )}
                    {act.vehiculo && (
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <Car size={11} />{act.vehiculo.marca} {act.vehiculo.modelo} {act.vehiculo.anio}
                      </span>
                    )}
                  </div>
                  {act.fecha_vencimiento && (
                    <p className={cn('text-xs mt-2 flex items-center gap-1', isVencida ? 'text-red-500 font-medium' : 'text-gray-400')}>
                      <Clock size={11} />
                      {isVencida ? 'Vencida: ' : ''}{formatDateTime(act.fecha_vencimiento)}
                    </p>
                  )}
                </div>
                <div className="shrink-0">
                  {isRealizada ? (
                    <span className="text-xs text-green-600 font-medium">✓ Realizada</span>
                  ) : (
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium',
                      act.estado === 'en_proceso' ? 'bg-blue-100 text-blue-700' :
                      isVencida ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'
                    )}>
                      {act.estado === 'en_proceso' ? 'En proceso' : act.estado === 'cancelada' ? 'Cancelada' : 'Pendiente'}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {(actividades ?? []).length === 0 && (citas ?? []).length === 0 && (
        <div className="flex flex-col items-center justify-center h-48 bg-gray-50 rounded-xl border border-gray-200 text-center">
          <CalendarDays size={28} className="text-gray-300 mb-2" />
          <p className="text-sm text-gray-500">Sin actividades ni citas {filtro === 'hoy' ? 'para hoy' : filtro === 'semana' ? 'esta semana' : ''}</p>
        </div>
      )}
    </div>
  )
}
