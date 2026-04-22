export type IntentTipo =
  | 'agendar_cita'
  | 'cancelar_cita'
  | 'consulta_estado_ot'
  | 'consulta_presupuesto'
  | 'saludo'
  | 'queja'
  | 'confirmacion'
  | 'otro'

export type SentimentTipo = 'positive' | 'neutral' | 'negative' | 'urgent'

export interface IntentResult {
  intent: IntentTipo
  confidence: number
  razon?: string
}

export interface SentimentResult {
  sentiment: SentimentTipo
  confidence: number
}
