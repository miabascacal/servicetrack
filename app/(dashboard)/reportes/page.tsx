import { createClient } from '@/lib/supabase/server'
import {
  Calendar,
  Wrench,
  Package,
  TrendingUp,
  HeartHandshake,
  Star,
  Shield,
  BarChart3,
  ArrowRight,
  TrendingDown,
  Users,
  Clock,
} from 'lucide-react'
import Link from 'next/link'

const MODULOS = [
  {
    key: 'citas',
    label: 'Citas',
    icon: Calendar,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    dot: 'bg-blue-500',
    href: '/reportes/citas',
    kpis: ['Tasa show vs no-show', 'Tiempo prom. confirmación', 'Bot actuó X veces', 'Fuentes de citas'],
    disponible: false,
  },
  {
    key: 'taller',
    label: 'Taller',
    icon: Wrench,
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    dot: 'bg-orange-500',
    href: '/reportes/taller',
    kpis: ['OTs abiertas / cerradas', 'Tiempo promedio de reparación', 'Ventas perdidas', 'Gasto por cliente'],
    disponible: false,
  },
  {
    key: 'partes',
    label: 'Refacciones',
    icon: Package,
    color: 'text-indigo-600',
    bg: 'bg-indigo-50',
    border: 'border-indigo-200',
    dot: 'bg-indigo-500',
    href: '/reportes/partes',
    kpis: ['Cotizaciones enviadas / aprobadas', 'Tasa de conversión', 'Valor total aprobado', 'Piezas más cotizadas'],
    disponible: false,
  },
  {
    key: 'ventas',
    label: 'Ventas',
    icon: TrendingUp,
    color: 'text-green-600',
    bg: 'bg-green-50',
    border: 'border-green-200',
    dot: 'bg-green-500',
    href: '/reportes/ventas',
    kpis: ['Pipeline por etapa', 'Tasa de conversión', 'Tiempo prom. cierre', 'Leads por fuente'],
    disponible: false,
  },
  {
    key: 'atencion',
    label: 'Atención a Clientes',
    icon: HeartHandshake,
    color: 'text-rose-600',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    dot: 'bg-rose-500',
    href: '/reportes/atencion',
    kpis: ['Quejas abiertas / resueltas', 'Tiempo prom. resolución', 'SLA cumplido', 'Por área'],
    disponible: false,
  },
  {
    key: 'csi',
    label: 'CSI',
    icon: Star,
    color: 'text-yellow-600',
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    dot: 'bg-yellow-500',
    href: '/reportes/csi',
    kpis: ['NPS promedio', 'Score por asesor', 'Reseñas Google generadas', 'Tendencia mensual'],
    disponible: false,
  },
  {
    key: 'seguros',
    label: 'Seguros',
    icon: Shield,
    color: 'text-purple-600',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    dot: 'bg-purple-500',
    href: '/reportes/seguros',
    kpis: ['Pólizas próximas a vencer', 'Por aseguradora', 'Por tipo de póliza', 'Historial de renovaciones'],
    disponible: false,
  },
  {
    key: 'dashboards',
    label: 'Dashboards',
    icon: BarChart3,
    color: 'text-gray-700',
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    dot: 'bg-gray-500',
    href: '/reportes/dashboards',
    kpis: ['KPIs ejecutivos', 'Vista gerencial', 'Comparativa sucursales', 'Exportar a Excel/PDF'],
    disponible: false,
  },
]

export default async function ReportesPage() {
  const supabase = await createClient()

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const weekAgoStr = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const [
    { count: citasHoy },
    { count: otsActivas },
    { count: clientesSemana },
    { count: cotizaciones },
  ] = await Promise.all([
    supabase.from('citas').select('id', { count: 'exact', head: true }).eq('fecha_cita', todayStr),
    supabase.from('ordenes_trabajo').select('id', { count: 'exact', head: true }).not('estado', 'in', '("entregado","cancelado")'),
    supabase.from('citas').select('cliente_id', { count: 'exact', head: true }).gte('fecha_cita', weekAgoStr),
    supabase.from('cotizaciones').select('id', { count: 'exact', head: true }).eq('estado', 'enviada'),
  ])

  const KPI_GLOBALES = [
    { label: 'Citas hoy', valor: String(citasHoy ?? 0), sub: 'programadas para hoy', icon: Calendar, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'OTs activas', valor: String(otsActivas ?? 0), sub: 'en taller actualmente', icon: Wrench, color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Visitas esta semana', valor: String(clientesSemana ?? 0), sub: 'últimos 7 días', icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Cotizaciones enviadas', valor: String(cotizaciones ?? 0), sub: 'pendientes de respuesta', icon: TrendingDown, color: 'text-green-600', bg: 'bg-green-50' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Reportes</h1>
        <p className="text-sm text-gray-500 mt-0.5">Indicadores por módulo — selecciona el área que quieres analizar</p>
      </div>

      {/* KPI globales del día */}
      <div className="grid grid-cols-4 gap-4">
        {KPI_GLOBALES.map(({ label, valor, sub, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center`}>
                <Icon size={18} className={color} />
              </div>
              <p className="text-2xl font-bold text-gray-900">{valor}</p>
            </div>
            <p className="text-sm font-medium text-gray-700">{label}</p>
            <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Módulos */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Reportes por módulo</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {MODULOS.map((m) => {
            const Icon = m.icon
            const card = (
              <div className={`bg-white rounded-xl border ${m.disponible ? m.border : 'border-gray-200'} p-5 h-full flex flex-col ${
                m.disponible ? 'hover:shadow-md transition-shadow cursor-pointer' : 'opacity-60'
              }`}>
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-xl ${m.bg} flex items-center justify-center`}>
                    <Icon size={20} className={m.color} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{m.label}</p>
                    {!m.disponible && (
                      <span className="text-[11px] text-gray-400">Próximamente</span>
                    )}
                  </div>
                </div>
                <ul className="space-y-1.5 flex-1">
                  {m.kpis.map((kpi) => (
                    <li key={kpi} className="flex items-center gap-2 text-xs text-gray-600">
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${m.dot}`} />
                      {kpi}
                    </li>
                  ))}
                </ul>
                {m.disponible && (
                  <div className={`mt-4 pt-3 border-t ${m.border} flex items-center justify-between`}>
                    <span className={`text-xs font-medium ${m.color}`}>Ver reporte</span>
                    <ArrowRight size={14} className={m.color} />
                  </div>
                )}
              </div>
            )
            return m.disponible ? (
              <Link key={m.key} href={m.href}>{card}</Link>
            ) : (
              <div key={m.key}>{card}</div>
            )
          })}
        </div>
      </div>

      {/* Footer note */}
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4">
        <Clock size={16} className="text-blue-500 mt-0.5 shrink-0" />
        <p className="text-sm text-blue-700">
          Los reportes detallados estarán disponibles en los siguientes sprints. Los KPIs globales se actualizan en tiempo real.
        </p>
      </div>
    </div>
  )
}
