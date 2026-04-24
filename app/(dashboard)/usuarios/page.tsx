import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ensureUsuario } from '@/lib/ensure-usuario'
import { tieneRol } from '@/lib/permisos'
import { AlertTriangle, Clock, MailCheck, Shield, UserCog } from 'lucide-react'
import { InvitarUsuario } from './InvitarUsuario'
import { UsuarioAcciones } from './UsuarioAcciones'
import { AsignarRol } from './AsignarRol'
import { cn } from '@/lib/utils'

type AuthStatus = 'active' | 'pending' | 'inactive' | 'missing'

type UsuarioRow = {
  id: string
  nombre: string
  apellido: string | null
  email: string
  whatsapp: string | null
  activo: boolean
  sucursal_id: string | null
}

type UsuarioRolRow = {
  id: string
  activo: boolean
  usuario_id: string
  rol_id: string
  // sucursal_id no existe en usuario_roles — ver migración 009
}

type RolRow = {
  id: string
  nombre: string
  es_super_admin: boolean
  activo: boolean
}

export default async function UsuariosPage() {
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
        Sin permisos para administrar usuarios.
      </div>
    )
  }

  const [usuariosResponse, usuarioRolesResponse, rolesResponse, authResponse] = await Promise.all([
    admin
      .from('usuarios')
      .select('id, nombre, apellido, email, whatsapp, activo, sucursal_id')
      .eq('sucursal_id', ctx.sucursal_id)
      .order('nombre'),
    admin
      .from('usuario_roles')
      .select('id, activo, usuario_id, rol_id'),
    admin
      .from('roles')
      .select('id, nombre, es_super_admin, activo')
      .eq('grupo_id', ctx.grupo_id)
      .eq('activo', true)
      .order('nombre'),
    admin.auth.admin.listUsers({ perPage: 1000 }),
  ])

  const usuariosError = usuariosResponse.error
  const usuarioRolesError = usuarioRolesResponse.error
  const rolesError = rolesResponse.error
  const authError = authResponse.error

  const usuarios = (usuariosResponse.data ?? []) as UsuarioRow[]
  const usuarioRoles = (usuarioRolesResponse.data ?? []) as UsuarioRolRow[]
  const roles = (rolesResponse.data ?? []) as RolRow[]
  const authUsers = authResponse.data?.users ?? []

  const rolesById = new Map(roles.map((rol) => [rol.id, rol]))
  const authById = new Map(authUsers.map((u) => [u.id, u]))
  const authByEmail = new Map(
    authUsers
      .filter((u) => !!u.email)
      .map((u) => [(u.email ?? '').trim().toLowerCase(), u])
  )

  const usuariosConEstado = usuarios.map((u) => {
    const normalizedEmail = (u.email ?? '').trim().toLowerCase()
    const authUser = authById.get(u.id) ?? authByEmail.get(normalizedEmail) ?? null

    let authStatus: AuthStatus = 'missing'
    if (authUser?.email_confirmed_at) authStatus = 'active'
    else if (authUser) authStatus = 'pending'
    else if (!u.activo) authStatus = 'inactive'

    const rolesActivos = usuarioRoles
      .filter((ur) => ur.usuario_id === u.id && ur.activo)
      .map((ur) => ({ ...ur, rol: rolesById.get(ur.rol_id) ?? null }))

    return { ...u, authStatus, authUser, rolesActivos }
  })

  const totalActivos = usuariosConEstado.filter((u) => u.activo && u.authStatus === 'active').length
  const totalPendientes = usuariosConEstado.filter((u) => u.authStatus === 'pending').length
  const rolesSchemaMissing = !!rolesError || !!usuarioRolesError

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Usuarios y Permisos</h1>
          <p className="text-sm text-gray-500 mt-0.5">Administra usuarios, roles y permisos por módulo</p>
        </div>
        <Link
          href="/usuarios/roles"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Shield size={16} />
          Gestionar Roles
        </Link>
      </div>

      {(usuariosError || usuarioRolesError || rolesError || authError) && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="font-medium">La pantalla cargó con advertencias.</p>
            {usuariosError && <p className="text-amber-800">Usuarios: {usuariosError.message}</p>}
            {usuarioRolesError && <p className="text-amber-800">Usuario roles: {usuarioRolesError.message}</p>}
            {rolesError && <p className="text-amber-800">Roles: {rolesError.message}</p>}
            {authError && <p className="text-amber-800">Supabase Auth: {authError.message}</p>}
          </div>
        </div>
      )}

      {rolesSchemaMissing && (
        <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          La lista de usuarios ya puede cargarse sin depender de relaciones embebidas, pero el módulo de roles sigue
          incompleto en esta base. Mientras no existan `roles` y `usuario_roles`, la columna de rol mostrará `Sin rol`.
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-2xl font-bold text-gray-900">{usuariosConEstado.length}</p>
          <p className="text-xs text-gray-500 mt-1">Usuarios totales</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-2xl font-bold text-green-600">{totalActivos}</p>
          <p className="text-xs text-gray-500 mt-1">Activos</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-2xl font-bold text-yellow-500">{totalPendientes}</p>
          <p className="text-xs text-gray-500 mt-1">Invitación pendiente</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-2xl font-bold text-gray-900">{roles.length}</p>
          <p className="text-xs text-gray-500 mt-1">Roles configurados</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">Usuarios</h2>
          <InvitarUsuario />
        </div>

        {usuariosConEstado.length === 0 ? (
          <div className="py-16 text-center">
            <UserCog size={32} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm text-gray-500">No hay usuarios registrados para esta sucursal</p>
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
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Estado
                </th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {usuariosConEstado.map((u) => {
                const apellidoInicial = (u.apellido ?? '').slice(0, 1).toUpperCase()
                const invitePending = u.authStatus === 'pending'

                return (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                            invitePending ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'
                          )}
                        >
                          {u.nombre.slice(0, 1).toUpperCase()}
                          {apellidoInicial}
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
                      <AsignarRol
                        usuarioId={u.id}
                        rolesDisponibles={roles.map(r => ({
                          id: r.id,
                          nombre: r.nombre,
                          es_super_admin: r.es_super_admin,
                        }))}
                        rolesAsignados={u.rolesActivos.map(ra => ({
                          asignacionId: ra.id,
                          rolId: ra.rol_id,
                          nombre: ra.rol?.nombre ?? 'Rol eliminado',
                          es_super_admin: ra.rol?.es_super_admin ?? false,
                        }))}
                      />
                    </td>
                    <td className="px-5 py-3">
                      {u.authStatus === 'pending' ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                          <Clock size={11} />
                          Invitación pendiente
                        </span>
                      ) : u.authStatus === 'active' && u.activo ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          <MailCheck size={11} />
                          Activo
                        </span>
                      ) : u.authStatus === 'missing' ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                          <AlertTriangle size={11} />
                          Sin registro Auth
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                          Inactivo
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <UsuarioAcciones usuarioId={u.id} authStatus={u.authStatus} authStatusKnown={!authError} activo={u.activo} />
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
