-- 020_configuracion_horarios_sucursal.sql
-- Soporte para horarios por módulo/día de semana, días no laborables y timezone por sucursal

-- 1. Timezone por sucursal (fallback: America/Mexico_City)
ALTER TABLE configuracion_citas_sucursal
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'America/Mexico_City';

-- 2. Horarios por módulo + día de semana (overrides sobre horario_inicio/fin global)
--    modulo: 'citas' | 'taller' | etc. (default 'citas')
--    dia_semana: 0=domingo, 1=lunes, ..., 6=sábado
--    Si existe fila activa para el módulo+día, se usa su horario en lugar del global.
--    Si NO existe, se consulta horario_inicio/horario_fin de configuracion_citas_sucursal.
CREATE TABLE IF NOT EXISTS configuracion_horarios_sucursal (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sucursal_id    UUID NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
  modulo         TEXT NOT NULL DEFAULT 'citas',
  dia_semana     INTEGER NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  horario_inicio TIME NOT NULL,
  horario_fin    TIME NOT NULL,
  activo         BOOLEAN NOT NULL DEFAULT true,
  creado_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (sucursal_id, modulo, dia_semana)
);

-- 3. Días no laborables por sucursal/módulo (feriados, cierres temporales)
--    modulo nullable: NULL = aplica a todos los módulos; valor específico = solo ese módulo.
--    activa: permite desactivar una entrada sin borrarla.
CREATE TABLE IF NOT EXISTS configuracion_dias_no_laborables (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sucursal_id UUID NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
  fecha       DATE NOT NULL,
  modulo      TEXT,
  motivo      TEXT,
  activa      BOOLEAN NOT NULL DEFAULT true,
  creado_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique indexes para días no laborables.
-- UNIQUE constraint estándar no previene duplicados cuando modulo IS NULL (NULL != NULL en SQL),
-- así que se usan dos índices parciales separados.
CREATE UNIQUE INDEX IF NOT EXISTS uq_dias_no_lab_con_modulo
  ON configuracion_dias_no_laborables (sucursal_id, modulo, fecha)
  WHERE modulo IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_dias_no_lab_sin_modulo
  ON configuracion_dias_no_laborables (sucursal_id, fecha)
  WHERE modulo IS NULL;

ALTER TABLE configuracion_horarios_sucursal  ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracion_dias_no_laborables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "horarios_config_all" ON configuracion_horarios_sucursal
  FOR ALL USING (sucursal_id = get_mi_sucursal_id());

CREATE POLICY "dias_no_lab_all" ON configuracion_dias_no_laborables
  FOR ALL USING (sucursal_id = get_mi_sucursal_id());
