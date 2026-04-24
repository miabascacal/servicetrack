'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { ensureUsuario } from '@/lib/ensure-usuario'
import { tieneRol } from '@/lib/permisos'
import { revalidatePath } from 'next/cache'

function getSiteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  )
}

async function getAdminCtx() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' as const }

  let ctx: import('@/lib/ensure-usuario').UsuarioCtx
  try {
    ctx = await ensureUsuario(supabase, user.id, user.email ?? '')
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error al obtener perfil' }
  }

  if (!tieneRol(ctx.rol, 'admin')) {
    return { error: 'Sin permisos para esta operación' as const }
  }

  return { ctx }
}

type AuthLookupResult =
  | {
      ok: true
      authUser: {
        id: string
        email?: string
        email_confirmed_at: string | null
      }
      matchesUsuarioId: boolean
    }
  | { ok: false; error: string }

async function getAuthUserForUsuario(
  admin: ReturnType<typeof createAdminClient>,
  usuarioId: string,
  email: string
): Promise<AuthLookupResult> {
  const { data: authList, error } = await admin.auth.admin.listUsers({ perPage: 1000 })

  if (error) {
    return { ok: false, error: `No se pudo consultar Supabase Auth: ${error.message}` }
  }

  const normalizedEmail = email.trim().toLowerCase()
  const authUserById = (authList.users ?? []).find((u) => u.id === usuarioId)
  const authUserByEmail = (authList.users ?? []).find(
    (u) => (u.email ?? '').trim().toLowerCase() === normalizedEmail
  )
  const authUser = authUserById ?? authUserByEmail

  if (!authUser) {
    return {
      ok: false,
      error:
        'El usuario existe en la tabla interna pero no aparece en Supabase Auth. Revisa la sincronización antes de reenviar.',
    }
  }

  return {
    ok: true,
    authUser: {
      id: authUser.id,
      email: authUser.email,
      email_confirmed_at: authUser.email_confirmed_at ?? null,
    },
    matchesUsuarioId: authUser.id === usuarioId,
  }
}

export async function invitarUsuarioAction(formData: FormData) {
  const auth = await getAdminCtx()
  if ('error' in auth) return { error: auth.error }

  const email = (formData.get('email') as string)?.trim().toLowerCase()
  const nombre = (formData.get('nombre') as string)?.trim()
  const apellido = (formData.get('apellido') as string)?.trim() || null
  const rol = (formData.get('rol') as string) || 'asesor_servicio'

  if (!email || !nombre) return { error: 'Email y nombre son requeridos' }

  const admin = createAdminClient()
  const redirectTo = `${getSiteUrl()}/auth/callback?next=/set-password`

  const { data: invited, error: eInvite } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { nombre, apellido },
    redirectTo,
  })

  if (eInvite) {
    if (eInvite.message?.includes('already')) return { error: 'Ese email ya tiene una cuenta' }
    return { error: `Error al invitar: ${eInvite.message}` }
  }

  if (!invited?.user?.id) return { error: 'No se pudo crear el usuario' }

  const { error: eUsr } = await admin.from('usuarios').upsert({
    id: invited.user.id,
    sucursal_id: auth.ctx.sucursal_id,
    nombre,
    apellido,
    email,
    rol,
    activo: true,
  })

  if (eUsr) return { error: `Usuario invitado pero hubo un error en el perfil: ${eUsr.message}` }

  revalidatePath('/usuarios')
  return { success: true, email }
}

export async function reenviarInvitacionAction(formData: FormData) {
  const auth = await getAdminCtx()
  if ('error' in auth) return { error: auth.error }

  const usuarioId = formData.get('usuario_id') as string
  if (!usuarioId) return { error: 'ID de usuario requerido' }

  const admin = createAdminClient()

  const { data: usr, error: eUsr } = await admin
    .from('usuarios')
    .select('email, nombre, apellido')
    .eq('id', usuarioId)
    .single()

  if (eUsr || !usr?.email) return { error: 'No se encontró el usuario' }

  const authLookup = await getAuthUserForUsuario(admin, usuarioId, usr.email)
  if (!authLookup.ok) return { error: authLookup.error }

  if (!authLookup.matchesUsuarioId) {
    return {
      error:
        'El email existe en Supabase Auth pero con otro ID. No se reenvió la invitación para evitar desalinear usuarios.',
    }
  }

  if (authLookup.authUser.email_confirmed_at) {
    return { error: 'Este usuario ya activó su cuenta. Usa "Reset contraseña" en su lugar.' }
  }

  if (!authLookup.authUser.email) {
    return { error: 'El usuario pendiente no tiene email en Supabase Auth.' }
  }

  const redirectTo = `${getSiteUrl()}/auth/callback?next=/set-password`
  const { error: eInvite } = await admin.auth.admin.inviteUserByEmail(authLookup.authUser.email, {
    data: { nombre: usr.nombre, apellido: usr.apellido },
    redirectTo,
  })

  if (eInvite) {
    if (eInvite.message?.includes('already registered') || eInvite.message?.includes('already')) {
      return { error: 'Este usuario ya activó su cuenta. Usa "Reset contraseña" en su lugar.' }
    }
    return { error: `No se pudo reenviar: ${eInvite.message}` }
  }

  revalidatePath('/usuarios')
  return { success: true, email: authLookup.authUser.email }
}

export async function desactivarUsuarioAction(usuarioId: string) {
  const auth = await getAdminCtx()
  if ('error' in auth) return { error: auth.error }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user?.id === usuarioId) return { error: 'No puedes desactivarte a ti mismo' }

  const admin = createAdminClient()

  const { error } = await admin
    .from('usuarios')
    .update({ activo: false })
    .eq('id', usuarioId)
    .eq('sucursal_id', auth.ctx.sucursal_id)

  if (error) return { error: `Error al desactivar: ${error.message}` }

  revalidatePath('/usuarios')
  return { ok: true }
}

export async function reactivarUsuarioAction(usuarioId: string) {
  const auth = await getAdminCtx()
  if ('error' in auth) return { error: auth.error }

  const admin = createAdminClient()

  const { error } = await admin
    .from('usuarios')
    .update({ activo: true })
    .eq('id', usuarioId)
    .eq('sucursal_id', auth.ctx.sucursal_id)

  if (error) return { error: `Error al reactivar: ${error.message}` }

  revalidatePath('/usuarios')
  return { ok: true }
}

export async function borrarUsuarioAction(usuarioId: string) {
  const auth = await getAdminCtx()
  if ('error' in auth) return { error: auth.error }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user?.id === usuarioId) return { error: 'No puedes eliminar tu propia cuenta' }

  const admin = createAdminClient()

  const { data: usr } = await admin
    .from('usuarios')
    .select('id')
    .eq('id', usuarioId)
    .eq('sucursal_id', auth.ctx.sucursal_id)
    .maybeSingle()

  if (!usr) return { error: 'Usuario no encontrado en esta sucursal' }

  // Check for history across key tables — if any, block deletion
  const [r1, r2, r3, r4] = await Promise.all([
    admin.from('citas').select('id', { count: 'exact', head: true }).eq('asesor_id', usuarioId),
    admin.from('ordenes_trabajo').select('id', { count: 'exact', head: true }).eq('asesor_id', usuarioId),
    admin.from('actividades').select('id', { count: 'exact', head: true }).eq('usuario_asignado_id', usuarioId),
    admin.from('mensajes').select('id', { count: 'exact', head: true }).eq('usuario_asesor_id', usuarioId),
  ])

  const historial = (r1.count ?? 0) + (r2.count ?? 0) + (r3.count ?? 0) + (r4.count ?? 0)
  if (historial > 0) {
    return { error: 'Este usuario tiene historial en el sistema. Solo puede desactivarse.' }
  }

  const { error: eAuth } = await admin.auth.admin.deleteUser(usuarioId)
  if (eAuth && !eAuth.message?.includes('not found')) {
    return { error: `Error al eliminar cuenta: ${eAuth.message}` }
  }

  const { error: eUsr } = await admin
    .from('usuarios')
    .delete()
    .eq('id', usuarioId)
    .eq('sucursal_id', auth.ctx.sucursal_id)

  if (eUsr) return { error: `Error al eliminar usuario: ${eUsr.message}` }

  revalidatePath('/usuarios')
  return { ok: true }
}

export async function resetPasswordAdminAction(formData: FormData) {
  const auth = await getAdminCtx()
  if ('error' in auth) return { error: auth.error }

  const usuarioId = formData.get('usuario_id') as string
  if (!usuarioId) return { error: 'ID de usuario requerido' }

  const admin = createAdminClient()

  const { data: usr, error: eUsr } = await admin
    .from('usuarios')
    .select('email')
    .eq('id', usuarioId)
    .single()

  if (eUsr || !usr?.email) return { error: 'No se encontró el usuario' }

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(usr.email, {
    redirectTo: `${getSiteUrl()}/auth/callback?next=/set-password`,
  })

  if (error) return { error: `No se pudo enviar el email: ${error.message}` }

  revalidatePath('/usuarios')
  return { success: true }
}
