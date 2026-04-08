-- ============================================================
-- SCHEMA MÍNIMO — Solo lo necesario para que la app funcione
-- Tablas: grupos, razones_sociales, sucursales, usuarios,
--         clientes, empresas, vehiculos, vehiculo_personas, actividades
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── ENUMS ────────────────────────────────────────────────────
CREATE TYPE tipo_cliente AS ENUM ('particular', 'empresa', 'flotilla');
CREATE TYPE canal_preferido AS ENUM ('whatsapp', 'email', 'llamada', 'presencial');
CREATE TYPE estado_cita AS ENUM ('pendiente_contactar', 'contactada', 'confirmada', 'en_agencia', 'show', 'no_show', 'cancelada');
CREATE TYPE fuente_cita AS ENUM ('salesforce', 'seekop', 'clearmechanic', 'drive', 'manual', 'bot', 'web');
CREATE TYPE estado_ot AS ENUM ('recibido', 'diagnostico', 'en_reparacion', 'listo', 'entregado', 'cancelado');
CREATE TYPE estado_pieza AS ENUM ('pendiente', 'pedida', 'en_transito', 'recibida', 'instalada');
CREATE TYPE estado_cotizacion AS ENUM ('borrador', 'enviada', 'abierta', 'aprobada', 'rechazada', 'vencida');
CREATE TYPE estado_lead AS ENUM ('nuevo', 'contactado', 'cotizado', 'negociando', 'cerrado_ganado', 'cerrado_perdido');
CREATE TYPE tipo_actividad AS ENUM ('llamada', 'contacto', 'seguimiento', 'tarea', 'reunion', 'recordatorio', 'cita_agendada', 'cotizacion_enviada', 'wa_enviado', 'csi_enviado');
CREATE TYPE estado_actividad AS ENUM ('pendiente', 'en_proceso', 'realizada', 'cancelada');
CREATE TYPE prioridad_actividad AS ENUM ('normal', 'alta', 'urgente');
CREATE TYPE modulo_origen AS ENUM ('crm', 'citas', 'taller', 'refacciones', 'ventas', 'bandeja', 'ia', 'sistema');
CREATE TYPE canal_mensaje AS ENUM ('whatsapp', 'facebook', 'instagram', 'email', 'interno');
CREATE TYPE condicion_csi AS ENUM ('feliz', 'no_feliz', 'sin_evaluar');
CREATE TYPE estado_venta_perdida AS ENUM ('detectada', 'registrada', 'contacto_enviado', 'cliente_interesado', 'cita_agendada', 'cerrada', 'sin_recuperar');
CREATE TYPE rol_usuario AS ENUM ('admin', 'gerente', 'asesor_servicio', 'asesor_ventas', 'encargada_citas', 'mk_atencion', 'refacciones', 'tecnico', 'key_user', 'viewer');
CREATE TYPE entidad_tipo AS ENUM ('cita', 'ot', 'cotizacion', 'lead', 'pieza', 'venta_perdida', 'mensaje', 'vehiculo');
CREATE TYPE rol_vehiculo AS ENUM ('dueno', 'conductor', 'otro');

-- ════════════════════════════════════════════════════
-- JERARQUÍA MULTI-TENANT
-- ════════════════════════════════════════════════════

CREATE TABLE grupos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  nombre TEXT NOT NULL,
  logo_url TEXT,
  activo BOOLEAN DEFAULT TRUE,
  creado_at TIMESTAMPTZ DEFAULT NOW(),
  actualizado_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE razones_sociales (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  grupo_id UUID REFERENCES grupos(id) NOT NULL,
  nombre TEXT NOT NULL,
  razon_social TEXT NOT NULL,
  rfc TEXT,
  activa BOOLEAN DEFAULT TRUE,
  creada_at TIMESTAMPTZ DEFAULT NOW(),
  actualizada_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sucursales (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  razon_social_id UUID REFERENCES razones_sociales(id) NOT NULL,
  nombre TEXT NOT NULL,
  codigo TEXT,
  marca TEXT,
  direccion TEXT,
  telefono TEXT,
  whatsapp TEXT,
  timezone TEXT DEFAULT 'America/Mexico_City',
  activa BOOLEAN DEFAULT TRUE,
  creada_at TIMESTAMPTZ DEFAULT NOW(),
  actualizada_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE usuarios (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  sucursal_id UUID REFERENCES sucursales(id),
  nombre TEXT NOT NULL,
  apellido TEXT,
  email TEXT UNIQUE NOT NULL,
  telefono TEXT,
  whatsapp TEXT,
  rol rol_usuario DEFAULT 'asesor_servicio',
  activo BOOLEAN DEFAULT TRUE,
  creado_at TIMESTAMPTZ DEFAULT NOW(),
  actualizado_at TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════
-- CLIENTES & EMPRESAS
-- ════════════════════════════════════════════════════

CREATE TABLE empresas (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  grupo_id UUID REFERENCES grupos(id) NOT NULL,
  nombre TEXT NOT NULL,
  rfc TEXT,
  telefono TEXT,
  email TEXT,
  activo BOOLEAN DEFAULT TRUE,
  creado_at TIMESTAMPTZ DEFAULT NOW(),
  actualizado_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE clientes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  grupo_id UUID REFERENCES grupos(id) NOT NULL,
  empresa_id UUID REFERENCES empresas(id),
  nombre TEXT NOT NULL,
  apellido TEXT NOT NULL,
  apellido_2 TEXT,
  whatsapp TEXT UNIQUE,
  telefono_contacto TEXT,
  telefono_alterno TEXT,
  email TEXT,
  email_2 TEXT,
  notas TEXT,
  activo BOOLEAN DEFAULT TRUE,
  creado_at TIMESTAMPTZ DEFAULT NOW(),
  actualizado_at TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════
-- VEHÍCULOS
-- ════════════════════════════════════════════════════

CREATE TABLE vehiculos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  grupo_id UUID REFERENCES grupos(id) NOT NULL,
  marca TEXT NOT NULL,
  modelo TEXT NOT NULL,
  anio INTEGER NOT NULL,
  color TEXT,
  placa TEXT,
  vin TEXT,
  km_actual INTEGER,
  intervalo_servicio_meses INTEGER DEFAULT 6,
  fecha_compra DATE,
  fecha_fin_garantia DATE,
  estado_verificacion TEXT DEFAULT 'no_aplica',
  activo BOOLEAN DEFAULT TRUE,
  creado_at TIMESTAMPTZ DEFAULT NOW(),
  actualizado_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE vehiculo_personas (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  vehiculo_id UUID REFERENCES vehiculos(id) ON DELETE CASCADE NOT NULL,
  cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE NOT NULL,
  rol_vehiculo rol_vehiculo NOT NULL DEFAULT 'dueno',
  activo BOOLEAN DEFAULT TRUE,
  creado_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(vehiculo_id, cliente_id)
);

-- ════════════════════════════════════════════════════
-- ACTIVIDADES (Agenda CRM)
-- ════════════════════════════════════════════════════

CREATE TABLE actividades (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sucursal_id UUID REFERENCES sucursales(id) NOT NULL,
  usuario_asignado_id UUID REFERENCES usuarios(id),
  creado_por_id UUID REFERENCES usuarios(id),
  cliente_id UUID REFERENCES clientes(id),
  vehiculo_id UUID REFERENCES vehiculos(id),
  tipo tipo_actividad NOT NULL,
  descripcion TEXT NOT NULL,
  estado estado_actividad DEFAULT 'pendiente',
  prioridad prioridad_actividad DEFAULT 'normal',
  fecha_programada TIMESTAMPTZ,
  fecha_vencimiento TIMESTAMPTZ,
  realizada_at TIMESTAMPTZ,
  completada BOOLEAN DEFAULT FALSE,
  notas TEXT,
  modulo_origen modulo_origen DEFAULT 'crm',
  creado_at TIMESTAMPTZ DEFAULT NOW(),
  actualizado_at TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════
-- CITAS (básico para que el módulo funcione)
-- ════════════════════════════════════════════════════

CREATE TABLE citas (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sucursal_id UUID REFERENCES sucursales(id) NOT NULL,
  cliente_id UUID REFERENCES clientes(id),
  vehiculo_id UUID REFERENCES vehiculos(id),
  fecha_cita DATE NOT NULL,
  hora_cita TIME NOT NULL,
  servicio TEXT,
  estado estado_cita DEFAULT 'pendiente_contactar',
  notas TEXT,
  creado_at TIMESTAMPTZ DEFAULT NOW(),
  actualizado_at TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════
-- FUNCIONES HELPER (deben existir antes de las policies)
-- ════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_mi_grupo_id()
RETURNS UUID AS $$
  SELECT rs.grupo_id
  FROM usuarios u
  JOIN sucursales s ON s.id = u.sucursal_id
  JOIN razones_sociales rs ON rs.id = s.razon_social_id
  WHERE u.id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_mi_sucursal_id()
RETURNS UUID AS $$
  SELECT sucursal_id FROM usuarios WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_mi_rs_id()
RETURNS UUID AS $$
  SELECT s.razon_social_id
  FROM usuarios u
  JOIN sucursales s ON s.id = u.sucursal_id
  WHERE u.id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ════════════════════════════════════════════════════

ALTER TABLE grupos ENABLE ROW LEVEL SECURITY;
ALTER TABLE razones_sociales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sucursales ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehiculos ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehiculo_personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE actividades ENABLE ROW LEVEL SECURITY;
ALTER TABLE citas ENABLE ROW LEVEL SECURITY;

-- Clientes
CREATE POLICY "clientes_select" ON clientes FOR SELECT USING (grupo_id = get_mi_grupo_id());
CREATE POLICY "clientes_insert" ON clientes FOR INSERT WITH CHECK (grupo_id = get_mi_grupo_id());
CREATE POLICY "clientes_update" ON clientes FOR UPDATE USING (grupo_id = get_mi_grupo_id());

-- Empresas
CREATE POLICY "empresas_select" ON empresas FOR SELECT USING (grupo_id = get_mi_grupo_id());
CREATE POLICY "empresas_insert" ON empresas FOR INSERT WITH CHECK (grupo_id = get_mi_grupo_id());
CREATE POLICY "empresas_update" ON empresas FOR UPDATE USING (grupo_id = get_mi_grupo_id());

-- Vehículos
CREATE POLICY "vehiculos_select" ON vehiculos FOR SELECT USING (grupo_id = get_mi_grupo_id());
CREATE POLICY "vehiculos_insert" ON vehiculos FOR INSERT WITH CHECK (grupo_id = get_mi_grupo_id());
CREATE POLICY "vehiculos_update" ON vehiculos FOR UPDATE USING (grupo_id = get_mi_grupo_id());

-- Vehiculo personas
CREATE POLICY "veh_personas_select" ON vehiculo_personas FOR SELECT
  USING (vehiculo_id IN (SELECT id FROM vehiculos WHERE grupo_id = get_mi_grupo_id()));
CREATE POLICY "veh_personas_insert" ON vehiculo_personas FOR INSERT
  WITH CHECK (vehiculo_id IN (SELECT id FROM vehiculos WHERE grupo_id = get_mi_grupo_id()));

-- Actividades
CREATE POLICY "actividades_select" ON actividades FOR SELECT USING (sucursal_id = get_mi_sucursal_id());
CREATE POLICY "actividades_insert" ON actividades FOR INSERT WITH CHECK (sucursal_id = get_mi_sucursal_id());
CREATE POLICY "actividades_update" ON actividades FOR UPDATE USING (sucursal_id = get_mi_sucursal_id());

-- Citas
CREATE POLICY "citas_select" ON citas FOR SELECT USING (sucursal_id = get_mi_sucursal_id());
CREATE POLICY "citas_insert" ON citas FOR INSERT WITH CHECK (sucursal_id = get_mi_sucursal_id());
CREATE POLICY "citas_update" ON citas FOR UPDATE USING (sucursal_id = get_mi_sucursal_id());

-- Usuarios (cada quien ve su propio perfil; admin ve todos de su grupo)
CREATE POLICY "usuarios_select" ON usuarios FOR SELECT
  USING (id = auth.uid() OR sucursal_id = get_mi_sucursal_id());
CREATE POLICY "usuarios_insert" ON usuarios FOR INSERT WITH CHECK (true);
CREATE POLICY "usuarios_update" ON usuarios FOR UPDATE USING (id = auth.uid());

-- Grupos / Razones sociales / Sucursales (solo lectura para usuarios normales)
CREATE POLICY "grupos_select" ON grupos FOR SELECT USING (id = get_mi_grupo_id());
CREATE POLICY "rs_select" ON razones_sociales FOR SELECT USING (grupo_id = get_mi_grupo_id());
CREATE POLICY "sucursales_select" ON sucursales FOR SELECT USING (id = get_mi_sucursal_id());

-- ════════════════════════════════════════════════════
-- ÍNDICES
-- ════════════════════════════════════════════════════

CREATE INDEX idx_clientes_grupo ON clientes(grupo_id);
CREATE INDEX idx_clientes_empresa ON clientes(empresa_id);
CREATE INDEX idx_clientes_whatsapp ON clientes(whatsapp);
CREATE INDEX idx_empresas_grupo ON empresas(grupo_id);
CREATE INDEX idx_vehiculos_grupo ON vehiculos(grupo_id);
CREATE INDEX idx_veh_personas_vehiculo ON vehiculo_personas(vehiculo_id);
CREATE INDEX idx_veh_personas_cliente ON vehiculo_personas(cliente_id);
CREATE INDEX idx_actividades_usuario ON actividades(usuario_asignado_id);
CREATE INDEX idx_actividades_cliente ON actividades(cliente_id);
CREATE INDEX idx_actividades_sucursal ON actividades(sucursal_id);
CREATE INDEX idx_actividades_fecha ON actividades(fecha_vencimiento);
CREATE INDEX idx_citas_sucursal ON citas(sucursal_id);
CREATE INDEX idx_citas_cliente ON citas(cliente_id);
CREATE INDEX idx_citas_fecha ON citas(fecha_cita);
CREATE INDEX idx_usuarios_sucursal ON usuarios(sucursal_id);
