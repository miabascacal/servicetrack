-- ════════════════════════════════════════════════════
-- 007_canal_interno_enum.sql
-- Sprint 8 — Corrección: agregar 'interno' al ENUM canal_mensaje
--            + trigger para message_count automático
--
-- CAUSA RAÍZ:
--   Migration 006 expandió el CHECK constraint de conversation_threads.canal
--   para incluir 'interno'. Pero mensajes.canal usa el ENUM canal_mensaje,
--   no un CHECK constraint. El ENUM no incluía 'interno' → los INSERTs de
--   eventos internos de OT fallaban silenciosamente (caught by try/catch).
--
-- CAMBIOS:
--
--   1. ALTER TYPE canal_mensaje ADD VALUE IF NOT EXISTS 'interno'
--      Agrega el valor al ENUM de forma idempotente.
--      Después de esto, mensajes.canal acepta 'interno'.
--
--   2. Trigger t_mensajes_increment_count
--      Incrementa conversation_threads.message_count en cada INSERT
--      en mensajes que tenga thread_id. Automático, no requiere cambio
--      en código de aplicación.
--      SECURITY DEFINER: corre con permisos del owner (service role),
--      no del usuario que hace el INSERT.
--
-- PREREQUISITOS:
--   - 006_ot_dms_and_taller_events.sql ejecutada
--   - ENUM canal_mensaje existe (creado al bootstrapear desde SUPABASE_SCHEMA.sql)
--
-- NOTA IMPORTANTE — ALTER TYPE ADD VALUE:
--   En PostgreSQL 12+ (Supabase usa PG15), ADD VALUE se puede ejecutar dentro
--   de una transacción. El valor nuevo NO es visible dentro de la misma
--   transacción que lo crea, pero sí en transacciones posteriores.
--   Esto es correcto para una migración: el trigger y las policies que siguen
--   en este mismo script no leen el nuevo valor, solo lo registran.
--
-- Verificación post-ejecución (ejecutar en SQL Editor):
--
--   -- Confirmar que 'interno' está en el ENUM:
--   SELECT enumlabel FROM pg_enum
--   WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'canal_mensaje')
--   ORDER BY enumsortorder;
--   → debe incluir 'interno'
--
--   -- Confirmar que el trigger existe:
--   SELECT tgname FROM pg_trigger WHERE tgname = 't_mensajes_increment_count';
--   → debe devolver 1 fila
-- ════════════════════════════════════════════════════


-- ── 1. Agregar 'interno' al ENUM canal_mensaje ────────────────────────────
-- IF NOT EXISTS: idempotente. Si ya existe, no hace nada.

ALTER TYPE canal_mensaje ADD VALUE IF NOT EXISTS 'interno';


-- ── 2. Trigger para incrementar message_count ─────────────────────────────
-- Se ejecuta AFTER INSERT en mensajes.
-- Solo actúa si el mensaje tiene thread_id (mensajes sin hilo no afectan contador).

CREATE OR REPLACE FUNCTION fn_increment_thread_message_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.thread_id IS NOT NULL THEN
    UPDATE conversation_threads
    SET message_count = message_count + 1
    WHERE id = NEW.thread_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Eliminar el trigger si ya existe (idempotente)
DROP TRIGGER IF EXISTS t_mensajes_increment_count ON mensajes;

CREATE TRIGGER t_mensajes_increment_count
  AFTER INSERT ON mensajes
  FOR EACH ROW
  EXECUTE FUNCTION fn_increment_thread_message_count();
