import { createClient } from '@/lib/supabase/server'
import { formatDate, formatDateTime, cn } from '@/lib/utils'
import { Calendar, Clock, User, Car, Phone, CheckCircle2, Circle, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { NuevaActividad } from './NuevaActividad'
import { AgendaCalendario } from './AgendaCalendario'

const TIPO_CONFIG: Record<string, { label: string; icon: React.ComponentType<{ size?: number; className?: string }> }> = {
  llamada:           { label: 'Llamada',           icon: Phone },
  contacto:          { label: 'Contacto',           icon: User },
  seguimiento:       { label: 'Seguimiento',        icon: Clock },
  tarea:             { label: 'Tarea',              icon: CheckCircle2 },
  reunion:           { label: 'Reunión',            icon: Calendar },
  recordatorio:      { label: 'Recordatorio',       icon: AlertCircle },
  cita_agendada:     { label: 'Cita agendada',      icon: Calendar },
  cotizacion_enviada:{ label: 'Cotización enviada', icon: Car },
  wa_enviado:        { label: 'WhatsApp enviado',   icon: Phone },
  csi_enviado:       { label: 'CSI enviado',        icon: CheckCircle2 },
}

const PRIORIDAD_CONFIG: Record<string, string> = {
  normal:  'border-l-gray-300',
  alta:    'border-l-yellow-400',
  urgente: 'border-l-red-500',
}

interface PageProps {
  searchParams: Promise<{ filtro?: string; vista?: string }>
}

export default async function AgendaPage({ searchParams }: PageProps) {
  const { filtro = 'hoy', vista = 'lista' } = await searchParams
  // createClient() aplica RLS — solo devuelve actividades de la sucursal del usuario autenticado
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString()
  const weekEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7).toISOString()

  let query = supabase
    .from('actividades')
    .select(`
      id, tipo, descripcion, estado, prioridad, fecha_vencimiento, realizada_at, creado_at,
      cliente:clientes ( id, nombre, apellido, whatsapp ),
      vehiculo:vehiculos ( id, marca, modelo, anio )
    `)
    .eq('usuario_asignado_id', user.id)
    .order('fecha_vencimiento', { ascending: true, nullsFirst: false })
    .order('creado_at', { ascending: false })
    .limit(100)

  if (filtro === 'hoy') {
    query = query.gte('fecha_vencimiento', todayStart).lt('fecha_vencimiento', todayEnd)
      .not('estado', 'eq', 'realizada').not('estado', 'eq', 'cancelada')
  } else if (filtro === 'semana') {
    query = query.gte('fecha_vencimiento', todayStart).lt('fecha_vencimiento', weekEnd)
      .not('estado', 'eq', 'realizada').not('estado', 'eq', 'cancelada')
  } else if (filtro === 'pendientes') {
    query = query.eq('estado', 'pendiente')
  } else if (filtro === 'todas') {
    // no extra filter
  }

  const { data: actividades } = await query

  const tabs = [
    { key: 'hoy', label: 'Hoy' },
    { key: 'semana', label: 'Esta semana' },
    { key: 'pendientes', label: 'Pendientes' },
    { key: 'todas', label: 'Todas' },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Mi Agenda</h1>
          <p className="text-sm text-gray-500 mt-0.5">Actividades y tareas asignadas a ti</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <Link
              href={`/crm/agenda?filtro=${filtro}&vista=lista`}
              className={cn('px-3 py-1.5 text-xs font-medium rounded-md transition-colors', vista !== 'calendario' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500')}
            >
              Lista
            </Link>
            <Link
              href={`/crm/agenda?filtro=${filtro}&vista=calendario`}
              className={cn('px-3 py-1.5 text-xs font-medium rounded-md transition-colors', vista === 'calendario' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500')}
            >
              Calendario
            </Link>
          </div>
          <NuevaActividad />
        </div>
      </div>

      {/* Vista calendario */}
      {vista === 'calendario' && (
        <AgendaCalendario actividades={(actividades ?? []).map(a => ({
          id: a.id,
          tipo: a.tipo,
          descripcion: a.descripcion ?? '',
          estado: a.estado,
          prioridad: a.prioridad ?? 'normal',
          fecha_vencimiento: a.fecha_vencimiento ?? null,
        }))} />
      )}

      {/* Tabs de lista — solo si vista=lista */}
      {vista !== 'calendario' && (
      <div className="flex items-center gap-1 border-b border-gray-200">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={`/crm/agenda?filtro=${tab.key}`}
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
      </div>)}

      {/* Activities — solo en vista lista */}
      {vista !== 'calendario' && (!actividades || actividades.length === 0) ? (
        <div className="flex flex-col items-center justify-center h-48 bg-gray-50 rounded-xl border border-gray-200 text-center">
          <Calendar size={28} className="text-gray-300 mb-2" />
          <p className="text-sm text-gray-500">Sin actividades {filtro === 'hoy' ? 'para hoy' : filtro === 'semana' ? 'esta semana' : ''}</p>
        </div>
      ) : vista !== 'calendario' ? (
        <div className="space-y-2">
          {(actividades ?? []).map((a) => {
            type ActRow = typeof a & {
              cliente: { id: string; nombre: string; apellido: string; whatsapp: string } | null
              vehiculo: { id: string; marca: string; modelo: string; anio: number } | null
              cita: { id: string; fecha_cita: string; hora_cita: string } | null
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
                {/* Icon */}
                <div className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                  isRealizada ? 'bg-green-100' : 'bg-gray-100'
                )}>
                  <Icon size={15} className={isRealizada ? 'text-green-600' : 'text-gray-500'} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">{tipoCfg.label}</span>
                      <p className="text-sm text-gray-900 mt-0.5">{act.descripcion}</p>
                    </div>
                    {act.prioridad === 'urgente' && (
                      <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full shrink-0">Urgente</span>
                    )}
                    {act.prioridad === 'alta' && (
                      <span className="text-xs font-medium text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-full shrink-0">Alta</span>
                    )}
                  </div>

                  {/* Links */}
                  <div className="flex flex-wrap gap-3 mt-2">
                    {act.cliente && (
                      <Link href={`/crm/clientes/${act.cliente.id}`} className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                        <User size={11} />
                        {act.cliente.nombre} {act.cliente.apellido}
                      </Link>
                    )}
                    {act.vehiculo && (
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <Car size={11} />
                        {act.vehiculo.marca} {act.vehiculo.modelo} {act.vehiculo.anio}
                      </span>
                    )}
                    {act.cita && (
                      <Link href={`/citas/${act.cita.id}`} className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                        <Calendar size={11} />
                        Cita {formatDate(act.cita.fecha_cita)}
                      </Link>
                    )}
                  </div>

                  {/* Date */}
                  {act.fecha_vencimiento && (
                    <p className={cn('text-xs mt-2 flex items-center gap-1', isVencida ? 'text-red-500 font-medium' : 'text-gray-400')}>
                      <Clock size={11} />
                      {isVencida ? 'Vencida: ' : ''}{formatDateTime(act.fecha_vencimiento)}
                    </p>
                  )}
                </div>

                {/* Status badge */}
                <div className="shrink-0">
                  {isRealizada ? (
                    <span className="text-xs text-green-600 font-medium">✓ Realizada</span>
                  ) : (
                    <span className={cn(
                      'text-xs px-2 py-0.5 rounded-full font-medium',
                      act.estado === 'en_proceso' ? 'bg-blue-100 text-blue-700' :
                      isVencida ? 'bg-red-100 text-red-600' :
                      'bg-gray-100 text-gray-600'
                    )}>
                      {act.estado === 'en_proceso' ? 'En proceso' : act.estado === 'cancelada' ? 'Cancelada' : 'Pendiente'}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
