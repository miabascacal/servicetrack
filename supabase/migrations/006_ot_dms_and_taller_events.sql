-- ════════════════════════════════════════════════════
-- 006_ot_dms_and_taller_events.sql
-- Sprint 8 — OT: soporte DMS + eventos internos de sistema
-- ════════════════════════════════════════════════════
--
-- CAMBIOS:
--
--   1. ordenes_trabajo.numero_ot_dms TEXT NULL
--      Identificador externo del DMS del cliente.
--      numero_ot  = identificador INTERNO generado por ServiceTrack.
--      numero_ot_dms = identificador EXTERNO del DMS (Autoline, etc).
--      Son conceptos distintos. Nunca reutilizar uno para el otro.
--      El campo es opcional: no todos los talleres usan DMS o tienen
--      integración activa al crear la OT.
--
--   2. Índice parcial en numero_ot_dms
--      Solo indexa filas con valor (NULL excluido).
--      Útil para reconciliación DMS↔ServiceTrack y búsqueda por número externo.
--
--   3. Expandir conversation_threads.canal para incluir 'interno'
--      Necesario para que Taller (y otros módulos futuros) puedan crear
--      hilos de auditoría/eventos del sistema sin requerir un canal externo
--      (WA, email, FB, IG). Los eventos internos son visibles en la bandeja
--      bajo el filtro "Todos", diferenciados por el indicador de canal.
--
-- PREREQUISITOS:
--   - 005_taller_foundation.sql ejecutada
--   - ordenes_trabajo y conversation_threads existen
--
-- IMPACTO EN CÓDIGO:
--   - app/actions/taller.ts: createOTAction y updateEstadoOTAction
--   - lib/threads.ts: ThreadCanal ahora incluye 'interno'
--   - app/(dashboard)/bandeja/_BandejaClient.tsx: BandejaCanal incluye 'interno'
-- ════════════════════════════════════════════════════


-- ── 1. numero_ot_dms en ordenes_trabajo ──────────────────────────────────

ALTER TABLE ordenes_trabajo
  ADD COLUMN IF NOT EXISTS numero_ot_dms TEXT NULL;

COMMENT ON COLUMN ordenes_trabajo.numero_ot IS
  'Identificador interno generado por ServiceTrack (formato OT-AAMMDD-XXXX). Inmutable una vez creado.';

COMMENT ON COLUMN ordenes_trabajo.numero_ot_dms IS
  'Identificador externo del DMS del cliente (Autoline, CDK, etc). Opcional. Nunca confundir con numero_ot.';

-- Índice parcial: solo filas con valor (no indexa NULLs)
CREATE INDEX IF NOT EXISTS idx_ot_dms
  ON ordenes_trabajo(numero_ot_dms)
  WHERE numero_ot_dms IS NOT NULL;


-- ── 2. Expandir canal en conversation_threads ─────────────────────────────
-- Permite crear hilos de tipo 'interno' para eventos del sistema
-- (OT creada, cambio de estado, etc.) sin necesitar un canal externo.

ALTER TABLE conversation_threads
  DROP CONSTRAINT IF EXISTS conversation_threads_canal_check;

ALTER TABLE conversation_threads
  ADD CONSTRAINT conversation_threads_canal_check
  CHECK (canal IN ('whatsapp', 'email', 'facebook', 'instagram', 'interno'));


-- ── 3. Verificación post-ejecución ───────────────────────────────────────
--
-- Confirmar columna y comentarios:
--   SELECT column_name, data_type, is_nullable, col_description(
--     (SELECT oid FROM pg_class WHERE relname = 'ordenes_trabajo'),
--     ordinal_position
--   ) AS comment
--   FROM information_schema.columns
--   WHERE table_name = 'ordenes_trabajo' AND column_name IN ('numero_ot', 'numero_ot_dms')
--   ORDER BY ordinal_position;
--
-- Confirmar constraint canal:
--   SELECT conname, pg_get_constraintdef(oid)
--   FROM pg_constraint
--   WHERE conrelid = 'conversation_threads'::regclass
--     AND conname = 'conversation_threads_canal_check';
--   → debe mostrar: canal IN ('whatsapp', 'email', 'facebook', 'instagram', 'interno')
