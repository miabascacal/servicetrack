import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatDate } from '@/lib/utils'
import {
  ChevronLeft,
  Phone,
  Mail,
  Building2,
  Calendar,
  Wrench,
  Plus,
  Pencil,
  FileText,
  AlertCircle,
  CheckCircle2,
  Clock,
  Activity,
  User,
} from 'lucide-react'
import { EmpresaSection, VehiculosSection } from './VinculacionControls'

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ area?: string }>
}

// ── Area / Departamento config ──────────────────────────────
const AREA_CONFIG = {
  cita:        { label: 'Citas',        color: 'text-blue-700',   bg: 'bg-blue-100',   border: 'border-blue-200',   dot: 'bg-blue-500'   },
  ot:          { label: 'Taller',       color: 'text-orange-700', bg: 'bg-orange-100', border: 'border-orange-200', dot: 'bg-orange-500' },
  cotizacion:  { label: 'Refacciones',  color: 'text-indigo-700', bg: 'bg-indigo-100', border: 'border-indigo-200', dot: 'bg-indigo-500' },
  actividad:   { label: 'CRM',          color: 'text-purple-700', bg: 'bg-purple-100', border: 'border-purple-200', dot: 'bg-purple-500' },
  mensaje:     { label: 'Bandeja',      color: 'text-green-700',  bg: 'bg-green-100',  border: 'border-green-200',  dot: 'bg-green-500'  },
} as const

const ESTADO_COLORS: Record<string, string> = {
  // citas
  pendiente: 'bg-yellow-100 text-yellow-700',
  confirmada: 'bg-blue-100 text-blue-700',
  llegada: 'bg-indigo-100 text-indigo-700',
  en_proceso: 'bg-purple-100 text-purple-700',
  terminada: 'bg-green-100 text-green-700',
  'no-show': 'bg-red-100 text-red-700',
  cancelada: 'bg-gray-100 text-gray-500',
  // OTs
  abierta: 'bg-blue-100 text-blue-700',
  en_espera_partes: 'bg-orange-100 text-orange-700',
  lista: 'bg-green-100 text-green-700',
  entregada: 'bg-gray-100 text-gray-500',
  // cotizaciones
  borrador: 'bg-gray-100 text-gray-600',
  enviada: 'bg-blue-100 text-blue-700',
  aprobada: 'bg-green-100 text-green-700',
  rechazada: 'bg-red-100 text-red-600',
  vencida: 'bg-yellow-100 text-yellow-700',
  // actividades
  pendiente_act: 'bg-yellow-100 text-yellow-700',
  completada: 'bg-green-100 text-green-700',
}

type AreaKey = keyof typeof AREA_CONFIG

interface TimelineItem {
  id: string
  tipo: AreaKey
  fecha: string
  titulo: string
  subtitulo?: string
  estado?: string
  usuario?: string
  monto?: number
  href: string
  completado?: boolean
  bot?: boolean
}

export default async function ClienteDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const { area = 'todos' } = await searchParams
  const supabase = createAdminClient()

  const { data: cliente } = await supabase
    .from('clientes')
    .select(`
      id, nombre, apellido, apellido_2,
      email, email_2, whatsapp, telefono_contacto, telefono_alterno,
      activo, creado_at,
      empresa:empresas ( id, nombre, rfc ),
      vehiculos:vehiculo_personas (
        rol_vehiculo,
        vehiculo:vehiculos (
          id, marca, modelo, anio, color, placa, vin,
          km_actual, estado_verificacion
        )
      )
    `)
    .eq('id', id)
    .single()

  if (!cliente) notFound()

  const [
    { data: citas },
    { data: actividades },
  ] = await Promise.all([
    supabase
      .from('citas')
      .select('id, fecha_cita, hora_cita, estado, creado_at')
      .eq('cliente_id', id)
      .order('fecha_cita', { ascending: false })
      .limit(20),
    supabase
      .from('actividades')
      .select('id, tipo, descripcion, fecha_vencimiento, estado, prioridad, completada, creado_at')
      .eq('cliente_id', id)
      .order('fecha_vencimiento', { ascending: false })
      .limit(20),
  ])
  const ots: null[] = []
  const cotizaciones: null[] = []

  type VehiculoPersonaRow = {
    rol_vehiculo: string
    vehiculo: {
      id: string; marca: string; modelo: string; anio: number
      color: string | null; placa: string | null; vin: string | null
      km_actual: number | null; estado_verificacion: string
    } | null
  }

  const empresa = (cliente.empresa as unknown) as { id: string; nombre: string; rfc: string | null } | null
  const vehiculoRows = (cliente.vehiculos as unknown as VehiculoPersonaRow[]) ?? []
  // Deduplicate by vehiculo id
  const vehiculosMap = new Map<string, VehiculoPersonaRow>()
  vehiculoRows.forEach(vp => { if (vp.vehiculo) vehiculosMap.set(vp.vehiculo.id, vp) })
  const vehiculos = Array.from(vehiculosMap.values())
  const today = new Date().toISOString().slice(0, 10)

  // ── Build unified timeline ──────────────────────────────────
  const allItems: TimelineItem[] = [
    ...(citas ?? []).map((c): TimelineItem => ({
      id: c.id,
      tipo: 'cita',
      fecha: c.fecha_cita,
      titulo: 'Cita',
      subtitulo: c.hora_cita ? `${String(c.hora_cita).slice(0, 5)} hrs` : undefined,
      estado: c.estado,
      href: `/citas/${c.id}`,
    })),
    ...(actividades ?? []).map((a): TimelineItem => ({
      id: a.id,
      tipo: 'actividad',
      fecha: a.fecha_vencimiento ?? a.creado_at,
      titulo: `${a.tipo}: ${a.descripcion}`,
      estado: a.completada ? 'completada' : a.estado ?? 'pendiente',
      completado: a.completada,
      href: `/crm/agenda`,
    })),
  ].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())

  // Filter
  const filtered = area === 'todos'
    ? allItems
    : allItems.filter((i) => i.tipo === area)

  // KPIs
  const totalInteracciones = allItems.length
  const ultimaFecha = allItems.at(0)?.fecha
  const gastoHistorico = 0
  const proximoServicio = null
  const proxVencido = proximoServicio && (proximoServicio as string) < today

  // Area counts for filter tabs
  const counts: Record<string, number> = {
    todos: allItems.length,
    cita: (citas ?? []).length,
    ot: (ots ?? []).length,
    cotizacion: (cotizaciones ?? []).length,
    actividad: (actividades ?? []).length,
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Link href="/crm/clientes" className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors">
            <ChevronLeft size={18} />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-gray-900">
                {cliente.nombre} {cliente.apellido}{cliente.apellido_2 ? ` ${cliente.apellido_2}` : ''}
              </h1>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                cliente.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
              }`}>{cliente.activo ? 'Activo' : 'Inactivo'}</span>
            </div>
            {empresa && (
              <div className="flex items-center gap-1.5 text-sm text-gray-500 mt-0.5">
                <Building2 size={13} />
                <Link href={`/crm/empresas/${empresa.id}`} className="hover:underline">{empresa.nombre}</Link>
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/citas/nuevo?cliente_id=${id}`}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
            <Calendar size={14} /> Nueva Cita
          </Link>
          <Link href={`/taller/nuevo?cliente_id=${id}`}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
            <Wrench size={14} /> OT
          </Link>
          <Link href={`/refacciones/cotizaciones/nuevo?cliente_id=${id}`}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
            <FileText size={14} /> Cotización
          </Link>
          <Link href={`/crm/clientes/${id}/editar`}
            className="p-2 border border-gray-300 text-gray-500 rounded-lg hover:bg-gray-50 transition-colors">
            <Pencil size={14} />
          </Link>
        </div>
      </div>

      {/* ── KPI strip ── */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
          <p className="text-xs text-gray-500 mb-1">Interacciones totales</p>
          <p className="text-2xl font-bold text-gray-900">{totalInteracciones}</p>
          <p className="text-xs text-gray-400 mt-0.5">todas las áreas</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
          <p className="text-xs text-gray-500 mb-1">Última actividad</p>
          <p className="text-lg font-semibold text-gray-900">{ultimaFecha ? formatDate(ultimaFecha) : '—'}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
          <p className="text-xs text-gray-500 mb-1">Gasto histórico</p>
          <p className="text-lg font-semibold text-gray-900">
            {gastoHistorico > 0 ? `$${gastoHistorico.toLocaleString('es-MX')}` : '—'}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">en taller</p>
        </div>
        <div className={`rounded-xl border px-5 py-4 ${proxVencido ? 'bg-red-50 border-red-300' : 'bg-white border-gray-200'}`}>
          <p className={`text-xs mb-1 ${proxVencido ? 'text-red-500' : 'text-gray-500'}`}>Próx. servicio</p>
          <p className={`text-lg font-semibold ${proxVencido ? 'text-red-700' : 'text-gray-900'}`}>
            {proximoServicio ? formatDate(proximoServicio) : '—'}
          </p>
          {proxVencido && <p className="text-xs text-red-500 mt-0.5 flex items-center gap-1"><AlertCircle size={11} /> Vencido</p>}
        </div>
      </div>

      {/* ── Body: left + right ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── LEFT COLUMN ── */}
        <div className="space-y-5">

          {/* Contacto */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Contacto</h2>
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 text-sm text-gray-800">
                <Phone size={14} className="text-gray-400 shrink-0" />
                <span className="font-mono">{cliente.whatsapp}</span>
                <span className="text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded font-medium">WA</span>
              </div>
              {cliente.telefono_contacto && (
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <Phone size={14} className="text-gray-400 shrink-0" />
                  <span className="font-mono">{cliente.telefono_contacto}</span>
                </div>
              )}
              {cliente.email && (
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <Mail size={14} className="text-gray-400 shrink-0" />
                  <span className="truncate">{cliente.email}</span>
                </div>
              )}
              {cliente.email_2 && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Mail size={14} className="text-gray-300 shrink-0" />
                  <span className="truncate">{cliente.email_2}</span>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-400 pt-2 border-t border-gray-100">
              Cliente desde {formatDate(cliente.creado_at)}
            </p>
          </div>

          {/* Relación por área — el insight clave de Autoline */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Relación por área</h2>
              <p className="text-xs text-gray-400 mt-0.5">Contactos activos en cada departamento</p>
            </div>
            <div className="divide-y divide-gray-100">
              {[
                {
                  area: 'Servicio / Taller',
                  icon: <Wrench size={13} />,
                  bg: 'bg-orange-100 text-orange-600',
                  count: (ots ?? []).length,
                  label: `${(ots ?? []).length} OT${(ots ?? []).length !== 1 ? 's' : ''}`,
                  ultima: undefined,
                  tipo: 'ot' as AreaKey,
                },
                {
                  area: 'Citas',
                  icon: <Calendar size={13} />,
                  bg: 'bg-blue-100 text-blue-600',
                  count: (citas ?? []).length,
                  label: `${(citas ?? []).length} cita${(citas ?? []).length !== 1 ? 's' : ''}`,
                  ultima: (citas ?? []).at(0)?.fecha_cita,
                  tipo: 'cita' as AreaKey,
                },
                {
                  area: 'Refacciones',
                  icon: <FileText size={13} />,
                  bg: 'bg-indigo-100 text-indigo-600',
                  count: (cotizaciones ?? []).length,
                  label: `${(cotizaciones ?? []).length} cotización${(cotizaciones ?? []).length !== 1 ? 'es' : ''}`,
                  ultima: undefined,
                  tipo: 'cotizacion' as AreaKey,
                },
                {
                  area: 'CRM / Actividades',
                  icon: <Activity size={13} />,
                  bg: 'bg-purple-100 text-purple-600',
                  count: (actividades ?? []).length,
                  label: `${(actividades ?? []).length} actividad${(actividades ?? []).length !== 1 ? 'es' : ''}`,
                  ultima: (actividades ?? []).at(0)?.fecha_vencimiento ?? (actividades ?? []).at(0)?.creado_at,
                  tipo: 'actividad' as AreaKey,
                },
              ].map((row) => (
                <Link
                  key={row.area}
                  href={`/crm/clientes/${id}?area=${row.tipo}`}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${row.bg}`}>
                    {row.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{row.area}</p>
                    <p className="text-xs text-gray-400">{row.ultima ? formatDate(row.ultima) : 'Sin actividad'}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-gray-900">{row.count}</p>
                    <p className="text-xs text-gray-400">{row.count === 1 ? 'registro' : 'registros'}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Empresa */}
          <EmpresaSection
            clienteId={id}
            empresa={empresa}
            vehiculos={vehiculos
              .filter(vp => vp.vehiculo)
              .map(vp => ({
                id: vp.vehiculo!.id,
                marca: vp.vehiculo!.marca,
                modelo: vp.vehiculo!.modelo,
                anio: vp.vehiculo!.anio,
                placa: vp.vehiculo!.placa,
                rol_vehiculo: vp.rol_vehiculo,
              }))}
          />

          {/* Vehículos */}
          <VehiculosSection
            clienteId={id}
            vehiculos={vehiculos
              .filter(vp => vp.vehiculo)
              .map(vp => ({
                id: vp.vehiculo!.id,
                marca: vp.vehiculo!.marca,
                modelo: vp.vehiculo!.modelo,
                anio: vp.vehiculo!.anio,
                placa: vp.vehiculo!.placa,
                rol_vehiculo: vp.rol_vehiculo,
              }))}
          />
        </div>

        {/* ── RIGHT COLUMN: Unified Timeline ── */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">

            {/* Timeline header */}
            <div className="px-5 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">Historial unificado</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Todas las áreas · {allItems.length} interacciones totales</p>
                </div>
              </div>
              {/* Filter tabs */}
              <div className="flex flex-wrap gap-1">
                {([
                  { key: 'todos', label: 'Todos' },
                  { key: 'cita', label: 'Citas' },
                  { key: 'ot', label: 'Taller' },
                  { key: 'cotizacion', label: 'Refacciones' },
                  { key: 'actividad', label: 'Actividades' },
                ] as { key: string; label: string }[]).map(({ key, label }) => (
                  <Link
                    key={key}
                    href={`/crm/clientes/${id}?area=${key}`}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      area === key
                        ? 'bg-gray-900 text-white'
                        : 'text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    {label}
                    <span className="ml-1 text-gray-400 font-normal">({counts[key] ?? 0})</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Timeline items */}
            {filtered.length === 0 ? (
              <div className="py-16 text-center">
                <Activity size={28} className="mx-auto text-gray-200 mb-3" />
                <p className="text-sm text-gray-500">Sin registros en esta área</p>
                <Link href={`/citas/nuevo?cliente_id=${id}`}
                  className="mt-3 inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline">
                  <Plus size={13} /> Crear primera interacción
                </Link>
              </div>
            ) : (
              <div className="relative">
                {/* Vertical timeline line */}
                <div className="absolute left-8 top-0 bottom-0 w-px bg-gray-100" />

                <div className="divide-y divide-gray-50">
                  {filtered.map((item) => {
                    const cfg = AREA_CONFIG[item.tipo]
                    return (
                      <Link
                        key={`${item.tipo}-${item.id}`}
                        href={item.href}
                        className="flex items-start gap-4 px-5 py-4 hover:bg-gray-50 transition-colors relative"
                      >
                        {/* Timeline dot */}
                        <div className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center z-10 ${cfg.bg} ${cfg.border} border-2 bg-white`}>
                          <div className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0 pt-0.5">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              {/* Area badge + date */}
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
                                  {cfg.label}
                                </span>
                                <span className="text-xs text-gray-400">{formatDate(item.fecha)}</span>
                                {item.subtitulo && (
                                  <span className="text-xs text-gray-400">· {item.subtitulo}</span>
                                )}
                              </div>

                              {/* Title */}
                              <p className="text-sm font-medium text-gray-900 truncate">{item.titulo}</p>

                              {/* User if available */}
                              {item.usuario && (
                                <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                                  <User size={11} /> {item.usuario}
                                </p>
                              )}
                            </div>

                            {/* Right: estado + monto */}
                            <div className="shrink-0 text-right">
                              {item.monto != null && item.monto > 0 && (
                                <p className="text-sm font-semibold text-gray-900 mb-1">
                                  ${item.monto.toLocaleString('es-MX')}
                                </p>
                              )}
                              {item.estado && (
                                <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${
                                  ESTADO_COLORS[item.estado] ?? 'bg-gray-100 text-gray-500'
                                }`}>
                                  {item.tipo === 'actividad' && item.completado ? (
                                    <span className="flex items-center gap-1">
                                      <CheckCircle2 size={11} /> Completada
                                    </span>
                                  ) : (
                                    item.estado.replace(/_/g, ' ')
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Footer */}
            {allItems.length > 0 && (
              <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
                <p className="text-xs text-gray-400">
                  Mostrando {filtered.length} de {allItems.length} interacciones
                </p>
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  {Object.entries(counts).filter(([k]) => k !== 'todos').map(([k, n]) => (
                    n > 0 ? (
                      <span key={k} className={`flex items-center gap-1 ${AREA_CONFIG[k as AreaKey]?.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${AREA_CONFIG[k as AreaKey]?.dot}`} />
                        {AREA_CONFIG[k as AreaKey]?.label}: {n}
                      </span>
                    ) : null
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
