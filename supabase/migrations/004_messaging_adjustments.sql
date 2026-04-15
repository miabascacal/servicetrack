-- ════════════════════════════════════════════════════
-- MIGRACIÓN 004 — MESSAGING ADJUSTMENTS
-- Sprint 8 Fase 1: alineación de vocabulario semántico
--
-- PREREQUISITOS OBLIGATORIOS (ejecutar antes de esta migración):
--
--   SELECT COUNT(*) FROM mensajes;              -- debe ser 0
--   SELECT COUNT(*) FROM conversation_threads;  -- debe ser 0
--
--   SELECT conname, pg_get_constraintdef(oid)
--   FROM   pg_constraint
--   WHERE  conrelid IN ('mensajes'::regclass, 'conversation_threads'::regclass)
--     AND  contype  = 'c'
--   ORDER  BY conname;
--   → confirmar nombres exactos antes del DROP
--
-- CAMBIOS:
--
--   mensajes.message_source
--     Antes: ('customer','agent_manual','agent_bot','system','import')
--     Después: ('customer','agent','agent_bot','system','import')
--     Razón: 'agent' es el término semántico correcto para el asesor humano.
--            'import' se conserva para migración histórica de datos desde Autoline.
--
--   mensajes.processing_status
--     Antes: ('pending','processing','done','failed')
--     Después: ('pending','processing','processed','skipped','error')
--     Razón: vocabulario alineado con el ciclo real de clasificación IA.
--            'processed'  = clasificado y resuelto (reemplaza 'done')
--            'skipped'    = excluido del clasificador (mensajes salientes)
--            'error'      = fallo en clasificación (reemplaza 'failed')
--
--   conversation_threads.last_message_source
--     Antes: ('customer','agent_manual','agent_bot','system')
--     Después: ('customer','agent','agent_bot','system')
--     Razón: alineación con mensajes.message_source.
--            'import' NO se agrega: no aplica a estado conversacional activo.
--
-- NOTAS DE ARQUITECTURA:
--   - Las tablas mensajes y conversation_threads se crearon en 003 y no
--     tienen filas productivas todavía (webhook no activo, lib/whatsapp.ts
--     escribe solo en wa_mensajes_log). El DROP/ADD es seguro.
--   - Esta migración no toca wa_mensajes_log ni ninguna otra tabla.
--   - Esta migración es prerequisito para el código de lib/threads.ts
--     y lib/whatsapp.ts de la Fase 1. No desplegar código antes de
--     ejecutar esta migración.
--
-- Fecha: 2026-04-14
-- ════════════════════════════════════════════════════


-- ── 1. mensajes.message_source ────────────────────────────────────────────

ALTER TABLE mensajes
  DROP CONSTRAINT IF EXISTS mensajes_message_source_check;

ALTER TABLE mensajes
  ADD CONSTRAINT mensajes_message_source_check
  CHECK (message_source IN ('customer', 'agent', 'agent_bot', 'system', 'import'));


-- ── 2. mensajes.processing_status ────────────────────────────────────────

ALTER TABLE mensajes
  DROP CONSTRAINT IF EXISTS mensajes_processing_status_check;

ALTER TABLE mensajes
  ADD CONSTRAINT mensajes_processing_status_check
  CHECK (processing_status IN ('pending', 'processing', 'processed', 'skipped', 'error'));


-- ── 3. conversation_threads.last_message_source ───────────────────────────

ALTER TABLE conversation_threads
  DROP CONSTRAINT IF EXISTS conversation_threads_last_message_source_check;

ALTER TABLE conversation_threads
  ADD CONSTRAINT conversation_threads_last_message_source_check
  CHECK (last_message_source IN ('customer', 'agent', 'agent_bot', 'system'));


-- ════════════════════════════════════════════════════
-- Verificación post-ejecución
--
-- SELECT conname, pg_get_constraintdef(oid) AS definition
-- FROM   pg_constraint
-- WHERE  conrelid IN ('mensajes'::regclass, 'conversation_threads'::regclass)
--   AND  conname IN (
--     'mensajes_message_source_check',
--     'mensajes_processing_status_check',
--     'conversation_threads_last_message_source_check'
--   )
-- ORDER  BY conname;
-- → debe devolver 3 filas con los valores nuevos
-- ════════════════════════════════════════════════════
