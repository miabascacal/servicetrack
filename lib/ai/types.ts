export type IntentTipo =
  | 'agendar_cita'
  | 'cancelar_cita'
  | 'reagendar_cita'
  | 'consulta_estado_ot'
  | 'consulta_presupuesto'
  | 'consulta_horario'
  | 'saludo'
  | 'queja'
  | 'confirmacion'
  | 'confirmar_asistencia'   // cliente confirma que asistirá a una cita ya agendada
  | 'consulta_cita_propia'   // cliente pregunta por su cita existente (fecha, hora, estado)
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
