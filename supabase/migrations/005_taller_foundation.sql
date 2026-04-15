-- ════════════════════════════════════════════════════
-- 005_taller_foundation.sql
-- Módulo Taller: ordenes_trabajo + lineas_ot
-- ════════════════════════════════════════════════════
--
-- DEVIACIONES respecto a SUPABASE_SCHEMA.sql:
--   • km_ingreso      → el código usa este nombre (schema tenía km_entrada)
--   • diagnostico     → columna nueva, faltaba en el schema original
--   • updated_at      → el código usa este nombre (schema usaba actualizada_at)
--   • created_at      → el código usa este nombre (schema usaba creada_at)
--   • seguimiento_token → nombre en código (schema usaba token_seguimiento)
--   • cliente_id NOT NULL → el action valida que siempre exista
--
-- Requiere: extensión pgcrypto (para gen_random_bytes en seguimiento_token)
-- Si pgcrypto no está instalada, ejecutar primero:
--   CREATE EXTENSION IF NOT EXISTS "pgcrypto";
-- ════════════════════════════════════════════════════

-- ── 1. ENUM estado_ot ─────────────────────────────────────────────────────
-- Puede existir ya si SUPABASE_SCHEMA.sql fue ejecutado parcialmente.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_ot') THEN
    CREATE TYPE estado_ot AS ENUM (
      'recibido',
      'diagnostico',
      'en_reparacion',
      'listo',
      'entregado',
      'cancelado'
    );
  END IF;
END$$;

-- ── 2. TABLA ordenes_trabajo ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ordenes_trabajo (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

  -- Relaciones
  sucursal_id   UUID REFERENCES sucursales(id) NOT NULL,
  cliente_id    UUID REFERENCES clientes(id) NOT NULL,     -- requerido: validado en createOTAction
  vehiculo_id   UUID REFERENCES vehiculos(id),             -- nullable: vehículo puede no estar registrado
  cita_id       UUID REFERENCES citas(id),                 -- nullable: OT puede ser walk-in sin cita
  asesor_id     UUID REFERENCES usuarios(id),              -- nullable: permite importación/sistema

  -- Identificación
  numero_ot         TEXT UNIQUE NOT NULL,                  -- generado por generarNumeroOT()
  seguimiento_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),

  -- Estado — enum compartido con lib/ot-estados.ts
  estado        estado_ot NOT NULL DEFAULT 'recibido',

  -- Recepción
  km_ingreso    INTEGER,                                   -- ⚠ schema original tenía km_entrada
  diagnostico   TEXT,                                      -- ⚠ faltaba en schema original

  -- Notas y fechas
  notas_internas  TEXT,
  promesa_entrega TIMESTAMPTZ,
  fecha_entrega   TIMESTAMPTZ,

  -- Totales calculados por recalcularTotalesOT()
  total_mano_obra   DECIMAL(10,2) DEFAULT 0,
  total_refacciones DECIMAL(10,2) DEFAULT 0,
  total_ot          DECIMAL(10,2) DEFAULT 0,

  -- Timestamps — ⚠ código usa updated_at / created_at
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ── 3. TABLA lineas_ot ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS lineas_ot (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  ot_id           UUID REFERENCES ordenes_trabajo(id) ON DELETE CASCADE NOT NULL,

  -- Tipo: coincide con TIPO_CONFIG en LineasOT.tsx
  tipo            TEXT NOT NULL CHECK (tipo IN ('mano_obra', 'refaccion', 'fluido', 'externo', 'cortesia')),

  descripcion     TEXT NOT NULL,
  numero_parte    TEXT,                                    -- opcional, solo refacciones/fluidos

  cantidad        DECIMAL(10,2) DEFAULT 1 NOT NULL,
  precio_unitario DECIMAL(10,2),
  total           DECIMAL(10,2),                           -- calculado: cantidad × precio_unitario

  estado          TEXT DEFAULT 'pendiente'
                    CHECK (estado IN ('pendiente', 'en_proceso', 'terminado', 'cancelado')),

  aprobado_cliente BOOLEAN DEFAULT FALSE,

  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ── 4. TRIGGER updated_at en ordenes_trabajo ─────────────────────────────
-- Función propia porque update_updated_at() del schema base
-- setea "actualizada_at", no "updated_at".

CREATE OR REPLACE FUNCTION update_ot_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS t_ordenes_trabajo_updated ON ordenes_trabajo;
CREATE TRIGGER t_ordenes_trabajo_updated
  BEFORE UPDATE ON ordenes_trabajo
  FOR EACH ROW EXECUTE FUNCTION update_ot_updated_at();

-- ── 5. ÍNDICES ────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_ot_sucursal  ON ordenes_trabajo(sucursal_id);
CREATE INDEX IF NOT EXISTS idx_ot_cliente   ON ordenes_trabajo(cliente_id);
CREATE INDEX IF NOT EXISTS idx_ot_vehiculo  ON ordenes_trabajo(vehiculo_id);
CREATE INDEX IF NOT EXISTS idx_ot_numero    ON ordenes_trabajo(numero_ot);
CREATE INDEX IF NOT EXISTS idx_ot_estado    ON ordenes_trabajo(estado);
CREATE INDEX IF NOT EXISTS idx_ot_token     ON ordenes_trabajo(seguimiento_token);

CREATE INDEX IF NOT EXISTS idx_lineas_ot_ot   ON lineas_ot(ot_id);
CREATE INDEX IF NOT EXISTS idx_lineas_ot_tipo ON lineas_ot(ot_id, tipo);

-- ── 6. ROW LEVEL SECURITY ─────────────────────────────────────────────────

ALTER TABLE ordenes_trabajo ENABLE ROW LEVEL SECURITY;
ALTER TABLE lineas_ot       ENABLE ROW LEVEL SECURITY;

-- ordenes_trabajo: solo de mi sucursal
CREATE POLICY "ot_por_sucursal" ON ordenes_trabajo FOR ALL
  USING (sucursal_id = get_mi_sucursal_id())
  WITH CHECK (sucursal_id = get_mi_sucursal_id());

-- lineas_ot: acceso a través de la OT padre (misma sucursal)
CREATE POLICY "lineas_ot_sucursal" ON lineas_ot FOR ALL
  USING (
    ot_id IN (
      SELECT id FROM ordenes_trabajo
      WHERE sucursal_id = get_mi_sucursal_id()
    )
  )
  WITH CHECK (
    ot_id IN (
      SELECT id FROM ordenes_trabajo
      WHERE sucursal_id = get_mi_sucursal_id()
    )
  );

-- ── 7. VERIFICACIÓN ───────────────────────────────────────────────────────
-- Ejecutar en SQL Editor después de aplicar:
--
--   SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--   WHERE table_name = 'ordenes_trabajo'
--   ORDER BY ordinal_position;
--
--   SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--   WHERE table_name = 'lineas_ot'
--   ORDER BY ordinal_position;
--
--   SELECT COUNT(*) FROM ordenes_trabajo;  -- debe devolver 0
--   SELECT COUNT(*) FROM lineas_ot;        -- debe devolver 0
