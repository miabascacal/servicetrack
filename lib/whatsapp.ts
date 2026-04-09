/**
 * WhatsApp Cloud API — envío de mensajes de texto y templates.
 * Cada sucursal tiene sus propias credenciales en la tabla wa_numeros.
 * Si no hay credenciales configuradas, el envío falla silenciosamente
 * (no rompe el flujo principal).
 */

import { createAdminClient } from '@/lib/supabase/admin'

export type WaMensajeTipo =
  | 'confirmacion_cita'
  | 'recordatorio_cita'
  | 'cita_cancelada'
  | 'ot_lista'
  | 'custom'

interface EnviarMensajeParams {
  sucursal_id: string
  modulo: 'citas' | 'taller' | 'ventas' | 'refacciones' | 'general'
  telefono: string          // formato internacional sin +: "5212345678"
  mensaje: string           // texto plano (para mensajes sin template)
  tipo: WaMensajeTipo
  entidad_tipo?: string
  entidad_id?: string
  cliente_id?: string
  template_name?: string
}

interface MetaTextBody {
  messaging_product: 'whatsapp'
  to: string
  type: 'text'
  text: { body: string; preview_url: boolean }
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
 */
export async function enviarMensajeWA(params: EnviarMensajeParams): Promise<boolean> {
  const supabase = createAdminClient()

  // Buscar número configurado para este módulo en esta sucursal
  const { data: waNumero } = await supabase
    .from('wa_numeros')
    .select('id, phone_number_id, access_token')
    .eq('sucursal_id', params.sucursal_id)
    .eq('modulo', params.modulo)
    .eq('activo', true)
    .single()

  // Si no hay número configurado, intentar con 'general'
  const { data: waGeneral } = !waNumero ? await supabase
    .from('wa_numeros')
    .select('id, phone_number_id, access_token')
    .eq('sucursal_id', params.sucursal_id)
    .eq('modulo', 'general')
    .eq('activo', true)
    .single() : { data: null }

  const wa = waNumero ?? waGeneral
  if (!wa) return false  // Sin credenciales — falla silenciosa

  const telefono = normalizarTelefono(params.telefono)
  if (!telefono) return false

  const body: MetaTextBody = {
    messaging_product: 'whatsapp',
    to: telefono,
    type: 'text',
    text: { body: params.mensaje, preview_url: false },
  }

  let status = 'enviado'
  let metaMessageId: string | undefined
  let errorDetalle: string | undefined

  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${wa.phone_number_id}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${wa.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    )

    const json = await res.json() as { messages?: { id: string }[]; error?: { message: string } }

    if (!res.ok || json.error) {
      status = 'error'
      errorDetalle = json.error?.message ?? `HTTP ${res.status}`
    } else {
      metaMessageId = json.messages?.[0]?.id
    }
  } catch (e) {
    status = 'error'
    errorDetalle = e instanceof Error ? e.message : 'Error desconocido'
  }

  // Registrar en log (no bloqueante)
  await supabase.from('wa_mensajes_log').insert({
    sucursal_id: params.sucursal_id,
    wa_numero_id: wa.id,
    cliente_id: params.cliente_id ?? null,
    telefono_destino: telefono,
    tipo: params.tipo,
    template_name: params.template_name ?? null,
    contenido: params.mensaje,
    entidad_tipo: params.entidad_tipo ?? null,
    entidad_id: params.entidad_id ?? null,
    status,
    meta_message_id: metaMessageId ?? null,
    error_detalle: errorDetalle ?? null,
    enviado_at: status === 'enviado' ? new Date().toISOString() : null,
  })

  return status === 'enviado'
}

// ── Mensajes predefinidos ──────────────────────────────────────────────────

export function mensajeConfirmacionCita(params: {
  nombre: string
  fecha: string   // "Jueves 10 de abril"
  hora: string    // "10:00"
  agencia: string
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
  nombre: string
  hora: string
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
  nombre: string
  fecha: string
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
