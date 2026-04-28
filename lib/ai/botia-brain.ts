/**
 * BotIA Operational Brain — Bootstrap Constants
 *
 * These constants are the starting point for BotIA's operational intelligence.
 * Future source of truth: supervised corpus in DB + configuracion_citas_sucursal.
 * These constants are NOT a replacement for DB configuration — they are safe defaults
 * used when DB config is absent, and shared definitions for code that currently
 * has inline copies of the same data.
 *
 * Integration points:
 *   - lib/ai/appointment-flow.ts imports PLACEHOLDER_NOMBRES, FRUSTRATION_PATTERNS,
 *     CONFIRMATION_PATTERNS, NEGATION_PATTERNS, SERVICE_SYNONYMS
 *   - lib/ai/classify-intent.ts may import INTENT_EXAMPLES for confidence hints
 *   - Future: bot training pipeline reads TRAINING_CORPUS_EXAMPLES as seed data
 */

// ── Client identity ───────────────────────────────────────────────────────────

/** Names that indicate an unresolved/placeholder client record. */
export const BOTIA_PLACEHOLDER_NOMBRES = new Set([
  'CLIENTE', 'SIN CLIENTE', 'SIN NOMBRE', 'DEMO', 'TEST', 'PRUEBA',
  'UNKNOWN', 'DESCONOCIDO', 'NA', 'NOMBRE', 'CUSTOMER', 'USER',
  'ANONIMO', 'ANÓNIMO', 'INVITADO', 'GUEST',
])

/** Multi-key client resolution order (WhatsApp is primary). */
export const BOTIA_CLIENT_RESOLUTION_ORDER = [
  'whatsapp',       // primary — always try first
  'email',          // secondary — exact match
  'telefono_alterno',
  'placa',          // vehicle-based lookup
  'vin',            // VIN lookup
  // nombre is NOT a key — only used as a hint / display field
] as const

// ── Intent categories ─────────────────────────────────────────────────────────

export const BOTIA_INTENTS = {
  // Agendamiento
  AGENDAR_CITA:            'agendar_cita',
  SELECCIONAR_FECHA:       'seleccionar_fecha',
  SELECCIONAR_HORA:        'seleccionar_hora',
  CONFIRMAR_CITA:          'confirmar_cita',
  CANCELAR_CITA:           'cancelar_cita',
  REAGENDAR_CITA:          'reagendar_cita',
  CONSULTAR_CITA:          'consulta_cita_propia',
  CONSULTAR_DISPONIBILIDAD:'consultar_disponibilidad',
  HORA_OCUPADA:            'hora_ocupada',
  CONFIRMAR_ASISTENCIA:    'confirmar_asistencia',
  // Cliente / CRM
  PROPORCIONAR_NOMBRE:     'proporcionar_nombre',
  PROPORCIONAR_EMAIL:      'proporcionar_email',
  PROPORCIONAR_TELEFONO:   'proporcionar_telefono',
  CLIENTE_CORRIGE:         'cliente_corrige_dato',
  CLIENTE_NO_SABE:         'cliente_no_sabe',
  // Vehículo
  PROPORCIONAR_VEHICULO:   'proporcionar_vehiculo',
  PROPORCIONAR_PLACA:      'proporcionar_placa',
  PROPORCIONAR_VIN:        'proporcionar_vin',
  CONFIRMAR_VEHICULO:      'confirmar_vehiculo',
  CORREGIR_VEHICULO:       'corregir_vehiculo',
  NO_TENGO_PLACA:          'no_tengo_placa',
  ENVIAR_TARJETA:          'enviar_tarjeta_circulacion',
  // Servicio
  MANTENIMIENTO:           'mantenimiento',
  DIAGNOSTICO:             'diagnostico_testigo',
  REVISION_GENERAL:        'revision_general',
  FRENOS:                  'frenos',
  CAMBIO_ACEITE:           'cambio_aceite',
  RUIDO:                   'ruido',
  GARANTIA:                'garantia',
  LAVADO:                  'lavado',
  PREGUNTAR_COSTO:         'preguntar_costo',
  // Sucursal
  CONSULTAR_UBICACION:     'consultar_ubicacion',
  CONSULTAR_HORARIO:       'consultar_horario',
  CONSULTAR_REQUISITOS:    'consultar_requisitos',
  COMO_LLEGAR:             'como_llegar',
  // Escalación / estado emocional
  HABLAR_ASESOR:           'hablar_asesor',
  CLIENTE_MOLESTO:         'cliente_molesto',
  CLIENTE_FRUSTRADO:       'cliente_frustrado',
  CLIENTE_CONFUNDIDO:      'cliente_confundido',
  CLIENTE_YA_DIJE:         'cliente_dice_ya_te_dije',
  INSULTO:                 'insulto_o_agresion',
  SOLICITUD_NO_SOPORTADA:  'solicitud_no_soportada',
  // Otros módulos (futuros)
  TALLER_ESTADO_OT:        'taller_estado_ot',
  VEHICULO_LISTO:          'vehiculo_listo',
  ENCUESTA_CSI:            'encuesta_csi',
  QUEJA_CLIENTE:           'queja_cliente',
} as const

export type BotiaIntent = (typeof BOTIA_INTENTS)[keyof typeof BOTIA_INTENTS]

// ── Entity types ──────────────────────────────────────────────────────────────

export const BOTIA_ENTITY_TYPES = [
  // Cliente
  'cliente_id', 'nombre', 'apellido', 'whatsapp', 'email', 'telefono_alterno',
  // Vehículo
  'vehiculo_id', 'marca', 'modelo', 'anio', 'placa', 'vin', 'color', 'kilometraje',
  // Cita
  'cita_id', 'sucursal_id', 'asesor_id', 'servicio', 'fecha', 'hora', 'estado',
  // Tiempo
  'fecha_relativa', 'fecha_absoluta', 'hora_absoluta', 'rango_horario',
  'preferencia_momento', 'despues_de_hora', 'antes_de_hora',
  // Sucursal
  'nombre_sucursal', 'direccion', 'telefono_sucursal', 'horario', 'requisitos_cita',
  // Conversación
  'intent', 'confidence', 'frustration_level', 'escalation_reason', 'missing_slots',
] as const

// ── Slot requirements per flow ────────────────────────────────────────────────

export const BOTIA_SLOT_REQUIREMENTS = {
  agendar_cita: {
    obligatorios: [
      'cliente_id',      // resolved client record
      'nombre_real',     // not a placeholder
      'whatsapp',        // primary resolution key
      'vehiculo_id',     // registered vehicle
      'servicio',        // service type
      'fecha',           // appointment date
      'hora',            // appointment time
      'sucursal_id',     // branch
    ],
    opcionales: ['asesor_id', 'notas', 'email'],
    reglas: [
      'CLIENTE DEMO no cuenta como cliente resuelto',
      'cliente_id existente NO implica cliente resuelto — verificar isClientePlaceholder()',
      'nombre no es llave única de cliente',
      'vehiculo debe buscarse por placa/VIN si los tiene el cliente',
      'placa es preferente — pedirla si el cliente no la dio',
      'no crear cita con servicio NULL',
      'no crear cita con vehiculo_id NULL en flujo comercial',
      'no confirmar sin cita_id real',
    ],
  },
} as const

// ── Escalation reasons ────────────────────────────────────────────────────────

export const BOTIA_ESCALATION_REASONS = {
  CLIENTE_PIDE_ASESOR:      'cliente_solicita_asesor',
  CLIENTE_MOLESTO_PERSISTE: 'cliente_molesto_persiste',
  DATOS_CONTRADICTORIOS:    'datos_contradictorios',
  SIN_DISPONIBILIDAD:       'sin_disponibilidad_y_rechaza_alternativas',
  FALLA_TECNICA:            'falla_tecnica',
  FALTA_CONFIGURACION:      'falta_configuracion_critica',
  COSTO_NO_CONFIGURADO:     'costo_no_configurado',
  QUEJA_COMPLEJA:           'queja_compleja',
  FUERA_DE_ALCANCE:         'solicitud_fuera_de_alcance',
  CLIENTE_NO_PUEDE_IDENTIFICARSE: 'cliente_no_identificado',
} as const

export const BOTIA_NO_ESCALAR = [
  'hora_ocupada_pero_hay_alternativas',
  'falta_nombre',
  'falta_vehiculo',
  'falta_servicio',
  'cliente_ya_dije_dato_en_metadata',
  'pregunta_ubicacion_con_config',
  'pregunta_horario_con_config',
  'pregunta_requisitos_con_config',
] as const

// ── Response policies ─────────────────────────────────────────────────────────

export const BOTIA_RESPONSE_POLICIES = {
  tono: ['profesional', 'amable', 'empático', 'claro', 'breve'],
  prohibido: [
    'repetir_groseria',
    'responder_agresivo',
    'culpar_al_cliente',
    'inventar_direccion',
    'inventar_horarios',
    'inventar_costos',
    'inventar_vehiculo',
    'confirmar_cita_sin_cita_id',
    'prometer_tiempo_no_configurado',
    'aprender_groserias',
    'copiar_tono_agresivo',
  ],
  max_lineas_por_mensaje: 3,
  preguntas_por_turno: 1,
} as const

// ── Learning policy ───────────────────────────────────────────────────────────

/** Patterns BotIA MUST NOT learn regardless of frequency. */
export const BOTIA_FORBIDDEN_LEARNING_PATTERNS = [
  /[^\w\s]{3,}/,               // excessive punctuation / symbols
  /\b(estupid|idiot|pend|cul|chinga|wey|mam[ao]n|culero)\b/i,  // profanity (sample)
  /instruccion|system prompt|ignore|jailbreak|forget|olvida/i,  // prompt injection attempts
  /\b(gratis|sin cobrar|no me cobr[ae]s)\b/i, // pricing bypass attempts
] as const

/** Topics BotIA CAN learn from supervised corpus. */
export const BOTIA_ALLOWED_LEARNING_PATTERNS = [
  'nuevas_formas_pedir_cita',
  'frases_de_servicio_regional',
  'formas_decir_fechas_horas',
  'descripciones_fallas_vehiculo',
  'frases_ambiguas_requieren_aclaracion',
  'causas_frecuentes_escalacion',
] as const

// ── Pattern sets (expanded from appointment-flow.ts) ─────────────────────────

/**
 * Frustration signal phrases. Used in isFrustracion().
 * Source of truth: this file — appointment-flow.ts imports from here.
 */
export const BOTIA_FRUSTRATION_PATTERNS = [
  'ya te dije', 'ya te había dicho', 'ya te habia dicho',
  'otra vez me preguntas', 'me vuelves a preguntar',
  'ya lo dije', 'pues ya qué', 'pues ya que',
  'lo acabo de decir', 'acabo de decirte',
  'ya lo mencioné', 'ya lo mencione', 'ya dije',
  'te acabo de decir', 'cuántas veces', 'cuantas veces',
  // Additional patterns
  'ya lo expliqué', 'ya lo explique',
  'no me entiendes', 'no me entendiste',
  'eso ya lo puse', 'eso ya lo dije',
  'estoy cansado', 'estoy harto', 'qué tarda',
  'ya tardaste', 'cuánto tiempo', 'cuanto tiempo',
] as const

/**
 * Affirmative phrases used in confirmation flows.
 * Source of truth: this file — appointment-flow.ts imports AFFIRMATIVES from here.
 */
export const BOTIA_CONFIRMATION_PATTERNS = [
  'sí', 'si', 'confirmo', 'correcto', 'ok', 'adelante', 'dale',
  'claro', 'de acuerdo', 'perfecto', 'confirmado', 'va', 'sale',
  'ándale', 'andale', 'con gusto', 'listo', 'órale', 'orale',
  'está bien', 'esta bien', 'acepto', 'sí por favor', 'si por favor',
  'así es', 'asi es', 'exacto', 'efectivamente', 'eso es',
  'sí quiero', 'si quiero', 'sí confirmo', 'si confirmo',
  // Additional
  'ahí estaré', 'ahi estare', 'nos vemos', 'estaré', 'estare',
  'sí asisto', 'si asisto', 'sí voy', 'si voy',
  'confirmado sí', 'afirmativo', 'correcto sí',
] as const

/**
 * Negation/skip phrases. Source of truth: this file.
 */
export const BOTIA_NEGATION_PATTERNS = [
  'no', 'ninguno', 'ninguna', 'otro', 'otra', 'otros', 'otras',
  'sin vehículo', 'sin vehiculo', 'no tengo', 'no tengo carro',
  'no tengo vehiculo', 'no tengo coche', 'sáltate', 'saltate',
  'omitir', 'continuar sin', 'después', 'despues', 'luego',
  // Additional
  'no puedo', 'no quiero', 'paso', 'tampoco', 'nada',
  'no aplica', 'sin carro', 'no tengo ninguno',
] as const

/**
 * Scheduling intent phrases. Source of truth: this file.
 */
export const BOTIA_SCHEDULING_PHRASES = [
  'agendar', 'quiero una cita', 'necesito una cita', 'hacer una cita',
  'quiero ir', 'quiero llevar', 'llevar el carro', 'llevar mi carro',
  'llevar el coche', 'llevar mi coche', 'llevar la camioneta',
  'llevar mi camioneta', 'programar una cita', 'quisiera agendar',
  'quisiera una cita', 'puedo llevar', 'puedo ir',
  // Additional
  'me puedes agendar', 'me pueden agendar', 'me puedes dar cita',
  'tienes espacio', 'hay espacio', 'están atendiendo',
  'quiero servicio', 'necesito servicio', 'traer mi carro',
  'quiero llevar el auto', 'llevar mi auto',
] as const

/**
 * Service type synonyms → canonical label.
 * Superset of the inline map in appointment-flow.ts.
 * Source of truth: this file.
 */
export const BOTIA_SERVICE_SYNONYMS: Record<string, string> = {
  // Mantenimiento / aceite
  mantenimiento:         'Mantenimiento',
  'mantenimiento menor': 'Mantenimiento menor',
  'mantenimiento mayor': 'Mantenimiento mayor',
  aceite:                'Cambio de aceite',
  'cambio de aceite':    'Cambio de aceite',
  'cambio aceite':       'Cambio de aceite',
  'oil change':          'Cambio de aceite',
  // Revisión
  revision:              'Revisión general',
  revisión:              'Revisión general',
  'revision general':    'Revisión general',
  'revisión general':    'Revisión general',
  'check up':            'Revisión general',
  checkup:               'Revisión general',
  // Frenos
  frenos:                'Revisión de frenos',
  freno:                 'Revisión de frenos',
  'balatas':             'Revisión de frenos',
  'pastillas':           'Revisión de frenos',
  // Diagnóstico / testigo
  diagnostico:           'Diagnóstico',
  diagnóstico:           'Diagnóstico',
  testigo:               'Diagnóstico — testigo encendido',
  'check engine':        'Diagnóstico — testigo encendido',
  'luz encendida':       'Diagnóstico — testigo encendido',
  'luz prendida':        'Diagnóstico — testigo encendido',
  // Afinación
  afinación:             'Afinación',
  afinacion:             'Afinación',
  bujías:                'Afinación',
  bujias:                'Afinación',
  // Otros
  pintura:               'Pintura',
  llantas:               'Servicio de llantas',
  llanta:                'Servicio de llantas',
  bateria:               'Revisión de batería',
  batería:               'Revisión de batería',
  suspension:            'Revisión de suspensión',
  suspensión:            'Revisión de suspensión',
  lavado:                'Lavado',
  garantia:              'Garantía',
  garantía:              'Garantía',
  ruido:                 'Diagnóstico — ruido',
  vibración:             'Diagnóstico — vibración',
  vibracion:             'Diagnóstico — vibración',
  'pierde potencia':     'Diagnóstico — pérdida de potencia',
}

/**
 * Known vehicle brands. Used by parsearVehiculo() to validate vehicle intent.
 * Source of truth: this file.
 */
export const BOTIA_VEHICLE_HINTS = new Set([
  'toyota', 'honda', 'nissan', 'chevrolet', 'ford', 'volkswagen', 'vw',
  'bmw', 'mercedes', 'audi', 'hyundai', 'kia', 'mazda', 'subaru', 'jeep',
  'dodge', 'ram', 'gmc', 'cadillac', 'buick', 'lincoln', 'acura', 'lexus',
  'infiniti', 'mitsubishi', 'suzuki', 'seat', 'peugeot', 'renault', 'fiat',
  'volvo', 'mini', 'porsche', 'tesla', 'jaguar', 'land rover', 'ferrari',
  'maserati', 'alfa romeo', 'chrysler', 'jeep', 'citroen', 'citroën',
  'dacia', 'skoda', 'byd', 'chery', 'mg', 'zotye',
])

// ── Vehicle resolution policy ─────────────────────────────────────────────────

export const BOTIA_VEHICLE_RESOLUTION_POLICY = {
  campos_obligatorios: ['marca', 'modelo', 'anio'],
  campos_preferentes:  ['placa'],   // placa is critical — enables CRM lookup
  campos_opcionales:   ['vin', 'color'],
  buscar_por_placa_primero: true,
  buscar_por_vin_segundo:   true,
  crear_si_no_existe:       true,
  vincular_a_cliente:       true,
  // Future
  ocr_tarjeta_circulacion:  false,  // pending — OCR via WhatsApp photo
} as const

// ── Time patterns used in parsing ─────────────────────────────────────────────

export const BOTIA_TIME_PATTERNS = {
  relativos: ['hoy', 'mañana', 'pasado mañana', 'la próxima semana'],
  dias_semana: ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'],
  meses: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
          'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
  expresiones_hora: ['temprano', 'en la mañana', 'en la tarde', 'primera hora',
                     'después de las', 'antes de las', 'al mediodía', 'al medio día'],
} as const
