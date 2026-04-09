-- ════════════════════════════════════════════════════
-- NÚMEROS DE WHATSAPP POR MÓDULO / ÁREA
-- Cada sucursal puede tener múltiples números de WA:
--   uno para Citas, uno por asesor de servicio, ventas, etc.
-- Todos comparten el mismo WABA (access_token) pero cada
-- número tiene su propio phone_number_id de Meta.
-- ════════════════════════════════════════════════════

CREATE TABLE wa_numeros (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sucursal_id UUID REFERENCES sucursales(id) ON DELETE CASCADE NOT NULL,

  -- Identificación
  nombre TEXT NOT NULL,           -- "Citas", "Asesor Juan", "Ventas", etc.
  modulo TEXT,                    -- 'citas' | 'taller' | 'ventas' | 'refacciones' | 'general'
  numero_display TEXT NOT NULL,   -- "+52 81 1234 5678" (para mostrar en UI)

  -- Credenciales Meta Cloud API
  waba_id TEXT,                   -- WhatsApp Business Account ID
  phone_number_id TEXT NOT NULL,  -- ID del número en Meta
  access_token TEXT NOT NULL,     -- Token de acceso (permanente recomendado)

  -- Estado
  activo BOOLEAN DEFAULT TRUE,
  verificado BOOLEAN DEFAULT FALSE,
  creado_at TIMESTAMPTZ DEFAULT NOW(),
  actualizado_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_wa_numeros_sucursal ON wa_numeros(sucursal_id);
CREATE INDEX idx_wa_numeros_modulo ON wa_numeros(sucursal_id, modulo);

-- RLS
ALTER TABLE wa_numeros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wa_numeros_select" ON wa_numeros FOR SELECT USING (sucursal_id = get_mi_sucursal_id());
CREATE POLICY "wa_numeros_insert" ON wa_numeros FOR INSERT WITH CHECK (sucursal_id = get_mi_sucursal_id());
CREATE POLICY "wa_numeros_update" ON wa_numeros FOR UPDATE USING (sucursal_id = get_mi_sucursal_id());

-- ════════════════════════════════════════════════════
-- LOG DE MENSAJES ENVIADOS
-- Registro de cada mensaje WA enviado por el sistema
-- ════════════════════════════════════════════════════

CREATE TABLE wa_mensajes_log (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sucursal_id UUID REFERENCES sucursales(id),
  wa_numero_id UUID REFERENCES wa_numeros(id),

  -- Destinatario
  cliente_id UUID REFERENCES clientes(id),
  telefono_destino TEXT NOT NULL,

  -- Mensaje
  tipo TEXT NOT NULL,             -- 'confirmacion_cita' | 'recordatorio_cita' | 'cita_cancelada' | 'ot_lista' | 'custom'
  template_name TEXT,             -- nombre del template en Meta
  contenido TEXT,                 -- texto del mensaje enviado

  -- Referencia al objeto relacionado
  entidad_tipo TEXT,              -- 'cita' | 'ot' | 'cotizacion'
  entidad_id UUID,

  -- Resultado
  status TEXT DEFAULT 'pendiente', -- 'pendiente' | 'enviado' | 'error' | 'leido'
  meta_message_id TEXT,           -- ID del mensaje devuelto por Meta
  error_detalle TEXT,
  enviado_at TIMESTAMPTZ,
  creado_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_wa_log_sucursal ON wa_mensajes_log(sucursal_id);
CREATE INDEX idx_wa_log_entidad ON wa_mensajes_log(entidad_tipo, entidad_id);
CREATE INDEX idx_wa_log_cliente ON wa_mensajes_log(cliente_id);
