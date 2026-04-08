import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Package, Plus, Search } from 'lucide-react'

interface PageProps {
  searchParams: Promise<{ q?: string }>
}

export default async function MaestroPartesPage({ searchParams }: PageProps) {
  const { q = '' } = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('maestro_partes')
    .select('id, numero_parte, descripcion, categoria, marca_vehiculo, marca_parte, precio_venta, precio_costo, disponible')
    .eq('activo', true)
    .order('descripcion')
    .limit(200)

  if (q) {
    query = query.or(`numero_parte.ilike.%${q}%,descripcion.ilike.%${q}%,categoria.ilike.%${q}%`)
  }

  const { data: partes } = await query

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Maestro de partes</h1>
          <p className="text-sm text-gray-500 mt-0.5">{partes?.length ?? 0} partes en catálogo</p>
        </div>
        <Link href="/refacciones/partes/nuevo"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
          <Plus size={15} />
          Nueva parte
        </Link>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <form method="GET">
          <input name="q" defaultValue={q} type="search"
            placeholder="Buscar por número, descripción o categoría..."
            className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
        </form>
      </div>

      {!partes || partes.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 bg-gray-50 rounded-xl border border-gray-200 text-center">
          <Package size={28} className="text-gray-300 mb-2" />
          <p className="text-sm text-gray-500">{q ? `Sin resultados para "${q}"` : 'No hay partes en el catálogo'}</p>
          <Link href="/refacciones/partes/nuevo" className="mt-3 text-xs text-blue-600 hover:underline">
            Agregar primera parte
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">No. Parte</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Descripción</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Categoría</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Marca</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Costo</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Venta</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Disp.</th>
              </tr>
            </thead>
            <tbody>
              {partes.map((p) => (
                <tr key={p.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-gray-700">{p.numero_parte}</td>
                  <td className="px-4 py-3 text-gray-900">{p.descripcion}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{p.categoria ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{p.marca_vehiculo ?? p.marca_parte ?? '—'}</td>
                  <td className="px-4 py-3 text-right text-gray-600 text-xs">
                    {p.precio_costo != null ? `$${p.precio_costo.toLocaleString('es-MX')}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {p.precio_venta != null ? `$${p.precio_venta.toLocaleString('es-MX')}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block w-2 h-2 rounded-full ${p.disponible ? 'bg-green-500' : 'bg-gray-300'}`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
