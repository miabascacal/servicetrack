import Anthropic from '@anthropic-ai/sdk'
import type { IntentResult, IntentTipo } from './types'

export type { IntentResult, IntentTipo }

const client = new Anthropic()

const VALID_INTENTS: IntentTipo[] = [
  'agendar_cita',
  'cancelar_cita',
  'consulta_estado_ot',
  'consulta_presupuesto',
  'saludo',
  'queja',
  'confirmacion',
  'otro',
]

const SYSTEM_PROMPT = `Eres un clasificador de intenciones para una agencia automotriz en México.
Clasifica el mensaje del cliente en UNA de estas intenciones y responde SOLO con JSON válido.

Intenciones posibles:
- agendar_cita: quiere agendar, programar o mover una cita de servicio
- cancelar_cita: quiere cancelar su cita
- consulta_estado_ot: pregunta por el estado de su vehículo o la orden de trabajo
- consulta_presupuesto: pregunta por precios, cotizaciones o costos
- saludo: solo saluda sin intención específica
- queja: expresa molestia, insatisfacción o reclamo
- confirmacion: confirma algo (asistencia a cita, recepción de información, etc.)
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
