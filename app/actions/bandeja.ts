'use server'

import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ensureUsuario }     from '@/lib/ensure-usuario'
import { getOrCreateThread } from '@/lib/threads'
import { classifyIntent }    from '@/lib/ai/classify-intent'
import { detectSentiment }   from '@/lib/ai/detect-sentiment'
import { generarRespuestaBot }    from '@/lib/ai/bot-citas'
import { generarRespuestaSimple } from '@/lib/ai/bot-respuestas'

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

// ── Demo: Simular mensaje entrante por WhatsApp ───────────────────────────────

export interface SimularResult {
  ok:         boolean
  intent?:    string
  sentiment?: string
  respuesta?: string
  cita_id?:   string | null
  handoff?:   boolean
  thread_id?: string
  cliente_id?: string
  error?:     string
}

/**
 * Simula un mensaje entrante de WhatsApp sin necesidad de número Meta activo.
 * Crea o reutiliza un cliente DEMO por teléfono, persiste en mensajes,
 * clasifica intent + sentiment, y genera respuesta del bot.
 * Uso exclusivo en modo demo — no envía WA real.
 */
export async function simularMensajeAction(params: {
  telefono: string
  mensaje:  string
}): Promise<SimularResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No autorizado' }

  let sucursal_id: string
  let grupo_id: string
  try {
    const ctx = await ensureUsuario(supabase, user.id, user.email ?? '')
    sucursal_id = ctx.sucursal_id
    grupo_id    = ctx.grupo_id
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error de perfil' }
  }

  // Misma normalización que clientes.ts — WA se guarda como +52XXXXXXXXXX
  const digits = params.telefono.replace(/\D/g, '')
  let waFormateado: string
  if (digits.length === 10) waFormateado = '+52' + digits
  else if (digits.length === 12 && digits.startsWith('52')) waFormateado = '+' + digits
  else if (digits.length === 13 && digits.startsWith('521')) waFormateado = '+' + digits
  else return { ok: false, error: 'Teléfono inválido: ingresa 10 dígitos (sin código de país)' }

  const admin = createAdminClient()

  // 1. Buscar o crear cliente.
  // UNIQUE(grupo_id, whatsapp) — columnas reales: grupo_id, nombre, apellido, whatsapp, activo.
  // No existen sucursal_id ni sucursal_origen_id en el schema desplegado.
  let { data: cliente } = await admin
    .from('clientes')
    .select('id, nombre, apellido')
    .eq('grupo_id', grupo_id)
    .eq('whatsapp', waFormateado)
    .maybeSingle()

  if (!cliente) {
    const { data: nuevo, error: insertError } = await admin
      .from('clientes')
      .insert({
        grupo_id,
        nombre:   'CLIENTE',
        apellido: 'DEMO',
        whatsapp: waFormateado,
        activo:   true,
      })
      .select('id, nombre, apellido')
      .single()
    if (insertError) {
      return { ok: false, error: `Error creando cliente demo: ${insertError.message}` }
    }
    cliente = nuevo
  }

  if (!cliente) return { ok: false, error: 'No se pudo resolver el cliente' }

  void sucursal_id // usado en getOrCreateThread más abajo

  // 2. Buscar hilo activo existente (incluye bot_active)
  // Leemos también `estado` para decidir el routing multi-turno más abajo.
  const { data: existingThread } = await admin
    .from('conversation_threads')
    .select('id, estado')
    .eq('sucursal_id', sucursal_id)
    .eq('cliente_id', cliente.id)
    .eq('canal', 'whatsapp')
    .eq('contexto_tipo', 'general')
    .is('contexto_id', null)
    .in('estado', ['open', 'waiting_customer', 'waiting_agent', 'bot_active'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let thread_id: string
  let threadEstado: string | null = null
  if (existingThread) {
    thread_id  = existingThread.id
    threadEstado = existingThread.estado
  } else {
    const result = await getOrCreateThread({
      sucursal_id,
      cliente_id: cliente.id,
      canal: 'whatsapp',
      contexto_tipo: 'general',
      thread_origin: 'inbound',
    })
    thread_id = result.thread_id
  }

  // 3. Insertar mensaje entrante del cliente
  const { data: msgIn } = await admin
    .from('mensajes')
    .insert({
      sucursal_id,
      cliente_id:         cliente.id,
      canal:              'whatsapp',
      direccion:          'entrante',
      contenido:          params.mensaje,
      thread_id,
      message_source:     'customer',
      processing_status:  'pending',
      enviado_at:         new Date().toISOString(),
    })
    .select('id')
    .single()

  // 4. Clasificar intent + sentiment en paralelo
  const [intentResult, sentimentResult] = await Promise.all([
    classifyIntent(params.mensaje),
    detectSentiment(params.mensaje),
  ])

  if (msgIn) {
    await admin
      .from('mensajes')
      .update({
        ai_intent:            intentResult.intent,
        ai_intent_confidence: intentResult.confidence,
        ai_sentiment:         sentimentResult.sentiment,
        processing_status:    'processed',
      })
      .eq('id', msgIn.id)
  }

  // 5. Generar respuesta del bot
  const ctx = {
    sucursal_id,
    cliente_id:     cliente.id,
    cliente_nombre: `${cliente.nombre} ${cliente.apellido}`.trim(),
    thread_id,
  }

  let respuesta: string
  let cita_id: string | null = null
  let handoff = false

  // Routing multi-turno:
  // - Si el hilo ya está en manos del bot (bot_active), siempre usar el loop agéntico
  //   para que el bot recuerde el contexto y continúe donde se quedó.
  // - Si es un hilo nuevo, solo activar el bot completo para intención de agendar cita.
  const isBotActive = threadEstado === 'bot_active'
  const usarBotCompleto =
    isBotActive ||
    (intentResult.intent === 'agendar_cita' && intentResult.confidence >= 0.6)

  if (usarBotCompleto) {
    const botResult = await generarRespuestaBot(params.mensaje, ctx)
    respuesta = botResult.respuesta
    cita_id   = botResult.cita_id
    handoff   = botResult.handoff
  } else {
    const botResult = generarRespuestaSimple({
      intent:         intentResult.intent,
      sentiment:      sentimentResult.sentiment,
      cliente_nombre: ctx.cliente_nombre,
    })
    respuesta = botResult.respuesta
    handoff   = botResult.handoff
  }

  // 6. Persistir respuesta del bot
  await admin
    .from('mensajes')
    .insert({
      sucursal_id,
      cliente_id:        cliente.id,
      canal:             'whatsapp',
      direccion:         'saliente',
      contenido:         respuesta,
      thread_id,
      message_source:    'agent_bot',
      enviado_por_bot:   true,
      processing_status: 'skipped',
      enviado_at:        new Date().toISOString(),
    })

  // 7. Actualizar estado del hilo
  const nuevoEstado = handoff ? 'waiting_agent' : 'bot_active'
  await admin
    .from('conversation_threads')
    .update({
      estado:              nuevoEstado,
      last_message_at:     new Date().toISOString(),
      last_message_source: 'agent_bot',
    })
    .eq('id', thread_id)

  return {
    ok:         true,
    intent:     intentResult.intent,
    sentiment:  sentimentResult.sentiment,
    respuesta,
    cita_id,
    handoff,
    thread_id,
    cliente_id: cliente.id,
  }
}

// ── Tomar conversación (asesor asume hilo del bot) ────────────────────────────

/**
 * Asesor toma una conversación que estaba en manos del bot o esperando asesor.
 * Mueve el hilo a 'open' y asigna el asesor actual.
 */
export async function tomarConversacionAction(
  thread_id: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!thread_id) return { ok: false, error: 'thread_id requerido' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No autorizado' }

  let sucursal_id: string
  try {
    const ctx = await ensureUsuario(supabase, user.id, user.email ?? '')
    sucursal_id = ctx.sucursal_id
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error de perfil' }
  }

  const admin = createAdminClient()

  const { data: thread } = await admin
    .from('conversation_threads')
    .select('id, sucursal_id')
    .eq('id', thread_id)
    .single()

  if (!thread || thread.sucursal_id !== sucursal_id) {
    return { ok: false, error: 'Hilo no encontrado o sin acceso' }
  }

  const { error } = await admin
    .from('conversation_threads')
    .update({ estado: 'open', assignee_id: user.id })
    .eq('id', thread_id)

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
