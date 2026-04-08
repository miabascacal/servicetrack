'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { ensureUsuario } from '@/lib/ensure-usuario'
import { revalidatePath } from 'next/cache'

export async function invitarUsuarioAction(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  let ctx: import('@/lib/ensure-usuario').UsuarioCtx
  try { ctx = await ensureUsuario(supabase, user.id, user.email ?? '') }
  catch (e) { return { error: e instanceof Error ? e.message : 'Error al obtener perfil' } }

  const email = (formData.get('email') as string)?.trim().toLowerCase()
  const nombre = (formData.get('nombre') as string)?.trim()
  const apellido = (formData.get('apellido') as string)?.trim() || null
  const rol = (formData.get('rol') as string) || 'asesor_servicio'

  if (!email || !nombre) return { error: 'Email y nombre son requeridos' }

  const admin = createAdminClient()

  // Invite via Supabase Auth — sends email with magic link
  const { data: invited, error: eInvite } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { nombre, apellido },
  })

  if (eInvite) {
    if (eInvite.message?.includes('already')) return { error: 'Ese email ya tiene una cuenta' }
    return { error: `Error al invitar: ${eInvite.message}` }
  }

  if (!invited?.user?.id) return { error: 'No se pudo crear el usuario' }

  // Create the usuarios row immediately so they can operate
  const { error: eUsr } = await admin
    .from('usuarios')
    .upsert({
      id: invited.user.id,
      sucursal_id: ctx.sucursal_id,
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
