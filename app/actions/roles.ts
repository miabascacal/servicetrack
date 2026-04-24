'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { ensureUsuario } from '@/lib/ensure-usuario'
import { tieneRol } from '@/lib/permisos'
import type { ModuloPermiso } from '@/types/database'

type PermisoRow = {
  puede_ver: boolean
  puede_crear: boolean
  puede_editar: boolean
  puede_eliminar: boolean
  puede_exportar: boolean
}

type CreateRolInput = {
  nombre: string
  descripcion: string
  permisos: Record<ModuloPermiso, PermisoRow>
}

export async function createRolAction(input: CreateRolInput) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  let ctx: import('@/lib/ensure-usuario').UsuarioCtx
  try { ctx = await ensureUsuario(supabase, user.id, user.email ?? '') }
  catch (e) { return { error: e instanceof Error ? e.message : 'Error al obtener perfil' } }

  if (!tieneRol(ctx.rol, 'admin'))
    return { success: false, error: 'Sin permisos para esta operación' }

  // Create the role
  const { data: rol, error: rolError } = await supabase
    .from('roles')
    .insert({
      grupo_id: ctx.grupo_id,
      nombre: input.nombre.trim(),
      descripcion: input.descripcion.trim() || null,
      es_super_admin: false,
      activo: true,
    })
    .select('id')
    .single()

  if (rolError) {
    if (rolError.code === '23505') return { error: 'Ya existe un rol con ese nombre' }
    return { error: 'Error al crear el rol' }
  }

  // Insert permissions for each module
  const permisosInsert = Object.entries(input.permisos).map(([modulo, p]) => ({
    rol_id: rol.id,
    modulo: modulo as ModuloPermiso,
    puede_ver: p.puede_ver,
    puede_crear: p.puede_crear,
    puede_editar: p.puede_editar,
    puede_eliminar: p.puede_eliminar,
    puede_exportar: p.puede_exportar,
  }))

  const { error: permisosError } = await supabase
    .from('rol_permisos')
    .insert(permisosInsert)

  if (permisosError) return { error: 'Error al guardar los permisos' }

  revalidatePath('/usuarios/roles')
  return { success: true }
}

export async function asignarRolAction(usuarioId: string, rolId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  let ctx: import('@/lib/ensure-usuario').UsuarioCtx
  try { ctx = await ensureUsuario(supabase, user.id, user.email ?? '') }
  catch (e) { return { error: e instanceof Error ? e.message : 'Error al obtener perfil' } }

  if (!tieneRol(ctx.rol, 'admin'))
    return { error: 'Sin permisos para esta operación' }

  // Verificar que el rol pertenece al mismo grupo
  const { data: rol } = await supabase
    .from('roles')
    .select('id')
    .eq('id', rolId)
    .eq('grupo_id', ctx.grupo_id)
    .single()

  if (!rol) return { error: 'Rol no válido para este grupo' }

  // Verificar que el usuario objetivo pertenece a la misma sucursal
  const { data: targetUser } = await supabase
    .from('usuarios')
    .select('id')
    .eq('id', usuarioId)
    .eq('sucursal_id', ctx.sucursal_id)
    .single()

  if (!targetUser) return { error: 'Usuario no encontrado en esta sucursal' }

  const { error } = await supabase
    .from('usuario_roles')
    .insert({ usuario_id: usuarioId, rol_id: rolId, activo: true })

  if (error) {
    if (error.code === '23505') return { error: 'El usuario ya tiene este rol' }
    return { error: `Error al asignar rol: ${error.message}` }
  }

  revalidatePath('/usuarios')
  return { ok: true }
}

export async function removerRolAction(asignacionId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  let ctx: import('@/lib/ensure-usuario').UsuarioCtx
  try { ctx = await ensureUsuario(supabase, user.id, user.email ?? '') }
  catch (e) { return { error: e instanceof Error ? e.message : 'Error al obtener perfil' } }

  if (!tieneRol(ctx.rol, 'admin'))
    return { error: 'Sin permisos para esta operación' }

  const { error } = await supabase
    .from('usuario_roles')
    .delete()
    .eq('id', asignacionId)

  if (error) return { error: `Error al remover rol: ${error.message}` }

  revalidatePath('/usuarios')
  return { ok: true }
}

export async function updateRolPermisosAction(
  rolId: string,
  permisos: Record<ModuloPermiso, PermisoRow>
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  let ctx: import('@/lib/ensure-usuario').UsuarioCtx
  try { ctx = await ensureUsuario(supabase, user.id, user.email ?? '') }
  catch (e) { return { error: e instanceof Error ? e.message : 'Error al obtener perfil' } }

  if (!tieneRol(ctx.rol, 'admin'))
    return { success: false, error: 'Sin permisos para esta operación' }

  // Upsert all permissions for this role
  const permisosUpsert = Object.entries(permisos).map(([modulo, p]) => ({
    rol_id: rolId,
    modulo: modulo as ModuloPermiso,
    puede_ver: p.puede_ver,
    puede_crear: p.puede_crear,
    puede_editar: p.puede_editar,
    puede_eliminar: p.puede_eliminar,
    puede_exportar: p.puede_exportar,
  }))

  const { error } = await supabase
    .from('rol_permisos')
    .upsert(permisosUpsert, { onConflict: 'rol_id,modulo' })

  if (error) return { error: 'Error al actualizar los permisos' }

  revalidatePath('/usuarios/roles')
  return { success: true }
}
