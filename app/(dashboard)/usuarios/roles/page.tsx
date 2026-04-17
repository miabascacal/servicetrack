import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ensureUsuario } from '@/lib/ensure-usuario'
import { tieneRol } from '@/lib/permisos'
import { AlertTriangle, Shield, Plus, ChevronLeft } from 'lucide-react'
import type { ModuloPermiso } from '@/types/database'

const MODULOS: { key: ModuloPermiso; label: string }[] = [
  { key: 'crm', label: 'CRM' },
  { key: 'citas', label: 'Citas' },
  { key: 'taller', label: 'Taller' },
  { key: 'refacciones', label: 'Refacciones' },
  { key: 'ventas', label: 'Ventas' },
  { key: 'bandeja', label: 'Bandeja + IA' },
  { key: 'atencion_clientes', label: 'Atención a Clientes' },
  { key: 'csi', label: 'CSI' },
  { key: 'seguros', label: 'Seguros' },
  { key: 'usuarios', label: 'Usuarios' },
  { key: 'reportes', label: 'Reportes' },
]

type RolRow = {
  id: string
  nombre: string
  descripcion: string | null
  es_super_admin: boolean
  activo: boolean
}

type RolPermisoRow = {
  rol_id: string
  modulo: string
  puede_ver: boolean
  puede_crear: boolean
  puede_editar: boolean
  puede_eliminar: boolean
  puede_exportar: boolean
}

export default async function RolesPage() {
  const supabase = await createClient()
  const admin = createAdminClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        No autorizado.
      </div>
    )
  }

  let ctx: import('@/lib/ensure-usuario').UsuarioCtx
  try {
    ctx = await ensureUsuario(supabase, user.id, user.email ?? '')
  } catch (e) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {e instanceof Error ? e.message : 'Error al obtener perfil del usuario'}
      </div>
    )
  }

  if (!tieneRol(ctx.rol, 'admin')) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Sin permisos para administrar roles.
      </div>
    )
  }

  const [rolesResponse, permisosResponse] = await Promise.all([
    admin
      .from('roles')
      .select('id, nombre, descripcion, es_super_admin, activo')
      .eq('grupo_id', ctx.grupo_id)
      .order('es_super_admin', { ascending: false })
      .order('nombre'),
    admin
      .from('rol_permisos')
      .select('rol_id, modulo, puede_ver, puede_crear, puede_editar, puede_eliminar, puede_exportar'),
  ])

  const rolesError = rolesResponse.error
  const permisosError = permisosResponse.error
  const roles = (rolesResponse.data ?? []) as RolRow[]
  const permisos = (permisosResponse.data ?? []) as RolPermisoRow[]
  const schemaMissing = !!rolesError || !!permisosError

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/usuarios"
            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700 transition-colors"
          >
            <ChevronLeft size={18} />
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Roles y Permisos</h1>
            <p className="text-sm text-gray-500 mt-0.5">Define qué puede hacer cada rol en cada módulo</p>
          </div>
        </div>
        <Link
          href="/usuarios/roles/nuevo"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} />
          Nuevo Rol
        </Link>
      </div>

      {schemaMissing && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <div className="flex items-start gap-3">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="font-medium">El esquema de roles/permisos no está completo en esta base.</p>
              {rolesError && <p className="text-amber-800">Roles: {rolesError.message}</p>}
              {permisosError && <p className="text-amber-800">Permisos: {permisosError.message}</p>}
              <p className="text-amber-800">
                Esta ruta quedará limitada hasta ejecutar el SQL pendiente de `roles`, `rol_permisos` y `usuario_roles`.
              </p>
            </div>
          </div>
        </div>
      )}

      {!roles || roles.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 py-16 text-center">
          <Shield size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">
            {schemaMissing ? 'No hay esquema de roles operativo en esta base' : 'No hay roles configurados'}
          </p>
          {!schemaMissing && (
            <Link
              href="/usuarios/roles/nuevo"
              className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg"
            >
              <Plus size={14} />
              Crear primer rol
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {roles.map((rol) => {
            const permisosRol = permisos.filter((p) => p.rol_id === rol.id)
            const modulosConAcceso = permisosRol.filter((p) => p.puede_ver).length

            return (
              <div key={rol.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        rol.es_super_admin ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'
                      }`}
                    >
                      <Shield size={16} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900 text-sm">{rol.nombre}</h3>
                        {rol.es_super_admin && (
                          <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs rounded font-medium">
                            Super Admin
                          </span>
                        )}
                        {!rol.activo && (
                          <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 text-xs rounded">Inactivo</span>
                        )}
                      </div>
                      {rol.descripcion && <p className="text-xs text-gray-500 mt-0.5">{rol.descripcion}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500">
                      {rol.es_super_admin ? 'Acceso total' : `${modulosConAcceso}/${MODULOS.length} módulos`}
                    </span>
                    <Link
                      href={`/usuarios/roles/${rol.id}`}
                      className="px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      Editar permisos
                    </Link>
                  </div>
                </div>

                {!rol.es_super_admin && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="text-left px-5 py-2 text-gray-500 font-medium w-40">Módulo</th>
                          {['Ver', 'Crear', 'Editar', 'Eliminar', 'Exportar'].map((h) => (
                            <th key={h} className="text-center px-3 py-2 text-gray-500 font-medium">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {MODULOS.map(({ key, label }) => {
                          const p = permisosRol.find((x) => x.modulo === key)
                          return (
                            <tr key={key} className="hover:bg-gray-50/50">
                              <td className="px-5 py-2 font-medium text-gray-700">{label}</td>
                              {[p?.puede_ver, p?.puede_crear, p?.puede_editar, p?.puede_eliminar, p?.puede_exportar].map(
                                (val, i) => (
                                  <td key={i} className="text-center px-3 py-2">
                                    {val ? (
                                      <span className="inline-block w-4 h-4 rounded-full bg-green-400" />
                                    ) : (
                                      <span className="inline-block w-4 h-4 rounded-full bg-gray-200" />
                                    )}
                                  </td>
                                )
                              )}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {rol.es_super_admin && (
                  <div className="px-5 py-3 bg-purple-50 text-xs text-purple-700">
                    Este rol tiene acceso completo a todos los módulos y acciones
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
