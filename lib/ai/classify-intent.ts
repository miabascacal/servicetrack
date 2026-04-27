import Anthropic from '@anthropic-ai/sdk'
import type { IntentResult, IntentTipo } from './types'

export type { IntentResult, IntentTipo }

const client = new Anthropic()

const VALID_INTENTS: IntentTipo[] = [
  'agendar_cita',
  'cancelar_cita',
  'reagendar_cita',
  'consulta_estado_ot',
  'consulta_presupuesto',
  'consulta_horario',
  'saludo',
  'queja',
  'confirmacion',
  'confirmar_asistencia',
  'consulta_cita_propia',
  'otro',
]

const SYSTEM_PROMPT = `Eres un clasificador de intenciones para una agencia automotriz en México.
Clasifica el mensaje del cliente en UNA de estas intenciones y responde SOLO con JSON válido.

Intenciones posibles:
- agendar_cita: quiere agendar o programar una cita de servicio nueva
- cancelar_cita: quiere cancelar una cita existente
- reagendar_cita: quiere cambiar la fecha/hora de una cita existente
- consulta_estado_ot: pregunta por el estado de su vehículo u orden de trabajo activa
- consulta_presupuesto: pregunta por precios, cotizaciones o costos
- consulta_horario: pregunta por horarios de atención, ubicación o información general
- saludo: solo saluda sin intención específica
- queja: expresa molestia, insatisfacción o reclamo
- confirmacion: confirma recepción de información genérica (no relacionada con asistencia a cita)
- confirmar_asistencia: confirma explícitamente que asistirá a una cita ya agendada ("sí confirmo", "ahí estaré", "sí voy")
- consulta_cita_propia: pregunta por los detalles de su propia cita ya agendada ("¿cuándo es mi cita?", "¿a qué hora?")
- otro: cualquier otra intención no listada

Responde SOLO con este JSON, sin texto adicional:
{"intent": "<intención>", "confidence": <0.0-1.0>, "razon": "<breve justificación>"}`

export async function classifyIntent(mensaje: string): Promise<IntentResult> {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 150,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: mensaje }],
  })

  const text = response.content[0]?.type === 'text' ? response.content[0].text : ''

  try {
    const parsed = JSON.parse(text) as Partial<IntentResult>
    const intent = VALID_INTENTS.includes(parsed.intent as IntentTipo)
      ? (parsed.intent as IntentTipo)
      : 'otro'
    return {
      intent,
      confidence: Math.min(1, Math.max(0, parsed.confidence ?? 0)),
      razon: parsed.razon,
    }
  } catch {
    return { intent: 'otro', confidence: 0 }
  }
}
