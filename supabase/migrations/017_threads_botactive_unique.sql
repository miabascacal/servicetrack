-- Migración 017 — Expandir índices únicos parciales para incluir bot_active
--
-- Problema: uq_thread_activo_general y uq_thread_activo_con_contexto solo cubren
-- ('open','waiting_customer','waiting_agent'). Cuando un hilo pasa a bot_active,
-- queda fuera del constraint y getOrCreateThread puede crear un duplicado.
--
-- Fix: rehacer ambos índices incluyendo bot_active en la condición WHERE.

DROP INDEX IF EXISTS uq_thread_activo_con_contexto;
DROP INDEX IF EXISTS uq_thread_activo_general;

-- Hilo activo por cliente + canal + contexto_tipo + contexto_id (con contexto específico)
CREATE UNIQUE INDEX uq_thread_activo_con_contexto
  ON conversation_threads (cliente_id, canal, contexto_tipo, contexto_id)
  WHERE estado IN ('open', 'waiting_customer', 'waiting_agent', 'bot_active');

-- Hilo activo por cliente + canal + contexto_tipo (sin contexto_id — caso general/WA)
CREATE UNIQUE INDEX uq_thread_activo_general
  ON conversation_threads (cliente_id, canal, contexto_tipo)
  WHERE estado IN ('open', 'waiting_customer', 'waiting_agent', 'bot_active')
    AND contexto_id IS NULL;
