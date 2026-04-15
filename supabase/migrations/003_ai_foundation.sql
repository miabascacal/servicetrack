-- ════════════════════════════════════════════════════
-- MIGRACIÓN 003 — AI FOUNDATION
-- Sprint 8: Bandeja real + webhook WA + intent classifier
--           + cola de mensajes + configuración IA
--
-- ESTADO: EJECUTADA 2026-04-13
--
-- PREREQUISITOS (verificar antes de ejecutar):
--   SELECT routine_name FROM information_schema.routines
--   WHERE routine_name = 'get_mi_sucursal_id';
--
-- INSTRUCCIONES DE EJECUCIÓN EN SUPABASE SQL EDITOR:
--   SECCIÓN 1: ejecutar completa en una primera ejecución
--              (incluye CREATE TABLE mensajes + 4 tablas IA + ALTER TABLE)
--   SECCIÓN 2: ejecutar en una SEGUNDA ejecución separada
--              (nueva pestaña o nueva ejecución = nueva transacción)
--   No mezclar ambas secciones en una sola ejecución.
--
-- TABLAS CREADAS:
--   mensajes, ai_settings, conversation_threads,
--   outbound_queue, automation_logs
--
-- COLUMNAS AGREGADAS A mensajes:
--   thread_id, message_source, wa_message_id,
--   ai_intent, ai_intent_confidence, ai_sentiment,
--   processing_status
--
-- NOTAS DE ARQUITECTURA:
--   - ai_settings.activo = FALSE por defecto: el bot queda apagado
--     hasta que un admin lo habilite deliberadamente.
--   - conversation_threads.contexto_id: FK lógica SIN constraint declarado.
--     Puede apuntar a citas, ordenes_trabajo, cotizaciones o leads según
--     contexto_tipo. La integridad la mantiene el código, no la BD.
--   - outbound_queue e automation_logs: INSERT solo desde service role
--     (createAdminClient()). Ningún componente UI inserta directamente.
--   - mensajes.processing_status: se agrega SIN DEFAULT en el ADD COLUMN
--     para que los mensajes históricos queden NULL (no entran a la cola IA).
--     El DEFAULT 'pending' se aplica en un ALTER COLUMN separado para que
--     solo los mensajes nuevos post-migración lo reciban automáticamente.
--   - mensajes usa enviado_at como timestamp principal. NO tiene creado_at.
--
-- DEUDA TÉCNICA REGISTRADA:
--   - RLS en ai_settings y outbound_queue solo valida sucursal_id.
--     La validación de rol (admin/gerente para settings, asesores para
--     aprobar mensajes) se hace en server actions.
--     Endurecer con RLS por rol al implementar Sprint 2 (usePermisos).
--
-- Fecha: 2026-04-13
-- ════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════
-- SECCIÓN 1 — TABLAS, TRIGGERS, RLS, ALTER TABLE
-- ════════════════════════════════════════════════════


-- ── FUNCIÓN: trigger para actualizado_at (masculino) ─────────────
-- La función existente update_updated_at() usa actualizada_at (femenino)
-- y solo aplica a citas, ordenes_trabajo y actividades.
-- Esta nueva función aplica a las tablas de esta migración que usan
-- la convención actualizado_at (masculino), consistente con usuarios,
-- vehiculos, clientes y leads.

CREATE OR REPLACE FUNCTION set_actualizado_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.actualizado_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ════════════════════════════════════════════════════
-- TABLA: mensajes
-- Bandeja unificada bidireccional (WA, email, FB, IG).
-- Cada fila es un mensaje individual entrante o saliente.
-- Esta tabla es la fuente de verdad para la bandeja del asesor.
--
-- NOTA: usa enviado_at como timestamp principal.
--       NO tiene columna creado_at.
-- ════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS mensajes (
  id                  UUID          DEFAULT uuid_generate_v4() PRIMARY KEY,
  sucursal_id         UUID          REFERENCES sucursales(id),
  cliente_id          UUID          REFERENCES clientes(id),
  usuario_asesor_id   UUID          REFERENCES usuarios(id),

  canal               canal_mensaje NOT NULL,
  direccion           TEXT          NOT NULL CHECK (direccion IN ('entrante', 'saliente')),
  contenido           TEXT,
  media_url           TEXT,
  media_tipo          TEXT,

  id_externo          TEXT,           -- ID en el sistema externo (ej: id de Meta para WA)
  estado_entrega      TEXT,           -- sent | delivered | read | failed

  enviado_por_bot     BOOLEAN       DEFAULT FALSE,
  enviado_at          TIMESTAMPTZ   DEFAULT NOW(),
  leido_at            TIMESTAMPTZ,
  leido_por_asesor    BOOLEAN       DEFAULT FALSE,

  -- Columnas de integración IA (agregadas en esta misma migración)
  thread_id           UUID          REFERENCES conversation_threads(id) ON DELETE SET NULL,
  message_source      TEXT
    CHECK (message_source IN ('customer','agent_manual','agent_bot','system','import')),
  wa_message_id       TEXT,           -- ID único del mensaje en Meta (deduplicación webhook)
  ai_intent           TEXT,           -- intención clasificada por IA
  ai_intent_confidence NUMERIC(4,3)
    CHECK (ai_intent_confidence BETWEEN 0 AND 1),
  ai_sentiment        TEXT
    CHECK (ai_sentiment IN ('positive','neutral','negative','urgent')),
  -- NULL = mensaje histórico (no entra al clasificador IA)
  -- 'pending' = mensaje nuevo pendiente de clasificar
  processing_status   TEXT
    CHECK (processing_status IN ('pending','processing','done','failed'))
);

-- Índices base de mensajes
CREATE INDEX IF NOT EXISTS idx_mensajes_cliente  ON mensajes(cliente_id);
CREATE INDEX IF NOT EXISTS idx_mensajes_canal    ON mensajes(canal);
CREATE INDEX IF NOT EXISTS idx_mensajes_asesor   ON mensajes(usuario_asesor_id);

ALTER TABLE mensajes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mensajes_select" ON mensajes
  FOR SELECT USING (sucursal_id = get_mi_sucursal_id());

CREATE POLICY "mensajes_insert" ON mensajes
  FOR INSERT WITH CHECK (sucursal_id = get_mi_sucursal_id());

CREATE POLICY "mensajes_update" ON mensajes
  FOR UPDATE USING (sucursal_id = get_mi_sucursal_id());

-- Aplicar DEFAULT 'pending' para filas nuevas post-migración
-- (no afecta las filas ya existentes, que quedan NULL)
ALTER TABLE mensajes
  ALTER COLUMN processing_status SET DEFAULT 'pending';


-- ════════════════════════════════════════════════════
-- TABLA: ai_settings
-- Configuración de IA por sucursal (relación 1:1).
-- Una fila por sucursal. Se crea manualmente desde la UI
-- de Configuración cuando el admin habilita la capa IA.
--
-- IMPORTANTE: activo = FALSE por defecto.
-- El bot está completamente apagado hasta que el admin
-- lo encienda deliberadamente desde Configuración → IA.
-- ════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS ai_settings (
  id                            UUID         DEFAULT uuid_generate_v4() PRIMARY KEY,
  sucursal_id                   UUID         NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,

  -- Kill switch global. FALSE = IA completamente inactiva para esta sucursal.
  activo                        BOOLEAN      NOT NULL DEFAULT FALSE,
  auto_reply_enabled            BOOLEAN      NOT NULL DEFAULT FALSE,
  -- Lista de canales con auto-reply activo. Ej: '{whatsapp}' o '{whatsapp,email}'
  auto_reply_channels           TEXT[]       NOT NULL DEFAULT '{}'::TEXT[],

  -- Si el score de confianza de la IA está por debajo, escala a humano.
  confidence_threshold          NUMERIC(4,3) NOT NULL DEFAULT 0.850
                                CHECK (confidence_threshold BETWEEN 0 AND 1),
  -- Después de este número de respuestas automáticas, el hilo escala siempre.
  max_auto_replies_per_thread   INTEGER      NOT NULL DEFAULT 3,

  -- Usuario al que se escala cuando no hay assignee en el hilo
  escalation_assignee_id        UUID         REFERENCES usuarios(id) ON DELETE SET NULL,

  -- Modelos de IA (sobreescribibles por sucursal)
  intent_model                  TEXT         NOT NULL DEFAULT 'claude-haiku-4-5-20251001',
  reply_model                   TEXT         NOT NULL DEFAULT 'claude-sonnet-4-6',

  -- Personalidad del bot
  bot_name                      TEXT         NOT NULL DEFAULT 'Asistente',
  bot_persona                   TEXT,                              -- instrucciones de tono/voz

  -- Horario del bot (sobreescribe el de sucursales si se define)
  horario_bot_inicio            TIME         NOT NULL DEFAULT '08:00',
  horario_bot_fin               TIME         NOT NULL DEFAULT '19:30',

  creado_at                     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  actualizado_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  UNIQUE(sucursal_id)
);

CREATE TRIGGER t_ai_settings_updated
  BEFORE UPDATE ON ai_settings
  FOR EACH ROW EXECUTE FUNCTION set_actualizado_at();

ALTER TABLE ai_settings ENABLE ROW LEVEL SECURITY;

-- Cualquier usuario de la sucursal puede leer la config IA
CREATE POLICY "ai_settings_select" ON ai_settings
  FOR SELECT USING (sucursal_id = get_mi_sucursal_id());

-- INSERT y UPDATE: la policy solo valida sucursal.
-- La validación de rol (solo admin/gerente) se hace en la server action.
-- TODO Sprint 2: endurecer con RLS por rol usando get_mi_rol() o similar.
CREATE POLICY "ai_settings_insert" ON ai_settings
  FOR INSERT WITH CHECK (sucursal_id = get_mi_sucursal_id());

CREATE POLICY "ai_settings_update" ON ai_settings
  FOR UPDATE USING (sucursal_id = get_mi_sucursal_id());


-- ════════════════════════════════════════════════════
-- TABLA: conversation_threads
-- Agrupa mensajes de un mismo contexto operacional.
-- Un cliente puede tener múltiples hilos abiertos
-- si son de contextos distintos (cita activa + OT activa).
--
-- IMPORTANTE — contexto_id:
-- FK lógica SIN constraint declarado de forma intencional.
-- contexto_id puede apuntar a citas, ordenes_trabajo,
-- cotizaciones o leads según el valor de contexto_tipo.
-- La integridad se mantiene por convención en código:
-- nunca borrar un registro sin resolver los hilos vinculados.
--
-- Los índices parciales únicos (uq_thread_activo_*)
-- previenen race conditions al crear hilos duplicados.
-- ════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS conversation_threads (
  id                        UUID         DEFAULT uuid_generate_v4() PRIMARY KEY,
  sucursal_id               UUID         NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
  cliente_id                UUID         NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,

  canal                     TEXT         NOT NULL
                            CHECK (canal IN ('whatsapp','email','facebook','instagram')),

  -- Módulo al que pertenece el hilo
  contexto_tipo             TEXT         NOT NULL DEFAULT 'general'
                            CHECK (contexto_tipo IN ('cita','ot','cotizacion','lead','general','postventa')),
  -- FK lógica al registro específico (sin constraint — ver nota arriba)
  contexto_id               UUID,

  thread_origin             TEXT         NOT NULL DEFAULT 'inbound'
                            CHECK (thread_origin IN ('inbound','outbound_manual','outbound_bot','import')),

  estado                    TEXT         NOT NULL DEFAULT 'open'
                            CHECK (estado IN ('open','waiting_customer','waiting_agent','closed','archived')),
  closed_reason             TEXT
                            CHECK (closed_reason IN ('resolved','merged','spam','no_response','transferred')),

  assignee_id               UUID         REFERENCES usuarios(id) ON DELETE SET NULL,

  -- Tiempos para SLA y ordenamiento en bandeja
  last_message_at           TIMESTAMPTZ,
  last_customer_message_at  TIMESTAMPTZ,
  last_agent_message_at     TIMESTAMPTZ,
  -- Permite mostrar badge en bandeja sin consultar la tabla mensajes
  last_message_source       TEXT
                            CHECK (last_message_source IN ('customer','agent_manual','agent_bot','system')),

  -- Counter denormalizado para rendimiento (evita COUNT en cada render)
  message_count             INTEGER      NOT NULL DEFAULT 0,

  -- Resumen generado por IA. Se actualiza periódicamente, no en cada mensaje.
  ai_summary                TEXT,

  -- Datos adicionales según contexto_tipo. No estructurar en exceso.
  metadata                  JSONB        NOT NULL DEFAULT '{}'::JSONB,

  creado_at                 TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  actualizado_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TRIGGER t_threads_updated
  BEFORE UPDATE ON conversation_threads
  FOR EACH ROW EXECUTE FUNCTION set_actualizado_at();

-- Índice principal para bandeja (lista de conversaciones, ordenada por actividad)
CREATE INDEX IF NOT EXISTS idx_threads_bandeja
  ON conversation_threads(sucursal_id, estado, last_message_at DESC);

-- Búsqueda de hilos de un cliente específico
CREATE INDEX IF NOT EXISTS idx_threads_cliente
  ON conversation_threads(cliente_id, canal);

-- Unicidad de hilo activo CON contexto explícito (cita, ot, cotizacion, lead)
CREATE UNIQUE INDEX IF NOT EXISTS uq_thread_activo_con_contexto
  ON conversation_threads(cliente_id, canal, contexto_tipo, contexto_id)
  WHERE estado IN ('open','waiting_customer','waiting_agent')
    AND contexto_id IS NOT NULL;

-- Unicidad de hilo activo SIN contexto (tipo general o postventa)
CREATE UNIQUE INDEX IF NOT EXISTS uq_thread_activo_general
  ON conversation_threads(cliente_id, canal, contexto_tipo)
  WHERE estado IN ('open','waiting_customer','waiting_agent')
    AND contexto_id IS NULL;

ALTER TABLE conversation_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "threads_select" ON conversation_threads
  FOR SELECT USING (sucursal_id = get_mi_sucursal_id());

CREATE POLICY "threads_insert" ON conversation_threads
  FOR INSERT WITH CHECK (sucursal_id = get_mi_sucursal_id());

CREATE POLICY "threads_update" ON conversation_threads
  FOR UPDATE USING (sucursal_id = get_mi_sucursal_id());


-- ════════════════════════════════════════════════════
-- TABLA: outbound_queue
-- Cola de mensajes para envío diferido.
-- Casos: fuera de horario del bot, aprobación manual
--        requerida, reintentos por fallo de API.
--
-- INSERT: solo desde service role (createAdminClient).
-- UPDATE (sent/failed): service role desde cron flush.
-- UPDATE (approved_by_id): server action autenticada.
-- ════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS outbound_queue (
  id                    UUID         DEFAULT uuid_generate_v4() PRIMARY KEY,
  sucursal_id           UUID         NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,

  canal                 TEXT         NOT NULL CHECK (canal IN ('whatsapp','email')),
  destinatario_tipo     TEXT         NOT NULL CHECK (destinatario_tipo IN ('cliente','usuario')),
  destinatario_id       UUID         NOT NULL,
  destinatario_telefono TEXT,                                      -- para WA
  destinatario_email    TEXT,                                      -- para email

  contenido             TEXT         NOT NULL,
  template_key          TEXT,                                      -- template Meta aprobado (si aplica)
  template_vars         JSONB        NOT NULL DEFAULT '{}'::JSONB,

  -- Quién originó este mensaje encolado
  workflow_key          TEXT         NOT NULL,
  message_source        TEXT         NOT NULL DEFAULT 'bot'
                        CHECK (message_source IN ('bot','system','agent_queued')),

  -- Flujo de aprobación manual
  approval_required     BOOLEAN      NOT NULL DEFAULT FALSE,
  approved_by_id        UUID         REFERENCES usuarios(id) ON DELETE SET NULL,
  approved_at           TIMESTAMPTZ,

  -- Previene doble inserción si el mismo trigger se ejecuta dos veces
  idempotency_key       TEXT         NOT NULL,

  -- Estados: pending → (pending_approval → approved) → sent | failed | cancelled
  estado                TEXT         NOT NULL DEFAULT 'pending'
                        CHECK (estado IN ('pending','pending_approval','approved','sent','failed','cancelled')),
  intentos              INTEGER      NOT NULL DEFAULT 0,
  max_intentos          INTEGER      NOT NULL DEFAULT 3,
  send_after            TIMESTAMPTZ  NOT NULL,                     -- cuándo enviar
  sent_at               TIMESTAMPTZ,
  error_detail          TEXT,

  -- Trazabilidad al registro que originó este mensaje
  referencia_tipo       TEXT
                        CHECK (referencia_tipo IN ('cita','ot','cotizacion','lead','mensaje','vehiculo','thread','cliente')),
  referencia_id         UUID,

  creado_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  UNIQUE(idempotency_key)
);

-- Índice principal para el cron que procesa la cola
CREATE INDEX IF NOT EXISTS idx_outbound_cron
  ON outbound_queue(sucursal_id, estado, send_after)
  WHERE estado IN ('pending','approved');

-- Índice para la UI de aprobaciones pendientes
CREATE INDEX IF NOT EXISTS idx_outbound_approval
  ON outbound_queue(sucursal_id, estado)
  WHERE approval_required = TRUE AND estado = 'pending_approval';

ALTER TABLE outbound_queue ENABLE ROW LEVEL SECURITY;

-- Agentes ven la cola de su sucursal (para UI de aprobación)
CREATE POLICY "outbound_select" ON outbound_queue
  FOR SELECT USING (sucursal_id = get_mi_sucursal_id());

-- Agentes pueden actualizar (aprobar) mensajes de su sucursal
-- La validación de rol va en la server action
CREATE POLICY "outbound_update" ON outbound_queue
  FOR UPDATE USING (sucursal_id = get_mi_sucursal_id());

-- Sin policy de INSERT para usuarios — solo service role inserta aquí


-- ════════════════════════════════════════════════════
-- TABLA: automation_logs
-- Auditoría de automatizaciones ejecutadas.
-- Append-only: solo INSERT, nunca UPDATE ni DELETE.
--
-- INSERT: exclusivamente desde service role.
-- SELECT: lectura para agentes (UI de configuración/auditoría).
-- ════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS automation_logs (
  id                      UUID         DEFAULT uuid_generate_v4() PRIMARY KEY,
  sucursal_id             UUID         NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,

  -- Identificación de la automatización ejecutada
  workflow_key            TEXT         NOT NULL,  -- 'recordatorio_cita_24h' | 'intent_classify' | etc.
  rule_key                TEXT,                    -- sub-regla si el workflow tiene ramas

  -- Previene doble logging si el cron se ejecuta dos veces
  idempotency_key         TEXT         NOT NULL,

  -- Resultado de la ejecución
  estado                  TEXT         NOT NULL
                          CHECK (estado IN ('success','failed','skipped','queued_after_hours')),
  queued_for_after_hours  BOOLEAN      NOT NULL DEFAULT FALSE,
  scheduled_for           TIMESTAMPTZ,             -- cuándo estaba programado
  executed_at             TIMESTAMPTZ,             -- cuándo se ejecutó realmente

  -- Canal involucrado (si la automatización envió un mensaje)
  canal                   TEXT         CHECK (canal IN ('whatsapp','email','push')),

  -- Trazabilidad al registro que originó la automatización
  referencia_tipo         TEXT         NOT NULL
                          CHECK (referencia_tipo IN ('cita','ot','cotizacion','lead','mensaje','vehiculo','thread','cliente')),
  referencia_id           UUID         NOT NULL,

  -- Texto breve del resultado. No guardar JSON completo de respuesta de API.
  resultado_detalle       TEXT,

  creado_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  UNIQUE(idempotency_key)
);

-- Consultar logs por tipo de automatización y fecha
CREATE INDEX IF NOT EXISTS idx_automation_workflow
  ON automation_logs(sucursal_id, workflow_key, creado_at DESC);

-- Buscar todos los logs de un registro específico
CREATE INDEX IF NOT EXISTS idx_automation_referencia
  ON automation_logs(referencia_tipo, referencia_id);

ALTER TABLE automation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "automation_logs_select" ON automation_logs
  FOR SELECT USING (sucursal_id = get_mi_sucursal_id());

-- Sin policy de INSERT — solo service role inserta aquí


-- ════════════════════════════════════════════════════
-- FIN SECCIÓN 1
-- ════════════════════════════════════════════════════
--
-- Verificación post-ejecución (Sección 1):
--
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public'
-- AND table_name IN (
--   'mensajes','ai_settings','conversation_threads',
--   'outbound_queue','automation_logs'
-- )
-- ORDER BY table_name;
-- → debe devolver 5 filas
--
-- SELECT column_name, column_default, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'mensajes'
-- AND column_name IN ('thread_id','message_source','wa_message_id',
--                     'ai_intent','ai_sentiment','processing_status')
-- ORDER BY column_name;
-- → processing_status debe tener column_default = 'pending'
-- ════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════
-- SECCIÓN 2 — ÍNDICES EN TABLA mensajes
-- EJECUTAR EN UNA SEGUNDA PASADA EN EL SQL EDITOR.
-- (nueva pestaña o nueva ejecución = nueva transacción)
--
-- NOTA: mensajes usa enviado_at como timestamp principal.
--       No existe creado_at en esta tabla.
-- ════════════════════════════════════════════════════

-- Lookup de mensajes por hilo (query principal de bandeja)
CREATE INDEX IF NOT EXISTS idx_mensajes_thread
  ON mensajes(thread_id)
  WHERE thread_id IS NOT NULL;

-- Deduplicación de mensajes entrantes por ID de Meta
-- Previene duplicados si el webhook de Meta se dispara más de una vez
CREATE UNIQUE INDEX IF NOT EXISTS idx_mensajes_wa_message_id
  ON mensajes(wa_message_id)
  WHERE wa_message_id IS NOT NULL;

-- Cola de procesamiento IA: mensajes nuevos pendientes de clasificar
-- Los mensajes históricos (processing_status = NULL) no aparecen aquí
CREATE INDEX IF NOT EXISTS idx_mensajes_processing
  ON mensajes(processing_status, enviado_at)
  WHERE processing_status = 'pending';

-- ════════════════════════════════════════════════════
-- FIN SECCIÓN 2
-- ════════════════════════════════════════════════════
