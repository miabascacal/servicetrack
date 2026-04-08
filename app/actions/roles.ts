'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
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

  // Get grupo_id from the authenticated user
  const { data: usuario } = await supabase
    .from('usuarios')
    .select('grupo_id')
    .eq('id', user.id)
    .single()

  if (!usuario) return { error: 'Usuario no encontrado' }

  // Create the role
  const { data: rol, error: rolError } = await supabase
    .from('roles')
    .insert({
      grupo_id: usuario.grupo_id,
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

export async function updateRolPermisosAction(
  rolId: string,
  permisos: Record<ModuloPermiso, PermisoRow>
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

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
