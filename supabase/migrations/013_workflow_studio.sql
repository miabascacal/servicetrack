-- ════════════════════════════════════════════════════
-- 013_workflow_studio.sql
-- Tablas: automation_rules, automation_rule_logs
-- Base para el constructor visual de automatizaciones
-- ════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS automation_rules (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sucursal_id     UUID REFERENCES sucursales(id) NOT NULL,
  nombre          TEXT NOT NULL,
  descripcion     TEXT,
  activa          BOOLEAN DEFAULT TRUE,

  -- Trigger: qué evento dispara esta regla
  trigger_tipo    TEXT NOT NULL CHECK (trigger_tipo IN (
    'cita_confirmada','cita_cancelada','cita_no_show',
    'ot_creada','ot_estado_cambio','ot_entregada',
    'lead_creado','lead_estado_cambio',
    'csi_respondida','manual'
  )),

  -- Condiciones adicionales en formato JSONB
  -- Ejemplo: {"estado": "confirmada", "canal": "whatsapp"}
  trigger_condiciones JSONB DEFAULT '{}',

  -- Lista ordenada de acciones a ejecutar
  -- Ejemplo: [{"tipo":"enviar_wa","mensaje":"Hola {nombre}..."},{"tipo":"crear_actividad","tipo_actividad":"seguimiento"}]
  acciones        JSONB DEFAULT '[]',

  creada_por_id   UUID REFERENCES usuarios(id),
  ultima_ejecucion_at  TIMESTAMPTZ,
  ejecuciones_total    INTEGER DEFAULT 0,

  creada_at       TIMESTAMPTZ DEFAULT NOW(),
  actualizada_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS automation_rule_logs (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  rule_id         UUID REFERENCES automation_rules(id) ON DELETE CASCADE NOT NULL,
  sucursal_id     UUID REFERENCES sucursales(id) NOT NULL,

  trigger_tipo    TEXT NOT NULL,
  entidad_tipo    TEXT,
  entidad_id      UUID,

  resultado       TEXT DEFAULT 'ok' CHECK (resultado IN ('ok','error','skipped')),
  detalle         JSONB DEFAULT '{}',

  ejecutado_at    TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_rule_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "automation_rules_sucursal" ON automation_rules
  FOR ALL USING (sucursal_id = get_mi_sucursal_id());

CREATE POLICY "automation_rule_logs_sucursal" ON automation_rule_logs
  FOR ALL USING (sucursal_id = get_mi_sucursal_id());

-- Grants
GRANT ALL ON automation_rules TO authenticated;
GRANT ALL ON automation_rule_logs TO authenticated;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_automation_rules_sucursal ON automation_rules(sucursal_id);
CREATE INDEX IF NOT EXISTS idx_automation_rules_activa ON automation_rules(sucursal_id, activa);
CREATE INDEX IF NOT EXISTS idx_automation_rule_logs_rule ON automation_rule_logs(rule_id);
CREATE INDEX IF NOT EXISTS idx_automation_rule_logs_sucursal ON automation_rule_logs(sucursal_id);
