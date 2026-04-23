/**
 * WhatsApp Cloud API webhook.
 * GET  — verificación de token con Meta (handshake).
 * POST — mensajes y eventos entrantes de Meta.
 *
 * Flujo por mensaje entrante:
 *   1. Resolver sucursal_id desde phone_number_id (wa_numeros)
 *   2. Deduplicar por wa_message_id (idx_mensajes_wa_message_id)
 *   3. Resolver cliente_id por teléfono normalizado
 *   4. Crear/reutilizar conversation_thread
 *   5. Persistir en mensajes (processing_status: 'pending')
 *   6. Si ai_settings.activo=TRUE: clasificar intent + sentimiento (Haiku)
 */

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrCreateThread } from '@/lib/threads'
import { classifyIntent } from '@/lib/ai/classify-intent'
import { detectSentiment } from '@/lib/ai/detect-sentiment'
import { generarRespuestaBot } from '@/lib/ai/bot-citas'
import { enviarMensajeWA } from '@/lib/whatsapp'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ── GET — Handshake de verificación ───────────────────────────────────────────

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const mode      = searchParams.get('hub.mode')
  const token     = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.WA_VERIFY_TOKEN) {
    return new Response(challenge ?? '', { status: 200 })
  }
  return new Response('Forbidden', { status: 403 })
}

// ── Tipos del payload de Meta ─────────────────────────────────────────────────

interface MetaWAMessage {
  from:       string
  id:         string
  timestamp:  string
  type:       string
  text?:      { body: string }
  image?:     { id: string; mime_type: string; caption?: string }
  audio?:     { id: string; mime_type: string }
  video?:     { id: string; mime_type: string; caption?: string }
  document?:  { id: string; filename: string; mime_type: string; caption?: string }
  location?:  { latitude: number; longitude: number; name?: string; address?: string }
}

interface MetaWAValue {
  messaging_product: string
  metadata:   { display_phone_number: string; phone_number_id: string }
  contacts?:  { profile: { name: string }; wa_id: string }[]
  messages?:  MetaWAMessage[]
  statuses?:  unknown[]
}

interface MetaWAPayload {
  object: string
  entry:  { id: string; changes: { value: MetaWAValue; field: string }[] }[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizarTelefono(tel: string): string {
  return tel.replace(/\D/g, '')
}

function extractContent(msg: MetaWAMessage): {
  contenido: string | null
  media_url: string | null
  media_tipo: string | null
} {
  switch (msg.type) {
    case 'text':
      return { contenido: msg.text?.body ?? null, media_url: null, media_tipo: null }
    case 'image':
      return { contenido: msg.image?.caption ?? null, media_url: msg.image?.id ?? null, media_tipo: msg.image?.mime_type ?? null }
    case 'audio':
      return { contenido: null, media_url: msg.audio?.id ?? null, media_tipo: msg.audio?.mime_type ?? null }
    case 'video':
      return { contenido: msg.video?.caption ?? null, media_url: msg.video?.id ?? null, media_tipo: msg.video?.mime_type ?? null }
    case 'document':
      return { contenido: msg.document?.caption ?? null, media_url: msg.document?.id ?? null, media_tipo: msg.document?.mime_type ?? null }
    case 'location': {
      const loc = msg.location
      if (!loc) return { contenido: null, media_url: null, media_tipo: 'location' }
      const parts = [loc.name, loc.address, `${loc.latitude},${loc.longitude}`].filter(Boolean)
      return { contenido: parts.join(' — '), media_url: null, media_tipo: 'location' }
    }
    default:
      return { contenido: null, media_url: null, media_tipo: msg.type }
  }
}

// ── POST — Mensajes entrantes ─────────────────────────────────────────────────

export async function POST(request: Request) {
  let payload: MetaWAPayload
  try {
    payload = await request.json() as MetaWAPayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (payload.object !== 'whatsapp_business_account') {
    return NextResponse.json({ status: 'ignored' })
  }

  const supabase = createAdminClient()

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== 'messages') continue
      const value = change.value
      if (!value.messages?.length) continue

      const phoneNumberId = value.metadata.phone_number_id

      // Resolver sucursal desde el número de teléfono de la cuenta
      const { data: waNumero } = await supabase
        .from('wa_numeros')
        .select('sucursal_id')
        .eq('phone_number_id', phoneNumberId)
        .eq('activo', true)
        .single()

      if (!waNumero) continue

      const { sucursal_id } = waNumero

      // Config IA para esta sucursal (bot apagado por defecto)
      const { data: aiSettings } = await supabase
        .from('ai_settings')
        .select('activo, confidence_threshold')
        .eq('sucursal_id', sucursal_id)
        .single()

      const aiActivo             = aiSettings?.activo === true
      const confidenceThreshold  = aiSettings?.confidence_threshold ?? 0.85

      for (const msg of value.messages) {
        // ── 1. Deduplicación ───────────────────────────────────────────────
        const { data: existing } = await supabase
          .from('mensajes')
          .select('id')
          .eq('wa_message_id', msg.id)
          .maybeSingle()

        if (existing) continue

        const senderPhone = normalizarTelefono(msg.from)
        const { contenido, media_url, media_tipo } = extractContent(msg)

        // ── 2. Resolver cliente por teléfono ──────────────────────────────
        // Buscar por número exacto o con prefijo +
        const { data: cliente } = await supabase
          .from('clientes')
          .select('id')
          .eq('sucursal_id', sucursal_id)
          .or(`whatsapp.eq.${senderPhone},whatsapp.eq.+${senderPhone}`)
          .maybeSingle()

        // ── 3. Hilo conversacional ─────────────────────────────────────────
        let thread_id: string | null = null

        if (cliente) {
          try {
            const { thread_id: tid } = await getOrCreateThread({
              sucursal_id,
              cliente_id:    cliente.id,
              canal:         'whatsapp',
              contexto_tipo: 'general',
              thread_origin: 'inbound',
            })
            thread_id = tid

            await supabase
              .from('conversation_threads')
              .update({
                last_message_at:          new Date().toISOString(),
                last_customer_message_at: new Date().toISOString(),
                last_message_source:      'customer',
                estado:                   'waiting_agent',
              })
              .eq('id', tid)
          } catch {
            // Best-effort: no se pierde el mensaje si el hilo falla
          }
        }

        // ── 4. Persistir mensaje ───────────────────────────────────────────
        const sentAt = new Date(parseInt(msg.timestamp) * 1000).toISOString()

        const { data: msgRow } = await supabase
          .from('mensajes')
          .insert({
            sucursal_id,
            cliente_id:       cliente?.id ?? null,
            canal:            'whatsapp',
            direccion:        'entrante',
            contenido,
            media_url,
            media_tipo,
            thread_id,
            message_source:   'customer',
            wa_message_id:    msg.id,
            processing_status: 'pending',
            enviado_at:       sentAt,
          })
          .select('id')
          .single()

        if (!msgRow?.id) continue

        // ── 5. Clasificación IA (si activa y mensaje de texto) ─────────────
        if (!aiActivo || msg.type !== 'text' || !contenido) continue

        try {
          const [intentResult, sentimentResult] = await Promise.all([
            classifyIntent(contenido),
            detectSentiment(contenido),
          ])

          await supabase
            .from('mensajes')
            .update({
              ai_intent:            intentResult.intent,
              ai_intent_confidence: intentResult.confidence,
              ai_sentiment:         sentimentResult.sentiment,
              processing_status:    'processed',
            })
            .eq('id', msgRow.id)

          // ── 6. Bot de citas (intent agendar_cita con alta confianza) ───────
          if (
            intentResult.intent === 'agendar_cita' &&
            intentResult.confidence >= confidenceThreshold &&
            cliente
          ) {
            // Obtener nombre del cliente para personalizar
            const { data: clienteData } = await supabase
              .from('clientes')
              .select('nombre, apellido')
              .eq('id', cliente.id)
              .single()

            try {
              const botResult = await generarRespuestaBot(contenido, {
                sucursal_id:    sucursal_id,
                cliente_id:     cliente.id,
                cliente_nombre: clienteData ? `${clienteData.nombre} ${clienteData.apellido}`.trim() : null,
                thread_id,
              })

              if (botResult.respuesta) {
                // Obtener teléfono del cliente para enviar WA
                const { data: clienteTel } = await supabase
                  .from('clientes')
                  .select('whatsapp')
                  .eq('id', cliente.id)
                  .single()

                if (clienteTel?.whatsapp) {
                  void enviarMensajeWA({
                    sucursal_id,
                    modulo:         'citas',
                    telefono:       clienteTel.whatsapp,
                    mensaje:        botResult.respuesta,
                    tipo:           'custom',
                    cliente_id:     cliente.id,
                    enviado_por_bot: true,
                    contexto_tipo:  'general',
                    contexto_id:    thread_id ?? undefined,
                  })
                }
              }

              // Actualizar estado del hilo
              if (thread_id) {
                const nuevoEstado = botResult.handoff ? 'waiting_agent' : 'bot_active'
                await supabase
                  .from('conversation_threads')
                  .update({ estado: nuevoEstado })
                  .eq('id', thread_id)
              }
            } catch {
              // Bot falla silenciosamente — el mensaje queda para atención humana
              if (thread_id) {
                await supabase
                  .from('conversation_threads')
                  .update({ estado: 'waiting_agent' })
                  .eq('id', thread_id)
              }
            }
          } else if (thread_id && intentResult.confidence < confidenceThreshold) {
            // Escalar a humano si confianza baja
            await supabase
              .from('conversation_threads')
              .update({ estado: 'waiting_agent' })
              .eq('id', thread_id)
          }
        } catch {
          await supabase
            .from('mensajes')
            .update({ processing_status: 'error' })
            .eq('id', msgRow.id)
        }
      }
    }
  }

  return NextResponse.json({ status: 'ok' })
}
