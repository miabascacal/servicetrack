import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Car, Plus, Search } from 'lucide-react'

interface PageProps {
  searchParams: Promise<{ q?: string }>
}

export default async function VehiculosPage({ searchParams }: PageProps) {
  const { q = '' } = await searchParams
  // createClient() aplica RLS — solo devuelve vehículos de la sucursal del usuario autenticado
  const admin = await createClient()

  let query = admin
    .from('vehiculos')
    .select(`
      id, marca, modelo, anio, color, placa, vin,
      km_actual, estado_verificacion, activo,
      vehiculo_personas (
        rol_vehiculo,
        cliente:clientes ( id, nombre, apellido, whatsapp )
      )
    `)
    .order('marca')
    .order('modelo')
    .limit(100)

  if (q) {
    query = query.or(`marca.ilike.%${q}%,modelo.ilike.%${q}%,placa.ilike.%${q}%,vin.ilike.%${q}%`)
  }

  const { data: vehiculos } = await query

  const VERIFICACION_COLORS: Record<string, string> = {
    vigente: 'bg-green-100 text-green-700',
    por_vencer: 'bg-yellow-100 text-yellow-700',
    vencida: 'bg-red-100 text-red-700',
    no_aplica: 'bg-gray-100 text-gray-500',
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Vehículos</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {vehiculos?.length ?? 0} vehículos registrados
          </p>
        </div>
        <Link
          href="/crm/vehiculos/nuevo"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} />
          Nuevo Vehículo
        </Link>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <form method="GET">
          <input
            name="q"
            defaultValue={q}
            type="search"
            placeholder="Buscar por marca, modelo, placa o VIN..."
            className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </form>
      </div>

      {/* Grid */}
      {!vehiculos || vehiculos.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 py-16 text-center">
          <Car size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">
            {q ? `Sin resultados para "${q}"` : 'No hay vehículos registrados'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {vehiculos.map((v) => {
            type PersonaRow = {
              rol_vehiculo: string
              cliente: { id: string; nombre: string; apellido: string; whatsapp: string } | null
            }
            const personas = (v.vehiculo_personas as unknown as PersonaRow[]) ?? []
            const dueno = personas.find((p) => p.rol_vehiculo === 'dueno')

            return (
              <Link
                key={v.id}
                href={`/crm/vehiculos/${v.id}`}
                className="bg-white rounded-lg border border-gray-200 p-4 hover:border-blue-300 hover:shadow-sm transition-all group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                      <Car size={18} className="text-gray-500" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm group-hover:text-blue-600 transition-colors">
                        {v.marca} {v.modelo}
                      </p>
                      <p className="text-xs text-gray-500">{v.anio} · {v.color ?? 'Sin color'}</p>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      VERIFICACION_COLORS[v.estado_verificacion] ?? 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {v.estado_verificacion.replace('_', ' ')}
                  </span>
                </div>

                <div className="space-y-1.5">
                  {v.placa && (
                    <p className="text-xs font-mono text-gray-600 bg-gray-100 inline-block px-2 py-0.5 rounded">
                      {v.placa}
                    </p>
                  )}
                  {dueno?.cliente && (
                    <p className="text-xs text-gray-500">
                      Dueño: {dueno.cliente.nombre} {dueno.cliente.apellido}
                    </p>
                  )}
                  {v.km_actual && (
                    <p className="text-xs text-gray-400">
                      {v.km_actual.toLocaleString('es-MX')} km
                    </p>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
