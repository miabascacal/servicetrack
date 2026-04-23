-- ════════════════════════════════════════════════════
-- 011_csi_schema.sql
-- Tablas: csi_encuestas, csi_preguntas, csi_envios, csi_respuestas
-- ENUM condicion_csi ya existe
-- ════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS csi_encuestas (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  grupo_id    UUID REFERENCES grupos(id) NOT NULL,
  nombre      TEXT NOT NULL,
  modulo_origen TEXT NOT NULL CHECK (modulo_origen IN ('taller','ventas','citas')),
  activa      BOOLEAN DEFAULT TRUE,
  dias_espera INTEGER DEFAULT 1,
  max_recordatorios INTEGER DEFAULT 2,
  horas_entre_recordatorio INTEGER DEFAULT 48,
  score_alerta INTEGER DEFAULT 3,
  creado_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(grupo_id, nombre)
);

CREATE TABLE IF NOT EXISTS csi_preguntas (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  encuesta_id UUID REFERENCES csi_encuestas(id) ON DELETE CASCADE NOT NULL,
  orden       INTEGER NOT NULL,
  texto       TEXT NOT NULL,
  tipo        TEXT NOT NULL CHECK (tipo IN ('estrellas','nps','texto','si_no')),
  obligatoria BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS csi_envios (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  encuesta_id UUID REFERENCES csi_encuestas(id) NOT NULL,
  cliente_id  UUID REFERENCES clientes(id) NOT NULL,
  vehiculo_id UUID REFERENCES vehiculos(id),
  ot_id       UUID REFERENCES ordenes_trabajo(id),
  asesor_id   UUID REFERENCES usuarios(id),
  sucursal_id UUID REFERENCES sucursales(id),
  estado      TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente','enviada','respondida','sin_respuesta','cancelada')),
  enviado_at  TIMESTAMPTZ,
  respondido_at TIMESTAMPTZ,
  recordatorios_enviados INTEGER DEFAULT 0,
  token_unico TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  creado_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS csi_respuestas (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  envio_id        UUID REFERENCES csi_envios(id) ON DELETE CASCADE NOT NULL,
  pregunta_id     UUID REFERENCES csi_preguntas(id) NOT NULL,
  respuesta_texto TEXT,
  respuesta_numerica INTEGER,
  creado_at       TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE csi_encuestas ENABLE ROW LEVEL SECURITY;
ALTER TABLE csi_preguntas ENABLE ROW LEVEL SECURITY;
ALTER TABLE csi_envios ENABLE ROW LEVEL SECURITY;
ALTER TABLE csi_respuestas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "csi_encuestas_grupo" ON csi_encuestas
  FOR ALL USING (grupo_id = get_mi_grupo_id());

CREATE POLICY "csi_preguntas_via_encuesta" ON csi_preguntas
  FOR ALL USING (
    encuesta_id IN (SELECT id FROM csi_encuestas WHERE grupo_id = get_mi_grupo_id())
  );

CREATE POLICY "csi_envios_sucursal" ON csi_envios
  FOR ALL USING (sucursal_id = get_mi_sucursal_id());

CREATE POLICY "csi_respuestas_via_envio" ON csi_respuestas
  FOR ALL USING (
    envio_id IN (SELECT id FROM csi_envios WHERE sucursal_id = get_mi_sucursal_id())
  );

-- Grants
GRANT ALL ON csi_encuestas TO authenticated;
GRANT ALL ON csi_preguntas TO authenticated;
GRANT ALL ON csi_envios TO authenticated;
GRANT ALL ON csi_respuestas TO authenticated;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_csi_envios_cliente ON csi_envios(cliente_id);
CREATE INDEX IF NOT EXISTS idx_csi_envios_ot ON csi_envios(ot_id);
CREATE INDEX IF NOT EXISTS idx_csi_envios_estado ON csi_envios(estado);
CREATE INDEX IF NOT EXISTS idx_csi_respuestas_envio ON csi_respuestas(envio_id);
