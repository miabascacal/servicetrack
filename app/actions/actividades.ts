'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ensureUsuario } from '@/lib/ensure-usuario'

export async function createActividadAction(formData: FormData) {
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  let ctx: import('@/lib/ensure-usuario').UsuarioCtx
  try { ctx = await ensureUsuario(supabase, user.id, user.email ?? '') }
  catch (e) { return { error: e instanceof Error ? e.message : 'Error al obtener perfil' } }

  const tipo = formData.get('tipo') as string
  const descripcion = (formData.get('descripcion') as string)?.trim()
  const fecha_vencimiento = formData.get('fecha_vencimiento') as string | null
  const hora_vencimiento = formData.get('hora_vencimiento') as string | null
  const prioridad = (formData.get('prioridad') as string) || 'normal'
  const cliente_id = (formData.get('cliente_id') as string) || null
  const vehiculo_id = (formData.get('vehiculo_id') as string) || null
  const notas = (formData.get('notas') as string)?.trim() || null

  if (!tipo || !descripcion) {
    return { error: 'Tipo y descripción son requeridos' }
  }

  // Build fecha_programada combining date + time if provided
  let fecha_programada: string | null = null
  if (fecha_vencimiento) {
    fecha_programada = hora_vencimiento
      ? `${fecha_vencimiento}T${hora_vencimiento}:00`
      : `${fecha_vencimiento}T09:00:00`
  }

  const { data, error } = await admin
    .from('actividades')
    .insert({
      sucursal_id: ctx.sucursal_id,
      usuario_asignado_id: user.id,
      creado_por_id: user.id,
      tipo,
      descripcion,
      estado: 'pendiente',
      prioridad,
      fecha_programada,
      fecha_vencimiento: fecha_programada,
      cliente_id,
      vehiculo_id,
      notas,
      modulo_origen: 'crm',
    })
    .select('id')
    .single()

  if (error) return { error: `Error al crear la actividad: ${error.message}` }

  revalidatePath('/crm/agenda')
  return { id: data.id }
}

export async function completarActividadAction(id: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  const { error } = await supabase
    .from('actividades')
    .update({ estado: 'realizada', realizada_at: new Date().toISOString(), completada: true })
    .eq('id', id)
    .eq('usuario_asignado_id', user.id)

  if (error) return { error: 'Error al completar la actividad' }

  revalidatePath('/crm/agenda')
  return { success: true }
}
