import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import {
  ChevronLeft, Building2, User, Phone, Mail, Hash, Pencil, Plus,
} from 'lucide-react'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EmpresaDetailPage({ params }: PageProps) {
  const { id } = await params
  // createClient() aplica RLS — solo devuelve empresas de la sucursal del usuario autenticado
  const admin = await createClient()

  const { data: empresa, error } = await admin
    .from('empresas')
    .select(`
      id, nombre, rfc, telefono, email, activo, creado_at,
      clientes ( id, nombre, apellido, whatsapp, email, activo )
    `)
    .eq('id', id)
    .single()

  if (error || !empresa) return notFound()

  type ClienteRow = {
    id: string; nombre: string; apellido: string
    whatsapp: string | null; email: string | null; activo: boolean
  }
  const clientes = (empresa.clientes as unknown as ClienteRow[]) ?? []

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Nav */}
      <div className="flex items-center justify-between">
        <Link href="/crm/empresas" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <ChevronLeft size={16} /> Empresas
        </Link>
        <Link
          href={`/crm/empresas/${id}/editar`}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <Pencil size={14} /> Editar
        </Link>
      </div>

      {/* Hero */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-700 text-xl font-bold shrink-0">
            {empresa.nombre[0]}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-gray-900">{empresa.nombre}</h1>
            {empresa.rfc && (
              <div className="flex items-center gap-1.5 text-sm text-gray-500 mt-1">
                <Hash size={13} />
                <span className="font-mono">{empresa.rfc}</span>
              </div>
            )}
            <span className={`inline-block mt-2 text-xs font-medium px-2 py-0.5 rounded-full ${empresa.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {empresa.activo ? 'Activa' : 'Inactiva'}
            </span>
          </div>
        </div>
      </div>

      {/* Datos de contacto */}
      {(empresa.telefono || empresa.email) && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Contacto</h2>
          <div className="space-y-2">
            {empresa.telefono && (
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <Phone size={14} className="text-gray-400 shrink-0" />
                <span className="font-mono">{empresa.telefono}</span>
              </div>
            )}
            {empresa.email && (
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <Mail size={14} className="text-gray-400 shrink-0" />
                <span>{empresa.email}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Clientes vinculados */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">
            Contactos <span className="text-gray-400 font-normal">({clientes.length})</span>
          </h2>
          <Link href={`/crm/clientes/nuevo?empresa_id=${id}`}
            className="flex items-center gap-1 text-xs text-blue-600 hover:bg-blue-50 px-2 py-1 rounded transition-colors">
            <Plus size={13} /> Agregar
          </Link>
        </div>

        {clientes.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <User size={22} className="mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-400">Sin contactos vinculados</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {clientes.map((c) => (
              <li key={c.id}>
                <Link href={`/crm/clientes/${c.id}`}
                  className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors group">
                  <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold shrink-0">
                    {c.nombre[0]}{c.apellido[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                      {c.nombre} {c.apellido}
                    </p>
                    <p className="text-xs text-gray-400 font-mono">{c.whatsapp ?? c.email ?? '—'}</p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${c.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {c.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
