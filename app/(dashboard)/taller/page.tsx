import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Wrench, Plus, Clock, Car, User } from 'lucide-react'
import { formatDate, formatDateTime, cn } from '@/lib/utils'
import type { EstadoOT } from '@/types/database'

const ESTADO_CONFIG: Record<EstadoOT, { label: string; color: string; dot: string }> = {
  recibido:    { label: 'Recibido',    color: 'bg-blue-100 text-blue-700',    dot: 'bg-blue-500' },
  diagnostico: { label: 'Diagnóstico', color: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500' },
  en_proceso:  { label: 'En proceso',  color: 'bg-purple-100 text-purple-700', dot: 'bg-purple-500' },
  listo:       { label: 'Listo',       color: 'bg-green-100 text-green-700',  dot: 'bg-green-500' },
  entregado:   { label: 'Entregado',   color: 'bg-gray-100 text-gray-600',    dot: 'bg-gray-400' },
  cancelado:   { label: 'Cancelado',   color: 'bg-red-100 text-red-600',      dot: 'bg-red-400' },
}

const ESTADO_ORDEN: EstadoOT[] = ['recibido', 'diagnostico', 'en_proceso', 'listo', 'entregado', 'cancelado']

interface PageProps {
  searchParams: Promise<{ estado?: string; q?: string }>
}

export default async function TallerPage({ searchParams }: PageProps) {
  const { estado, q = '' } = await searchParams
  // createClient() aplica RLS — solo devuelve OTs de la sucursal del usuario autenticado
  const supabase = await createClient()

  let query = supabase
    .from('ordenes_trabajo')
    .select(`
      id, numero_ot, numero_ot_dms, estado, diagnostico, km_ingreso, promesa_entrega, created_at, updated_at,
      cliente:clientes ( id, nombre, apellido, whatsapp ),
      vehiculo:vehiculos ( id, marca, modelo, anio, placa ),
      asesor:usuarios ( id, nombre, apellido )
    `)
    .order('created_at', { ascending: false })
    .limit(100)

  if (estado && estado !== 'todas') {
    query = query.eq('estado', estado)
  } else if (!estado) {
    // Default: exclude finalized
    query = query.not('estado', 'in', '("entregado","cancelado")')
  }

  if (q) {
    query = query.ilike('numero_ot', `%${q}%`)
  }

  const { data: ots } = await query

  // Count by estado for filter tabs
  const { data: countsData } = await supabase
    .from('ordenes_trabajo')
    .select('estado')
    .not('estado', 'in', '("entregado","cancelado")')

  const activeCount = countsData?.length ?? 0

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Taller</h1>
          <p className="text-sm text-gray-500 mt-0.5">Órdenes de trabajo activas</p>
        </div>
        <Link
          href="/taller/nuevo"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus size={15} />
          Nueva OT
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200">
        <Link
          href="/taller"
          className={cn(
            'px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
            !estado ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          )}
        >
          Activas ({activeCount})
        </Link>
        {ESTADO_ORDEN.map((e) => (
          <Link
            key={e}
            href={`/taller?estado=${e}`}
            className={cn(
              'px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors capitalize',
              estado === e ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            {ESTADO_CONFIG[e].label}
          </Link>
        ))}
        <Link
          href="/taller?estado=todas"
          className={cn(
            'px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
            estado === 'todas' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          )}
        >
          Todas
        </Link>
      </div>

      {/* Table */}
      {!ots || ots.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-center bg-gray-50 rounded-xl border border-gray-200">
          <Wrench size={28} className="text-gray-300 mb-2" />
          <p className="text-sm text-gray-500">No hay órdenes de trabajo{estado && estado !== 'todas' ? ` en estado "${ESTADO_CONFIG[estado as EstadoOT]?.label ?? estado}"` : ''}</p>
          <Link href="/taller/nuevo" className="mt-3 text-xs text-blue-600 hover:underline">
            Crear primera OT
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">OT</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Cliente / Vehículo</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Estado</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Asesor</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Promesa</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Creada</th>
              </tr>
            </thead>
            <tbody>
              {ots.map((ot) => {
                type OTRow = typeof ot & {
                  cliente: { id: string; nombre: string; apellido: string; whatsapp: string } | null
                  vehiculo: { id: string; marca: string; modelo: string; anio: number; placa: string | null } | null
                  asesor: { id: string; nombre: string; apellido: string } | null
                }
                const row = ot as unknown as OTRow
                const estadoCfg =
                  ESTADO_CONFIG[row.estado as EstadoOT] ??
                  { label: row.estado ?? 'SIN ESTADO', color: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' }

                return (
                  <tr key={row.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/taller/${row.id}`} className="font-mono text-xs font-medium text-blue-600 hover:underline">
                        {row.numero_ot}
                      </Link>
                      {(row as unknown as { numero_ot_dms: string | null }).numero_ot_dms && (
                        <p className="text-xs text-gray-400 font-mono mt-0.5">
                          DMS: {(row as unknown as { numero_ot_dms: string | null }).numero_ot_dms}
                        </p>
                      )}
                      {row.diagnostico && (
                        <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[160px]">{row.diagnostico}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {row.cliente ? (
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
                                {row.vehiculo.placa && ` — ${row.vehiculo.placa}`}
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium', estadoCfg.color)}>
                        <span className={cn('w-1.5 h-1.5 rounded-full', estadoCfg.dot)} />
                        {estadoCfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {row.asesor ? `${row.asesor.nombre} ${row.asesor.apellido}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {row.promesa_entrega ? (
                        <div className="flex items-center gap-1">
                          <Clock size={11} />
                          {formatDate(row.promesa_entrega)}
                        </div>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {row.created_at ? formatDateTime(row.created_at) : '—'}
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
