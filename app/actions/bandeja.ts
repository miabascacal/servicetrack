'use server'

import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ensureUsuario }     from '@/lib/ensure-usuario'
import { getOrCreateThread } from '@/lib/threads'
import { classifyIntent }    from '@/lib/ai/classify-intent'
import { detectSentiment }   from '@/lib/ai/detect-sentiment'
import { generarRespuestaBot, type CitaProxima } from '@/lib/ai/bot-citas'
import { generarRespuestaSimple } from '@/lib/ai/bot-respuestas'
import {
  crearCitaBot,
  crearActividadBot,
  confirmarCitaBot,
  guardarConfirmacionPendiente,
  limpiarConfirmacionPendiente,
  obtenerEscalationAssigneeId,
  type ConfirmacionPendiente,
} from '@/lib/ai/bot-tools'
import {
  getAppointmentFlowState,
  setAppointmentFlowState,
  clearAppointmentFlowState,
  mergeAppointmentFlowState,
  isAfirmacionFlow,
  isFrustracion,
  intentoAgendar,
  nextStep,
  parsearServicio,
  parsearFecha,
  parsearHora,
  parsearPlaca,
  parsearNombre,
  parsearVehiculo,
  parsearSeleccion,
  isNegacion,
  isNoTienePlaca,
  isRechazoCita,
  isSolicitudConfirmacionHumana,
  isSolicitudRecordatorio,
  isClientePlaceholder,
  type AppointmentFlowState,
} from '@/lib/ai/appointment-flow'
import {
  buscarVehiculosCliente,
  crearVehiculoYVincularBot,
  actualizarPlacaVehiculoBot,
  actualizarNombreClienteBot,
  leerInfoSucursal,
} from '@/lib/ai/bot-crm'
import {
  BOTIA_AGENCY_MODULE_KEYWORDS,
  BOTIA_ESCALATION_REASONS,
} from '@/lib/ai/botia-brain'

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

  let sucursal_id: string
  try {
    const ctx = await ensureUsuario(supabase, user.id, user.email ?? '')
    sucursal_id = ctx.sucursal_id
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Error de perfil' }
  }

  const admin = createAdminClient()

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

// ── Slot detection helpers ───────────────────────────────────────────────────

const MESES_ES: Record<string, number> = {
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
  julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
}

/** Extrae fecha+hora+servicio del texto de un mensaje del bot */
function extraerSlotDeTexto(texto: string): ConfirmacionPendiente | null {
  const horaM =
    texto.match(/a\s+las\s+(\d{1,2}):(\d{2})/) ??
    texto.match(/a\s+las\s+(\d{1,2})\b/)        ??
    texto.match(/\b(\d{1,2}):(\d{2})\s*hrs?/)
  if (!horaM) return null
  const hora = horaM[2] !== undefined
    ? `${horaM[1].padStart(2, '0')}:${horaM[2]}`
    : `${horaM[1].padStart(2, '0')}:00`

  const nowMX = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Mexico_City' }))
  let fecha: string | null = null

  if (/mañana/i.test(texto)) {
    const d = new Date(nowMX); d.setDate(d.getDate() + 1)
    fecha = d.toISOString().split('T')[0]
  } else if (/\bhoy\b/i.test(texto)) {
    fecha = nowMX.toISOString().split('T')[0]
  } else {
    const mNat = texto.match(/(\d{1,2})\s+de\s+(\w+)(?:\s+de\s+(\d{4}))?/i)
    if (mNat) {
      const dia = parseInt(mNat[1], 10)
      const mes = MESES_ES[mNat[2].toLowerCase()]
      if (mes !== undefined) {
        const anio = mNat[3] ? parseInt(mNat[3], 10) : nowMX.getFullYear()
        const d = new Date(anio, mes, dia)
        if (d < nowMX) d.setFullYear(d.getFullYear() + 1)
        fecha = d.toISOString().split('T')[0]
      }
    } else {
      const mIso = texto.match(/\b(\d{4}-\d{2}-\d{2})\b/)
      if (mIso) fecha = mIso[1]
    }
  }
  if (!fecha) return null

  let servicio: string | null = null
  const srvMs = [
    ...texto.matchAll(/\bpara\s+(?!mañana|el\s|la\s|hoy|las\s|\d{1,2}:)([A-Za-záéíóúüñÁÉÍÓÚÜÑ0-9][^,.!?:]{2,50})/gi),
  ]
  if (srvMs.length > 0) {
    const cand = srvMs[srvMs.length - 1][1].trim()
    if (!/^\d+:\d+/.test(cand)) servicio = cand.slice(0, 60)
  }
  return { fecha, hora, servicio }
}

/**
 * Escanea mensajes salientes recientes del hilo buscando slot (fecha+hora+servicio).
 * Fallback cuando el LLM omitió llamar a preparar_confirmacion_cita.
 */
async function detectarSlotDesdeHistorial(thread_id: string): Promise<ConfirmacionPendiente | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('mensajes')
    .select('contenido, direccion')
    .eq('thread_id', thread_id)
    .order('enviado_at', { ascending: false })
    .limit(10)

  if (!data) return null
  for (const msg of data) {
    if (msg.direccion !== 'saliente' || !msg.contenido) continue
    const slot = extraerSlotDeTexto(msg.contenido as string)
    if (slot) return slot
  }
  return null
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
 * Retorna true si el texto es una respuesta afirmativa clara del cliente.
 * Usado para el pre-check determinístico de confirmación de cita.
 */
function isAfirmacion(texto: string): boolean {
  const t = texto.toLowerCase().trim().replace(/[¡!¿?.]/g, '').trim()
  const AFFIRMATIVES = [
    'sí', 'si', 'confirmo', 'correcto', 'ok', 'adelante', 'dale',
    'claro', 'de acuerdo', 'perfecto', 'confirmado', 'va', 'sale',
    'ándale', 'andale', 'con gusto', 'listo', 'órale', 'orale',
  ]
  return AFFIRMATIVES.some(a =>
    t === a ||
    t.startsWith(a + ' ') ||
    t.endsWith(' ' + a) ||
    t === a + 's' // "sí" variants
  )
}

/**
 * Parsea la confirmación pendiente desde el objeto metadata del hilo.
 * La metadata viene de Supabase como objeto JS plano (JSONB auto-parsed).
 */
function parsePendingConfirmation(metadata: unknown): ConfirmacionPendiente | null {
  if (!metadata || typeof metadata !== 'object') return null
  const m = metadata as Record<string, unknown>
  const pending = m.confirmacion_pendiente
  if (!pending || typeof pending !== 'object') return null
  const p = pending as Record<string, unknown>
  if (typeof p.fecha !== 'string' || typeof p.hora !== 'string') return null
  return {
    fecha:    p.fecha,
    hora:     p.hora,
    servicio: typeof p.servicio === 'string' && p.servicio ? p.servicio : null,
  }
}

type AgencyModule =
  | 'citas'
  | 'taller'
  | 'refacciones'
  | 'atencion_clientes'
  | 'ventas'
  | 'csi'
  | 'seguros'

function detectAgencyModule(
  message: string,
  intent: string,
): AgencyModule | null {
  const lowered = message.toLowerCase()

  if (intent === 'agendar_cita') return 'citas'
  if (intent === 'consulta_estado_ot' || intent === 'solicitud_taller') return 'taller'
  if (intent === 'solicitud_refacciones') return 'refacciones'
  if (intent === 'solicitud_ventas') return 'ventas'
  if (intent === 'solicitud_csi') return 'csi'
  if (intent === 'solicitud_seguros') return 'seguros'
  if (intent === 'solicitud_atencion_clientes' || intent === 'queja') return 'atencion_clientes'

  for (const [moduleName, keywords] of Object.entries(BOTIA_AGENCY_MODULE_KEYWORDS)) {
    if (keywords.some(keyword => lowered.includes(keyword))) {
      return moduleName as AgencyModule
    }
  }

  return null
}

function formatReminderPolicyResponse(): string {
  return 'Si la automatización está activa, recibirás recordatorio por WhatsApp un día antes de tu cita.\nSi se crea una actividad para asesor, también pueden darte seguimiento por llamada.'
}

async function crearEscalacionAgencia(params: {
  sucursal_id: string
  cliente_id: string
  modulo: AgencyModule
  descripcion: string
  notas?: string | null
  vehiculo_id?: string | null
  cita_id?: string | null
}) {
  const responsableId = await obtenerEscalationAssigneeId(params.sucursal_id)
  await crearActividadBot({
    sucursal_id: params.sucursal_id,
    cliente_id: params.cliente_id,
    tipo: `seguimiento_${params.modulo}`,
    descripcion: params.descripcion,
    prioridad: 'normal',
    modulo_origen: params.modulo,
    notas: params.notas ?? null,
    vehiculo_id: params.vehiculo_id ?? null,
    cita_id: params.cita_id ?? null,
    usuario_asignado_id: responsableId,
  })
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

  // 2. Buscar hilo activo existente (incluye metadata para pre-check determinístico)
  const { data: existingThread } = await admin
    .from('conversation_threads')
    .select('id, estado, metadata')
    .eq('sucursal_id', sucursal_id)
    .eq('cliente_id', cliente.id)
    .eq('canal', 'whatsapp')
    .eq('contexto_tipo', 'general')
    .is('contexto_id', null)
    .in('estado', ['open', 'waiting_customer', 'waiting_agent', 'bot_active'])
    .order('creado_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let thread_id: string
  let threadEstado: string | null = null
  if (existingThread) {
    thread_id    = existingThread.id
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

  // 2b. Buscar cita próxima del cliente para contexto determinístico del bot
  const hoyStr = new Date().toISOString().split('T')[0]
  const { data: citaProximaData } = await admin
    .from('citas')
    .select('id, fecha_cita, hora_cita, estado, servicio')
    .eq('sucursal_id', sucursal_id)
    .eq('cliente_id', cliente.id)
    .not('estado', 'in', '(cancelada,no_show)')
    .gte('fecha_cita', hoyStr)
    .order('fecha_cita', { ascending: true })
    .order('hora_cita', { ascending: true })
    .limit(1)
    .maybeSingle()
  const citaProxima: CitaProxima | null = citaProximaData
    ? {
        id:         citaProximaData.id as string,
        fecha_cita: citaProximaData.fecha_cita as string,
        hora_cita:  citaProximaData.hora_cita as string,
        estado:     citaProximaData.estado as string,
        servicio:   citaProximaData.servicio as string | null,
      }
    : null

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
        processing_status:    'done',
      })
      .eq('id', msgIn.id)
  }

  // 5. Pre-check determinístico: si hay confirmación pendiente y el cliente afirma,
  //    crear la cita directamente sin pasar por el LLM.
  let respuesta = 'En este momento no puedo procesar tu solicitud. Un asesor se pondrá en contacto contigo pronto.'
  let cita_id: string | null = null
  let handoff = false
  let skipBot = false

  // ── P0.2 + P0.1 State machine — deterministic appointment flow ──────────────
  //
  // P0.2: Captures client name (if DEMO placeholder) and resolves vehicle before
  //       proceeding to the P0.1 slot-capture flow (servicio → fecha → hora → confirm).
  // P0.1: Creates cita directly when all slots captured + client confirms, bypassing LLM.
  // Falls through to existing step-5a/5b/5c when state machine doesn't handle it.
  let flowState: AppointmentFlowState | null = getAppointmentFlowState(existingThread?.metadata ?? null)
  const frustrado = isFrustracion(params.mensaje)
  const currentModule = detectAgencyModule(params.mensaje, intentResult.intent)

  if (!skipBot && isSolicitudRecordatorio(params.mensaje)) {
    respuesta = formatReminderPolicyResponse()
    skipBot = true
  }

  if (!skipBot && currentModule && currentModule !== 'citas' && !flowState) {
    const vehiculoDetectado = parsearVehiculo(params.mensaje)
    const placaDetectada = parsearPlaca(params.mensaje)
    const notasModulo = [
      vehiculoDetectado
        ? `Vehiculo: ${vehiculoDetectado.marca} ${vehiculoDetectado.modelo} ${vehiculoDetectado.anio}`
        : null,
      placaDetectada ? `Placa/VIN referencial: ${placaDetectada}` : null,
      `Mensaje original: ${params.mensaje}`,
    ].filter(Boolean).join(' — ')

    if (currentModule === 'refacciones') {
      const tieneVehiculo = vehiculoDetectado || placaDetectada
      const tienePieza = /refaccion|refacciones|pieza|piezas|balata|balatas|filtro|parabrisas|faro|fascia|bateria|amortiguador|llanta/i.test(params.mensaje)

      if (!tienePieza || !tieneVehiculo) {
        respuesta = 'Claro, te ayudo a canalizar tu solicitud con Refacciones.\n¿Qué pieza necesitas y para qué vehículo?'
        skipBot = true
      } else {
        await crearEscalacionAgencia({
          sucursal_id,
          cliente_id: cliente.id as string,
          modulo: 'refacciones',
          descripcion: 'Solicitud de refacciones recibida por BotIA',
          notas: notasModulo,
        })
        respuesta = 'Claro, ya dejé tu solicitud canalizada con Refacciones.\nUn asesor revisará la pieza y te dará seguimiento.'
        handoff = true
        skipBot = true
      }
    } else {
      const reasonMap: Record<Exclude<AgencyModule, 'citas' | 'refacciones'>, string> = {
        taller: BOTIA_ESCALATION_REASONS.TALLER,
        atencion_clientes: BOTIA_ESCALATION_REASONS.ATENCION_CLIENTES,
        ventas: BOTIA_ESCALATION_REASONS.VENTAS,
        csi: BOTIA_ESCALATION_REASONS.CSI,
        seguros: BOTIA_ESCALATION_REASONS.SEGUROS,
      }
      await crearEscalacionAgencia({
        sucursal_id,
        cliente_id: cliente.id as string,
        modulo: currentModule,
        descripcion: `Solicitud de ${currentModule} recibida por BotIA`,
        notas: `${reasonMap[currentModule as Exclude<AgencyModule, 'citas' | 'refacciones'>]} — ${notasModulo}`,
      })

      const messageMap: Record<Exclude<AgencyModule, 'citas' | 'refacciones'>, string> = {
        taller: 'Claro, te ayudo a canalizar tu solicitud con Taller.\nUn asesor revisará tu caso y te dará seguimiento.',
        atencion_clientes: 'Entiendo. Voy a canalizar tu caso con Atención a Clientes para revisarlo contigo.',
        ventas: 'Claro, te ayudo a canalizar tu solicitud con Ventas.\nUn asesor te contactará para continuar.',
        csi: 'Gracias por compartirlo. Voy a canalizar tu comentario con el área correspondiente.',
        seguros: 'Claro, te ayudo a canalizarlo con Seguros.\nUn asesor revisará tu caso y te contactará.',
      }
      respuesta = messageMap[currentModule as Exclude<AgencyModule, 'citas' | 'refacciones'>]
      handoff = true
      skipBot = true
    }
  }

  const shouldProcessFlow =
    flowState !== null ||
    (intentResult.intent === 'agendar_cita' && intentResult.confidence >= 0.5) ||
    intentoAgendar(params.mensaje)

  if (shouldProcessFlow && !citaProxima) {
    if (!flowState) flowState = { step: 'capturar_servicio' }

    // ── Step A: Name capture — DETERMINISTIC, no LLM fallback ───────────────
    //
    // P0.2.1 FIX: Steps A and B now set skipBot=true and generate responses
    // directly instead of relying on the LLM to follow flowInject instructions.
    // Claude Haiku was ignoring flowInject due to conflicting SYSTEM_PROMPT rules.
    if (!flowState.nombre_resuelto) {
      const esPlaceholder = isClientePlaceholder(
        cliente.nombre as string | null,
        cliente.apellido as string | null,
      )

      if (!esPlaceholder) {
        flowState = { ...flowState, nombre_resuelto: true }
        // Fall through to Step B
      } else if (flowState.step !== 'capturar_nombre') {
        // First detection: ask for name
        flowState = { ...flowState, step: 'capturar_nombre' }
        await setAppointmentFlowState(thread_id, flowState)
        respuesta = frustrado
          ? `Disculpa. Para completar tu cita correctamente necesito tu nombre. ¿Cómo te llamas?`
          : `¡Hola! Con gusto te ayudo a agendar tu cita. ¿Me dices tu nombre completo?`
        skipBot = true
      } else {
        // Already in capturar_nombre: try to parse name from this message
        const nombreParsed = parsearNombre(params.mensaje)
        if (nombreParsed) {
          const updResult = await actualizarNombreClienteBot({
            cliente_id: cliente.id as string,
            nombre:     nombreParsed.nombre,
            apellido:   nombreParsed.apellido,
          })
          if (!updResult.ok) {
            respuesta = `No pude guardar tu nombre. Un asesor se pondrá en contacto contigo.`
            skipBot  = true
            handoff  = true
          } else {
            // Update local reference for bot context used in Step 6
            ;(cliente as Record<string, unknown>).nombre  = nombreParsed.nombre
            ;(cliente as Record<string, unknown>).apellido = nombreParsed.apellido
            flowState = { ...flowState, nombre_resuelto: true }
            // Fall through to Step B
          }
        } else {
          // Could not parse name — ask again
          await setAppointmentFlowState(thread_id, flowState)
          respuesta = frustrado
            ? `Disculpa, necesito tu nombre completo (nombre y apellido) para continuar. ¿Cómo te llamas?`
            : `Para continuar necesito tu nombre y apellido. ¿Cómo te llamas? (ejemplo: Juan Pérez)`
          skipBot = true
        }
      }
    }

    // ── Step B: Vehicle resolution — DETERMINISTIC, no LLM fallback ──────────
    //
    // Vehicle is OBLIGATORY for P0.2.1. isNegacion in capturar_vehiculo keeps
    // the user in the same step — skipping vehicle is not allowed.
    if (!skipBot && flowState.nombre_resuelto && !flowState.vehiculo_resuelto) {
      const vehiculoStep = flowState.step

      if (vehiculoStep === 'resolver_vehiculo') {
        const opciones = flowState.vehiculos_opciones ?? []
        const idx      = parsearSeleccion(params.mensaje, opciones.length, opciones)

        if (idx !== null) {
          // Client selected an existing vehicle
          flowState = {
            ...flowState,
            vehiculo_id: opciones[idx].id,
            vehiculo_resuelto: true,
            placa: parsearPlaca(opciones[idx].descripcion),
          }
          // Fall through to Step C
        } else if (isNegacion(params.mensaje)) {
          // Client wants a different vehicle not in the list → capture new one
          flowState = { ...flowState, step: 'capturar_vehiculo', vehiculos_opciones: [] }
          await setAppointmentFlowState(thread_id, flowState)
          respuesta = `Sin problema. ¿Qué vehículo vas a traer? Dime la marca, modelo y año.`
          skipBot   = true
        } else {
          // Maybe gave new vehicle data inline
          const vData = parsearVehiculo(params.mensaje)
          if (vData) {
            const vRes = await crearVehiculoYVincularBot({ grupo_id, cliente_id: cliente.id as string, ...vData })
            if ('id' in vRes) {
              flowState = {
                ...flowState,
                vehiculo_id: vRes.id,
                vehiculo_resuelto: true,
                placa: vData.placa ?? null,
                placa_pendiente: vData.placa ? false : undefined,
              }
              // Fall through to Step C
            } else {
              await setAppointmentFlowState(thread_id, flowState)
              respuesta = `${vRes.error}`
              skipBot   = true
            }
          } else {
            // Could not parse — re-present options
            await setAppointmentFlowState(thread_id, flowState)
            if (opciones.length === 1) {
              respuesta = frustrado
                ? `Disculpa, para completar tu cita necesito confirmar el vehículo: ${opciones[0].descripcion}. ¿Es este tu vehículo? (sí/no)`
                : `¿Tu cita es para el ${opciones[0].descripcion}? (sí/no)`
            } else {
              const lista = opciones.map((o, i) => `${i + 1}) ${o.descripcion}`).join('\n')
              respuesta = `¿Para cuál vehículo es la cita?\n${lista}\n(O dime la marca, modelo y año de otro vehículo)`
            }
            skipBot = true
          }
        }
      } else if (vehiculoStep === 'capturar_vehiculo') {
        const vData = parsearVehiculo(params.mensaje)
        if (vData) {
          const vRes = await crearVehiculoYVincularBot({ grupo_id, cliente_id: cliente.id as string, ...vData })
          if ('id' in vRes) {
            flowState = {
              ...flowState,
              vehiculo_id: vRes.id,
              vehiculo_resuelto: true,
              placa: vData.placa ?? null,
              placa_pendiente: vData.placa ? false : undefined,
            }
            // Fall through to Step C
          } else {
            await setAppointmentFlowState(thread_id, flowState)
            respuesta = `${vRes.error}`
            skipBot   = true
          }
        } else if (isNegacion(params.mensaje)) {
          // Vehicle is required — do not allow skipping
          await setAppointmentFlowState(thread_id, flowState)
          respuesta = `Para agendar una cita necesitamos registrar el vehículo. ¿Cuál es la marca, modelo y año del vehículo que vas a traer? (ejemplo: Honda City 2022)`
          skipBot   = true
        } else {
          await setAppointmentFlowState(thread_id, flowState)
          respuesta = frustrado
            ? `Disculpa, para completar tu cita necesito los datos del vehículo: marca, modelo y año. ¿Cuáles son?`
            : `Para registrar tu cita necesito el vehículo. ¿Cuál es la marca, modelo y año? (ejemplo: Nissan Sentra 2021)`
          skipBot = true
        }
      } else {
        // First time entering vehicle step — load from DB
        const vehiculos = await buscarVehiculosCliente(cliente.id as string)
        if (vehiculos.length === 0) {
          flowState = { ...flowState, step: 'capturar_vehiculo', vehiculos_opciones: [] }
          await setAppointmentFlowState(thread_id, flowState)
          respuesta = frustrado
            ? `Para completar tu cita necesito el vehículo. ¿Cuál es la marca, modelo y año?`
            : `Para registrar tu cita necesito saber qué vehículo traes. ¿Cuál es la marca, modelo y año?`
          skipBot = true
        } else if (vehiculos.length === 1) {
          const desc = `${vehiculos[0].marca} ${vehiculos[0].modelo} ${vehiculos[0].anio}${vehiculos[0].placa ? ` (${vehiculos[0].placa})` : ''}`
          flowState = { ...flowState, step: 'resolver_vehiculo', vehiculos_opciones: [{ id: vehiculos[0].id, descripcion: desc }] }
          await setAppointmentFlowState(thread_id, flowState)
          respuesta = `Tengo registrado el vehículo: *${desc}*. ¿Tu cita es para este vehículo?`
          skipBot = true
        } else {
          const opciones = vehiculos.map(v => ({
            id:          v.id,
            descripcion: `${v.marca} ${v.modelo} ${v.anio}${v.placa ? ` (${v.placa})` : ''}`,
          }))
          flowState = { ...flowState, step: 'resolver_vehiculo', vehiculos_opciones: opciones }
          await setAppointmentFlowState(thread_id, flowState)
          const lista = opciones.map((o, i) => `${i + 1}) ${o.descripcion}`).join('\n')
          respuesta = `Tengo registrados ${opciones.length} vehículos. ¿Para cuál es la cita?\n${lista}`
          skipBot = true
        }
      }
    }

    // ── Step C: Service / fecha / hora / confirmation (P0.1) ─────────────────
    if (!skipBot && flowState.nombre_resuelto && flowState.vehiculo_resuelto && !flowState.placa && !flowState.placa_pendiente) {
      const placaDetectada = parsearPlaca(params.mensaje)

      if (placaDetectada && flowState.vehiculo_id) {
        const updPlaca = await actualizarPlacaVehiculoBot({
          vehiculo_id: flowState.vehiculo_id,
          placa: placaDetectada,
        })
        if (updPlaca.ok) {
          flowState = { ...flowState, placa: placaDetectada, placa_pendiente: false }
        }
      } else if (isNoTienePlaca(params.mensaje)) {
        flowState = { ...flowState, placa_pendiente: true, step: 'capturar_servicio' }
      } else {
        flowState = { ...flowState, step: 'capturar_placa' }
        await setAppointmentFlowState(thread_id, flowState)
        respuesta = `Â¿Me compartes la placa? Si no la tienes a la mano, puedo continuar y dejarla pendiente.`
        skipBot = true
      }
    }

    // Safety gate: only proceed if both name and vehicle are resolved.
    if (!skipBot && flowState.nombre_resuelto && flowState.vehiculo_resuelto) {
      // If coming from a vehicle step, transition to service capture
      const SERVICE_STEPS = new Set([
        'capturar_servicio', 'capturar_fecha', 'capturar_hora', 'esperando_confirmacion',
      ])
      if (!SERVICE_STEPS.has(flowState.step)) {
        flowState = { ...flowState, step: 'capturar_servicio' }
      }

      const newServicio = !flowState.servicio ? parsearServicio(params.mensaje) : null
      const newFecha    = !flowState.fecha    ? parsearFecha(params.mensaje)    : null
      const newHora     = !flowState.hora     ? parsearHora(params.mensaje)     : null

      const patch: Partial<AppointmentFlowState> = { updated_at: new Date().toISOString() }
      if (newServicio) patch.servicio = newServicio
      if (newFecha)    patch.fecha    = newFecha
      if (newHora)     patch.hora     = newHora

      flowState = mergeAppointmentFlowState(flowState, patch)
      flowState = { ...flowState, step: nextStep(flowState) }

      if (flowState.step === 'esperando_confirmacion' && isSolicitudConfirmacionHumana(params.mensaje)) {
        const flowResult = await crearCitaBot({
          sucursal_id,
          cliente_id:  cliente.id as string,
          fecha:       flowState.fecha!,
          hora:        flowState.hora!,
          servicio:    flowState.servicio ?? undefined,
          vehiculo_id: flowState.vehiculo_id ?? undefined,
          confirmada:  false,
          notas: flowState.placa_pendiente ? 'Placa pendiente por compartir por el cliente' : null,
          tipoActividad: 'confirmacion_cita',
        })
        if ('id' in flowResult) {
          cita_id = flowResult.id
          await crearEscalacionAgencia({
            sucursal_id,
            cliente_id: cliente.id as string,
            modulo: 'citas',
            descripcion: 'Cita pendiente de confirmacion humana creada por BotIA',
            notas: `Cliente pidió llamada para confirmar. Cita ${flowState.fecha} ${flowState.hora}${flowState.placa_pendiente ? ' — placa pendiente' : ''}`,
            vehiculo_id: flowState.vehiculo_id ?? null,
            cita_id: flowResult.id,
          })
          respuesta = `Entendido. Dejo tu cita como pendiente de confirmaciÃ³n para que un asesor te contacte.\nAdemÃ¡s, si la automatizaciÃ³n estÃ¡ activa, recibirÃ¡s recordatorio por WhatsApp un dÃ­a antes de tu cita.`
          flowState = { ...flowState, step: 'completado', cita_id: flowResult.id }
          handoff = true
          skipBot = true
        }
      } else if (flowState.step === 'esperando_confirmacion' && isRechazoCita(params.mensaje)) {
        respuesta = `Entendido, no la confirmo.\nSi quieres te ayudo a buscar otro horario o lo canalizo con un asesor.`
        flowState = { ...flowState, step: 'capturar_hora', hora: null }
        skipBot = true
      } else if (flowState.step === 'esperando_confirmacion' && isAfirmacionFlow(params.mensaje)) {
        const flowResult = await crearCitaBot({
          sucursal_id,
          cliente_id:  cliente.id as string,
          fecha:       flowState.fecha!,
          hora:        flowState.hora!,
          servicio:    flowState.servicio ?? undefined,
          vehiculo_id: flowState.vehiculo_id ?? undefined,
          confirmada:  true,
          notas: flowState.placa_pendiente ? 'Placa pendiente por compartir por el cliente' : null,
        })
        if ('id' in flowResult) {
          cita_id = flowResult.id
          const fechaLeg = new Date(flowState.fecha! + 'T12:00:00').toLocaleDateString('es-MX', {
            weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Mexico_City',
          })
          const srv = flowState.servicio ? ` para ${flowState.servicio}` : ''
          respuesta = `¡Listo! Tu cita${srv} ha sido confirmada para el ${fechaLeg} a las ${flowState.hora} hrs. ¡Hasta pronto!`
          flowState = { ...flowState, step: 'completado', cita_id: flowResult.id }
          skipBot   = true
        }
        // If crearCitaBot returned an error (slot taken etc.) fall through to LLM
      }
    }

    // Persist state
    if (flowState.step === 'completado' || flowState.step === 'escalado') {
      await clearAppointmentFlowState(thread_id)
      await limpiarConfirmacionPendiente(thread_id)
    } else if (!skipBot) {
      await setAppointmentFlowState(thread_id, flowState)
    }
  }

  const pendingConf = parsePendingConfirmation(existingThread?.metadata)

  if (!skipBot && pendingConf && isSolicitudConfirmacionHumana(params.mensaje)) {
    const result = await crearCitaBot({
      sucursal_id,
      cliente_id: cliente.id,
      fecha:      pendingConf.fecha,
      hora:       pendingConf.hora,
      servicio:   pendingConf.servicio ?? undefined,
      vehiculo_id: flowState?.vehiculo_id ?? null,
      confirmada: false,
      notas: flowState?.placa_pendiente ? 'Placa pendiente por compartir por el cliente' : null,
      tipoActividad: 'confirmacion_cita',
    })
    if ('id' in result) {
      cita_id = result.id
      await crearEscalacionAgencia({
        sucursal_id,
        cliente_id: cliente.id as string,
        modulo: 'citas',
        descripcion: 'Cita pendiente de confirmacion humana creada por BotIA',
        notas: `Cliente pidió llamada para confirmar. Cita ${pendingConf.fecha} ${pendingConf.hora}${flowState?.placa_pendiente ? ' — placa pendiente' : ''}`,
        vehiculo_id: flowState?.vehiculo_id ?? null,
        cita_id: result.id,
      })
      respuesta = `Entendido. Dejo tu cita como pendiente de confirmaciÃ³n para que un asesor te contacte.\nAdemÃ¡s, si la automatizaciÃ³n estÃ¡ activa, recibirÃ¡s recordatorio por WhatsApp un dÃ­a antes de tu cita.`
      handoff = true
      skipBot = true
      await limpiarConfirmacionPendiente(thread_id)
    }
  } else if (!skipBot && pendingConf && isAfirmacion(params.mensaje)) {
    const result = await crearCitaBot({
      sucursal_id,
      cliente_id: cliente.id,
      fecha:      pendingConf.fecha,
      hora:       pendingConf.hora,
      servicio:   pendingConf.servicio ?? undefined,
      vehiculo_id: flowState?.vehiculo_id ?? null,
      confirmada: true,
      notas: flowState?.placa_pendiente ? 'Placa pendiente por compartir por el cliente' : null,
    })
    if ('id' in result) {
      cita_id  = result.id
      const fechaLegible = new Date(pendingConf.fecha + 'T12:00:00').toLocaleDateString('es-MX', {
        weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Mexico_City',
      })
      const srv = pendingConf.servicio ? ` para ${pendingConf.servicio}` : ''
      respuesta = `¡Listo! Tu cita${srv} ha sido confirmada para el ${fechaLegible} a las ${pendingConf.hora} hrs. ¡Hasta pronto! 🎉`
      skipBot   = true
      // Clear pending state now that cita is created
      await limpiarConfirmacionPendiente(thread_id)
    }
    // If crearCitaBot returned an error (slot taken, etc.) fall through to bot
  }

  // 5b. Fallback determinístico para cita existente:
  // Si el cliente dice que sí pero no había confirmacion_pendiente (nuevo slot),
  // verificar si tiene exactamente una cita próxima activa y confirmarla.
  // Guard: skip if flowState is active (affirmation belongs to the appointment flow).
  if (!skipBot && !flowState && isAfirmacion(params.mensaje)) {
    const hoy = new Date().toISOString().split('T')[0]
    const { data: citasActivas } = await admin
      .from('citas')
      .select('id, fecha_cita, hora_cita, servicio')
      .eq('sucursal_id', sucursal_id)
      .eq('cliente_id', cliente.id)
      .in('estado', ['pendiente_contactar', 'contactada'])
      .gte('fecha_cita', hoy)
      .order('fecha_cita', { ascending: true })
      .limit(2)

    if (citasActivas && citasActivas.length === 1) {
      const cita  = citasActivas[0]
      const cr    = await confirmarCitaBot({ cita_id: cita.id, sucursal_id })
      if (cr.ok) {
        const fechaLeg = new Date((cita.fecha_cita as string) + 'T12:00:00').toLocaleDateString('es-MX', {
          weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Mexico_City',
        })
        const hora = (cita.hora_cita as string).slice(0, 5)
        const srv  = cita.servicio ? ` para ${cita.servicio}` : ''
        respuesta = `¡Perfecto! Tu asistencia${srv} ha sido confirmada para el ${fechaLeg} a las ${hora} hrs. ¡Hasta pronto!`
        skipBot   = true
      }
    }
  }

  // 5c. Slot detection fallback: cliente dijo "sí" pero no había confirmacion_pendiente.
  //     Detectar fecha+hora+servicio de los mensajes previos del bot y crear cita.
  // Guard: skip if flowState is active.
  if (!skipBot && !flowState && isAfirmacion(params.mensaje)) {
    const detectedSlot = await detectarSlotDesdeHistorial(thread_id)
    if (detectedSlot) {
      await guardarConfirmacionPendiente({
        thread_id,
        fecha:    detectedSlot.fecha,
        hora:     detectedSlot.hora,
        servicio: detectedSlot.servicio ?? undefined,
      })
      const slotResult = await crearCitaBot({
        sucursal_id,
        cliente_id: cliente.id,
        fecha:      detectedSlot.fecha,
        hora:       detectedSlot.hora,
        servicio:   detectedSlot.servicio ?? undefined,
        confirmada: true,
      })
      if ('id' in slotResult) {
        cita_id  = slotResult.id
        const fechaLegible = new Date(detectedSlot.fecha + 'T12:00:00').toLocaleDateString('es-MX', {
          weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Mexico_City',
        })
        const srv = detectedSlot.servicio ? ` para ${detectedSlot.servicio}` : ''
        respuesta = `¡Listo! Tu cita${srv} ha sido confirmada para el ${fechaLegible} a las ${detectedSlot.hora} hrs. ¡Te esperamos!`
        skipBot   = true
      }
      await limpiarConfirmacionPendiente(thread_id)
    }
  }

  // 6. Generar respuesta del bot (si no se resolvió determinísticamente)
  if (!skipBot) {
    // Load sucursal info for location/hours questions — best-effort
    const infoSucursal = await leerInfoSucursal(sucursal_id).catch(() => null)

    const clienteNombre = [
      (cliente as Record<string, unknown>).nombre,
      (cliente as Record<string, unknown>).apellido,
    ].filter(Boolean).join(' ') || null

    const ctx = {
      sucursal_id,
      cliente_id:              cliente.id as string,
      cliente_nombre:          clienteNombre,
      thread_id,
      intent_tipo:             intentResult.intent,
      confirmacion_pendiente:  pendingConf,
      cita_proxima:            citaProxima,
      appointment_flow:        flowState,
      es_frustracion:          frustrado,
      info_sucursal:           infoSucursal,
    }

    const isBotActive = threadEstado === 'bot_active'
    const usarBotCompleto =
      isBotActive ||
      !!citaProxima ||
      !!flowState ||
      (intentResult.intent === 'agendar_cita'        && intentResult.confidence >= 0.6) ||
      (intentResult.intent === 'confirmar_asistencia' && intentResult.confidence >= 0.5) ||
      (intentResult.intent === 'consulta_cita_propia' && intentResult.confidence >= 0.5)

    let existingConfirmed = false
    if (usarBotCompleto) {
      const botResult   = await generarRespuestaBot(params.mensaje, ctx)
      respuesta         = botResult.respuesta
      cita_id           = botResult.cita_id
      handoff           = botResult.handoff
      existingConfirmed = botResult.existing_confirmed
    } else {
      const botResult = generarRespuestaSimple({
        intent:         intentResult.intent,
        sentiment:      sentimentResult.sentiment,
        cliente_nombre: ctx.cliente_nombre,
      })
      respuesta = botResult.respuesta
      handoff   = botResult.handoff
    }

    // Guardrail: si el bot dice "confirmada/agendada" sin cita real ni herramienta exitosa → escalar.
    const FRASES_CREACION_FALSA = [
      'te agend', 'cita confirmada', 'quedó confirmada', 'quedó agendada',
      'queda confirmada', 'queda agendada', 'está confirmada', 'está agendada',
    ]
    if (
      !existingConfirmed &&
      !cita_id &&
      FRASES_CREACION_FALSA.some(f => respuesta.toLowerCase().includes(f))
    ) {
      respuesta = 'Para cerrar tu cita necesito confirmar un dato más con un asesor. Te canalizo para que la agenda quede correctamente registrada.'
      handoff   = true
    }
  }

  // 7. Persistir respuesta del bot
  const { error: botMsgError } = await admin
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
      processing_status: 'done',
      enviado_at:        new Date().toISOString(),
    })

  if (botMsgError) {
    console.error('[simularMensajeAction] error al guardar respuesta del bot:', botMsgError)
    return {
      ok:    false,
      error: `Error guardando respuesta del bot: ${botMsgError.message}`,
      cita_id,
      handoff,
      thread_id,
      cliente_id: cliente.id,
    }
  }

  // 8. Actualizar estado del hilo
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

// ── Asesor responde en una conversación abierta ──────────────────────────────

export async function enviarMensajeAsesorAction(params: {
  thread_id: string
  contenido: string
}): Promise<{ ok: boolean; error?: string }> {
  if (!params.thread_id || !params.contenido.trim()) {
    return { ok: false, error: 'Parámetros inválidos' }
  }

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
    .select('id, sucursal_id, cliente_id')
    .eq('id', params.thread_id)
    .single()

  if (!thread || thread.sucursal_id !== sucursal_id) {
    return { ok: false, error: 'Hilo no encontrado o sin acceso' }
  }

  const now = new Date().toISOString()

  const { error: msgError } = await admin
    .from('mensajes')
    .insert({
      sucursal_id,
      cliente_id:        thread.cliente_id,
      canal:             'whatsapp',
      direccion:         'saliente',
      contenido:         params.contenido.trim(),
      thread_id:         params.thread_id,
      message_source:    'agent_manual',
      enviado_por_bot:   false,
      processing_status: 'done',
      enviado_at:        now,
    })

  if (msgError) return { ok: false, error: msgError.message }

  await admin
    .from('conversation_threads')
    .update({
      last_message_at:     now,
      last_message_source: 'agent_manual',
    })
    .eq('id', params.thread_id)

  return { ok: true }
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
