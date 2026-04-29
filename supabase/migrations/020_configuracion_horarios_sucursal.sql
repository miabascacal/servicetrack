-- 020_configuracion_horarios_sucursal.sql
-- Soporte para horarios por día de semana, días no laborables y timezone por sucursal

-- 1. Timezone por sucursal (fallback: America/Mexico_City)
ALTER TABLE configuracion_citas_sucursal
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'America/Mexico_City';

-- 2. Horarios por día de semana (overrides sobre horario_inicio/fin global)
--    dia_semana: 0=domingo, 1=lunes, ..., 6=sábado
--    Si existe una fila para el día, se usa su horario en lugar del global.
--    Si NO existe, se usa horario_inicio/horario_fin de configuracion_citas_sucursal.
CREATE TABLE IF NOT EXISTS configuracion_horarios_sucursal (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sucursal_id    UUID NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
  dia_semana     INTEGER NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  horario_inicio TIME NOT NULL,
  horario_fin    TIME NOT NULL,
  activo         BOOLEAN NOT NULL DEFAULT true,
  creado_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (sucursal_id, dia_semana)
);

-- 3. Días no laborables por sucursal (feriados, cierres temporales)
--    Si la fecha aparece aquí, buscarDisponibilidad retorna 0 slots disponibles.
CREATE TABLE IF NOT EXISTS configuracion_dias_no_laborables (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sucursal_id UUID NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
  fecha       DATE NOT NULL,
  motivo      TEXT,
  creado_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (sucursal_id, fecha)
);

ALTER TABLE configuracion_horarios_sucursal  ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracion_dias_no_laborables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "horarios_config_all" ON configuracion_horarios_sucursal
  FOR ALL USING (sucursal_id = get_mi_sucursal_id());

CREATE POLICY "dias_no_lab_all" ON configuracion_dias_no_laborables
  FOR ALL USING (sucursal_id = get_mi_sucursal_id());
