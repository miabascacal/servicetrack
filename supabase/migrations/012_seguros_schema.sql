-- ════════════════════════════════════════════════════
-- 012_seguros_schema.sql
-- Tipos: tipo_poliza, estado_poliza
-- Tablas: companias_seguro, seguros_vehiculo
-- ════════════════════════════════════════════════════

DO $$ BEGIN
  CREATE TYPE tipo_poliza AS ENUM ('NF','NP','XF','XP');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE estado_poliza AS ENUM ('M','N','C','I');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS companias_seguro (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  grupo_id    UUID REFERENCES grupos(id) NOT NULL,
  nombre      TEXT NOT NULL,
  clave       TEXT,
  activa      BOOLEAN DEFAULT TRUE,
  creado_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(grupo_id, nombre)
);

CREATE TABLE IF NOT EXISTS seguros_vehiculo (
  id                          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  vehiculo_id                 UUID REFERENCES vehiculos(id) ON DELETE CASCADE NOT NULL,
  cliente_id                  UUID REFERENCES clientes(id) NOT NULL,
  sucursal_id                 UUID REFERENCES sucursales(id),
  compania_seguro_id          UUID REFERENCES companias_seguro(id),

  numero_poliza               TEXT,
  propietario_poliza          TEXT,
  telefono_contacto           TEXT,

  fecha_inicio                DATE,
  fecha_fin                   DATE,

  tipo_poliza                 tipo_poliza,
  estado                      estado_poliza DEFAULT 'N',

  -- Coberturas principales
  cob_terceros                BOOLEAN DEFAULT FALSE,
  monto_terceros              DECIMAL(12,2),
  cob_robo                    BOOLEAN DEFAULT FALSE,
  monto_robo                  DECIMAL(12,2),
  cob_dano_vehiculo           BOOLEAN DEFAULT FALSE,
  monto_dano_vehiculo         DECIMAL(12,2),
  cob_parabrisas              BOOLEAN DEFAULT FALSE,
  monto_parabrisas            DECIMAL(12,2),

  referencia                  TEXT,
  notas                       TEXT,

  alerta_vencimiento_enviada  BOOLEAN DEFAULT FALSE,
  alerta_vencimiento_at       TIMESTAMPTZ,

  operario_creacion_id        UUID REFERENCES usuarios(id),
  creado_at                   TIMESTAMPTZ DEFAULT NOW(),
  actualizado_at              TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE companias_seguro ENABLE ROW LEVEL SECURITY;
ALTER TABLE seguros_vehiculo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "companias_seguro_grupo" ON companias_seguro
  FOR ALL USING (grupo_id = get_mi_grupo_id());

CREATE POLICY "seguros_vehiculo_sucursal" ON seguros_vehiculo
  FOR ALL USING (sucursal_id = get_mi_sucursal_id());

-- Grants
GRANT ALL ON companias_seguro TO authenticated;
GRANT ALL ON seguros_vehiculo TO authenticated;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_seguros_vehiculo ON seguros_vehiculo(vehiculo_id);
CREATE INDEX IF NOT EXISTS idx_seguros_cliente ON seguros_vehiculo(cliente_id);
CREATE INDEX IF NOT EXISTS idx_seguros_fecha_fin ON seguros_vehiculo(fecha_fin)
  WHERE alerta_vencimiento_enviada = FALSE;
CREATE INDEX IF NOT EXISTS idx_companias_grupo ON companias_seguro(grupo_id);
