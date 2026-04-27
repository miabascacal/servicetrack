/**
 * WhatsApp Cloud API — envío de mensajes de texto y templates.
 * Cada sucursal tiene sus propias credenciales en la tabla wa_numeros.
 * Si no hay credenciales configuradas, el envío falla silenciosamente
 * (no rompe el flujo principal).
 *
 * Persistencia conversacional (Sprint 8 Fase 1):
 *   Todo mensaje saliente nuevo se persiste también en `mensajes` con su thread_id.
 *   `wa_mensajes_log` se conserva como log técnico de la llamada a la API de Meta.
 *   Si la persistencia conversacional falla, el error queda en wa_mensajes_log.error_detalle.
 */

import { createAdminClient }                       from '@/lib/supabase/admin'
import { getOrCreateThread, type ThreadContextoTipo } from '@/lib/threads'

export type WaMensajeTipo =
  | 'confirmacion_cita'
  | 'recordatorio_cita'
  | 'cita_cancelada'
  | 'ot_lista'
  | 'custom'

interface EnviarMensajeParams {
  sucursal_id:       string
  modulo:            'citas' | 'taller' | 'ventas' | 'refacciones' | 'general'
  telefono:          string          // formato internacional sin +: "5212345678"
  mensaje:           string          // texto plano (para mensajes sin template)
  tipo:              WaMensajeTipo
  entidad_tipo?:     string
  entidad_id?:       string
  cliente_id?:       string

  // ── Campos de persistencia conversacional (Sprint 8 Fase 1) ──────────────
  usuario_asesor_id?: string         // id en tabla usuarios (no auth.users)
  contexto_tipo?:     ThreadContextoTipo
  contexto_id?:       string
  enviado_por_bot?:   boolean        // default false

  // Conservado para compatibilidad con callers que construyen templates
  template_name?:     string
}

interface MetaTextBody {
  messaging_product: 'whatsapp'
  to:                string
  type:              'text'
  text:              { body: string; preview_url: boolean }
}

/**
 * Normaliza teléfono a formato E.164 sin el +
 * Ej: "+52 1 81 1234 5678" → "5218112345678"
 */
function normalizarTelefono(tel: string): string {
  return tel.replace(/\D/g, '')
}

/**
 * Envía un mensaje de texto libre a través de la Cloud API de Meta.
 * Retorna true si fue exitoso, false si falló o no hay credenciales.
 *
 * Comportamiento de persistencia:
 *   - Si params.cliente_id está presente, resuelve/crea un conversation_thread
 *     e inserta el mensaje en `mensajes`.
 *   - Si la persistencia falla, el error se registra en wa_mensajes_log.error_detalle
 *     y la función retorna el resultado del envío sin propagar la excepción.
 *   - message_count en conversation_threads NO se incrementa en Fase 1.
 *     TODO Fase 2: agregar función RPC o trigger para incremento atómico.
 */
export async function enviarMensajeWA(params: EnviarMensajeParams): Promise<boolean> {
  const supabase = createAdminClient()

  // ── 1. Buscar número configurado para este módulo en esta sucursal ─────
  const { data: waNumero } = await supabase
    .from('wa_numeros')
    .select('id, phone_number_id, access_token')
    .eq('sucursal_id', params.sucursal_id)
    .eq('modulo', params.modulo)
    .eq('activo', true)
    .single()

  // Si no hay número configurado, intentar con 'general'
  const { data: waGeneral } = !waNumero
    ? await supabase
        .from('wa_numeros')
        .select('id, phone_number_id, access_token')
        .eq('sucursal_id', params.sucursal_id)
        .eq('modulo', 'general')
        .eq('activo', true)
        .single()
    : { data: null }

  const wa = waNumero ?? waGeneral
  if (!wa) return false  // Sin credenciales — falla silenciosa

  const telefono = normalizarTelefono(params.telefono)
  if (!telefono) return false

  const body: MetaTextBody = {
    messaging_product: 'whatsapp',
    to:   telefono,
    type: 'text',
    text: { body: params.mensaje, preview_url: false },
  }

  let status        = 'enviado'
  let metaMessageId: string | undefined
  let errorDetalle:  string | undefined

  // ── 2. Llamada a la API de Meta ────────────────────────────────────────
  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${wa.phone_number_id}/messages`,
      {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${wa.access_token}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify(body),
      },
    )

    const json = await res.json() as {
      messages?: { id: string }[]
      error?:    { message: string }
    }

    if (!res.ok || json.error) {
      status       = 'error'
      errorDetalle = json.error?.message ?? `HTTP ${res.status}`
    } else {
      metaMessageId = json.messages?.[0]?.id
    }
  } catch (e) {
    status       = 'error'
    errorDetalle = e instanceof Error ? e.message : 'Error desconocido'
  }

  // ── 3. Log técnico en wa_mensajes_log ──────────────────────────────────
  // Capturar el id del row para poder actualizar error_detalle si la
  // persistencia conversacional falla más adelante.
  const { data: logRow } = await supabase
    .from('wa_mensajes_log')
    .insert({
      sucursal_id:      params.sucursal_id,
      wa_numero_id:     wa.id,
      cliente_id:       params.cliente_id       ?? null,
      telefono_destino: telefono,
      tipo:             params.tipo,
      template_name:    params.template_name    ?? null,
      contenido:        params.mensaje,
      entidad_tipo:     params.entidad_tipo      ?? null,
      entidad_id:       params.entidad_id        ?? null,
      status,
      meta_message_id:  metaMessageId            ?? null,
      error_detalle:    errorDetalle             ?? null,
      enviado_at:       status === 'enviado' ? new Date().toISOString() : null,
    })
    .select('id')
    .single()

  const logRowId = logRow?.id

  // ── 4. Persistencia conversacional ────────────────────────────────────
  // Solo si hay cliente_id: sin cliente no hay hilo posible.
  // Corre en try/catch propio — un fallo aquí no cancela el resultado del envío.
  if (params.cliente_id) {
    try {
      const messageSource = params.enviado_por_bot ? 'agent_bot' : 'agent'

      const { thread_id } = await getOrCreateThread({
        sucursal_id:   params.sucursal_id,
        cliente_id:    params.cliente_id,
        canal:         'whatsapp',
        contexto_tipo: params.contexto_tipo,
        contexto_id:   params.contexto_id,
        assignee_id:   params.usuario_asesor_id,
      })

      await supabase
        .from('mensajes')
        .insert({
          sucursal_id:         params.sucursal_id,
          cliente_id:          params.cliente_id,
          usuario_asesor_id:   params.usuario_asesor_id ?? null,
          canal:               'whatsapp',
          direccion:           'saliente',
          contenido:           params.mensaje,
          thread_id,
          message_source:      messageSource,
          wa_message_id:       metaMessageId ?? null,
          estado_entrega:      status === 'enviado' ? 'sent' : 'failed',
          enviado_por_bot:     params.enviado_por_bot ?? false,
          // 'skipped': mensajes salientes no requieren clasificación IA.
          // Requiere 004_messaging_adjustments.sql ejecutada previamente.
          processing_status:   'skipped',
          enviado_at:          new Date().toISOString(),
        })

      // Actualizar timestamps del hilo.
      // message_count no se incrementa aquí — TODO Fase 2: trigger o RPC.
      await supabase
        .from('conversation_threads')
        .update({
          last_message_at:       new Date().toISOString(),
          last_agent_message_at: new Date().toISOString(),
          last_message_source:   messageSource,
        })
        .eq('id', thread_id)

    } catch (persistErr) {
      // Persistencia fallida — registrar en wa_mensajes_log para trazabilidad.
      // No se propaga: el WA ya fue enviado y el resultado es el del envío.
      const detail     = persistErr instanceof Error ? persistErr.message : String(persistErr)
      const combined   = [errorDetalle, `[PERSIST_ERROR: ${detail}]`].filter(Boolean).join(' ')
      if (logRowId) {
        await supabase
          .from('wa_mensajes_log')
          .update({ error_detalle: combined })
          .eq('id', logRowId)
      }
    }
  }

  return status === 'enviado'
}

// ── Mensajes predefinidos ──────────────────────────────────────────────────

export function mensajeConfirmacionCita(params: {
  nombre:     string
  fecha:      string   // "Jueves 10 de abril"
  hora:       string   // "10:00"
  agencia:    string
  direccion?: string
}): string {
  return [
    `Hola ${params.nombre} 👋`,
    ``,
    `Tu cita en *${params.agencia}* ha sido *confirmada* ✅`,
    ``,
    `📅 *Fecha:* ${params.fecha}`,
    `🕐 *Hora:* ${params.hora} hrs`,
    params.direccion ? `📍 *Dirección:* ${params.direccion}` : '',
    ``,
    `Si tienes alguna duda o necesitas reagendar, responde este mensaje.`,
  ].filter(Boolean).join('\n')
}

export function mensajeRecordatorioCita(params: {
  nombre:  string
  hora:    string
  agencia: string
}): string {
  return [
    `Hola ${params.nombre} 👋`,
    ``,
    `Te recordamos que *mañana* tienes cita en *${params.agencia}* a las *${params.hora} hrs* 🚗`,
    ``,
    `Si necesitas cambiar tu cita, responde este mensaje.`,
  ].join('\n')
}

export function mensajeCitaCancelada(params: {
  nombre:  string
  fecha:   string
  agencia: string
}): string {
  return [
    `Hola ${params.nombre},`,
    ``,
    `Tu cita del *${params.fecha}* en *${params.agencia}* ha sido cancelada.`,
    ``,
    `Para reagendar, responde este mensaje o contáctanos directamente.`,
  ].join('\n')
}

export function mensajeRecordatorio2h(params: {
  nombre:  string
  hora:    string
  agencia: string
}): string {
  return [
    `Hola ${params.nombre} 👋`,
    ``,
    `Te recordamos que *hoy en 2 horas* tienes cita en *${params.agencia}* a las *${params.hora} hrs* 🚗`,
    ``,
    `Si necesitas cambiar tu cita, responde este mensaje.`,
  ].join('\n')
}

export function mensajeNoShow(params: {
  nombre:  string
  hora:    string
  agencia: string
}): string {
  return [
    `Hola ${params.nombre} 👋`,
    ``,
    `Notamos que no pudiste llegar a tu cita de las *${params.hora} hrs* en *${params.agencia}*.`,
    ``,
    `¿Te gustaría reagendar? Responde este mensaje y con gusto te ayudamos.`,
  ].join('\n')
}

export function mensajeVehiculoListo(params: {
  nombre:     string
  numero_ot:  string
  agencia:    string
  direccion?: string
}): string {
  return [
    `Hola ${params.nombre} 👋`,
    ``,
    `Tu vehículo ya está listo en *${params.agencia}* 🚗✅`,
    ``,
    `📋 Número de servicio: *${params.numero_ot}*`,
    params.direccion ? `📍 *Dirección:* ${params.direccion}` : '',
    ``,
    `Puedes pasar a recogerlo en horario de atención.`,
    `Si tienes alguna pregunta o necesitas coordinar la entrega, responde este mensaje.`,
  ].filter(Boolean).join('\n')
}
