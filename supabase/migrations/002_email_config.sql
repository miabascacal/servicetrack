-- ════════════════════════════════════════════════════
-- CONFIGURACIÓN DE EMAIL POR MÓDULO / SUCURSAL
-- Cada sucursal puede tener un remitente distinto por módulo.
-- Si no hay config para el módulo específico, usa 'general'.
-- Si no hay 'general', usa el EMAIL_FROM del sistema.
-- ════════════════════════════════════════════════════

CREATE TABLE email_config (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sucursal_id UUID REFERENCES sucursales(id) ON DELETE CASCADE NOT NULL,

  nombre TEXT NOT NULL,             -- "Citas Norte", "Servicio Sur", etc.
  modulo TEXT NOT NULL,             -- 'citas' | 'taller' | 'ventas' | 'refacciones' | 'general'

  -- Remitente que verá el cliente
  from_name TEXT NOT NULL,          -- "Citas Agencia Norte"
  from_email TEXT NOT NULL,         -- citas@norte.agencia.com.mx

  -- Reply-to (a dónde responde el cliente)
  reply_to TEXT,                    -- puede ser distinto al from

  activo BOOLEAN DEFAULT TRUE,
  creado_at TIMESTAMPTZ DEFAULT NOW(),
  actualizado_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(sucursal_id, modulo)       -- un config por módulo por sucursal
);

CREATE INDEX idx_email_config_sucursal ON email_config(sucursal_id);

ALTER TABLE email_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "email_config_select" ON email_config FOR SELECT USING (sucursal_id = get_mi_sucursal_id());
CREATE POLICY "email_config_insert" ON email_config FOR INSERT WITH CHECK (sucursal_id = get_mi_sucursal_id());
CREATE POLICY "email_config_update" ON email_config FOR UPDATE USING (sucursal_id = get_mi_sucursal_id());
CREATE POLICY "email_config_delete" ON email_config FOR DELETE USING (sucursal_id = get_mi_sucursal_id());
