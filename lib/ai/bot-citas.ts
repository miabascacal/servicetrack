/**
 * Bot conversacional Ara — agencia automotriz.
 *
 * PRIORIDADES del bot (en orden):
 *   1. Seguimiento de citas YA agendadas: confirmar, recordar, detectar falta de contacto
 *   2. Agendar citas nuevas si el cliente no tiene ninguna
 *   3. Escalar a asesor cuando no puede resolver
 *
 * Activación: requiere ai_settings.activo = TRUE + wa_numeros configurado.
 * El loop agéntico se activa cuando el hilo está en bot_active O cuando
 * classify-intent detecta agendar_cita / confirmar_asistencia / consulta_cita_propia.
 */

import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  buscarDisponibilidad,
  crearCitaBot,
  consultarCitasCliente,
  confirmarCitaBot,
} from './bot-tools'

const client = new Anthropic()

const SYSTEM_PROMPT = `Eres Ara, el asistente virtual de una agencia automotriz en México.

PRIORIDADES (en orden estricto):
1. Seguimiento de citas YA agendadas del cliente (confirmar, recordar, dar detalles)
2. Agendar citas nuevas solo si el cliente no tiene ninguna próxima

━━━ PRIMERA INTERACCIÓN (historial vacío) ━━━
SIEMPRE llama primero a consultar_citas_cliente antes de responder.
• Si tiene cita próxima en estado 'pendiente_contactar' o 'contactada':
  → Saluda, menciona la cita (fecha y hora) y pregunta: "¿Confirmas tu asistencia?"
• Si tiene cita ya confirmada:
  → Saluda, da un recordatorio breve (fecha, hora) y cierra con "¿En qué más puedo ayudarte?"
• Si NO tiene citas:
  → Saluda y ofrece agendar una nueva

━━━ FLUJO DE CONFIRMACIÓN DE CITA EXISTENTE ━━━
1. Cuando el cliente confirma ("sí", "confirmo", "ahí estaré", "claro", "de acuerdo"):
   → Llama a confirmar_cita_cliente con el cita_id correspondiente
   → Después de confirmar_cita_cliente exitosa: da mensaje de confirmación con fecha/hora
     y termina con "Hasta pronto, ¡nos vemos!" — NO hagas más preguntas
2. Cuando el cliente NO puede ir:
   → Transfiere con escalar_a_asesor con razon "cliente no puede asistir a su cita"

━━━ FLUJO DE AGENDAMIENTO NUEVO ━━━
PASO 1. Pregunta el servicio o motivo (si no lo dio)
PASO 2. Pregunta la fecha deseada (si no la dio)
PASO 3. Con la fecha, llama SIEMPRE a buscar_disponibilidad — NUNCA propongas horarios sin esta herramienta
PASO 4. Presenta máximo 5 horarios disponibles y pide que elija uno
PASO 5. Confirma: "¿Confirmas tu cita el [fecha legible] a las [hora] para [servicio]?"
PASO 6. Solo con confirmación explícita del cliente, llama a crear_cita
   → Después de crear_cita exitosa: da el mensaje de confirmación con todos los datos
     y termina con "Hasta pronto" — NO hagas más preguntas
   → CRÍTICO: llama a crear_cita SOLO UNA VEZ. Si ya fue creada, NO la vuelvas a crear

━━━ REGLAS GENERALES ━━━
- Responde en español, tono amigable y breve — máximo 3 líneas por mensaje
- Haz UNA sola pregunta a la vez
- NO repitas preguntas por datos que el cliente ya dio en mensajes anteriores
- Si el cliente pide hablar con una persona → escalar_a_asesor
- Si no puedes resolver algo o el cliente está molesto → escalar_a_asesor
- Usa formato YYYY-MM-DD internamente; muestra fechas legibles al cliente ("jueves 15 de mayo")
- Horario de atención: lunes a viernes 8:00–18:00, sábados 9:00–14:00
- Para recoger tu vehículo trae: factura/tarjeta de circulación, identificación oficial y llaves`

export interface BotMensaje {
  role:    'user' | 'assistant'
  content: string
}

export interface BotContexto {
  sucursal_id:    string
  cliente_id:     string | null
  cliente_nombre: string | null
  thread_id:      string | null
}

export interface BotResultado {
  respuesta: string
  cita_id:   string | null
  handoff:   boolean
}

async function cargarHistorial(thread_id: string, limite = 14): Promise<BotMensaje[]> {
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('mensajes')
    .select('direccion, contenido')
    .eq('thread_id', thread_id)
    .not('contenido', 'is', null)
    .order('enviado_at', { ascending: false })
    .limit(limite)

  if (!data) return []

  return data
    .reverse()
    .map(m => ({
      role:    (m.direccion === 'entrante' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: (m.contenido as string) ?? '',
    }))
    .filter(m => m.content.length > 0)
}

export async function generarRespuestaBot(
  mensajeCliente: string,
  ctx: BotContexto,
): Promise<BotResultado> {
  const historial = ctx.thread_id
    ? await cargarHistorial(ctx.thread_id)
    : []

  const nombreCliente = ctx.cliente_nombre ?? 'cliente'
  const esPrimeraInteraccion = historial.length === 0

  const tools: Anthropic.Tool[] = [
    {
      name:        'consultar_citas_cliente',
      description: 'Consulta las citas agendadas del cliente (últimos 30 días y próximas). Úsala siempre al inicio de la primera interacción para saber si el cliente ya tiene cita.',
      input_schema: {
        type:       'object' as const,
        properties: {},
        required:   [],
      },
    },
    {
      name:        'confirmar_cita_cliente',
      description: 'Confirma la asistencia del cliente a una cita ya agendada. Llama solo cuando el cliente diga explícitamente que sí asistirá.',
      input_schema: {
        type:       'object' as const,
        properties: {
          cita_id: {
            type:        'string',
            description: 'ID de la cita a confirmar (obtenido de consultar_citas_cliente)',
          },
        },
        required: ['cita_id'],
      },
    },
    {
      name:        'buscar_disponibilidad',
      description: 'Busca los horarios disponibles para una fecha. Úsala siempre antes de proponer horarios para una cita nueva.',
      input_schema: {
        type:       'object' as const,
        properties: {
          fecha: {
            type:        'string',
            description: 'Fecha en formato YYYY-MM-DD. Debe ser hoy o posterior.',
          },
        },
        required: ['fecha'],
      },
    },
    {
      name:        'crear_cita',
      description: 'Crea una cita NUEVA una vez que el cliente confirmó explícitamente fecha, hora y servicio. Llama SOLO UNA VEZ por conversación.',
      input_schema: {
        type:       'object' as const,
        properties: {
          fecha:    { type: 'string', description: 'Fecha en formato YYYY-MM-DD' },
          hora:     { type: 'string', description: 'Hora en formato HH:MM (24h)' },
          servicio: { type: 'string', description: 'Tipo de servicio (opcional)' },
        },
        required: ['fecha', 'hora'],
      },
    },
    {
      name:        'escalar_a_asesor',
      description: 'Escala la conversación a un asesor humano. Úsala cuando el cliente lo pida o cuando no puedas resolver.',
      input_schema: {
        type:       'object' as const,
        properties: {
          razon: { type: 'string', description: 'Motivo breve del escalamiento' },
        },
        required: ['razon'],
      },
    },
  ]

  const messages: Anthropic.MessageParam[] = [
    ...historial.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user', content: mensajeCliente },
  ]

  let cita_id: string | null = null
  let handoff = false
  let respuesta = 'En este momento no puedo procesar tu solicitud. Un asesor se pondrá en contacto contigo pronto.'

  // Indica al modelo si es la primera interacción para que llame a consultar_citas_cliente
  const systemPrimer = esPrimeraInteraccion
    ? `\n\n[SISTEMA] Primera interacción. Llama AHORA a consultar_citas_cliente antes de responder.`
    : ''

  const systemFull = SYSTEM_PROMPT
    + (nombreCliente !== 'cliente' ? `\n\nEl cliente se llama ${nombreCliente}.` : '')
    + systemPrimer

  // Agentic loop — máximo 8 iteraciones
  for (let i = 0; i < 8; i++) {
    const response = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 600,
      system:     systemFull,
      tools,
      messages,
    })

    if (response.stop_reason === 'end_turn') {
      const textBlock = response.content.find(b => b.type === 'text')
      if (textBlock?.type === 'text') respuesta = textBlock.text
      break
    }

    if (response.stop_reason !== 'tool_use') break

    messages.push({ role: 'assistant', content: response.content })
    const toolResults: Anthropic.ToolResultBlockParam[] = []

    for (const block of response.content) {
      if (block.type !== 'tool_use') continue

      const input    = block.input as Record<string, string>
      let toolResult = ''

      switch (block.name) {
        case 'consultar_citas_cliente': {
          if (!ctx.cliente_id) {
            toolResult = 'No se pudo identificar al cliente en el sistema.'
          } else {
            const result = await consultarCitasCliente({
              sucursal_id: ctx.sucursal_id,
              cliente_id:  ctx.cliente_id,
            })
            toolResult = result.mensaje
          }
          break
        }

        case 'confirmar_cita_cliente': {
          const citaId = input.cita_id ?? ''
          if (!citaId) {
            toolResult = 'Se requiere el ID de la cita para confirmarla.'
          } else {
            const result = await confirmarCitaBot({
              cita_id:     citaId,
              sucursal_id: ctx.sucursal_id,
            })
            toolResult = result.ok
              ? `SISTEMA: ${result.mensaje} — Ahora da al cliente el mensaje de confirmación final y termina la conversación.`
              : result.mensaje
          }
          break
        }

        case 'buscar_disponibilidad': {
          const disp = await buscarDisponibilidad(ctx.sucursal_id, input.fecha ?? '')
          toolResult = disp.mensaje
          break
        }

        case 'crear_cita': {
          // Guard: prevent duplicate creation in the same agentic loop
          if (cita_id) {
            toolResult = `SISTEMA: La cita ya fue creada (id: ${cita_id}). No crear de nuevo. Da el mensaje de confirmación final al cliente y termina.`
          } else if (!ctx.cliente_id) {
            toolResult = 'Error: cliente no identificado en el sistema. Escala a asesor.'
            handoff = true
          } else {
            const result = await crearCitaBot({
              sucursal_id: ctx.sucursal_id,
              cliente_id:  ctx.cliente_id,
              fecha:       input.fecha ?? '',
              hora:        input.hora  ?? '',
              servicio:    input.servicio,
            })
            if ('error' in result) {
              toolResult = result.error
            } else {
              cita_id    = result.id
              // Instruction to model: generate confirmation text and stop
              toolResult = `SISTEMA: ${result.confirmacion} — Ahora da al cliente el mensaje de confirmación final (incluye fecha, hora y servicio) y termina con "Hasta pronto". NO llames ninguna herramienta más.`
            }
          }
          break
        }

        case 'escalar_a_asesor': {
          handoff    = true
          toolResult = `Escalamiento registrado: ${input.razon}`
          break
        }

        default:
          toolResult = 'Herramienta desconocida.'
      }

      toolResults.push({
        type:        'tool_result',
        tool_use_id: block.id,
        content:     toolResult,
      })
    }

    messages.push({ role: 'user', content: toolResults })

    // After cita confirmed or created, allow ONE more model response (the confirmation text)
    // then exit — prevents the bot from looping back into questions.
    if (cita_id && !handoff) {
      // Continue loop once more so model generates the final text response, then it will end_turn
    }
  }

  return { respuesta, cita_id, handoff }
}
