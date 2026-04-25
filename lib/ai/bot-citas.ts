/**
 * Bot conversacional para agendar citas por WhatsApp.
 * Usa Claude Haiku con tool_use para conducir el flujo de agendamiento.
 *
 * Activación: requiere ai_settings.activo = TRUE en la sucursal + wa_numeros configurado.
 * El bot sólo toma el hilo cuando classify-intent devuelve 'agendar_cita' con alta confianza.
 */

import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import { buscarDisponibilidad, crearCitaBot } from './bot-tools'

const client = new Anthropic()

const SYSTEM_PROMPT = `Eres el asistente virtual de citas de una agencia automotriz en México.
Tu único propósito es ayudar a agendar citas de servicio vehicular.

Reglas:
- Responde siempre en español, de manera amigable y breve (máximo 3-4 líneas por mensaje)
- Necesitas para agendar: fecha y hora. El tipo de servicio es opcional.
- Pregunta de a una cosa por mensaje
- Antes de crear la cita, confirma los datos: "¿Confirmas tu cita el [fecha] a las [hora] para [servicio]?"
- Una vez confirmado, usa la herramienta crear_cita
- Si el cliente pide hablar con una persona, escala inmediatamente
- Si no puedes resolver algo o el cliente está molesto, escala a un asesor
- Usa formato de fecha YYYY-MM-DD (ej: 2026-05-15)
- Los horarios disponibles los obtienes con la herramienta buscar_disponibilidad
- No inventes horarios ni confirmes disponibilidad sin usar la herramienta`

export interface BotMensaje {
  role: 'user' | 'assistant'
  content: string
}

export interface BotContexto {
  sucursal_id: string
  cliente_id: string | null
  cliente_nombre: string | null
  thread_id: string | null
}

export interface BotResultado {
  respuesta: string
  cita_id: string | null
  handoff: boolean
}

async function cargarHistorial(thread_id: string, limite = 10): Promise<BotMensaje[]> {
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
      role: (m.direccion === 'entrante' ? 'user' : 'assistant') as 'user' | 'assistant',
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

  const tools: Anthropic.Tool[] = [
    {
      name: 'buscar_disponibilidad',
      description: 'Busca los horarios disponibles para una fecha. Úsala siempre antes de proponer horarios.',
      input_schema: {
        type: 'object' as const,
        properties: {
          fecha: {
            type: 'string',
            description: 'Fecha en formato YYYY-MM-DD. Debe ser hoy o posterior.',
          },
        },
        required: ['fecha'],
      },
    },
    {
      name: 'crear_cita',
      description: 'Crea la cita una vez que el cliente confirmó explícitamente los datos.',
      input_schema: {
        type: 'object' as const,
        properties: {
          fecha: { type: 'string', description: 'Fecha en formato YYYY-MM-DD' },
          hora: { type: 'string', description: 'Hora en formato HH:MM (24h)' },
          servicio: { type: 'string', description: 'Tipo de servicio (opcional)' },
        },
        required: ['fecha', 'hora'],
      },
    },
    {
      name: 'escalar_a_asesor',
      description: 'Escala la conversación a un asesor humano. Úsala cuando el cliente lo pida o no puedas ayudar.',
      input_schema: {
        type: 'object' as const,
        properties: {
          razon: { type: 'string', description: 'Motivo breve del escalamiento' },
        },
        required: ['razon'],
      },
    },
  ]

  // Construir historial para Claude (sin el mensaje actual — se agrega como último 'user')
  const messages: Anthropic.MessageParam[] = [
    ...historial.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user', content: mensajeCliente },
  ]

  let cita_id: string | null = null
  let handoff = false
  let respuesta = 'En este momento no puedo procesar tu solicitud. Un asesor se pondrá en contacto contigo.'

  // Agentic loop — máximo 6 iteraciones
  for (let i = 0; i < 6; i++) {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: SYSTEM_PROMPT + (ctx.cliente_nombre
        ? `\n\nEl cliente se llama ${nombreCliente}.`
        : ''),
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

      const input = block.input as Record<string, string>
      let toolResult = ''

      switch (block.name) {
        case 'buscar_disponibilidad': {
          const disp = await buscarDisponibilidad(ctx.sucursal_id, input.fecha ?? '')
          toolResult = disp.mensaje
          break
        }

        case 'crear_cita': {
          if (!ctx.cliente_id) {
            toolResult = 'Error: cliente no identificado en el sistema. Escala a asesor.'
            handoff = true
          } else {
            const result = await crearCitaBot({
              sucursal_id: ctx.sucursal_id,
              cliente_id: ctx.cliente_id,
              fecha: input.fecha ?? '',
              hora: input.hora ?? '',
              servicio: input.servicio,
            })
            if ('error' in result) {
              toolResult = result.error
            } else {
              cita_id = result.id
              toolResult = result.confirmacion
            }
          }
          break
        }

        case 'escalar_a_asesor': {
          handoff = true
          toolResult = `Escalamiento registrado: ${input.razon}`
          break
        }

        default:
          toolResult = 'Herramienta desconocida.'
      }

      toolResults.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: toolResult,
      })
    }

    messages.push({ role: 'user', content: toolResults })
  }

  return { respuesta, cita_id, handoff }
}
