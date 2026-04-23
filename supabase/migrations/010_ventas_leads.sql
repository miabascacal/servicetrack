-- ════════════════════════════════════════════════════
-- 010_ventas_leads.sql
-- Tablas: leads, ventas_perdidas
-- ENUMs requeridos ya existen: estado_lead, estado_venta_perdida, canal_mensaje
-- ════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS leads (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sucursal_id     UUID REFERENCES sucursales(id),
  cliente_id      UUID REFERENCES clientes(id),
  asesor_id       UUID REFERENCES usuarios(id),

  -- Datos de contacto si no hay cliente vinculado
  nombre          TEXT,
  whatsapp        TEXT,
  email           TEXT,

  estado          estado_lead DEFAULT 'nuevo',
  fuente          TEXT DEFAULT 'manual',
  necesidad       TEXT,
  vehiculo_interes TEXT,
  presupuesto_estimado DECIMAL(10,2),

  ultima_interaccion_at TIMESTAMPTZ,
  notas           TEXT,
  creado_at       TIMESTAMPTZ DEFAULT NOW(),
  actualizado_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ventas_perdidas (
  id                    UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sucursal_id           UUID REFERENCES sucursales(id),
  cliente_id            UUID REFERENCES clientes(id),
  vehiculo_id           UUID REFERENCES vehiculos(id),
  ot_id                 UUID REFERENCES ordenes_trabajo(id),
  asesor_id             UUID REFERENCES usuarios(id),

  descripcion_reparacion TEXT NOT NULL,
  monto_rechazado       DECIMAL(10,2),
  fecha_rechazo         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  estado                estado_venta_perdida DEFAULT 'detectada',

  contacto_wa_enviado_at    TIMESTAMPTZ,
  contacto_wa_respuesta_at  TIMESTAMPTZ,
  cliente_interesado        BOOLEAN,

  cita_recuperacion_id  UUID REFERENCES citas(id),
  notas                 TEXT,
  creada_at             TIMESTAMPTZ DEFAULT NOW(),
  actualizada_at        TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_perdidas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leads_sucursal" ON leads
  FOR ALL USING (sucursal_id = get_mi_sucursal_id());

CREATE POLICY "ventas_perdidas_sucursal" ON ventas_perdidas
  FOR ALL USING (sucursal_id = get_mi_sucursal_id());

-- Grants
GRANT ALL ON leads TO authenticated;
GRANT ALL ON ventas_perdidas TO authenticated;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_leads_sucursal ON leads(sucursal_id);
CREATE INDEX IF NOT EXISTS idx_leads_estado ON leads(estado);
CREATE INDEX IF NOT EXISTS idx_leads_cliente ON leads(cliente_id);
CREATE INDEX IF NOT EXISTS idx_ventas_perdidas_sucursal ON ventas_perdidas(sucursal_id);
CREATE INDEX IF NOT EXISTS idx_ventas_perdidas_ot ON ventas_perdidas(ot_id);
CREATE INDEX IF NOT EXISTS idx_ventas_perdidas_estado ON ventas_perdidas(estado);
