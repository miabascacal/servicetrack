import { createClient } from '@/lib/supabase/server'
import { Shield, AlertTriangle, CheckCircle2, XCircle, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

type PolizaRow = {
  id: string
  numero_poliza: string | null
  tipo_poliza: string | null
  estado: string | null
  fecha_inicio: string | null
  fecha_fin: string | null
  alerta_vencimiento_enviada: boolean
  vehiculo: { marca: string; modelo: string; anio: number; placa: string | null } | null
  cliente: { nombre: string; apellido: string } | null
  compania: { nombre: string } | null
}

const ESTADO_LABEL: Record<string, string> = { M: 'Vencida', N: 'Vigente', C: 'Cancelada', I: 'Inactiva' }
const TIPO_LABEL: Record<string, string> = { NF: 'Nuevo/Full', NP: 'Nuevo/Parcial', XF: 'Usado/Full', XP: 'Usado/Parcial' }

function diasParaVencer(fechaFin: string | null): number | null {
  if (!fechaFin) return null
  const diff = new Date(fechaFin).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export default async function SegurosPage() {
  const supabase = await createClient()

  const { data: polizas } = await supabase
    .from('seguros_vehiculo')
    .select(`
      id, numero_poliza, tipo_poliza, estado, fecha_inicio, fecha_fin, alerta_vencimiento_enviada,
      vehiculo:vehiculos ( marca, modelo, anio, placa ),
      cliente:clientes ( nombre, apellido ),
      compania:companias_seguro ( nombre )
    `)
    .order('fecha_fin', { ascending: true, nullsFirst: false })
    .limit(200)

  const rows = (polizas as unknown as PolizaRow[]) ?? []

  const vigentes = rows.filter(r => r.estado === 'N').length
  const proximasVencer = rows.filter(r => {
    const d = diasParaVencer(r.fecha_fin)
    return d !== null && d >= 0 && d <= 30
  }).length
  const vencidas = rows.filter(r => r.estado === 'M').length
  const total = rows.length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Seguros</h1>
          <p className="text-sm text-gray-500 mt-0.5">Pólizas vehiculares de clientes</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors">
          <Plus size={16} />
          Nueva póliza
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total pólizas', value: total, icon: Shield, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Vigentes', value: vigentes, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Vencen en 30 días', value: proximasVencer, icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50' },
          { label: 'Vencidas', value: vencidas, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-3">
            <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', bg)}>
              <Icon size={18} className={color} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabla de pólizas */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Pólizas registradas</h2>
        </div>

        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <Shield size={32} className="text-gray-300 mb-2" />
            <p className="text-sm text-gray-500">Sin pólizas registradas</p>
            <p className="text-xs text-gray-400 mt-1">Agrega la primera póliza de un cliente</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Cliente', 'Vehículo', 'Compañía', 'Tipo', 'Vence', 'Estado'].map(h => (
                    <th key={h} className="text-left text-xs font-medium text-gray-500 px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map(poliza => {
                  const dias = diasParaVencer(poliza.fecha_fin)
                  const esAlerta = dias !== null && dias >= 0 && dias <= 30
                  return (
                    <tr key={poliza.id} className={cn('hover:bg-gray-50', esAlerta && 'bg-orange-50/50')}>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {poliza.cliente ? `${poliza.cliente.nombre} ${poliza.cliente.apellido}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {poliza.vehiculo
                          ? `${poliza.vehiculo.marca} ${poliza.vehiculo.modelo} ${poliza.vehiculo.anio}`
                          : '—'}
                        {poliza.vehiculo?.placa && <span className="text-gray-400 ml-1">· {poliza.vehiculo.placa}</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{poliza.compania?.nombre ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{poliza.tipo_poliza ? TIPO_LABEL[poliza.tipo_poliza] ?? poliza.tipo_poliza : '—'}</td>
                      <td className="px-4 py-3">
                        {poliza.fecha_fin ? (
                          <span className={cn('text-xs font-medium', esAlerta ? 'text-orange-600' : dias !== null && dias < 0 ? 'text-red-600' : 'text-gray-600')}>
                            {new Date(poliza.fecha_fin).toLocaleDateString('es-MX')}
                            {dias !== null && dias >= 0 && dias <= 30 && (
                              <span className="ml-1 text-orange-500">({dias}d)</span>
                            )}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          'text-xs px-2 py-0.5 rounded-full font-medium',
                          poliza.estado === 'N' ? 'bg-green-100 text-green-700' :
                          poliza.estado === 'M' ? 'bg-red-100 text-red-600' :
                          'bg-gray-100 text-gray-500'
                        )}>
                          {poliza.estado ? ESTADO_LABEL[poliza.estado] ?? poliza.estado : '—'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
