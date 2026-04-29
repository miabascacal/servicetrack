-- 021_workflow_automation_refacciones.sql
-- Extiende automation_rules con triggers para flujos de refacciones

-- Reemplaza el CHECK constraint de trigger_tipo para incluir nuevos tipos.
-- Los tipos anteriores se conservan; se añaden ot_pendiente_refacciones y solicitud_refacciones.
ALTER TABLE automation_rules DROP CONSTRAINT IF EXISTS automation_rules_trigger_tipo_check;

ALTER TABLE automation_rules
  ADD CONSTRAINT automation_rules_trigger_tipo_check
  CHECK (trigger_tipo IN (
    'cita_confirmada', 'cita_cancelada', 'cita_no_show',
    'ot_creada', 'ot_estado_cambio', 'ot_entregada',
    'ot_pendiente_refacciones',
    'lead_creado', 'lead_estado_cambio',
    'csi_respondida', 'manual',
    'solicitud_refacciones'
  ));

-- Documenta el uso esperado de trigger_condiciones para refacciones:
-- ot_pendiente_refacciones: { "pieza": "filtro aceite", "vehiculo_id": "...", "ot_id": "..." }
-- solicitud_refacciones:    { "pieza": "...", "vehiculo_id": "...", "cliente_id": "..." }
COMMENT ON COLUMN automation_rules.trigger_condiciones IS
  'Condiciones en JSONB. ot_pendiente_refacciones: {pieza, vehiculo_id, ot_id}. solicitud_refacciones: {pieza, vehiculo_id, cliente_id}.';
