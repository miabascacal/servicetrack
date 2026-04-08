import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Building2, Plus, Search, Users } from 'lucide-react'

interface PageProps {
  searchParams: Promise<{ q?: string }>
}

export default async function EmpresasPage({ searchParams }: PageProps) {
  const { q = '' } = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('empresas')
    .select(`
      id, nombre, rfc, telefono, email, activo,
      clientes ( id )
    `)
    .order('nombre')
    .limit(100)

  if (q) {
    query = query.or(`nombre.ilike.%${q}%,rfc.ilike.%${q}%`)
  }

  const { data: empresas } = await query

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Empresas</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {empresas?.length ?? 0} empresas registradas
          </p>
        </div>
        <Link
          href="/crm/empresas/nuevo"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} />
          Nueva Empresa
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
            placeholder="Buscar por nombre o RFC..."
            className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </form>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {!empresas || empresas.length === 0 ? (
          <div className="py-16 text-center">
            <Building2 size={32} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm text-gray-500">
              {q ? `Sin resultados para "${q}"` : 'No hay empresas registradas'}
            </p>
            {!q && (
              <Link
                href="/crm/empresas/nuevo"
                className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg"
              >
                <Plus size={14} />
                Crear primera empresa
              </Link>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Empresa</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase hidden md:table-cell">RFC</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">Contacto</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Clientes</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {empresas.map((e) => {
                const numClientes = Array.isArray(e.clientes) ? e.clientes.length : 0
                return (
                  <tr key={e.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                          <Building2 size={15} className="text-blue-500" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{e.nombre}</p>
                          {e.email && <p className="text-xs text-gray-500">{e.email}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 hidden md:table-cell">
                      <span className="text-gray-600 font-mono text-xs">{e.rfc ?? '—'}</span>
                    </td>
                    <td className="px-5 py-3 hidden sm:table-cell">
                      <span className="text-gray-600 text-sm font-mono">{e.telefono ?? '—'}</span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5 text-gray-600">
                        <Users size={13} className="text-gray-400" />
                        <span className="text-sm">{numClientes}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link
                        href={`/crm/empresas/${e.id}`}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Ver
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
