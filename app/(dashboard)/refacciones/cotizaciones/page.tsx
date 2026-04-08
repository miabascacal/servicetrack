import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { FileText, Plus, User, Car } from 'lucide-react'
import { formatDate, formatDateTime, cn } from '@/lib/utils'

const ESTADO_CONFIG: Record<string, { label: string; color: string }> = {
  borrador:  { label: 'Borrador',  color: 'bg-gray-100 text-gray-600' },
  enviada:   { label: 'Enviada',   color: 'bg-blue-100 text-blue-700' },
  abierta:   { label: 'Abierta',   color: 'bg-indigo-100 text-indigo-700' },
  aprobada:  { label: 'Aprobada',  color: 'bg-green-100 text-green-700' },
  rechazada: { label: 'Rechazada', color: 'bg-red-100 text-red-600' },
  vencida:   { label: 'Vencida',   color: 'bg-yellow-100 text-yellow-700' },
}

interface PageProps {
  searchParams: Promise<{ estado?: string }>
}

export default async function CotizacionesPage({ searchParams }: PageProps) {
  const { estado } = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('cotizaciones')
    .select(`
      id, numero_cotizacion, tipo, estado, total, fecha_emision, fecha_vencimiento,
      cliente:clientes ( id, nombre, apellido ),
      vehiculo:vehiculos ( id, marca, modelo, anio ),
      asesor:usuarios ( id, nombre, apellido )
    `)
    .order('creada_at', { ascending: false })
    .limit(100)

  if (estado) query = query.eq('estado', estado)

  const { data: cotizaciones } = await query

  const tabs = [
    { key: '', label: 'Todas' },
    { key: 'borrador', label: 'Borrador' },
    { key: 'enviada', label: 'Enviadas' },
    { key: 'aprobada', label: 'Aprobadas' },
    { key: 'rechazada', label: 'Rechazadas' },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Cotizaciones</h1>
          <p className="text-sm text-gray-500 mt-0.5">{cotizaciones?.length ?? 0} cotizaciones</p>
        </div>
        <Link
          href="/refacciones/cotizaciones/nuevo"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus size={15} />
          Nueva cotización
        </Link>
      </div>

      <div className="flex items-center gap-1 border-b border-gray-200">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={tab.key ? `/refacciones/cotizaciones?estado=${tab.key}` : '/refacciones/cotizaciones'}
            className={cn(
              'px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              (estado ?? '') === tab.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {!cotizaciones || cotizaciones.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 bg-gray-50 rounded-xl border border-gray-200 text-center">
          <FileText size={28} className="text-gray-300 mb-2" />
          <p className="text-sm text-gray-500">No hay cotizaciones</p>
          <Link href="/refacciones/cotizaciones/nuevo" className="mt-3 text-xs text-blue-600 hover:underline">
            Crear primera cotización
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Cotización</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Cliente / Vehículo</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Estado</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Total</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Vencimiento</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {cotizaciones.map((cot) => {
                type CotRow = typeof cot & {
                  cliente: { id: string; nombre: string; apellido: string } | null
                  vehiculo: { id: string; marca: string; modelo: string; anio: number } | null
                  asesor: { id: string; nombre: string; apellido: string } | null
                }
                const row = cot as unknown as CotRow
                const estadoCfg = ESTADO_CONFIG[row.estado] ?? { label: row.estado, color: 'bg-gray-100 text-gray-600' }

                return (
                  <tr key={row.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/refacciones/cotizaciones/${row.id}`} className="font-mono text-xs font-medium text-blue-600 hover:underline">
                        {row.numero_cotizacion}
                      </Link>
                      <p className="text-xs text-gray-400 mt-0.5 capitalize">{row.tipo}</p>
                    </td>
                    <td className="px-4 py-3">
                      {row.cliente && (
                        <div>
                          <div className="flex items-center gap-1.5">
                            <User size={11} className="text-gray-400" />
                            <Link href={`/crm/clientes/${row.cliente.id}`} className="text-gray-900 hover:underline">
                              {row.cliente.nombre} {row.cliente.apellido}
                            </Link>
                          </div>
                          {row.vehiculo && (
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <Car size={11} className="text-gray-400" />
                              <span className="text-xs text-gray-500">
                                {row.vehiculo.marca} {row.vehiculo.modelo} {row.vehiculo.anio}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', estadoCfg.color)}>
                        {estadoCfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {row.total != null ? `$${row.total.toLocaleString('es-MX')}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {row.fecha_vencimiento ? formatDate(row.fecha_vencimiento) : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {formatDateTime(row.fecha_emision)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
