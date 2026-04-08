'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { ensureUsuario } from '@/lib/ensure-usuario'

export async function createEmpresaAction(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  let usuario: import('@/lib/ensure-usuario').UsuarioCtx
  try { usuario = await ensureUsuario(supabase, user.id, user.email ?? '') }
  catch (e) { return { error: e instanceof Error ? e.message : 'Error al obtener perfil' } }

  const nombre = (formData.get('nombre') as string)?.trim()
  if (!nombre) return { error: 'El nombre de la empresa es requerido' }

  const { data, error } = await supabase
    .from('empresas')
    .insert({
      grupo_id: usuario.grupo_id,
      nombre,
      rfc: (formData.get('rfc') as string)?.trim().toUpperCase() || null,
      telefono: (formData.get('telefono') as string)?.trim() || null,
      email: (formData.get('email') as string)?.trim() || null,
      activo: true,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') return { error: 'Ya existe una empresa con ese nombre o RFC' }
    return { error: 'Error al crear la empresa' }
  }

  revalidatePath('/crm/empresas')
  return { id: data.id }
}
