import { createAdminClient } from '@/lib/supabase/admin'

export type AppointmentFlowStep =
  | 'capturar_servicio'
  | 'capturar_fecha'
  | 'capturar_hora'
  | 'esperando_confirmacion'
  | 'completado'
  | 'escalado'

export interface AppointmentFlowState {
  step:         AppointmentFlowStep
  servicio?:    string | null
  fecha?:       string | null
  hora?:        string | null
  cliente_id?:  string | null
  vehiculo_id?: string | null
  cita_id?:     string | null
  updated_at?:  string
}

// ── State accessors ───────────────────────────────────────────────────────────

export function getAppointmentFlowState(metadata: unknown): AppointmentFlowState | null {
  if (!metadata || typeof metadata !== 'object') return null
  const m    = metadata as Record<string, unknown>
  const flow = m.appointment_flow
  if (!flow || typeof flow !== 'object') return null
  const f = flow as Record<string, unknown>
  if (typeof f.step !== 'string') return null

  const VALID = new Set<string>([
    'capturar_servicio', 'capturar_fecha', 'capturar_hora',
    'esperando_confirmacion', 'completado', 'escalado',
  ])
  if (!VALID.has(f.step)) return null

  return {
    step:        f.step as AppointmentFlowStep,
    servicio:    typeof f.servicio    === 'string' ? f.servicio    : null,
    fecha:       typeof f.fecha       === 'string' ? f.fecha       : null,
    hora:        typeof f.hora        === 'string' ? f.hora        : null,
    cliente_id:  typeof f.cliente_id  === 'string' ? f.cliente_id  : null,
    vehiculo_id: typeof f.vehiculo_id === 'string' ? f.vehiculo_id : null,
    cita_id:     typeof f.cita_id     === 'string' ? f.cita_id     : null,
    updated_at:  typeof f.updated_at  === 'string' ? f.updated_at  : undefined,
  }
}

export function mergeAppointmentFlowState(
  existing: AppointmentFlowState | null,
  patch: Partial<AppointmentFlowState>,
): AppointmentFlowState {
  const base: AppointmentFlowState = existing ?? { step: 'capturar_servicio' }
  return { ...base, ...patch }
}

export function nextStep(state: AppointmentFlowState): AppointmentFlowStep {
  if (!state.servicio) return 'capturar_servicio'
  if (!state.fecha)    return 'capturar_fecha'
  if (!state.hora)     return 'capturar_hora'
  return 'esperando_confirmacion'
}

export async function setAppointmentFlowState(
  thread_id: string,
  state: AppointmentFlowState,
): Promise<void> {
  const admin = createAdminClient()
  const { data: current } = await admin
    .from('conversation_threads')
    .select('metadata')
    .eq('id', thread_id)
    .single()

  const existing = (current?.metadata ?? {}) as Record<string, unknown>
  await admin
    .from('conversation_threads')
    .update({ metadata: { ...existing, appointment_flow: state } })
    .eq('id', thread_id)
}

export async function clearAppointmentFlowState(thread_id: string): Promise<void> {
  const admin = createAdminClient()
  const { data: current } = await admin
    .from('conversation_threads')
    .select('metadata')
    .eq('id', thread_id)
    .single()

  const existing = { ...(current?.metadata ?? {}) as Record<string, unknown> }
  delete existing.appointment_flow
  await admin
    .from('conversation_threads')
    .update({ metadata: existing })
    .eq('id', thread_id)
}

// ── Text parsers ──────────────────────────────────────────────────────────────

const SERVICIOS_KEYWORD: Record<string, string> = {
  mantenimiento:      'Mantenimiento',
  revision:           'Revisión general',
  revisión:           'Revisión general',
  frenos:             'Revisión de frenos',
  lavado:             'Lavado',
  afinación:          'Afinación',
  afinacion:          'Afinación',
  aceite:             'Cambio de aceite',
  'cambio de aceite': 'Cambio de aceite',
  diagnostico:        'Diagnóstico',
  diagnóstico:        'Diagnóstico',
  pintura:            'Pintura',
  llantas:            'Servicio de llantas',
  bateria:            'Revisión de batería',
  batería:            'Revisión de batería',
  suspension:         'Revisión de suspensión',
  suspensión:         'Revisión de suspensión',
}

export function parsearServicio(texto: string): string | null {
  const t = texto.toLowerCase()

  // "50 mil", "50k", "50000 km" → "Servicio 50 mil km"
  const mMil = t.match(/\b(\d+)\s*(?:mil|k)\b/)
    ?? t.match(/\b(\d+)[,.]?000\s*(?:kms?)?\b/)
  if (mMil) return `Servicio ${mMil[1]} mil km`

  // keyword exact match
  for (const [kw, label] of Object.entries(SERVICIOS_KEYWORD)) {
    if (t.includes(kw)) return label
  }

  // "servicio de X" or "servicio X"
  const mSrv = texto.match(/servicio\s+(?:de\s+)?([a-záéíóúüñA-ZÁÉÍÓÚÜÑ0-9][a-záéíóúüñA-ZÁÉÍÓÚÜÑ0-9\s]{2,40})/i)
  if (mSrv) return `Servicio de ${mSrv[1].trim()}`

  return null
}

const DIAS_SEMANA_NUM: Record<string, number> = {
  domingo: 0, lunes: 1, martes: 2, miércoles: 3, miercoles: 3,
  jueves: 4, viernes: 5, sábado: 6, sabado: 6,
}

const MESES_ES_NUM: Record<string, number> = {
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
  julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
}

export function parsearFecha(texto: string): string | null {
  const t = texto.toLowerCase()
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Mexico_City' }))

  if (/\bhoy\b/.test(t)) return now.toISOString().split('T')[0]

  if (/\bma[ñn]ana\b/.test(t)) {
    const d = new Date(now)
    d.setDate(d.getDate() + 1)
    return d.toISOString().split('T')[0]
  }

  for (const [dia, num] of Object.entries(DIAS_SEMANA_NUM)) {
    if (t.includes(dia)) {
      const d    = new Date(now)
      const diff = (num - d.getDay() + 7) % 7 || 7
      d.setDate(d.getDate() + diff)
      return d.toISOString().split('T')[0]
    }
  }

  // "15 de mayo [de 2026]"
  const mNat = texto.match(/(\d{1,2})\s+de\s+(\w+)(?:\s+de\s+(\d{4}))?/i)
  if (mNat) {
    const dia = parseInt(mNat[1], 10)
    const mes = MESES_ES_NUM[mNat[2].toLowerCase()]
    if (mes !== undefined) {
      const anio = mNat[3] ? parseInt(mNat[3], 10) : now.getFullYear()
      const d    = new Date(anio, mes, dia)
      if (d < now) d.setFullYear(d.getFullYear() + 1)
      return d.toISOString().split('T')[0]
    }
  }

  // ISO format
  const mIso = texto.match(/\b(\d{4}-\d{2}-\d{2})\b/)
  if (mIso) return mIso[1]

  return null
}

export function parsearHora(texto: string): string | null {
  const t = texto.toLowerCase().trim()

  // "11:30", "8:00"
  const mColon = t.match(/\b(\d{1,2}):(\d{2})\b/)
  if (mColon) {
    const h = parseInt(mColon[1], 10)
    if (h >= 0 && h <= 23) return `${h.toString().padStart(2, '0')}:${mColon[2]}`
  }

  // "las 11", "a las 11", "a las 11:30"
  const mLas = t.match(/(?:a\s+las?|las?)\s+(\d{1,2})(?::(\d{2}))?\b/)
  if (mLas) {
    const h = parseInt(mLas[1], 10)
    const m = mLas[2] ?? '00'
    if (h >= 0 && h <= 23) return `${h.toString().padStart(2, '0')}:${m.padStart(2, '0')}`
  }

  // "2 pm", "2pm", "2 am"
  const mAmPm = t.match(/\b(\d{1,2})\s*(am|pm)\b/)
  if (mAmPm) {
    let h = parseInt(mAmPm[1], 10)
    if (mAmPm[2] === 'pm' && h < 12) h += 12
    if (mAmPm[2] === 'am' && h === 12) h = 0
    if (h >= 0 && h <= 23) return `${h.toString().padStart(2, '0')}:00`
  }

  // Standalone number in working-hours range (6-19)
  const mNum = t.match(/^(\d{1,2})$/)
  if (mNum) {
    const h = parseInt(mNum[1], 10)
    if (h >= 6 && h <= 19) return `${h.toString().padStart(2, '0')}:00`
  }

  return null
}

// ── Intent helpers ────────────────────────────────────────────────────────────

export function isAfirmacionFlow(texto: string): boolean {
  const t = texto.toLowerCase().trim().replace(/[¡!¿?.]/g, '').trim()
  const AFFIRMATIVES = [
    'sí', 'si', 'confirmo', 'correcto', 'ok', 'adelante', 'dale',
    'claro', 'de acuerdo', 'perfecto', 'confirmado', 'va', 'sale',
    'ándale', 'andale', 'con gusto', 'listo', 'órale', 'orale',
    'está bien', 'esta bien', 'acepto', 'sí por favor', 'si por favor',
    'así es', 'asi es', 'exacto', 'efectivamente', 'eso es',
    'sí quiero', 'si quiero', 'sí confirmo', 'si confirmo',
  ]
  return AFFIRMATIVES.some(a =>
    t === a ||
    t.startsWith(a + ' ') ||
    t.endsWith(' ' + a) ||
    t === a + 's',
  )
}

export function isFrustracion(texto: string): boolean {
  const t = texto.toLowerCase()
  const FRUSTRACION = [
    'ya te dije', 'ya te había dicho', 'ya te habia dicho',
    'otra vez me preguntas', 'me vuelves a preguntar',
    'ya lo dije', 'pues ya qué', 'pues ya que',
    'lo acabo de decir', 'acabo de decirte',
    'ya lo mencioné', 'ya lo mencione', 'ya dije',
    'te acabo de decir', 'cuántas veces', 'cuantas veces',
  ]
  return FRUSTRACION.some(f => t.includes(f))
}

export function intentoAgendar(texto: string): boolean {
  const t = texto.toLowerCase()
  const INTENT = [
    'agendar', 'quiero una cita', 'necesito una cita', 'hacer una cita',
    'quiero ir', 'quiero llevar', 'llevar el carro', 'llevar mi carro',
    'llevar el coche', 'llevar mi coche', 'llevar la camioneta',
    'llevar mi camioneta', 'programar una cita', 'quisiera agendar',
    'quisiera una cita', 'puedo llevar', 'puedo ir',
  ]
  return INTENT.some(kw => t.includes(kw))
}
