-- Sprint 8 Fase 2 — Fix: add bot_active to conversation_threads estado CHECK constraint
-- bot_active = bot está manejando la conversación activamente
-- without this, every webhook update to bot_active fails with a CHECK violation

ALTER TABLE conversation_threads
  DROP CONSTRAINT IF EXISTS conversation_threads_estado_check;

ALTER TABLE conversation_threads
  ADD CONSTRAINT conversation_threads_estado_check
  CHECK (estado IN ('open', 'waiting_customer', 'waiting_agent', 'closed', 'archived', 'bot_active'));
