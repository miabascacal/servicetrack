'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { EstadoOT } from '@/types/database'
import { ensureUsuario } from '@/lib/ensure-usuario'

// ── Generar número de OT único ─────────────────────────────────────────────
function generarNumeroOT(): string {
  const now = new Date()
  const year = now.getFullYear().toString().slice(-2)
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const rand = Math.floor(Math.random() * 9000) + 1000
  return `OT-${year}${month}${day}-${rand}`
}

// ── Crear OT ───────────────────────────────────────────────────────────────
export async function createOTAction(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  let usuario: import('@/lib/ensure-usuario').UsuarioCtx
  try { usuario = await ensureUsuario(supabase, user.id, user.email ?? '') }
  catch (e) { return { error: e instanceof Error ? e.message : 'Error al obtener perfil' } }

  const cliente_id = formData.get('cliente_id') as string
  const vehiculo_id = (formData.get('vehiculo_id') as string) || null
  const cita_id = (formData.get('cita_id') as string) || null
  const km_ingreso = formData.get('km_ingreso') ? parseInt(formData.get('km_ingreso') as string) : null
  const diagnostico = (formData.get('diagnostico') as string)?.trim() || null
  const notas_internas = (formData.get('notas_internas') as string)?.trim() || null
  const promesa_entrega = (formData.get('promesa_entrega') as string) || null

  if (!cliente_id) return { error: 'Cliente es requerido' }

  const { data, error } = await supabase
    .from('ordenes_trabajo')
    .insert({
      sucursal_id: usuario.sucursal_id ?? usuario.grupo_id,
      cliente_id,
      vehiculo_id,
      cita_id,
      asesor_id: user.id,
      numero_ot: generarNumeroOT(),
      estado: 'recibido' as EstadoOT,
      km_ingreso,
      diagnostico,
      notas_internas,
      promesa_entrega: promesa_entrega || null,
    })
    .select('id')
    .single()

  if (error) return { error: `Error al crear la orden de trabajo: ${error.message}` }

  revalidatePath('/taller')
  return { id: data.id }
}

// ── Cambiar estado OT ──────────────────────────────────────────────────────
const ALLOWED_TRANSITIONS: Record<EstadoOT, EstadoOT[]> = {
  recibido:     ['diagnostico', 'en_reparacion', 'cancelado'],
  diagnostico:  ['en_reparacion', 'cancelado'],
  en_reparacion: ['listo', 'cancelado'],
  listo:        ['entregado'],
  entregado:    [],
  cancelado:    [],
}

export async function updateEstadoOTAction(otId: string, nuevoEstado: EstadoOT) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  const { data: ot } = await supabase
    .from('ordenes_trabajo')
    .select('estado')
    .eq('id', otId)
    .single()

  if (!ot) return { error: 'OT no encontrada' }

  const allowed = ALLOWED_TRANSITIONS[ot.estado as EstadoOT]
  if (!allowed.includes(nuevoEstado)) {
    return { error: `No se puede mover de "${ot.estado}" a "${nuevoEstado}"` }
  }

  const updateData: Record<string, unknown> = {
    estado: nuevoEstado,
  }
  if (nuevoEstado === 'entregado') {
    updateData.fecha_entrega = new Date().toISOString()
  }

  const { error } = await supabase
    .from('ordenes_trabajo')
    .update(updateData)
    .eq('id', otId)

  if (error) return { error: 'Error al actualizar el estado' }

  revalidatePath('/taller')
  revalidatePath(`/taller/${otId}`)
  return { success: true }
}

// ── Agregar línea a OT ─────────────────────────────────────────────────────
export async function addLineaOTAction(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  const ot_id = formData.get('ot_id') as string
  const tipo = formData.get('tipo') as string
  const descripcion = (formData.get('descripcion') as string)?.trim()
  const cantidad = parseFloat((formData.get('cantidad') as string) || '1')
  const precio_unitario = parseFloat((formData.get('precio_unitario') as string) || '0')
  const numero_parte = (formData.get('numero_parte') as string)?.trim() || null

  if (!ot_id || !tipo || !descripcion) return { error: 'Datos incompletos' }

  const total = cantidad * precio_unitario

  const { error } = await supabase
    .from('lineas_ot')
    .insert({
      ot_id,
      tipo,
      descripcion,
      cantidad,
      precio_unitario,
      total,
      numero_parte,
      estado: 'pendiente',
    })

  if (error) return { error: 'Error al agregar la línea' }

  revalidatePath(`/taller/${ot_id}`)
  return { success: true }
}

// ── Eliminar línea de OT ───────────────────────────────────────────────────
export async function deleteLineaOTAction(lineaId: string, otId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  const { error } = await supabase
    .from('lineas_ot')
    .delete()
    .eq('id', lineaId)

  if (error) return { error: 'Error al eliminar la línea' }

  revalidatePath(`/taller/${otId}`)
  return { success: true }
}

// ── Actualizar diagnóstico / notas OT ──────────────────────────────────────
export async function updateOTAction(otId: string, fields: { diagnostico?: string; notas_internas?: string; promesa_entrega?: string | null }) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  const { error } = await supabase
    .from('ordenes_trabajo')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', otId)

  if (error) return { error: 'Error al actualizar la OT' }

  revalidatePath(`/taller/${otId}`)
  return { success: true }
}
