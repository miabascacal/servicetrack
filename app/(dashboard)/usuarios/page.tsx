import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { UserCog, Shield } from 'lucide-react'
import { InvitarUsuario } from './InvitarUsuario'

export default async function UsuariosPage() {
  const supabase = await createClient()

  const [{ data: usuarios }, { data: roles }] = await Promise.all([
    supabase
      .from('usuarios')
      .select(`
        id, nombre, apellido, email, whatsapp, activo, sucursal_id,
        usuario_roles (
          id, activo,
          rol:roles ( id, nombre, es_super_admin )
        )
      `)
      .order('nombre'),
    supabase
      .from('roles')
      .select('id, nombre, es_super_admin, activo')
      .eq('activo', true)
      .order('nombre'),
  ])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Usuarios y Permisos</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Administra usuarios, roles y permisos por módulo
          </p>
        </div>
        <Link
          href="/usuarios/roles"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Shield size={16} />
          Gestionar Roles
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-2xl font-bold text-gray-900">{usuarios?.length ?? 0}</p>
          <p className="text-xs text-gray-500 mt-1">Usuarios totales</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-2xl font-bold text-gray-900">
            {usuarios?.filter((u) => u.activo).length ?? 0}
          </p>
          <p className="text-xs text-gray-500 mt-1">Usuarios activos</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-2xl font-bold text-gray-900">{roles?.length ?? 0}</p>
          <p className="text-xs text-gray-500 mt-1">Roles configurados</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-2xl font-bold text-gray-900">
            {roles?.filter((r) => r.es_super_admin).length ?? 0}
          </p>
          <p className="text-xs text-gray-500 mt-1">Super admins</p>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">Usuarios</h2>
          <InvitarUsuario />
        </div>

        {!usuarios || usuarios.length === 0 ? (
          <div className="py-16 text-center">
            <UserCog size={32} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm text-gray-500">No hay usuarios registrados</p>
            <p className="text-xs text-gray-400 mt-1">
              Los usuarios se crean desde Supabase Auth
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Usuario
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Rol
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden sm:table-cell">
                  WhatsApp
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Estado
                </th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {usuarios.map((u) => {
                type UsuarioRolRow = {
                  id: string
                  activo: boolean
                  rol: { id: string; nombre: string; es_super_admin: boolean } | null
                }
                const rolesActivos = ((u.usuario_roles as unknown) as UsuarioRolRow[]).filter(
                  (ur) => ur.activo
                )
                return (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold shrink-0">
                          {u.nombre.slice(0, 1).toUpperCase()}
                          {u.apellido.slice(0, 1).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {u.nombre} {u.apellido}
                          </p>
                          <p className="text-xs text-gray-500">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1">
                        {rolesActivos.length === 0 ? (
                          <span className="text-xs text-gray-400">Sin rol</span>
                        ) : (
                          rolesActivos.map((ur) => (
                            <span
                              key={ur.id}
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                ur.rol?.es_super_admin
                                  ? 'bg-purple-100 text-purple-700'
                                  : 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {ur.rol?.nombre ?? 'Rol eliminado'}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 hidden sm:table-cell">
                      <span className="text-gray-600 text-xs">{u.whatsapp ?? '—'}</span>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          u.activo
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {u.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button className="text-xs text-blue-600 hover:underline">
                        Editar
                      </button>
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
