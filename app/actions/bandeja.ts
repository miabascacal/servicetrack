'use server'

import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ensureUsuario }     from '@/lib/ensure-usuario'

export interface MensajeRow {
  id:             string
  contenido:      string | null
  enviado_at:     string
  message_source: string | null
  direccion:      string
  enviado_por_bot: boolean
  estado_entrega: string | null
}

/**
 * Devuelve los mensajes de un hilo en orden cronológico.
 *
 * Validación explícita de pertenencia antes de devolver datos:
 * no se confía en el silencio de RLS — un thread_id fabricado
 * no debe filtrar información de otra sucursal.
 */
export async function getThreadMessagesAction(
  thread_id: string,
): Promise<{ data: MensajeRow[] | null; error: string | null }> {
  if (!thread_id) return { data: null, error: 'thread_id requerido' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'No autorizado' }

  // Obtener sucursal del usuario (ensureUsuario usa adminClient internamente
  // porque RLS bloquea el SELECT directo en la tabla usuarios)
  let sucursal_id: string
  try {
    const ctx = await ensureUsuario(supabase, user.id, user.email ?? '')
    sucursal_id = ctx.sucursal_id
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Error de perfil' }
  }

  const admin = createAdminClient()

  // Verificar que el hilo pertenece a la sucursal del usuario.
  // adminClient garantiza que encontramos el hilo aunque RLS devuelva
  // vacío por alguna razón — el control de acceso lo hacemos nosotros.
  const { data: thread, error: threadError } = await admin
    .from('conversation_threads')
    .select('id, sucursal_id')
    .eq('id', thread_id)
    .single()

  if (threadError || !thread) {
    return { data: null, error: 'Hilo no encontrado' }
  }

  if (thread.sucursal_id !== sucursal_id) {
    console.error(
      `[bandeja] acceso denegado al hilo ${thread_id}: ` +
      `usuario ${user.id} (sucursal ${sucursal_id}) ` +
      `vs hilo sucursal ${thread.sucursal_id}`,
    )
    return { data: null, error: 'No autorizado' }
  }

  const { data: mensajes, error: mensajesError } = await admin
    .from('mensajes')
    .select('id, contenido, enviado_at, message_source, direccion, enviado_por_bot, estado_entrega')
    .eq('thread_id', thread_id)
    .order('enviado_at', { ascending: true })
    .limit(100)

  if (mensajesError) {
    return { data: null, error: `Error cargando mensajes: ${mensajesError.message}` }
  }

  return { data: mensajes ?? [], error: null }
}
