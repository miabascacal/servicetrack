'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { EstadoCita } from '@/types/database'
import { ensureUsuario } from '@/lib/ensure-usuario'

export async function createCitaAction(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  let usuario: import('@/lib/ensure-usuario').UsuarioCtx
  try { usuario = await ensureUsuario(supabase, user.id, user.email ?? '') }
  catch (e) { return { error: e instanceof Error ? e.message : 'Error al obtener perfil' } }

  const cliente_id = formData.get('cliente_id') as string
  const fecha_cita = formData.get('fecha_cita') as string
  const hora_cita = formData.get('hora_cita') as string

  if (!cliente_id || !fecha_cita || !hora_cita) {
    return { error: 'Cliente, fecha y hora son requeridos' }
  }

  const vehiculo_id = (formData.get('vehiculo_id') as string) || null
  const motivo = (formData.get('motivo') as string)?.trim() || null
  const notas_previas = (formData.get('notas_previas') as string)?.trim() || null

  const { data, error } = await supabase
    .from('citas')
    .insert({
      sucursal_id: usuario.sucursal_id,
      cliente_id,
      vehiculo_id: vehiculo_id || null,
      fecha_cita,
      hora_cita,
      motivo: motivo || null,
      notas_previas: notas_previas || null,
      estado: 'pendiente_contactar' as unknown as EstadoCita,
    })
    .select('id')
    .single()

  if (error) return { error: `Error al crear la cita: ${error.message}` }

  revalidatePath('/citas')
  return { id: data.id }
}

export async function updateCitaEstadoAction(citaId: string, nuevoEstado: EstadoCita) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  // Verify valid transition server-side
  const ALLOWED_TRANSITIONS: Record<string, string[]> = {
    pendiente_contactar: ['contactada', 'confirmada', 'no_show', 'cancelada'],
    contactada:  ['confirmada', 'no_show', 'cancelada'],
    confirmada:  ['en_agencia', 'no_show', 'cancelada'],
    en_agencia:  ['show', 'no_show', 'cancelada'],
    show:        ['terminada'],
    terminada:   [],
    no_show:     ['confirmada'],
    cancelada:   [],
    // legacy
    pendiente:   ['confirmada', 'cancelada'],
    llegada:     ['en_proceso', 'cancelada'],
    en_proceso:  ['terminada', 'cancelada'],
    'no-show':   ['confirmada'],
  }

  const { data: cita } = await supabase
    .from('citas')
    .select('estado')
    .eq('id', citaId)
    .single()

  if (!cita) return { error: 'Cita no encontrada' }

  const allowed = ALLOWED_TRANSITIONS[cita.estado] ?? []
  if (!allowed.includes(nuevoEstado)) {
    return { error: `No se puede mover de "${cita.estado}" a "${nuevoEstado}"` }
  }

  const updateData: Record<string, unknown> = { estado: nuevoEstado }

  // When terminada, mark activa = false (remove from kanban)
  if (['terminada', 'cancelada', 'no_show'].includes(nuevoEstado)) {
    updateData.activa = false
  }

  const { error } = await supabase
    .from('citas')
    .update(updateData)
    .eq('id', citaId)

  if (error) return { error: 'Error al actualizar el estado' }

  revalidatePath('/citas')
  revalidatePath(`/citas/${citaId}`)
  return { success: true }
}

export async function cancelarCitaAction(citaId: string, motivo?: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  const { error } = await supabase
    .from('citas')
    .update({ estado: 'cancelada', activa: false })
    .eq('id', citaId)

  if (error) return { error: 'Error al cancelar la cita' }

  revalidatePath('/citas')
  revalidatePath(`/citas/${citaId}`)
  return { success: true }
}
