import { createClient } from '@/lib/supabase/server'
import { Plus, TrendingUp, DollarSign, Target, XCircle } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

// Valores exactos del ENUM estado_lead en BD
type EstadoLead = 'nuevo' | 'contactado' | 'cotizado' | 'negociando' | 'cerrado_ganado' | 'cerrado_perdido'

const COLUMNAS: { estado: EstadoLead; label: string; color: string; dot: string; bg: string }[] = [
  { estado: 'nuevo',          label: 'Nuevo',       color: 'text-gray-600',   dot: 'bg-gray-400',   bg: 'bg-gray-50' },
  { estado: 'contactado',     label: 'Contactado',  color: 'text-blue-600',   dot: 'bg-blue-400',   bg: 'bg-blue-50' },
  { estado: 'cotizado',       label: 'Cotizado',    color: 'text-yellow-600', dot: 'bg-yellow-400', bg: 'bg-yellow-50' },
  { estado: 'negociando',     label: 'Negociando',  color: 'text-orange-600', dot: 'bg-orange-400', bg: 'bg-orange-50' },
  { estado: 'cerrado_ganado', label: 'Ganado',      color: 'text-green-600',  dot: 'bg-green-500',  bg: 'bg-green-50' },
  { estado: 'cerrado_perdido',label: 'Perdido',     color: 'text-red-600',    dot: 'bg-red-400',    bg: 'bg-red-50' },
]

const FUENTE_LABEL: Record<string, string> = {
  organico: 'Orgánico', recomendacion: 'Recomendación', campana: 'Campaña',
  walk_in: 'Walk-in', web: 'Web', otro: 'Otro',
}

type LeadRow = {
  id: string
  estado: EstadoLead
  fuente: string | null
  nombre: string | null        // columna real en tabla leads
  vehiculo_interes: string | null
  presupuesto_estimado: number | null
  creado_at: string
  cliente: { id: string; nombre: string; apellido: string } | null
  asesor: { nombre: string; apellido: string } | null  // FK real: asesor_id
}

export default async function VentasPage() {
  const supabase = await createClient()

  const { data: leads } = await supabase
    .from('leads')
    .select(`
      id, estado, fuente, nombre, vehiculo_interes, presupuesto_estimado, creado_at,
      cliente:clientes ( id, nombre, apellido ),
      asesor:usuarios!leads_asesor_id_fkey ( nombre, apellido )
    `)
    .order('creado_at', { ascending: false })
    .limit(200)

  const rows = (leads as unknown as LeadRow[]) ?? []

  const total = rows.length
  const ganados = rows.filter(r => r.estado === 'cerrado_ganado').length
  const activos = rows.filter(r => !['cerrado_ganado', 'cerrado_perdido'].includes(r.estado)).length
  const perdidos = rows.filter(r => r.estado === 'cerrado_perdido').length

  return (
    <div className="space-y-5 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Ventas</h1>
          <p className="text-sm text-gray-500 mt-0.5">Pipeline de leads y oportunidades</p>
        </div>
        <Link
          href="/ventas/nuevo"
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
        >
          <Plus size={16} />
          Nuevo Lead
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 shrink-0">
        {[
          { label: 'Total leads',   value: total,   icon: TrendingUp, color: 'text-gray-600',   bg: 'bg-gray-50'  },
          { label: 'Activos',       value: activos,  icon: Target,     color: 'text-blue-600',   bg: 'bg-blue-50'  },
          { label: 'Ganados',       value: ganados,  icon: DollarSign, color: 'text-green-600',  bg: 'bg-green-50' },
          { label: 'Perdidos',      value: perdidos, icon: XCircle,    color: 'text-red-600',    bg: 'bg-red-50'   },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
            <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', bg)}>
              <Icon size={18} className={color} />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Kanban */}
      <div className="flex-1 overflow-x-auto pb-4">
        <div className="flex gap-3 h-full min-w-max">
          {COLUMNAS.map(({ estado, label, color, dot, bg }) => {
            const leadsCol = rows.filter(r => r.estado === estado)
            return (
              <div key={estado} className="w-64 flex flex-col gap-2">
                {/* Column header */}
                <div className={cn('flex items-center gap-2 px-3 py-2 rounded-lg', bg)}>
                  <div className={cn('w-2 h-2 rounded-full', dot)} />
                  <span className={cn('text-xs font-semibold', color)}>{label}</span>
                  <span className="text-xs text-gray-400 ml-auto">{leadsCol.length}</span>
                </div>

                {/* Cards */}
                <div className="space-y-2 flex-1 overflow-y-auto">
                  {leadsCol.map(lead => {
                    const nombre = lead.cliente
                      ? `${lead.cliente.nombre} ${lead.cliente.apellido}`
                      : lead.nombre ?? 'Sin nombre'
                    return (
                      <Link
                        key={lead.id}
                        href={`/ventas/${lead.id}`}
                        className="block bg-white rounded-lg border border-gray-200 p-3 space-y-2 hover:shadow-sm hover:border-gray-300 transition-all"
                      >
                        <p className="text-sm font-medium text-gray-900 leading-tight">{nombre}</p>

                        {lead.vehiculo_interes && (
                          <p className="text-xs text-gray-500">{lead.vehiculo_interes}</p>
                        )}

                        <div className="flex items-center justify-between">
                          {lead.presupuesto_estimado ? (
                            <span className="text-xs font-medium text-green-700">
                              ${lead.presupuesto_estimado.toLocaleString('es-MX')}
                            </span>
                          ) : <span />}
                          {lead.fuente && (
                            <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                              {FUENTE_LABEL[lead.fuente] ?? lead.fuente}
                            </span>
                          )}
                        </div>

                        {lead.asesor && (
                          <p className="text-[10px] text-gray-400">
                            {lead.asesor.nombre} {lead.asesor.apellido}
                          </p>
                        )}
                      </Link>
                    )
                  })}

                  {leadsCol.length === 0 && (
                    <div className="text-center py-8 text-xs text-gray-400">Sin leads</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}


