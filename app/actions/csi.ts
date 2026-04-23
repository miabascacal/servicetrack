'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createEncuestaAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { ensureUsuario } = await import('@/lib/ensure-usuario')
  let ctx: { grupo_id: string } | null = null
  try { ctx = await ensureUsuario(supabase, user.id, user.email ?? '') } catch { /* sin perfil */ }
  if (!ctx?.grupo_id) return { error: 'Sin grupo asignado' }

  const nombre = (formData.get('nombre') as string)?.trim().toUpperCase()
  const modulo_origen = formData.get('modulo_origen') as string
  const dias_espera = parseInt(formData.get('dias_espera') as string) || 2
  const score_alerta = parseInt(formData.get('score_alerta') as string) || 3

  if (!nombre || !modulo_origen) return { error: 'Nombre y módulo son requeridos' }
  if (!['taller', 'ventas', 'citas'].includes(modulo_origen)) return { error: 'Módulo inválido' }

  const { error } = await supabase.from('csi_encuestas').insert({
    grupo_id: ctx.grupo_id,
    nombre,
    modulo_origen,
    dias_espera,
    score_alerta,
    activa: true,
  })

  if (error) return { error: error.message }
  revalidatePath('/csi')
  return { ok: true }
}
