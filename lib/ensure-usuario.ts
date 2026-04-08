import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'

export interface UsuarioCtx {
  grupo_id: string
  sucursal_id: string
}

/**
 * Devuelve grupo_id y sucursal_id del usuario autenticado.
 *
 * Si el usuario no tiene fila en `usuarios` (primer uso),
 * usa el cliente admin (service_role) para crear toda la jerarquía:
 * grupo → razón social → sucursal → usuario.
 *
 * Lanza un error descriptivo si algo falla, para que el action lo muestre en la UI.
 */
export async function ensureUsuario(
  _supabase: SupabaseClient,
  userId: string,
  email: string,
): Promise<UsuarioCtx> {
  // Siempre usamos admin para leer — RLS bloquea el SELECT en usuarios
  const admin = createAdminClient()

  // 1. Buscar usuario existente con su sucursal
  const { data: usr, error: eRead } = await admin
    .from('usuarios')
    .select('sucursal_id')
    .eq('id', userId)
    .single()

  if (eRead && eRead.code !== 'PGRST116') {
    // PGRST116 = "no rows returned" — es normal si es primera vez
    throw new Error(`Error leyendo perfil: ${eRead.message}`)
  }

  if (usr?.sucursal_id) {
    const { data: suc } = await admin
      .from('sucursales')
      .select('razon_social_id')
      .eq('id', usr.sucursal_id)
      .single()

    if (suc?.razon_social_id) {
      const { data: rs } = await admin
        .from('razones_sociales')
        .select('grupo_id')
        .eq('id', suc.razon_social_id)
        .single()

      if (rs?.grupo_id) return { grupo_id: rs.grupo_id, sucursal_id: usr.sucursal_id }
    }
  }

  // 2. Bootstrap — usuario nuevo sin jerarquía
  const nombreDefault = email.split('@')[0] ?? 'Admin'

  const { data: grupo, error: eGrupo } = await admin
    .from('grupos')
    .insert({ nombre: 'Mi Concesionario' })
    .select('id')
    .single()

  if (eGrupo || !grupo) throw new Error(`Bootstrap grupos: ${eGrupo?.message ?? 'sin datos'}`)

  const { data: rs, error: eRS } = await admin
    .from('razones_sociales')
    .insert({ grupo_id: grupo.id, nombre: 'Principal', razon_social: 'Mi Empresa S.A. de C.V.' })
    .select('id')
    .single()

  if (eRS || !rs) throw new Error(`Bootstrap razones_sociales: ${eRS?.message ?? 'sin datos'}`)

  const { data: suc, error: eSuc } = await admin
    .from('sucursales')
    .insert({ razon_social_id: rs.id, nombre: 'Sucursal Principal', codigo: 'SUC1' })
    .select('id')
    .single()

  if (eSuc || !suc) throw new Error(`Bootstrap sucursales: ${eSuc?.message ?? 'sin datos'}`)

  const { error: eUsr } = await admin
    .from('usuarios')
    .upsert({
      id: userId,
      sucursal_id: suc.id,
      nombre: nombreDefault,
      email,
      rol: 'admin',
      activo: true,
    })

  if (eUsr) throw new Error(`Bootstrap usuarios: ${eUsr.message}`)

  return { grupo_id: grupo.id, sucursal_id: suc.id }
}
