'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { EstadoOT } from '@/types/database'
import { ensureUsuario } from '@/lib/ensure-usuario'
import { tieneRol } from '@/lib/permisos'
import { OT_TRANSITIONS, ESTADO_OT_LABELS } from '@/lib/ot-estados'
import { getOrCreateThread } from '@/lib/threads'
import { enviarMensajeWA, mensajeVehiculoListo } from '@/lib/whatsapp'

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

  const payload = {
    sucursal_id:       params.sucursal_id,
    cliente_id:        params.cliente_id,
    thread_id,
    canal:             'interno',
    direccion:         'saliente',
    message_source:    'system',
    contenido:         params.contenido,
    enviado_por_bot:   false,
    enviado_at:        now,
    processing_status: 'skipped',   // eventos del sistema no pasan por el clasificador IA
  }

  const { error: msgError } = await admin.from('mensajes').insert(payload)

  if (msgError) {
    throw new Error(
      `[insertarEventoOT] mensajes.insert falló — ` +
      `code: ${msgError.code}, message: ${msgError.message}, details: ${msgError.details} — ` +
      `payload: ${JSON.stringify({ ot_id: params.ot_id, numero_ot: params.numero_ot, thread_id, canal: 'interno', sucursal_id: params.sucursal_id })}`
    )
  }

  // Actualizar metadatos del hilo para que aparezca en bandeja con orden correcto
  const { error: threadError } = await admin.from('conversation_threads')
    .update({
      last_message_at:     now,
      last_message_source: 'system',
    })
    .eq('id', thread_id)

  if (threadError) {
    // No lanzar — el mensaje ya fue insertado. Solo registrar.
    console.error(
      `[insertarEventoOT] conversation_threads.update falló (no crítico) — ` +
      `thread_id: ${thread_id}, code: ${threadError.code}, message: ${threadError.message}`
    )
  }
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
  const diagnostico = (formData.get('diagnostico') as string)?.trim().toUpperCase() || null
  const notas_internas = (formData.get('notas_internas') as string)?.trim() || null
  const promesa_entrega = (formData.get('promesa_entrega') as string) || null
  const numero_ot_dms = (formData.get('numero_ot_dms') as string)?.trim().toUpperCase() || null

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
    console.error(
      `[createOT] evento interno falló — ot_id: ${data.id}, numero_ot: ${numero_ot}, sucursal_id: ${usuario.sucursal_id} — `,
      e instanceof Error ? e.message : e
    )
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
  // updated_at es manejado por el trigger t_ordenes_trabajo_updated (migration 005).
  // TODO: agregar columna updated_by UUID cuando se cree la migración correspondiente.
  // Por ahora el usuario que operó el cambio queda trazado en el evento interno de bandeja.

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
        sucursal_id:   ot.sucursal_id,
        cliente_id:    ot.cliente_id,
        ot_id:         otId,
        numero_ot:     ot.numero_ot,
        numero_ot_dms: ot.numero_ot_dms,
        contenido:     `Estado actualizado — ${ot.numero_ot}${dmsInfo}: "${estadoAnterior}" → "${estadoNuevo}".`,
      })
    }
  } catch (e) {
    console.error(
      `[updateEstadoOT] evento interno falló — ot_id: ${otId}, numero_ot: ${ot.numero_ot}, nuevo_estado: ${nuevoEstado} — `,
      e instanceof Error ? e.message : e
    )
  }

  // Notificación WA al cliente cuando el vehículo está listo — best-effort
  if (nuevoEstado === 'listo' && ot.cliente_id && ot.sucursal_id) {
    try {
      const admin = createAdminClient()
      const { data: cliente } = await admin
        .from('clientes')
        .select('nombre, whatsapp')
        .eq('id', ot.cliente_id)
        .single()

      const { data: sucursal } = await admin
        .from('sucursales')
        .select('nombre, direccion')
        .eq('id', ot.sucursal_id)
        .single()

      if (cliente?.whatsapp) {
        void enviarMensajeWA({
          sucursal_id:   ot.sucursal_id,
          modulo:        'taller',
          telefono:      cliente.whatsapp,
          mensaje:       mensajeVehiculoListo({
            nombre:    cliente.nombre,
            numero_ot: ot.numero_ot,
            agencia:   sucursal?.nombre ?? 'la agencia',
            direccion: sucursal?.direccion ?? undefined,
          }),
          tipo:          'ot_lista',
          entidad_tipo:  'ot',
          entidad_id:    otId,
          cliente_id:    ot.cliente_id,
          enviado_por_bot: false,
          contexto_tipo: 'ot',
          contexto_id:   otId,
        })
      }
    } catch (e) {
      console.error(
        `[updateEstadoOT] WA vehiculo listo falló — ot_id: ${otId} — `,
        e instanceof Error ? e.message : e
      )
    }
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
  fields: { diagnostico?: string; notas_internas?: string; promesa_entrega?: string | null; numero_ot_dms?: string | null }
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  let ctx: import('@/lib/ensure-usuario').UsuarioCtx
  try { ctx = await ensureUsuario(supabase, user.id, user.email ?? '') }
  catch (e) { return { error: e instanceof Error ? e.message : 'Error al obtener perfil' } }

  if (!tieneRol(ctx.rol, 'asesor_servicio'))
    return { success: false, error: 'Sin permisos para esta operación' }

  const normalizedFields = {
    ...fields,
    ...(fields.diagnostico !== undefined && { diagnostico: fields.diagnostico?.trim().toUpperCase() || null }),
    ...(fields.numero_ot_dms !== undefined && { numero_ot_dms: fields.numero_ot_dms?.trim().toUpperCase() || null }),
  }

  const { error } = await supabase
    .from('ordenes_trabajo')
    .update({ ...normalizedFields, updated_at: new Date().toISOString() })
    .eq('id', otId)

  if (error) return { error: 'Error al actualizar la OT' }

  revalidatePath(`/taller/${otId}`)
  return { success: true }
}

// ── Vincular OT existente a una Cita ──────────────────────────────────────
// Valida que la OT y la cita compartan sucursal, cliente y vehículo.
// Actualiza ordenes_trabajo.cita_id = citaId.
export async function vincularOTCitaAction(citaId: string, otId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  let ctx: import('@/lib/ensure-usuario').UsuarioCtx
  try { ctx = await ensureUsuario(supabase, user.id, user.email ?? '') }
  catch (e) { return { error: e instanceof Error ? e.message : 'Error al obtener perfil' } }

  if (!tieneRol(ctx.rol, 'asesor_servicio'))
    return { success: false, error: 'Sin permisos para esta operación' }

  // Traer cita y OT en paralelo — RLS garantiza que ambas son de la sucursal del usuario
  const [{ data: cita }, { data: ot }] = await Promise.all([
    supabase
      .from('citas')
      .select('id, cliente_id, vehiculo_id, sucursal_id')
      .eq('id', citaId)
      .single(),
    supabase
      .from('ordenes_trabajo')
      .select('id, cliente_id, vehiculo_id, sucursal_id, estado, cita_id')
      .eq('id', otId)
      .single(),
  ])

  if (!cita) return { error: 'Cita no encontrada' }
  if (!ot)   return { error: 'OT no encontrada' }

  // Validaciones de contexto
  if (ot.sucursal_id !== cita.sucursal_id) return { error: 'La OT pertenece a otra sucursal' }
  if (ot.cliente_id  !== cita.cliente_id)  return { error: 'La OT pertenece a otro cliente' }
  // Regla vehiculo_id: solo bloquear si AMBOS tienen vehículo asignado y son distintos.
  // Si alguno es null (cita sin vehículo o OT sin vehículo), se permite — no hay conflicto explícito.
  if (cita.vehiculo_id && ot.vehiculo_id && ot.vehiculo_id !== cita.vehiculo_id)
    return { error: 'La OT corresponde a otro vehículo' }
  if (ot.estado === 'entregado' || ot.estado === 'cancelado')
    return { error: 'No se puede vincular una OT cerrada' }
  if (ot.cita_id && ot.cita_id !== citaId)
    return { error: 'La OT ya está vinculada a otra cita' }

  const { error } = await supabase
    .from('ordenes_trabajo')
    .update({ cita_id: citaId, updated_at: new Date().toISOString() })
    .eq('id', otId)

  if (error) return { error: 'Error al vincular la OT' }

  revalidatePath(`/citas/${citaId}`)
  revalidatePath(`/taller/${otId}`)
  return { success: true }
}
