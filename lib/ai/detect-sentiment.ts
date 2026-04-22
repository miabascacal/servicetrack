import Anthropic from '@anthropic-ai/sdk'
import type { SentimentResult, SentimentTipo } from './types'

export type { SentimentResult, SentimentTipo }

const client = new Anthropic()

const VALID_SENTIMENTS: SentimentTipo[] = ['positive', 'neutral', 'negative', 'urgent']

const SYSTEM_PROMPT = `Eres un detector de sentimiento para una agencia automotriz en México.
Analiza el tono emocional del mensaje del cliente y responde SOLO con JSON válido.

Sentimientos posibles:
- positive: satisfecho, agradecido, contento
- neutral: informativo, sin carga emocional notable
- negative: molesto, insatisfecho, frustrado
- urgent: urgente, angustiado, requiere atención inmediata

Responde SOLO con este JSON, sin texto adicional:
{"sentiment": "<sentimiento>", "confidence": <0.0-1.0>}`

export async function detectSentiment(mensaje: string): Promise<SentimentResult> {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 80,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: mensaje }],
  })

  const text = response.content[0]?.type === 'text' ? response.content[0].text : ''

  try {
    const parsed = JSON.parse(text) as Partial<SentimentResult>
    const sentiment = VALID_SENTIMENTS.includes(parsed.sentiment as SentimentTipo)
      ? (parsed.sentiment as SentimentTipo)
      : 'neutral'
    return {
      sentiment,
      confidence: Math.min(1, Math.max(0, parsed.confidence ?? 0)),
    }
  } catch {
    return { sentiment: 'neutral', confidence: 0 }
  }
}
