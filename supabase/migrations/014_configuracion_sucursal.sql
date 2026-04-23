-- 014_configuracion_sucursal.sql
-- Tablas de configuración operativa por sucursal para citas y taller

CREATE TABLE IF NOT EXISTS configuracion_citas_sucursal (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sucursal_id       UUID NOT NULL UNIQUE REFERENCES sucursales(id) ON DELETE CASCADE,
  horario_inicio    TIME NOT NULL DEFAULT '08:00',
  horario_fin       TIME NOT NULL DEFAULT '18:00',
  dias_disponibles  INTEGER[] NOT NULL DEFAULT '{1,2,3,4,5,6}',
  intervalo_minutos INTEGER NOT NULL DEFAULT 30 CHECK (intervalo_minutos IN (15, 30, 60)),
  activa            BOOLEAN NOT NULL DEFAULT true,
  creado_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS configuracion_taller_sucursal (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sucursal_id       UUID NOT NULL UNIQUE REFERENCES sucursales(id) ON DELETE CASCADE,
  horario_inicio    TIME NOT NULL DEFAULT '08:00',
  horario_fin       TIME NOT NULL DEFAULT '18:00',
  dias_disponibles  INTEGER[] NOT NULL DEFAULT '{1,2,3,4,5,6}',
  capacidad_bahias  INTEGER NOT NULL DEFAULT 4 CHECK (capacidad_bahias > 0),
  notas_operativas  TEXT,
  creado_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE configuracion_citas_sucursal ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracion_taller_sucursal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "citas_config_select" ON configuracion_citas_sucursal
  FOR SELECT USING (sucursal_id = get_mi_sucursal_id());

CREATE POLICY "citas_config_all" ON configuracion_citas_sucursal
  FOR ALL USING (sucursal_id = get_mi_sucursal_id());

CREATE POLICY "taller_config_select" ON configuracion_taller_sucursal
  FOR SELECT USING (sucursal_id = get_mi_sucursal_id());

CREATE POLICY "taller_config_all" ON configuracion_taller_sucursal
  FOR ALL USING (sucursal_id = get_mi_sucursal_id());
