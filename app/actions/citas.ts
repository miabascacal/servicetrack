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
  const servicio = (formData.get('servicio') as string)?.trim() || null
  const notas = (formData.get('notas') as string)?.trim() || null

  const { data, error } = await supabase
    .from('citas')
    .insert({
      sucursal_id: usuario.sucursal_id,
      cliente_id,
      vehiculo_id: vehiculo_id || null,
      fecha_cita,
      hora_cita,
      servicio: servicio || null,
      notas: notas || null,
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
    contactada:          ['confirmada', 'no_show', 'cancelada'],
    confirmada:          ['en_agencia', 'no_show', 'cancelada'],
    en_agencia:          ['show', 'no_show', 'cancelada'],
    show:                [],
    no_show:             ['confirmada'],
    cancelada:           [],
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
    .update({ estado: 'cancelada' })
    .eq('id', citaId)

  if (error) return { error: 'Error al cancelar la cita' }

  revalidatePath('/citas')
  revalidatePath(`/citas/${citaId}`)
  return { success: true }
}
