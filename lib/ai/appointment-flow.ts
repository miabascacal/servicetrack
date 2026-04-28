import { createAdminClient } from '@/lib/supabase/admin'

export type AppointmentFlowStep =
  | 'capturar_nombre'
  | 'resolver_vehiculo'
  | 'capturar_vehiculo'
  | 'capturar_servicio'
  | 'capturar_fecha'
  | 'capturar_hora'
  | 'esperando_confirmacion'
  | 'completado'
  | 'escalado'

export interface AppointmentFlowState {
  step:                     AppointmentFlowStep
  nombre_resuelto?:         boolean
  vehiculo_resuelto?:       boolean
  vehiculos_opciones?:      Array<{ id: string; descripcion: string }>
  servicio?:                string | null
  fecha?:                   string | null
  hora?:                    string | null
  cliente_id?:              string | null
  vehiculo_id?:             string | null
  cita_id?:                 string | null
  updated_at?:              string
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
    'capturar_nombre', 'resolver_vehiculo', 'capturar_vehiculo',
    'capturar_servicio', 'capturar_fecha', 'capturar_hora',
    'esperando_confirmacion', 'completado', 'escalado',
  ])
  if (!VALID.has(f.step)) return null

  const rawOpciones = f.vehiculos_opciones
  const vehiculos_opciones: Array<{ id: string; descripcion: string }> | undefined =
    Array.isArray(rawOpciones)
      ? (rawOpciones as unknown[]).flatMap(o => {
          if (o && typeof o === 'object') {
            const r = o as Record<string, unknown>
            if (typeof r.id === 'string' && typeof r.descripcion === 'string') {
              return [{ id: r.id, descripcion: r.descripcion }]
            }
          }
          return []
        })
      : undefined

  return {
    step:                f.step as AppointmentFlowStep,
    nombre_resuelto:     f.nombre_resuelto   === true ? true : undefined,
    vehiculo_resuelto:   f.vehiculo_resuelto === true ? true : undefined,
    vehiculos_opciones,
    servicio:            typeof f.servicio    === 'string' ? f.servicio    : null,
    fecha:               typeof f.fecha       === 'string' ? f.fecha       : null,
    hora:                typeof f.hora        === 'string' ? f.hora        : null,
    cliente_id:          typeof f.cliente_id  === 'string' ? f.cliente_id  : null,
    vehiculo_id:         typeof f.vehiculo_id === 'string' ? f.vehiculo_id : null,
    cita_id:             typeof f.cita_id     === 'string' ? f.cita_id     : null,
    updated_at:          typeof f.updated_at  === 'string' ? f.updated_at  : undefined,
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

// ── P0.2 Parsers ─────────────────────────────────────────────────────────────

const PALABRAS_NO_NOMBRE = new Set([
  'hola', 'gracias', 'buenos', 'días', 'dias', 'tardes', 'noches', 'buen',
  'ok', 'sí', 'si', 'no', 'claro', 'correcto', 'perfecto', 'dale', 'órale',
  'orale', 'ándale', 'andale', 'quiero', 'necesito', 'quisiera', 'puede',
  'puedo', 'podrías', 'podría', 'agendar', 'cita', 'servicio', 'carro',
  'coche', 'auto', 'camioneta', 'camion', 'moto', 'vehiculo', 'vehículo',
  'mantenimiento', 'revisión', 'revision', 'aceite', 'frenos', 'llantas',
  'batería', 'bateria', 'afinación', 'afinacion', 'diagnóstico', 'diagnostico',
  'mañana', 'hoy', 'lunes', 'martes', 'miércoles', 'miercoles', 'jueves',
  'viernes', 'sábado', 'sabado', 'domingo', 'enero', 'febrero', 'marzo',
  'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre',
  'noviembre', 'diciembre',
])

/**
 * Parses a client name from free text. Requires ≥2 name-like words.
 * Returns { nombre, apellido } or null if the text doesn't look like a name.
 */
export function parsearNombre(
  texto: string,
): { nombre: string; apellido: string } | null {
  let t = texto.trim()

  // Strip common prefixes
  t = t.replace(/^(?:me\s+llamo|mi\s+nombre\s+es?|soy|les?\s+habla|habla)\s+/i, '')
  t = t.replace(/^[Hh]ola[,.]?\s*/i, '')

  // Extract tokens that look like proper-name words (letters only, ≥2 chars)
  const words = t
    .split(/\s+/)
    .filter(w => /^[A-ZÁÉÍÓÚÜÑa-záéíóúüñ]{2,}$/.test(w))

  if (words.length < 2) return null

  const nameWords = words.filter(w => !PALABRAS_NO_NOMBRE.has(w.toLowerCase()))
  if (nameWords.length < 2) return null

  const nombre   = nameWords[0]
  const apellido = nameWords.slice(1, 3).join(' ')

  return { nombre, apellido }
}

const MARCAS_CONOCIDAS = new Set([
  'toyota', 'honda', 'nissan', 'chevrolet', 'ford', 'volkswagen', 'vw',
  'bmw', 'mercedes', 'audi', 'hyundai', 'kia', 'mazda', 'subaru', 'jeep',
  'dodge', 'ram', 'gmc', 'cadillac', 'buick', 'lincoln', 'acura', 'lexus',
  'infiniti', 'mitsubishi', 'suzuki', 'seat', 'peugeot', 'renault', 'fiat',
  'volvo', 'mini', 'porsche', 'tesla', 'jaguar',
])

export interface VehiculoParseado {
  marca:   string
  modelo:  string
  anio:    number
  placa?:  string
  color?:  string
}

/**
 * Parses vehicle data from free text. Requires at least a known brand OR a year
 * (to avoid accidentally parsing names as vehicles).
 */
export function parsearVehiculo(texto: string): VehiculoParseado | null {
  const t = texto.toLowerCase()

  // Year: 4 digits starting 19xx or 20xx
  const yearM = texto.match(/\b(19|20)\d{2}\b/)
  const anio  = yearM ? parseInt(yearM[0], 10) : null

  // Mexican placa pattern (very loose: ABC-123 or 123-ABC etc.)
  const placaM = texto.match(/\b([A-Z]{2,3}[-\s]?\d{3,4}[A-Z]{0,2}|\d{3,4}[-\s]?[A-Z]{2,3})\b/i)
  const placa  = placaM
    ? placaM[1].replace(/[-\s]/g, '').toUpperCase()
    : undefined

  // Known brand lookup
  let marca:  string | null = null
  let modelo: string | null = null

  for (const m of MARCAS_CONOCIDAS) {
    if (t.includes(m)) {
      marca = m.charAt(0).toUpperCase() + m.slice(1)
      // modelo = next 1–2 words after brand that aren't year/numbers
      const afterBrand = texto.slice(t.indexOf(m) + m.length).trim().split(/\s+/)
      const modelWords = afterBrand
        .filter(w => /^[A-Za-záéíóúüñÁÉÍÓÚÜÑ][A-Za-záéíóúüñÁÉÍÓÚÜÑ0-9\-]{0,20}$/.test(w))
        .slice(0, 2)
      if (modelWords.length > 0) modelo = modelWords.join(' ')
      break
    }
  }

  // Need at least brand OR year to be confident this is a vehicle
  if (!marca && !anio) return null
  // Need at least brand to derive modelo
  if (!marca) return null

  return {
    marca,
    modelo:  modelo ?? 'N/D',
    anio:    anio ?? new Date().getFullYear(),
    placa,
  }
}

/**
 * Matches a client response to a numbered list of options (1-based input → 0-based index).
 * Optionally matches by fuzzy keyword against option descriptions.
 */
export function parsearSeleccion(
  texto: string,
  max:   number,
  opciones?: Array<{ id: string; descripcion: string }>,
): number | null {
  const t = texto.toLowerCase().trim().replace(/[¡!¿?.]/g, '')

  // Single-option affirmative
  if (max === 1 && /^(s[ií]|correcto|exacto|ese|esa|claro|sí\s+esa|si\s+esa|ese\s+mismo)/.test(t)) {
    return 0
  }

  // Explicit number: "1", "2", "el 3", "opción 2", "número 1"
  const numM =
    t.match(/^(\d+)$/) ??
    t.match(/(?:opci[oó]n|n[uú]mero|el|la|numero)\s+(\d+)/i)
  if (numM) {
    const n = parseInt(numM[1] ?? numM[0], 10)
    if (!isNaN(n) && n >= 1 && n <= max) return n - 1
  }

  // Ordinals
  if (/\b(primer[ao]?|primero)\b/.test(t)) return 0
  if (/\b(segund[ao])\b/.test(t)) return max > 1 ? 1 : null
  if (/\b(tercer[ao])\b/.test(t)) return max > 2 ? 2 : null

  // Keyword match against option descriptions (≥4-char word present in description)
  if (opciones) {
    const words = t.split(/\s+/).filter(w => w.length >= 4)
    for (let i = 0; i < opciones.length; i++) {
      const desc = opciones[i].descripcion.toLowerCase()
      if (words.some(w => desc.includes(w))) return i
    }
  }

  return null
}

/**
 * Returns true if the client is declining/skipping a vehicle selection prompt.
 */
export function isNegacion(texto: string): boolean {
  const t = texto.toLowerCase().trim().replace(/[¡!¿?.]/g, '')
  const NEGACIONES = [
    'no', 'ninguno', 'ninguna', 'otro', 'otra', 'otros', 'otras',
    'sin vehículo', 'sin vehiculo', 'no tengo', 'no tengo carro',
    'no tengo vehiculo', 'no tengo coche', 'sáltate', 'saltate',
    'omitir', 'continuar sin', 'después', 'despues', 'luego',
  ]
  return NEGACIONES.some(
    n => t === n || t.startsWith(n + ' ') || t.endsWith(' ' + n),
  )
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
