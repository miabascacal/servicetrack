export type IntentTipo =
  | 'agendar_cita'
  | 'cancelar_cita'
  | 'reagendar_cita'
  | 'consulta_estado_ot'
  | 'consulta_presupuesto'
  | 'consulta_horario'
  | 'solicitud_refacciones'
  | 'solicitud_taller'
  | 'solicitud_ventas'
  | 'solicitud_csi'
  | 'solicitud_seguros'
  | 'solicitud_atencion_clientes'
  | 'solicitud_recordatorio'
  | 'solicitud_confirmacion_humana'
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
