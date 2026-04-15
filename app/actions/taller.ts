'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { EstadoOT } from '@/types/database'
import { ensureUsuario } from '@/lib/ensure-usuario'
import { tieneRol } from '@/lib/permisos'
import { OT_TRANSITIONS, ESTADO_OT_LABELS } from '@/lib/ot-estados'
import { getOrCreateThread } from '@/lib/threads'

// ── Generar número de OT único ─────────────────────────────────────────────
function generarNumeroOT(): string {
  const now = new Date()
  const year = now.getFullYear().toString().slice(-2)
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const rand = Math.floor(Math.random() * 9000) + 1000
  return `OT-${year}${month}${day}-${rand}`
}

// ── Recalcular totales de OT ───────────────────────────────────────────────
// Llama después de cualquier INSERT o DELETE en lineas_ot.
// Actualiza total_mano_obra, total_refacciones y total_ot en ordenes_trabajo.
async function recalcularTotalesOT(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ot_id: string
): Promise<void> {
  const { data: lineas } = await supabase
    .from('lineas_ot')
    .select('tipo, total')
    .eq('ot_id', ot_id)

  const rows = lineas ?? []

  const totalManoObra = rows
    .filter(l => l.tipo === 'mano_obra')
    .reduce((s, l) => s + (l.total ?? 0), 0)

  const totalRefacciones = rows
    .filter(l => ['refaccion', 'fluido', 'externo', 'cortesia'].includes(l.tipo))
    .reduce((s, l) => s + (l.total ?? 0), 0)

  const totalOT = rows.reduce((s, l) => s + (l.total ?? 0), 0)

  await supabase
    .from('ordenes_trabajo')
    .update({ total_mano_obra: totalManoObra, total_refacciones: totalRefacciones, total_ot: totalOT })
    .eq('id', ot_id)
}

// ── Insertar evento interno de sistema en bandeja ─────────────────────────
// Best-effort: los errores aquí NO fallan la operación principal.
// Crea o reutiliza el hilo 'interno' del contexto OT e inserta un
// mensaje de sistema visible en la bandeja bajo el filtro "Todos".
async function insertarEventoOT(params: {
  sucursal_id:  string
  cliente_id:   string
  ot_id:        string
  numero_ot:    string
  numero_ot_dms: string | null
  contenido:    string
  assignee_id?: string
}): Promise<void> {
  const admin = createAdminClient()

  const { thread_id } = await getOrCreateThread({
    sucursal_id:  params.sucursal_id,
    cliente_id:   params.cliente_id,
    canal:        'interno',
    contexto_tipo: 'ot',
    contexto_id:  params.ot_id,
    assignee_id:  params.assignee_id,
  })

  const now = new Date().toISOString()

  await admin.from('mensajes').insert({
    sucursal_id:      params.sucursal_id,
    cliente_id:       params.cliente_id,
    thread_id,
    canal:            'interno',
    direccion:        'saliente',
    message_source:   'system',
    contenido:        params.contenido,
    enviado_por_bot:  false,
    enviado_at:       now,
    processing_status: 'skipped',   // eventos del sistema no pasan por el clasificador IA
  })

  // Actualizar metadatos del hilo para que aparezca en bandeja con orden correcto
  await admin.from('conversation_threads')
    .update({
      last_message_at:     now,
      last_message_source: 'system',
    })
    .eq('id', thread_id)
}

// ── Crear OT ───────────────────────────────────────────────────────────────
export async function createOTAction(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  let usuario: import('@/lib/ensure-usuario').UsuarioCtx
  try { usuario = await ensureUsuario(supabase, user.id, user.email ?? '') }
  catch (e) { return { error: e instanceof Error ? e.message : 'Error al obtener perfil' } }

  if (!tieneRol(usuario.rol, 'asesor_servicio'))
    return { success: false, error: 'Sin permisos para esta operación' }

  const cliente_id = formData.get('cliente_id') as string
  const vehiculo_id = (formData.get('vehiculo_id') as string) || null
  const cita_id = (formData.get('cita_id') as string) || null
  const km_ingreso = formData.get('km_ingreso') ? parseInt(formData.get('km_ingreso') as string) : null
  const diagnostico = (formData.get('diagnostico') as string)?.trim() || null
  const notas_internas = (formData.get('notas_internas') as string)?.trim() || null
  const promesa_entrega = (formData.get('promesa_entrega') as string) || null
  const numero_ot_dms = (formData.get('numero_ot_dms') as string)?.trim() || null

  if (!cliente_id) return { error: 'Cliente es requerido' }

  // Generar número interno antes del INSERT para usarlo en el evento de sistema
  const numero_ot = generarNumeroOT()

  const { data, error } = await supabase
    .from('ordenes_trabajo')
    .insert({
      sucursal_id: usuario.sucursal_id,
      cliente_id,
      vehiculo_id,
      cita_id,
      asesor_id: user.id,
      numero_ot,
      numero_ot_dms,
      estado: 'recibido' as EstadoOT,
      km_ingreso,
      diagnostico,
      notas_internas,
      promesa_entrega: promesa_entrega || null,
    })
    .select('id')
    .single()

  if (error) return { error: `Error al crear la orden de trabajo: ${error.message}` }

  // Evento interno — best-effort: no falla la creación de la OT si hay error aquí
  try {
    const dmsInfo = numero_ot_dms ? ` · DMS: ${numero_ot_dms}` : ''
    await insertarEventoOT({
      sucursal_id:  usuario.sucursal_id,
      cliente_id,
      ot_id:        data.id,
      numero_ot,
      numero_ot_dms,
      contenido:    `OT creada — ServiceTrack: ${numero_ot}${dmsInfo}.`,
      assignee_id:  user.id,
    })
  } catch (e) {
    console.error('[createOT] error creando evento interno:', e)
  }

  revalidatePath('/taller')
  return { id: data.id }
}

// ── Cambiar estado OT ──────────────────────────────────────────────────────
export async function updateEstadoOTAction(otId: string, nuevoEstado: EstadoOT) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  let ctx: import('@/lib/ensure-usuario').UsuarioCtx
  try { ctx = await ensureUsuario(supabase, user.id, user.email ?? '') }
  catch (e) { return { error: e instanceof Error ? e.message : 'Error al obtener perfil' } }

  if (!tieneRol(ctx.rol, 'asesor_servicio'))
    return { success: false, error: 'Sin permisos para esta operación' }

  // Traer estado actual + contexto necesario para el evento interno
  const { data: ot } = await supabase
    .from('ordenes_trabajo')
    .select('estado, cliente_id, sucursal_id, numero_ot, numero_ot_dms')
    .eq('id', otId)
    .single()

  if (!ot) return { error: 'OT no encontrada' }

  const allowed = OT_TRANSITIONS[ot.estado as EstadoOT]
  if (!allowed.includes(nuevoEstado)) {
    return { error: `No se puede mover de "${ot.estado}" a "${nuevoEstado}"` }
  }

  const updateData: Record<string, unknown> = { estado: nuevoEstado }
  if (nuevoEstado === 'entregado') {
    updateData.fecha_entrega = new Date().toISOString()
  }

  const { error } = await supabase
    .from('ordenes_trabajo')
    .update(updateData)
    .eq('id', otId)

  if (error) return { error: 'Error al actualizar el estado' }

  // Evento interno — best-effort
  try {
    if (ot.cliente_id && ot.sucursal_id) {
      const estadoAnterior = ESTADO_OT_LABELS[ot.estado as EstadoOT] ?? ot.estado
      const estadoNuevo    = ESTADO_OT_LABELS[nuevoEstado] ?? nuevoEstado
      const dmsInfo = ot.numero_ot_dms ? ` · DMS: ${ot.numero_ot_dms}` : ''
      await insertarEventoOT({
        sucursal_id:  ot.sucursal_id,
        cliente_id:   ot.cliente_id,
        ot_id:        otId,
        numero_ot:    ot.numero_ot,
        numero_ot_dms: ot.numero_ot_dms,
        contenido:    `Estado actualizado — ${ot.numero_ot}${dmsInfo}: "${estadoAnterior}" → "${estadoNuevo}".`,
      })
    }
  } catch (e) {
    console.error('[updateEstadoOT] error creando evento interno:', e)
  }

  revalidatePath('/taller')
  revalidatePath(`/taller/${otId}`)
  return { success: true }
}

// ── Agregar línea a OT ─────────────────────────────────────────────────────
export async function addLineaOTAction(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  let ctx: import('@/lib/ensure-usuario').UsuarioCtx
  try { ctx = await ensureUsuario(supabase, user.id, user.email ?? '') }
  catch (e) { return { error: e instanceof Error ? e.message : 'Error al obtener perfil' } }

  if (!tieneRol(ctx.rol, 'asesor_servicio'))
    return { success: false, error: 'Sin permisos para esta operación' }

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

  await recalcularTotalesOT(supabase, ot_id)

  revalidatePath(`/taller/${ot_id}`)
  return { success: true }
}

// ── Eliminar línea de OT ───────────────────────────────────────────────────
export async function deleteLineaOTAction(lineaId: string, otId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  let ctx: import('@/lib/ensure-usuario').UsuarioCtx
  try { ctx = await ensureUsuario(supabase, user.id, user.email ?? '') }
  catch (e) { return { error: e instanceof Error ? e.message : 'Error al obtener perfil' } }

  if (!tieneRol(ctx.rol, 'gerente'))
    return { success: false, error: 'Sin permisos para esta operación' }

  const { error } = await supabase
    .from('lineas_ot')
    .delete()
    .eq('id', lineaId)

  if (error) return { error: 'Error al eliminar la línea' }

  await recalcularTotalesOT(supabase, otId)

  revalidatePath(`/taller/${otId}`)
  return { success: true }
}

// ── Actualizar diagnóstico / notas / promesa OT ────────────────────────────
export async function updateOTAction(
  otId: string,
  fields: { diagnostico?: string; notas_internas?: string; promesa_entrega?: string | null }
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  let ctx: import('@/lib/ensure-usuario').UsuarioCtx
  try { ctx = await ensureUsuario(supabase, user.id, user.email ?? '') }
  catch (e) { return { error: e instanceof Error ? e.message : 'Error al obtener perfil' } }

  if (!tieneRol(ctx.rol, 'asesor_servicio'))
    return { success: false, error: 'Sin permisos para esta operación' }

  const { error } = await supabase
    .from('ordenes_trabajo')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', otId)

  if (error) return { error: 'Error al actualizar la OT' }

  revalidatePath(`/taller/${otId}`)
  return { success: true }
}
