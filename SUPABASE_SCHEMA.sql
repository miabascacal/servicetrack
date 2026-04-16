-- ============================================================
-- SUPABASE SCHEMA — Plataforma SaaS Postventa Automotriz
-- Versión 2.0 — Marzo 2026
-- Arquitectura multi-tenant: Grupo → Razón Social → Sucursal
-- Clientes universales a nivel Grupo (sin duplicados)
-- Ejecutar en orden. RLS activo en todas las tablas.
-- IMPORTANTE: este archivo es un snapshot base y NO refleja el estado completo actual del proyecto.
-- La fuente de verdad del estado runtime real son las migraciones en `supabase/migrations/`.
-- A la fecha existen divergencias conocidas respecto a este archivo, por ejemplo:
-- `002_email_config.sql`, `003_ai_foundation.sql`, `004_messaging_adjustments.sql`,
-- `006_ot_dms_and_taller_events.sql`, `007_canal_interno_enum.sql`,
-- `008_estado_ot_en_proceso.sql`, además de tablas/campos como `email_config`,
-- `conversation_threads`, ajustes en `mensajes` y el estado OT canónico `en_proceso`.
-- ============================================================

-- ── EXTENSIONES ──────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── ENUMS ────────────────────────────────────────────────────

CREATE TYPE tipo_cliente AS ENUM ('particular', 'empresa', 'flotilla');
CREATE TYPE canal_preferido AS ENUM ('whatsapp', 'email', 'llamada', 'presencial');
CREATE TYPE estado_cita AS ENUM ('pendiente_contactar', 'contactada', 'confirmada', 'en_agencia', 'show', 'no_show', 'cancelada');
-- en_agencia: cliente hizo check-in (Recepción Express), asesor aún no lo atiende
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
-- tecnico: ejecuta trabajo en taller, asignado a líneas de OT
CREATE TYPE entidad_tipo AS ENUM ('cita', 'ot', 'cotizacion', 'lead', 'pieza', 'venta_perdida', 'mensaje', 'vehiculo');

-- ════════════════════════════════════════════════════
-- NIVEL 1: GRUPOS (top de la jerarquía multi-tenant)
-- ════════════════════════════════════════════════════

CREATE TABLE grupos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  nombre TEXT NOT NULL,                        -- "Grupo Automotriz del Norte"
  logo_url TEXT,
  activo BOOLEAN DEFAULT TRUE,
  creado_at TIMESTAMPTZ DEFAULT NOW(),
  actualizado_at TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════
-- NIVEL 2: RAZONES SOCIALES (entidades fiscales del grupo)
-- ════════════════════════════════════════════════════

CREATE TABLE razones_sociales (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  grupo_id UUID REFERENCES grupos(id) NOT NULL,
  nombre TEXT NOT NULL,                        -- "División Mercedes-Benz"
  razon_social TEXT NOT NULL,                  -- nombre fiscal completo
  rfc TEXT,
  activa BOOLEAN DEFAULT TRUE,
  creada_at TIMESTAMPTZ DEFAULT NOW(),
  actualizada_at TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════
-- VISIBILIDAD CRUZADA ENTRE RAZONES SOCIALES
-- Sin registro = aisladas. Con registro = acceso configurado.
-- ════════════════════════════════════════════════════

CREATE TABLE configuracion_visibilidad (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  grupo_id UUID REFERENCES grupos(id) NOT NULL,
  rs_origen_id UUID REFERENCES razones_sociales(id) NOT NULL,  -- quien puede ver
  rs_destino_id UUID REFERENCES razones_sociales(id) NOT NULL, -- a quien ve
  puede_ver_clientes BOOLEAN DEFAULT FALSE,
  puede_ver_actividades BOOLEAN DEFAULT FALSE,
  puede_ver_citas BOOLEAN DEFAULT FALSE,
  puede_ver_ots BOOLEAN DEFAULT FALSE,
  activo BOOLEAN DEFAULT TRUE,
  creada_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(rs_origen_id, rs_destino_id)
);

-- ════════════════════════════════════════════════════
-- NIVEL 3: SUCURSALES (operaciones físicas)
-- ════════════════════════════════════════════════════

CREATE TABLE sucursales (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  razon_social_id UUID REFERENCES razones_sociales(id) NOT NULL,
  nombre TEXT NOT NULL,                        -- "Mercedes-Benz Monterrey Norte"
  codigo TEXT,                                 -- MB1, MB2, H1, H2 (clave corta)
  marca TEXT,                                  -- Mercedes-Benz, Honda, VW, etc.
  direccion TEXT,
  maps_url TEXT,                               -- link Google Maps para WA
  maps_embed_url TEXT,
  telefono TEXT,
  whatsapp TEXT,
  horario_bot_inicio TIME DEFAULT '08:00',
  horario_bot_fin TIME DEFAULT '19:30',
  timezone TEXT DEFAULT 'America/Mexico_City',
  activa BOOLEAN DEFAULT TRUE,
  creada_at TIMESTAMPTZ DEFAULT NOW(),
  actualizada_at TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════
-- USUARIOS
-- ════════════════════════════════════════════════════

CREATE TABLE usuarios (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  sucursal_id UUID REFERENCES sucursales(id),
  nombre TEXT NOT NULL,
  apellido TEXT,
  email TEXT UNIQUE NOT NULL,
  telefono TEXT,
  whatsapp TEXT,
  rol rol_usuario DEFAULT 'asesor_servicio',
  -- Sincronización de calendario — Outlook O Google (o ambos)
  outlook_refresh_token TEXT,
  outlook_calendar_id TEXT,
  gmail_refresh_token TEXT,
  gcal_calendar_id TEXT,
  calendario_preferido TEXT DEFAULT 'outlook' CHECK (calendario_preferido IN ('outlook', 'google', 'ambos', 'ninguno')),
  activo BOOLEAN DEFAULT TRUE,
  creado_at TIMESTAMPTZ DEFAULT NOW(),
  actualizado_at TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════
-- MÓDULO USUARIOS & PERMISOS
-- Capa 1: Roles (plantillas reutilizables por grupo)
-- Capa 2: Permisos por rol y módulo (ver/crear/editar/eliminar/exportar)
-- Capa 3: Asignación usuario → rol + sucursal
-- Capa 4: Overrides individuales por usuario
-- ════════════════════════════════════════════════════

CREATE TABLE roles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  grupo_id UUID REFERENCES grupos(id) NOT NULL,
  nombre TEXT NOT NULL,                                   -- 'Administrador', 'Gerente', 'Asesor Servicio'...
  descripcion TEXT,
  es_super_admin BOOLEAN DEFAULT FALSE,                   -- acceso total sin restricciones
  activo BOOLEAN DEFAULT TRUE,
  creado_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(grupo_id, nombre)
);

-- Permisos por rol + módulo
CREATE TABLE rol_permisos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  rol_id UUID REFERENCES roles(id) ON DELETE CASCADE NOT NULL,
  modulo TEXT NOT NULL CHECK (modulo IN (
    'crm','citas','taller','refacciones','ventas',
    'bandeja','seguros','atencion_clientes',
    'usuarios','configuracion','reportes'
  )),
  puede_ver      BOOLEAN DEFAULT FALSE,
  puede_crear    BOOLEAN DEFAULT FALSE,
  puede_editar   BOOLEAN DEFAULT FALSE,
  puede_eliminar BOOLEAN DEFAULT FALSE,
  puede_exportar BOOLEAN DEFAULT FALSE,
  UNIQUE(rol_id, modulo)
);

-- Asignación usuario → rol + sucursal
-- sucursal_id NULL = aplica a todas las sucursales del grupo
CREATE TABLE usuario_roles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE NOT NULL,
  rol_id UUID REFERENCES roles(id) NOT NULL,
  sucursal_id UUID REFERENCES sucursales(id),             -- NULL = todas las sucursales
  activo BOOLEAN DEFAULT TRUE,
  asignado_por UUID REFERENCES usuarios(id),
  creado_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(usuario_id, rol_id, sucursal_id)
);

-- Overrides individuales (ajuste fino sin cambiar el rol)
-- NULL en un campo = hereda del rol asignado
CREATE TABLE usuario_permisos_override (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE NOT NULL,
  sucursal_id UUID REFERENCES sucursales(id),
  modulo TEXT NOT NULL CHECK (modulo IN (
    'crm','citas','taller','refacciones','ventas',
    'bandeja','seguros','atencion_clientes',
    'usuarios','configuracion','reportes'
  )),
  puede_ver      BOOLEAN,                                 -- NULL = hereda del rol
  puede_crear    BOOLEAN,
  puede_editar   BOOLEAN,
  puede_eliminar BOOLEAN,
  puede_exportar BOOLEAN,
  motivo TEXT,                                            -- por qué se hizo el override
  modificado_por UUID REFERENCES usuarios(id),
  creado_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(usuario_id, sucursal_id, modulo)
);

-- RLS
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE rol_permisos ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuario_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuario_permisos_override ENABLE ROW LEVEL SECURITY;

-- Solo admins del grupo pueden gestionar roles y permisos
CREATE POLICY "roles_grupo" ON roles
  USING (grupo_id = get_mi_grupo_id());
CREATE POLICY "rol_permisos_grupo" ON rol_permisos
  USING (rol_id IN (SELECT id FROM roles WHERE grupo_id = get_mi_grupo_id()));
CREATE POLICY "usuario_roles_grupo" ON usuario_roles
  USING (usuario_id IN (SELECT id FROM usuarios WHERE sucursal_id IN (
    SELECT id FROM sucursales WHERE razon_social_id IN (
      SELECT id FROM razones_sociales WHERE grupo_id = get_mi_grupo_id()))));
CREATE POLICY "usuario_overrides_grupo" ON usuario_permisos_override
  USING (usuario_id IN (SELECT id FROM usuarios WHERE sucursal_id IN (
    SELECT id FROM sucursales WHERE razon_social_id IN (
      SELECT id FROM razones_sociales WHERE grupo_id = get_mi_grupo_id()))));

-- Índices
CREATE INDEX idx_usuario_roles_usuario ON usuario_roles(usuario_id);
CREATE INDEX idx_usuario_roles_sucursal ON usuario_roles(sucursal_id);
CREATE INDEX idx_rol_permisos_rol ON rol_permisos(rol_id);
CREATE INDEX idx_overrides_usuario ON usuario_permisos_override(usuario_id);

-- ════════════════════════════════════════════════════
-- EMPRESAS (a nivel Grupo — sin duplicados entre RS)
-- ════════════════════════════════════════════════════

CREATE TABLE empresas (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  grupo_id UUID REFERENCES grupos(id) NOT NULL,      -- a nivel grupo
  sucursal_origen_id UUID REFERENCES sucursales(id), -- donde se creó
  razon_social TEXT NOT NULL,
  nombre_comercial TEXT,
  rfc TEXT,
  email TEXT,
  telefono TEXT,
  whatsapp TEXT,
  direccion TEXT,
  contacto_nombre TEXT,
  contacto_cargo TEXT,
  notas TEXT,
  creada_at TIMESTAMPTZ DEFAULT NOW(),
  actualizada_at TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════
-- CLIENTES (universales a nivel Grupo — "Driver 360")
-- Un cliente puede visitar cualquier sucursal del grupo
-- sin duplicarse en la BD.
-- ════════════════════════════════════════════════════

CREATE TABLE clientes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  grupo_id UUID REFERENCES grupos(id) NOT NULL,          -- dueño del registro
  sucursal_origen_id UUID REFERENCES sucursales(id),     -- sucursal donde se capturó
  empresa_id UUID REFERENCES empresas(id),               -- null si es particular
  nombre TEXT NOT NULL,
  apellido TEXT,
  apellido_2 TEXT,
  email TEXT,
  email_2 TEXT,
  whatsapp TEXT NOT NULL,
  telefono_contacto TEXT,                                 -- teléfono fijo o secundario de contacto
  telefono_alterno TEXT,                                  -- tercer número si aplica
  tipo tipo_cliente DEFAULT 'particular',
  canal_preferido canal_preferido DEFAULT 'whatsapp',
  rfc TEXT,
  id_dms TEXT,                                           -- ID en Autoline u otro DMS
  asesor_asignado_id UUID REFERENCES usuarios(id),
  notas TEXT,
  activo BOOLEAN DEFAULT TRUE,
  creado_at TIMESTAMPTZ DEFAULT NOW(),
  actualizado_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(grupo_id, whatsapp)                             -- 1 cliente por WA por grupo
);

-- ════════════════════════════════════════════════════
-- VEHÍCULOS
-- ════════════════════════════════════════════════════

CREATE TABLE vehiculos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  -- cliente_id = dueño principal (desnormalizado para queries rápidos)
  -- Relación completa en vehiculo_personas (dueno | conductor | otro)
  cliente_id UUID REFERENCES clientes(id) NOT NULL,      -- SIEMPRE el Dueño
  sucursal_id UUID REFERENCES sucursales(id),            -- sucursal donde se registró
  vin TEXT,
  placa TEXT,
  marca TEXT,
  modelo TEXT,
  anio INTEGER,
  version TEXT,
  color TEXT,
  km_actuales INTEGER,
  km_garantia INTEGER,
  fecha_compra DATE,
  fecha_fin_garantia DATE,
  -- Servicio programado
  intervalo_servicio_meses INTEGER DEFAULT 6,             -- 6 o 12 según marca/modelo (configurable)
  proxima_servicio DATE,                                  -- calculado: fecha_ultimo_servicio + intervalo_servicio_meses
  -- Verificación vehicular
  fecha_verificacion DATE,
  proxima_verificacion DATE,
  estado_verificacion TEXT CHECK (estado_verificacion IN ('vigente', 'por_vencer', 'vencida', 'no_aplica')),
  -- Extensión de garantía
  garantia_ext_inicio DATE,
  garantia_ext_fin DATE,
  numero_motor TEXT,
  id_dms TEXT,
  notas TEXT,
  creado_at TIMESTAMPTZ DEFAULT NOW(),
  actualizado_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(vin)
);

-- ════════════════════════════════════════════════════
-- VEHÍCULO — PERSONAS VINCULADAS
-- Un vehículo puede tener: Dueño + Conductor + Otro
-- Regla: siempre debe existir exactamente 1 Dueño
-- ════════════════════════════════════════════════════

CREATE TYPE rol_vehiculo AS ENUM ('dueno', 'conductor', 'otro');

CREATE TABLE vehiculo_personas (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  vehiculo_id UUID REFERENCES vehiculos(id) ON DELETE CASCADE NOT NULL,
  cliente_id UUID REFERENCES clientes(id) NOT NULL,
  rol rol_vehiculo NOT NULL DEFAULT 'dueno',
  activo BOOLEAN DEFAULT TRUE,
  desde DATE,                                            -- desde cuándo tiene este rol
  notas TEXT,
  creado_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(vehiculo_id, cliente_id, rol)                   -- un cliente no puede tener 2 veces el mismo rol en el mismo vehículo
);

-- ════════════════════════════════════════════════════
-- CITAS (Kanban — corazón del MVP)
-- ════════════════════════════════════════════════════

CREATE TABLE citas (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sucursal_id UUID REFERENCES sucursales(id) NOT NULL,   -- DONDE ocurre la cita
  cliente_id UUID REFERENCES clientes(id),
  vehiculo_id UUID REFERENCES vehiculos(id),
  asesor_id UUID REFERENCES usuarios(id),
  encargada_citas_id UUID REFERENCES usuarios(id),

  fecha_cita TIMESTAMPTZ NOT NULL,
  tipo_servicio TEXT,
  observaciones TEXT,

  estado estado_cita DEFAULT 'pendiente_contactar',
  fuente fuente_cita DEFAULT 'manual',

  -- Control del timer 15 minutos
  contacto_asignado_at TIMESTAMPTZ,
  contacto_limite_at TIMESTAMPTZ,                        -- asignado_at + 15 min (trigger)
  contacto_realizado_at TIMESTAMPTZ,
  contacto_realizado_por UUID REFERENCES usuarios(id),
  contacto_bot BOOLEAN DEFAULT FALSE,

  -- Recordatorios
  recordatorio_24h_enviado_at TIMESTAMPTZ,
  recordatorio_2h_enviado_at TIMESTAMPTZ,
  confirmacion_cliente BOOLEAN,
  confirmacion_at TIMESTAMPTZ,

  -- No-show
  no_show_registrado_at TIMESTAMPTZ,
  recuperacion_wa_enviado_at TIMESTAMPTZ,

  -- Origen externo
  archivo_origen TEXT,
  id_externo TEXT,

  -- ── Recepción Express (pre-llegada vía WA) ───────────────────
  prellegada_km          INTEGER,          -- KM respondido la noche anterior por WA
  prellegada_notas       TEXT,             -- "también revisar frenos, etc."
  prellegada_cortesia    BOOLEAN,          -- ¿solicita auto de cortesía?
  prellegada_at          TIMESTAMPTZ,      -- cuándo respondió el WA previo

  -- ── Check-in digital (día de la cita) ────────────────────────
  checkin_at             TIMESTAMPTZ,      -- momento exacto del check-in
  checkin_via            TEXT CHECK (checkin_via IN ('wa', 'qr', 'manual')),
  checkin_km             INTEGER,          -- KM confirmado al llegar
  checkin_notas          TEXT,             -- notas adicionales al llegar
  checkin_solicita_cort  BOOLEAN,

  -- ── Atención por asesor ───────────────────────────────────────
  asesor_salio_at        TIMESTAMPTZ,      -- asesor confirmó que salió a recibirlo
  tiempo_espera_min      INTEGER,          -- checkin_at → asesor_salio_at (calculado)
  ot_creada_auto         BOOLEAN DEFAULT FALSE, -- OT se abrió desde Recepción Express

  creada_at TIMESTAMPTZ DEFAULT NOW(),
  actualizada_at TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════
-- ÓRDENES DE TRABAJO (OT / PDV)
-- ════════════════════════════════════════════════════

CREATE TABLE ordenes_trabajo (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sucursal_id UUID REFERENCES sucursales(id) NOT NULL,
  cliente_id UUID REFERENCES clientes(id),
  vehiculo_id UUID REFERENCES vehiculos(id),
  cita_id UUID REFERENCES citas(id),
  asesor_id UUID REFERENCES usuarios(id),

  numero_ot TEXT UNIQUE NOT NULL,
  fecha_recepcion TIMESTAMPTZ DEFAULT NOW(),
  km_entrada INTEGER,
  promesa_entrega TIMESTAMPTZ,
  fecha_entrega TIMESTAMPTZ,

  estado estado_ot DEFAULT 'recibido',

  -- Escalación automática (n8n-004)
  ultima_actualizacion_at TIMESTAMPTZ,
  horas_sin_actualizar INTEGER,
  nivel_escalacion INTEGER DEFAULT 0,        -- 0=normal 1=asesor 2=gerente 3=bot

  -- Link de seguimiento público (sin auth)
  token_seguimiento TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),

  -- CSI (n8n-005)
  condicion_csi condicion_csi DEFAULT 'sin_evaluar',
  csi_calificacion INTEGER,
  csi_enviado_at TIMESTAMPTZ,
  csi_respondido_at TIMESTAMPTZ,
  resena_google_solicitada BOOLEAN DEFAULT FALSE,

  -- Firma digital
  firma_digital_url TEXT,
  firma_digital_at TIMESTAMPTZ,

  total_mano_obra DECIMAL(10,2),
  total_refacciones DECIMAL(10,2),
  total_ot DECIMAL(10,2),

  notas_internas TEXT,
  creada_at TIMESTAMPTZ DEFAULT NOW(),
  actualizada_at TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════
-- PIEZAS / EXPEDIENTE DE PIEZA
-- ════════════════════════════════════════════════════

CREATE TABLE piezas_ot (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  ot_id UUID REFERENCES ordenes_trabajo(id) ON DELETE CASCADE,
  sucursal_id UUID REFERENCES sucursales(id),
  cliente_id UUID REFERENCES clientes(id),

  numero_parte TEXT,
  descripcion TEXT NOT NULL,
  cantidad INTEGER DEFAULT 1,
  proveedor TEXT,
  eta DATE,

  estado estado_pieza DEFAULT 'pendiente',
  fecha_pedido TIMESTAMPTZ,
  fecha_llegada TIMESTAMPTZ,

  costo_unitario DECIMAL(10,2),
  imagen_oem_url TEXT,

  -- Notificaciones al cliente (n8n-003)
  ultimo_wa_enviado_at TIMESTAMPTZ,
  wa_llegada_enviado BOOLEAN DEFAULT FALSE,
  cliente_respondio_agendar BOOLEAN,
  cliente_respondio_at TIMESTAMPTZ,

  creada_at TIMESTAMPTZ DEFAULT NOW(),
  actualizada_at TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════
-- VENTAS PERDIDAS
-- ════════════════════════════════════════════════════

CREATE TABLE ventas_perdidas (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sucursal_id UUID REFERENCES sucursales(id),
  cliente_id UUID REFERENCES clientes(id),
  vehiculo_id UUID REFERENCES vehiculos(id),
  ot_id UUID REFERENCES ordenes_trabajo(id),
  asesor_id UUID REFERENCES usuarios(id),

  descripcion_reparacion TEXT NOT NULL,
  monto_rechazado DECIMAL(10,2),
  fecha_rechazo TIMESTAMPTZ NOT NULL,

  estado estado_venta_perdida DEFAULT 'detectada',

  contacto_wa_enviado_at TIMESTAMPTZ,
  contacto_wa_respuesta_at TIMESTAMPTZ,
  cliente_interesado BOOLEAN,

  actividad_citas_id UUID,
  cita_recuperacion_id UUID REFERENCES citas(id),

  notas TEXT,
  creada_at TIMESTAMPTZ DEFAULT NOW(),
  actualizada_at TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════
-- COTIZACIONES DE REFACCIONES
-- ════════════════════════════════════════════════════

CREATE TABLE cotizaciones (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sucursal_id UUID REFERENCES sucursales(id),
  cliente_id UUID REFERENCES clientes(id),
  vehiculo_id UUID REFERENCES vehiculos(id),
  asesor_id UUID REFERENCES usuarios(id),
  ot_id UUID REFERENCES ordenes_trabajo(id),

  numero_cotizacion TEXT UNIQUE,
  tipo TEXT DEFAULT 'refacciones' CHECK (tipo IN ('refacciones', 'servicio', 'mixta')),
  -- refacciones: cotización de partes independiente
  -- servicio: presupuesto pre-OT que el cliente aprueba antes de abrir la OT
  -- mixta: mano de obra + refacciones
  estado estado_cotizacion DEFAULT 'borrador',
  fecha_emision TIMESTAMPTZ DEFAULT NOW(),
  fecha_vencimiento TIMESTAMPTZ,

  total DECIMAL(10,2),
  moneda TEXT DEFAULT 'MXN',
  pdf_url TEXT,

  enviada_at TIMESTAMPTZ,
  abierta_at TIMESTAMPTZ,
  abierta_por_cliente BOOLEAN DEFAULT FALSE,

  seguimiento_24h_at TIMESTAMPTZ,
  seguimiento_48h_at TIMESTAMPTZ,
  seguimiento_72h_at TIMESTAMPTZ,

  aprobada_at TIMESTAMPTZ,
  rechazada_at TIMESTAMPTZ,

  notas TEXT,
  creada_at TIMESTAMPTZ DEFAULT NOW(),
  actualizada_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── ÍTEMS DE COTIZACIÓN ───────────────────────────────────────
CREATE TABLE cotizacion_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  cotizacion_id UUID REFERENCES cotizaciones(id) ON DELETE CASCADE,
  numero_parte TEXT,
  descripcion TEXT NOT NULL,
  cantidad INTEGER DEFAULT 1,
  precio_unitario DECIMAL(10,2),
  total DECIMAL(10,2),
  imagen_oem_url TEXT
);

-- ════════════════════════════════════════════════════
-- LEADS / PIPELINE DE VENTAS
-- ════════════════════════════════════════════════════

CREATE TABLE leads (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sucursal_id UUID REFERENCES sucursales(id),
  cliente_id UUID REFERENCES clientes(id),
  asesor_id UUID REFERENCES usuarios(id),

  nombre TEXT,
  whatsapp TEXT,
  email TEXT,

  estado estado_lead DEFAULT 'nuevo',
  fuente canal_mensaje DEFAULT 'whatsapp',
  necesidad TEXT,                            -- servicio | refaccion | venta | info
  vehiculo_interes TEXT,
  presupuesto_estimado DECIMAL(10,2),

  ultima_interaccion_at TIMESTAMPTZ,
  horas_sin_actualizar INTEGER,

  notas TEXT,
  creado_at TIMESTAMPTZ DEFAULT NOW(),
  actualizado_at TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════
-- ACTIVIDADES (HUB UNIVERSAL del CRM)
-- Toda acción del sistema genera una actividad.
-- entidad_tipo + entidad_id = lookup universal cross-módulo.
-- ════════════════════════════════════════════════════

CREATE TABLE actividades (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sucursal_id UUID REFERENCES sucursales(id) NOT NULL,   -- DONDE ocurrió

  tipo tipo_actividad NOT NULL,
  titulo TEXT NOT NULL,
  descripcion TEXT,
  estado estado_actividad DEFAULT 'pendiente',
  prioridad prioridad_actividad DEFAULT 'normal',

  fecha_programada TIMESTAMPTZ,
  fecha_realizada TIMESTAMPTZ,

  resultado TEXT,
  notas TEXT,
  duracion_minutos INTEGER,

  -- Vínculos directos
  usuario_asignado_id UUID REFERENCES usuarios(id) NOT NULL,
  creada_por_id UUID REFERENCES usuarios(id),
  cliente_id UUID REFERENCES clientes(id),
  vehiculo_id UUID REFERENCES vehiculos(id),
  empresa_id UUID REFERENCES empresas(id),
  ot_id UUID REFERENCES ordenes_trabajo(id),
  cita_id UUID REFERENCES citas(id),
  cotizacion_id UUID REFERENCES cotizaciones(id),
  lead_id UUID REFERENCES leads(id),
  venta_perdida_id UUID REFERENCES ventas_perdidas(id),
  pieza_ot_id UUID REFERENCES piezas_ot(id),

  -- Lookup universal (para reportes cross-módulo)
  entidad_tipo entidad_tipo,                 -- 'cita'|'ot'|'cotizacion'|'lead'|...
  entidad_id UUID,                           -- ID del registro relacionado principal

  -- Sync con Outlook Calendar (n8n-006)
  outlook_event_id TEXT,
  outlook_synced_at TIMESTAMPTZ,

  -- Notificaciones enviadas
  wa_enviado BOOLEAN DEFAULT FALSE,
  wa_enviado_at TIMESTAMPTZ,
  email_enviado BOOLEAN DEFAULT FALSE,
  email_enviado_at TIMESTAMPTZ,

  modulo_origen modulo_origen DEFAULT 'crm',

  creada_at TIMESTAMPTZ DEFAULT NOW(),
  actualizada_at TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════
-- MENSAJES / BANDEJA UNIFICADA
-- ════════════════════════════════════════════════════

CREATE TABLE mensajes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sucursal_id UUID REFERENCES sucursales(id),
  cliente_id UUID REFERENCES clientes(id),
  usuario_asesor_id UUID REFERENCES usuarios(id),

  canal canal_mensaje NOT NULL,
  direccion TEXT NOT NULL CHECK (direccion IN ('entrante', 'saliente')),
  contenido TEXT,
  media_url TEXT,
  media_tipo TEXT,

  id_externo TEXT,
  estado_entrega TEXT,

  enviado_por_bot BOOLEAN DEFAULT FALSE,
  enviado_at TIMESTAMPTZ DEFAULT NOW(),
  leido_at TIMESTAMPTZ,
  leido_por_asesor BOOLEAN DEFAULT FALSE
);

-- ════════════════════════════════════════════════════
-- ARCHIVOS IMPORTADOS
-- ════════════════════════════════════════════════════

CREATE TABLE archivos_importados (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sucursal_id UUID REFERENCES sucursales(id),
  usuario_id UUID REFERENCES usuarios(id),

  nombre_archivo TEXT,
  tipo TEXT,                                 -- citas | ot | csi | venta_perdida | clientes
  fuente TEXT,                               -- drive | csv | excel | autoline | sf | seekop

  total_registros INTEGER,
  registros_creados INTEGER,
  registros_actualizados INTEGER,
  registros_con_error INTEGER,
  errores JSONB,

  estado TEXT DEFAULT 'procesando',
  procesado_at TIMESTAMPTZ,
  creado_at TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════
-- MAESTRO DE PARTES
-- ════════════════════════════════════════════════════

CREATE TABLE maestro_partes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sucursal_id UUID REFERENCES sucursales(id),

  numero_parte TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  marca_vehiculo TEXT,
  categoria TEXT,                            -- 'Motor', 'Frenos', 'Suspensión', etc.
  subcategoria TEXT,
  marca_parte TEXT,                          -- OEM | nombre marca aftermarket
  numero_parte_alterno TEXT,                 -- número alternativo del proveedor
  imagen_oem_url TEXT,
  precio_lista DECIMAL(10,2),
  precio_costo DECIMAL(10,2),
  precio_venta DECIMAL(10,2),
  margen_porcentaje DECIMAL(5,2),
  unidad_medida TEXT DEFAULT 'pieza',
  peso_kg DECIMAL(8,3),
  aplicaciones TEXT[],                       -- ['Sentra 2018-2022', 'Versa 2019+']
  proveedor_principal TEXT,
  tiempo_entrega_dias INTEGER,               -- ETA típico del proveedor
  notas_tecnicas TEXT,
  disponible BOOLEAN DEFAULT TRUE,
  activo BOOLEAN DEFAULT TRUE,

  fuente TEXT,                               -- dms | portal_marca | manual
  ultima_consulta_at TIMESTAMPTZ,

  UNIQUE(sucursal_id, numero_parte)
);

-- ════════════════════════════════════════════════════
-- MÓDULO SEGUROS
-- Pólizas vinculadas a vehículos (historial completo)
-- Un vehículo puede tener múltiples pólizas a lo largo del tiempo
-- ════════════════════════════════════════════════════

CREATE TYPE estado_poliza AS ENUM ('M', 'N', 'C', 'I');
-- M = memorándum | N = nuevo | C = confirmado | I = facturado

CREATE TYPE tipo_poliza AS ENUM ('NF', 'NP', 'XF', 'XP');
-- NF = nuevo pago completo | NP = nuevo pago periódico
-- XF = renovación pago completo | XP = renovación pago periódico

CREATE TABLE companias_seguro (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  grupo_id UUID REFERENCES grupos(id) NOT NULL,          -- a nivel grupo
  codigo TEXT NOT NULL,                                  -- 2 chars alfanumérico
  nombre TEXT NOT NULL,
  activa BOOLEAN DEFAULT TRUE,
  creada_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(grupo_id, codigo)
);

-- ════════════════════════════════════════════════════
-- MÓDULO CSI — CUSTOMER SATISFACTION INDEX
-- Encuestas de satisfacción automáticas post-servicio
-- Score bajo → crea queja automática en Atención a Clientes
-- ════════════════════════════════════════════════════

CREATE TABLE csi_encuestas (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  grupo_id UUID REFERENCES grupos(id) NOT NULL,
  nombre TEXT NOT NULL,
  modulo_origen TEXT NOT NULL CHECK (modulo_origen IN ('taller','ventas','citas')),
  activa BOOLEAN DEFAULT TRUE,
  dias_espera INTEGER DEFAULT 1,                          -- días post-evento antes de enviar
  max_recordatorios INTEGER DEFAULT 2,
  horas_entre_recordatorio INTEGER DEFAULT 48,
  score_alerta INTEGER DEFAULT 3,                         -- score <= este valor → crea queja auto
  creado_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(grupo_id, nombre)
);

CREATE TABLE csi_preguntas (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  encuesta_id UUID REFERENCES csi_encuestas(id) ON DELETE CASCADE NOT NULL,
  orden INTEGER NOT NULL,
  texto TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('estrellas','nps','texto','si_no')),
  obligatoria BOOLEAN DEFAULT TRUE
);

CREATE TABLE csi_envios (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  encuesta_id UUID REFERENCES csi_encuestas(id) NOT NULL,
  cliente_id UUID REFERENCES clientes(id) NOT NULL,
  vehiculo_id UUID REFERENCES vehiculos(id),
  ot_id UUID REFERENCES ordenes_trabajo(id),              -- OT origen (taller)
  asesor_id UUID REFERENCES usuarios(id),
  sucursal_id UUID REFERENCES sucursales(id),
  estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente','enviada','respondida','sin_respuesta','cancelada')),
  enviado_at TIMESTAMPTZ,
  respondido_at TIMESTAMPTZ,
  recordatorios_enviados INTEGER DEFAULT 0,
  token_unico TEXT UNIQUE NOT NULL,                       -- link seguro sin login para responder
  queja_id UUID REFERENCES quejas(id),                    -- si score bajo → queja auto-creada
  creado_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE csi_respuestas (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  envio_id UUID REFERENCES csi_envios(id) ON DELETE CASCADE NOT NULL,
  pregunta_id UUID REFERENCES csi_preguntas(id) NOT NULL,
  respuesta_texto TEXT,
  respuesta_numerica INTEGER,                             -- 1-5 estrellas / 0-10 NPS
  creado_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger: score bajo → crea queja automática en Atención a Clientes
CREATE OR REPLACE FUNCTION crear_queja_por_csi()
RETURNS TRIGGER AS $$
DECLARE
  v_encuesta csi_encuestas%ROWTYPE;
  v_score_promedio NUMERIC;
  v_queja_id UUID;
BEGIN
  SELECT e.* INTO v_encuesta FROM csi_encuestas e
    JOIN csi_envios env ON env.encuesta_id = e.id
    WHERE env.id = NEW.envio_id;

  SELECT AVG(respuesta_numerica) INTO v_score_promedio
    FROM csi_respuestas
    WHERE envio_id = NEW.envio_id AND respuesta_numerica IS NOT NULL;

  IF v_score_promedio IS NOT NULL AND v_score_promedio <= v_encuesta.score_alerta THEN
    INSERT INTO quejas (
      sucursal_id, cliente_id, vehiculo_id,
      tipo, area, voz_cliente, origen
    )
    SELECT env.sucursal_id, env.cliente_id, env.vehiculo_id,
      'servicio', 'servicio',
      'Score CSI bajo: ' || ROUND(v_score_promedio,1) || '/5',
      'csi'
    FROM csi_envios env WHERE env.id = NEW.envio_id
    RETURNING id INTO v_queja_id;

    UPDATE csi_envios SET queja_id = v_queja_id WHERE id = NEW.envio_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER t_queja_por_csi
  AFTER INSERT ON csi_respuestas
  FOR EACH ROW EXECUTE FUNCTION crear_queja_por_csi();

-- RLS
ALTER TABLE csi_encuestas ENABLE ROW LEVEL SECURITY;
ALTER TABLE csi_preguntas ENABLE ROW LEVEL SECURITY;
ALTER TABLE csi_envios ENABLE ROW LEVEL SECURITY;
ALTER TABLE csi_respuestas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "csi_encuestas_grupo" ON csi_encuestas USING (grupo_id = get_mi_grupo_id());
CREATE POLICY "csi_envios_sucursal" ON csi_envios USING (sucursal_id = get_mi_sucursal_id());
CREATE POLICY "csi_respuestas_via_envio" ON csi_respuestas USING (
  envio_id IN (SELECT id FROM csi_envios WHERE sucursal_id = get_mi_sucursal_id())
);

-- Índices
CREATE INDEX idx_csi_envios_cliente ON csi_envios(cliente_id);
CREATE INDEX idx_csi_envios_ot ON csi_envios(ot_id);
CREATE INDEX idx_csi_envios_estado ON csi_envios(estado);
CREATE INDEX idx_csi_respuestas_envio ON csi_respuestas(envio_id);

CREATE TABLE seguros_vehiculo (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  vehiculo_id UUID REFERENCES vehiculos(id) ON DELETE CASCADE NOT NULL,
  cliente_id UUID REFERENCES clientes(id) NOT NULL,      -- desnormalizado para queries rápidos
  sucursal_id UUID REFERENCES sucursales(id),

  -- Compañía e identificación
  compania_seguro_id UUID REFERENCES companias_seguro(id),
  numero_poliza TEXT,

  -- Propietario de la póliza (puede diferir del dueño del vehículo)
  propietario_poliza TEXT,
  direccion_propietario TEXT,
  cp_propietario TEXT,
  telefono_contacto TEXT,

  -- Vigencia
  fecha_inicio DATE,
  fecha_fin DATE,                                        -- ⚠️ usado para alerta de vencimiento

  -- Clasificación
  tipo_poliza tipo_poliza,
  estado estado_poliza DEFAULT 'N',
  modulo_origen TEXT DEFAULT 'crm',                      -- crm | pdv | showroom

  -- Coberturas Grupo 1 — Terceros
  cob_terceros BOOLEAN DEFAULT FALSE,
  monto_terceros DECIMAL(12,2),
  cob_robo BOOLEAN DEFAULT FALSE,
  monto_robo DECIMAL(12,2),
  cob_roce BOOLEAN DEFAULT FALSE,
  monto_roce DECIMAL(12,2),
  cob_no_averia BOOLEAN DEFAULT FALSE,
  monto_no_averia DECIMAL(12,2),
  cob_otros_1 BOOLEAN DEFAULT FALSE,
  monto_otros_1 DECIMAL(12,2),
  total_1 DECIMAL(12,2),                                 -- suma del grupo Terceros

  -- Coberturas Grupo 2 — Daños al vehículo
  cob_dano_vehiculo BOOLEAN DEFAULT FALSE,
  monto_dano_vehiculo DECIMAL(12,2),
  cob_parabrisas BOOLEAN DEFAULT FALSE,
  monto_parabrisas DECIMAL(12,2),
  cob_pasajero BOOLEAN DEFAULT FALSE,
  monto_pasajero DECIMAL(12,2),
  cob_ext_terceros BOOLEAN DEFAULT FALSE,
  monto_ext_terceros DECIMAL(12,2),
  cob_otros_2 BOOLEAN DEFAULT FALSE,
  monto_otros_2 DECIMAL(12,2),
  total_2 DECIMAL(12,2),                                 -- suma del grupo Vehículo

  -- Info adicional
  referencia TEXT,
  referencia_cliente TEXT,                               -- asientos cubiertos, importes extras, etc.

  -- Auditoría de estados
  operario_creacion_id UUID REFERENCES usuarios(id),
  fecha_creacion TIMESTAMPTZ DEFAULT NOW(),
  operario_confirmacion_id UUID REFERENCES usuarios(id),
  fecha_confirmacion TIMESTAMPTZ,
  operario_factura_id UUID REFERENCES usuarios(id),
  fecha_factura TIMESTAMPTZ,

  -- Alerta de vencimiento
  alerta_vencimiento_enviada BOOLEAN DEFAULT FALSE,
  alerta_vencimiento_at TIMESTAMPTZ,

  creado_at TIMESTAMPTZ DEFAULT NOW(),
  actualizado_at TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════
-- NOTIFICACIONES ENCOLADAS
-- Mensajes fuera del horario del bot (8am–7:30pm)
-- Se envían al abrir el siguiente día laboral
-- ════════════════════════════════════════════════════

CREATE TABLE notificaciones_encoladas (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sucursal_id UUID REFERENCES sucursales(id),
  cliente_id UUID REFERENCES clientes(id),

  tipo TEXT,                                 -- wa | email
  destinatario TEXT,
  contenido TEXT,
  media_url TEXT,

  contexto_modulo modulo_origen,
  contexto_id UUID,

  programada_at TIMESTAMPTZ DEFAULT NOW(),
  enviar_at TIMESTAMPTZ,
  enviada_at TIMESTAMPTZ,
  estado TEXT DEFAULT 'encolada'
);

-- ════════════════════════════════════════════════════
-- ÍNDICES PARA PERFORMANCE
-- ════════════════════════════════════════════════════

-- Jerarquía multi-tenant
CREATE INDEX idx_rs_grupo ON razones_sociales(grupo_id);
CREATE INDEX idx_sucursales_rs ON sucursales(razon_social_id);
CREATE INDEX idx_usuarios_sucursal ON usuarios(sucursal_id);

-- Clientes (universales)
CREATE INDEX idx_clientes_grupo ON clientes(grupo_id);
CREATE INDEX idx_clientes_whatsapp ON clientes(whatsapp);
CREATE INDEX idx_clientes_sucursal_origen ON clientes(sucursal_origen_id);

-- Empresas
CREATE INDEX idx_empresas_grupo ON empresas(grupo_id);

-- Seguros
CREATE INDEX idx_seguros_vehiculo ON seguros_vehiculo(vehiculo_id);
CREATE INDEX idx_seguros_cliente ON seguros_vehiculo(cliente_id);
CREATE INDEX idx_seguros_fecha_fin ON seguros_vehiculo(fecha_fin) WHERE alerta_vencimiento_enviada = FALSE;
CREATE INDEX idx_companias_grupo ON companias_seguro(grupo_id);

-- Vehículos
CREATE INDEX idx_vehiculos_vin ON vehiculos(vin);
CREATE INDEX idx_vehiculos_cliente ON vehiculos(cliente_id);

-- Vehículo personas
CREATE INDEX idx_veh_personas_vehiculo ON vehiculo_personas(vehiculo_id);
CREATE INDEX idx_veh_personas_cliente ON vehiculo_personas(cliente_id);
CREATE INDEX idx_veh_personas_rol ON vehiculo_personas(rol);

-- Citas
CREATE INDEX idx_citas_estado ON citas(estado);
CREATE INDEX idx_citas_fecha ON citas(fecha_cita);
CREATE INDEX idx_citas_sucursal_fecha ON citas(sucursal_id, fecha_cita);
CREATE INDEX idx_citas_limite ON citas(contacto_limite_at) WHERE estado = 'pendiente_contactar';

-- OT
CREATE INDEX idx_ot_numero ON ordenes_trabajo(numero_ot);
CREATE INDEX idx_ot_estado ON ordenes_trabajo(estado);
CREATE INDEX idx_ot_token ON ordenes_trabajo(token_seguimiento);

-- Actividades
CREATE INDEX idx_actividades_usuario ON actividades(usuario_asignado_id);
CREATE INDEX idx_actividades_cliente ON actividades(cliente_id);
CREATE INDEX idx_actividades_estado ON actividades(estado);
CREATE INDEX idx_actividades_fecha ON actividades(fecha_programada);
CREATE INDEX idx_actividades_entidad ON actividades(entidad_tipo, entidad_id);
CREATE INDEX idx_actividades_sucursal ON actividades(sucursal_id);

-- Mensajes
CREATE INDEX idx_mensajes_cliente ON mensajes(cliente_id);
CREATE INDEX idx_mensajes_canal ON mensajes(canal);
CREATE INDEX idx_mensajes_asesor ON mensajes(usuario_asesor_id);

-- Leads y ventas perdidas
CREATE INDEX idx_leads_estado ON leads(estado);
CREATE INDEX idx_ventas_perdidas_estado ON ventas_perdidas(estado);

-- Visibilidad
CREATE INDEX idx_visibilidad_origen ON configuracion_visibilidad(rs_origen_id);

-- ════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- ════════════════════════════════════════════════════

ALTER TABLE grupos ENABLE ROW LEVEL SECURITY;
ALTER TABLE razones_sociales ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracion_visibilidad ENABLE ROW LEVEL SECURITY;
ALTER TABLE sucursales ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehiculos ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehiculo_personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE citas ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordenes_trabajo ENABLE ROW LEVEL SECURITY;
ALTER TABLE piezas_ot ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_perdidas ENABLE ROW LEVEL SECURITY;
ALTER TABLE cotizaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE actividades ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensajes ENABLE ROW LEVEL SECURITY;
ALTER TABLE maestro_partes ENABLE ROW LEVEL SECURITY;

-- ── Helper: obtener grupo_id del usuario autenticado ──────────
CREATE OR REPLACE FUNCTION get_mi_grupo_id()
RETURNS UUID AS $$
  SELECT rs.grupo_id
  FROM usuarios u
  JOIN sucursales s ON s.id = u.sucursal_id
  JOIN razones_sociales rs ON rs.id = s.razon_social_id
  WHERE u.id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ── Helper: obtener sucursal_id del usuario autenticado ───────
CREATE OR REPLACE FUNCTION get_mi_sucursal_id()
RETURNS UUID AS $$
  SELECT sucursal_id FROM usuarios WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ── Helper: obtener razon_social_id del usuario autenticado ──
CREATE OR REPLACE FUNCTION get_mi_rs_id()
RETURNS UUID AS $$
  SELECT s.razon_social_id
  FROM usuarios u
  JOIN sucursales s ON s.id = u.sucursal_id
  WHERE u.id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Clientes: ver todos los del grupo (Driver 360 universal)
CREATE POLICY "clientes_por_grupo" ON clientes FOR SELECT
  USING (grupo_id = get_mi_grupo_id());

CREATE POLICY "clientes_insert_grupo" ON clientes FOR INSERT
  WITH CHECK (grupo_id = get_mi_grupo_id());

CREATE POLICY "clientes_update_grupo" ON clientes FOR UPDATE
  USING (grupo_id = get_mi_grupo_id());

-- Empresas: ver todas las del grupo
CREATE POLICY "empresas_por_grupo" ON empresas FOR SELECT
  USING (grupo_id = get_mi_grupo_id());

-- Citas: solo de mi sucursal
CREATE POLICY "citas_por_sucursal" ON citas FOR ALL
  USING (sucursal_id = get_mi_sucursal_id());

-- OT: solo de mi sucursal + pública por token
CREATE POLICY "ot_por_sucursal" ON ordenes_trabajo FOR ALL
  USING (sucursal_id = get_mi_sucursal_id());

CREATE POLICY "ot_seguimiento_publico" ON ordenes_trabajo
  FOR SELECT USING (token_seguimiento IS NOT NULL);

-- Actividades: mi sucursal + RS con visibilidad configurada
CREATE POLICY "actividades_por_visibilidad" ON actividades FOR SELECT
  USING (
    sucursal_id = get_mi_sucursal_id()
    OR sucursal_id IN (
      SELECT s.id
      FROM sucursales s
      JOIN configuracion_visibilidad cv ON cv.rs_destino_id = s.razon_social_id
      WHERE cv.rs_origen_id = get_mi_rs_id()
        AND cv.puede_ver_actividades = TRUE
        AND cv.activo = TRUE
    )
  );

CREATE POLICY "actividades_insert_sucursal" ON actividades FOR INSERT
  WITH CHECK (sucursal_id = get_mi_sucursal_id());

-- Vehículos: siguiendo al cliente (a nivel grupo)
CREATE POLICY "vehiculos_por_grupo" ON vehiculos FOR SELECT
  USING (
    cliente_id IN (SELECT id FROM clientes WHERE grupo_id = get_mi_grupo_id())
  );

-- Vehículo personas: mismo acceso que vehículos
CREATE POLICY "veh_personas_por_grupo" ON vehiculo_personas FOR SELECT
  USING (
    vehiculo_id IN (
      SELECT id FROM vehiculos
      WHERE cliente_id IN (SELECT id FROM clientes WHERE grupo_id = get_mi_grupo_id())
    )
  );

CREATE POLICY "veh_personas_insert" ON vehiculo_personas FOR INSERT
  WITH CHECK (
    vehiculo_id IN (
      SELECT id FROM vehiculos
      WHERE cliente_id IN (SELECT id FROM clientes WHERE grupo_id = get_mi_grupo_id())
    )
  );

-- ════════════════════════════════════════════════════
-- FUNCIONES Y TRIGGERS
-- ════════════════════════════════════════════════════

-- Actualizar timestamp automáticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.actualizada_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER t_clientes_updated BEFORE UPDATE ON clientes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER t_citas_updated BEFORE UPDATE ON citas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER t_ot_updated BEFORE UPDATE ON ordenes_trabajo
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER t_actividades_updated BEFORE UPDATE ON actividades
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Calcular horas sin actualizar en OT (para escalación n8n-004)
CREATE OR REPLACE FUNCTION calcular_horas_sin_actualizar()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ultima_actualizacion_at IS NOT NULL THEN
    NEW.horas_sin_actualizar = EXTRACT(EPOCH FROM (NOW() - NEW.ultima_actualizacion_at)) / 3600;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER t_ot_horas BEFORE UPDATE ON ordenes_trabajo
  FOR EACH ROW EXECUTE FUNCTION calcular_horas_sin_actualizar();

-- Asignar fecha límite de contacto al crear/actualizar cita (timer 15 min)
CREATE OR REPLACE FUNCTION asignar_limite_contacto()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.contacto_asignado_at IS NOT NULL AND NEW.contacto_limite_at IS NULL THEN
    NEW.contacto_limite_at = NEW.contacto_asignado_at + INTERVAL '15 minutes';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER t_citas_limite BEFORE INSERT OR UPDATE ON citas
  FOR EACH ROW EXECUTE FUNCTION asignar_limite_contacto();

-- ════════════════════════════════════════════════════
-- REGLAS DE NEGOCIO — TRIGGERS DE VALIDACIÓN
-- ════════════════════════════════════════════════════

-- R01: Empresa → máximo 10 clientes vinculados
CREATE OR REPLACE FUNCTION validar_max_clientes_empresa()
RETURNS TRIGGER AS $$
DECLARE
  total INTEGER;
BEGIN
  IF NEW.empresa_id IS NOT NULL THEN
    SELECT COUNT(*) INTO total
    FROM clientes
    WHERE empresa_id = NEW.empresa_id
      AND activo = TRUE
      AND id != COALESCE(NEW.id, uuid_nil());
    IF total >= 10 THEN
      RAISE EXCEPTION 'La empresa ya tiene 10 clientes vinculados (máximo permitido)';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER t_max_clientes_empresa
  BEFORE INSERT OR UPDATE ON clientes
  FOR EACH ROW EXECUTE FUNCTION validar_max_clientes_empresa();

-- R02: Vehículo → siempre debe tener exactamente 1 Dueño en vehiculo_personas
-- Se crea automáticamente al insertar un vehículo
CREATE OR REPLACE FUNCTION crear_dueno_vehiculo()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO vehiculo_personas (vehiculo_id, cliente_id, rol)
  VALUES (NEW.id, NEW.cliente_id, 'dueno');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER t_crear_dueno_vehiculo
  AFTER INSERT ON vehiculos
  FOR EACH ROW EXECUTE FUNCTION crear_dueno_vehiculo();

-- R03: vehiculo_personas → no se puede eliminar el último Dueño
CREATE OR REPLACE FUNCTION validar_dueno_vehiculo()
RETURNS TRIGGER AS $$
DECLARE
  duenos INTEGER;
BEGIN
  IF OLD.rol = 'dueno' THEN
    SELECT COUNT(*) INTO duenos
    FROM vehiculo_personas
    WHERE vehiculo_id = OLD.vehiculo_id
      AND rol = 'dueno'
      AND activo = TRUE
      AND id != OLD.id;
    IF duenos = 0 THEN
      RAISE EXCEPTION 'El vehículo debe tener al menos un Dueño vinculado';
    END IF;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER t_validar_dueno_vehiculo
  BEFORE DELETE ON vehiculo_personas
  FOR EACH ROW EXECUTE FUNCTION validar_dueno_vehiculo();

-- ════════════════════════════════════════════════════
-- LÍNEAS DE OT (desglose de trabajos y refacciones por OT)
-- Reemplaza los totales simples con itemizado completo
-- ════════════════════════════════════════════════════

CREATE TABLE lineas_ot (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  ot_id UUID REFERENCES ordenes_trabajo(id) ON DELETE CASCADE NOT NULL,
  sucursal_id UUID REFERENCES sucursales(id),
  tecnico_id UUID REFERENCES usuarios(id),       -- técnico asignado a esta línea

  tipo TEXT NOT NULL CHECK (tipo IN ('mano_obra', 'refaccion', 'fluido', 'externo', 'cortesia')),
  descripcion TEXT NOT NULL,
  numero_parte TEXT,                             -- si es refaccion/fluido
  cantidad DECIMAL(10,2) DEFAULT 1,
  unidad TEXT DEFAULT 'pieza',                   -- pieza | litro | hora | servicio
  precio_unitario DECIMAL(10,2),
  descuento_porcentaje DECIMAL(5,2) DEFAULT 0,
  total DECIMAL(10,2),

  estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'en_proceso', 'terminado', 'cancelado')),
  aprobado_cliente BOOLEAN DEFAULT FALSE,        -- cliente autorizó esta línea
  aprobado_at TIMESTAMPTZ,

  imagen_oem_url TEXT,                           -- foto de la pieza OEM
  notas TEXT,

  creada_at TIMESTAMPTZ DEFAULT NOW(),
  actualizada_at TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════
-- INSPECCIONES DE VEHÍCULO (Recepción Express)
-- Checklist visual al recibir el vehículo
-- ════════════════════════════════════════════════════

CREATE TABLE inspecciones_vehiculo (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  ot_id UUID REFERENCES ordenes_trabajo(id) ON DELETE CASCADE NOT NULL,
  cita_id UUID REFERENCES citas(id),
  sucursal_id UUID REFERENCES sucursales(id),
  usuario_id UUID REFERENCES usuarios(id) NOT NULL,  -- asesor que recepciona

  km_entrada INTEGER,
  nivel_gasolina INTEGER CHECK (nivel_gasolina BETWEEN 0 AND 8), -- octavos
  fotos_urls TEXT[],                             -- array URLs Supabase Storage
  items JSONB DEFAULT '{}',
  -- Ejemplo items:
  -- {"rayones_frente": true, "golpe_defensa": "pequeño", "llanta_trasera_der": "baja"}

  firma_cliente_url TEXT,                        -- firma digital del cliente
  firma_cliente_at TIMESTAMPTZ,
  observaciones TEXT,

  completada_at TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════
-- MÓDULO ATENCIÓN A CLIENTES
-- Quejas detectadas desde cualquier módulo/área.
-- Flujo: Receptor → Encargado AC → Gerente área
--        → Persona involucrada → Cliente → Validación → Cierre
-- Cada paso genera actividad enlazada y visible en cadena.
-- ════════════════════════════════════════════════════

CREATE TYPE estado_queja AS ENUM (
  'recibida',          -- receptor la capturó
  'asignada',          -- encargado AC la recibió
  'en_seguimiento',    -- encargado AC la canalizó al gerente
  'con_gerente',       -- gerente investiga internamente
  'solucion_propuesta',-- gerente fue con el cliente con solución
  'validando',         -- encargado AC valida con cliente
  'cerrada',           -- cliente aceptó solución
  'reabierta'          -- cliente rechazó, nuevo ciclo
);

CREATE TYPE tipo_queja AS ENUM (
  'servicio',          -- calidad del trabajo en taller
  'atencion',          -- trato del personal
  'tiempo',            -- demora en entrega o respuesta
  'facturacion',       -- cobro incorrecto
  'instalaciones',     -- daños, limpieza
  'ventas_nuevas',
  'ventas_usadas',
  'refacciones',
  'citas',
  'administracion',
  'otro'
);

CREATE TYPE area_queja AS ENUM (
  'servicio', 'refacciones', 'citas', 'ventas_nuevas',
  'ventas_usadas', 'administracion', 'otro'
);

CREATE TABLE quejas (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sucursal_id UUID REFERENCES sucursales(id) NOT NULL,
  folio TEXT UNIQUE NOT NULL,              -- AC-2026-0001 (autoincrement por sucursal)

  -- Quién y sobre qué
  cliente_id UUID REFERENCES clientes(id),
  vehiculo_id UUID REFERENCES vehiculos(id),
  empresa_id UUID REFERENCES empresas(id),

  -- Origen de la queja
  modulo_origen modulo_origen,             -- desde qué módulo se levantó
  area_involucrada area_queja NOT NULL,    -- departamento al que aplica
  tipo tipo_queja NOT NULL,
  voz_cliente TEXT NOT NULL,              -- exactamente lo que dijo el cliente
  fecha_hora_recepcion TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Actores
  recibida_por_id UUID REFERENCES usuarios(id) NOT NULL,      -- quien capturó
  persona_involucrada_id UUID REFERENCES usuarios(id),        -- empleado señalado
  encargado_ac_id UUID REFERENCES usuarios(id),               -- Atención a Clientes
  gerente_area_id UUID REFERENCES usuarios(id),               -- gerente del área

  -- Referencias cruzadas (desde qué registro se levantó)
  ot_id UUID REFERENCES ordenes_trabajo(id),
  cita_id UUID REFERENCES citas(id),
  cotizacion_id UUID REFERENCES cotizaciones(id),
  lead_id UUID REFERENCES leads(id),

  -- Estado y seguimiento
  estado estado_queja DEFAULT 'recibida',
  prioridad prioridad_actividad DEFAULT 'normal',
  ciclo INTEGER DEFAULT 1,                -- aumenta si cliente rechaza solución

  -- Resolución
  hallazgo_interno TEXT,                  -- qué encontró el gerente al investigar
  solucion_propuesta TEXT,                -- qué se le ofreció al cliente
  compensacion TEXT,                      -- descuento, cortesía, retrabajo, etc.
  cliente_acepto_solucion BOOLEAN,
  motivo_rechazo_cliente TEXT,            -- si no aceptó, por qué

  -- Tiempos
  fecha_limite_ac TIMESTAMPTZ,            -- SLA encargado AC (desde recibida)
  fecha_limite_gerente TIMESTAMPTZ,       -- SLA gerente (desde canalización)
  cerrada_at TIMESTAMPTZ,

  -- Notificaciones enviadas
  wa_encargado_ac_at TIMESTAMPTZ,
  wa_gerente_at TIMESTAMPTZ,
  wa_cliente_solucion_at TIMESTAMPTZ,

  creada_at TIMESTAMPTZ DEFAULT NOW(),
  actualizada_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── SEGUIMIENTOS DE QUEJA ────────────────────────────────────────
-- Cada paso del flujo queda registrado como seguimiento.
-- Encadenados: cada uno sabe qué actividad generó y quién sigue.
-- ────────────────────────────────────────────────────────────────

CREATE TYPE paso_seguimiento AS ENUM (
  'recepcion',          -- receptor captura la queja
  'asignacion_ac',      -- encargado AC recibe y revisa
  'canalizacion_gerente',-- AC canaliza al gerente del área
  'investigacion',      -- gerente investiga con involucrado
  'propuesta_solucion', -- gerente presenta solución al cliente
  'validacion_cliente', -- AC valida con el cliente
  'cierre',             -- solución aceptada
  'reapertura'          -- cliente rechazó, inicia nuevo ciclo
);

CREATE TABLE seguimientos_queja (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  queja_id UUID REFERENCES quejas(id) ON DELETE CASCADE NOT NULL,
  ciclo INTEGER DEFAULT 1,               -- a qué ciclo pertenece este paso

  paso paso_seguimiento NOT NULL,
  responsable_id UUID REFERENCES usuarios(id) NOT NULL,  -- a quién le toca actuar
  realizado_por_id UUID REFERENCES usuarios(id),         -- quién lo marcó completado

  descripcion TEXT,                      -- qué se hizo / qué se decidió
  notas_internas TEXT,                   -- visible solo al equipo
  fecha_limite TIMESTAMPTZ,              -- cuándo debe completarse
  completado_at TIMESTAMPTZ,
  completado BOOLEAN DEFAULT FALSE,

  -- Actividad en agenda generada para este paso
  actividad_id UUID REFERENCES actividades(id),

  -- Notificaciones enviadas para este paso
  wa_enviado BOOLEAN DEFAULT FALSE,
  wa_enviado_at TIMESTAMPTZ,
  email_enviado BOOLEAN DEFAULT FALSE,
  email_enviado_at TIMESTAMPTZ,
  outlook_event_id TEXT,                 -- evento en el calendario del responsable

  creado_at TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════
-- CAMPAÑAS DE SERVICIO Y GARANTÍAS
-- Recalls, campañas OEM, garantías extendidas por VIN
-- ════════════════════════════════════════════════════

CREATE TABLE campanas_servicio (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sucursal_id UUID REFERENCES sucursales(id),
  codigo TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('recall', 'campana', 'garantia_extendida', 'mantenimiento_preventivo')),
  descripcion TEXT,
  modelos_aplicables TEXT[],          -- ['Sentra', 'March', 'Versa']
  anio_desde INTEGER,
  anio_hasta INTEGER,
  fecha_inicio DATE,
  fecha_fin DATE,
  activa BOOLEAN DEFAULT TRUE,
  creada_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE campanas_vehiculos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  campana_id UUID REFERENCES campanas_servicio(id) ON DELETE CASCADE,
  vehiculo_id UUID REFERENCES vehiculos(id),
  cliente_id UUID REFERENCES clientes(id),        -- desnormalizado para queries
  estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'notificado', 'agendado', 'aplicado', 'no_aplica')),
  wa_notificacion_at TIMESTAMPTZ,
  aplicado_at TIMESTAMPTZ,
  ot_aplicacion_id UUID REFERENCES ordenes_trabajo(id),
  UNIQUE(campana_id, vehiculo_id)
);

-- ════════════════════════════════════════════════════
-- REPORTES GUARDADOS (constructor de reportes por módulo)
-- Cada módulo tiene su sub-módulo de reportes.
-- Config almacenada como JSONB — fields, filters, groupBy, chartType
-- ════════════════════════════════════════════════════

CREATE TABLE reportes_guardados (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sucursal_id UUID REFERENCES sucursales(id),
  usuario_id UUID REFERENCES usuarios(id) NOT NULL,

  nombre TEXT NOT NULL,
  descripcion TEXT,
  modulo modulo_origen NOT NULL,             -- reusa ENUM: crm|citas|taller|refacciones|ventas|bandeja|seguros

  config JSONB NOT NULL DEFAULT '{}',
  -- Estructura del config:
  -- {
  --   "fields":   ["fecha_recepcion", "asesor", "total_ot"],
  --   "filters":  [{"field": "estado", "op": "eq", "value": "entregado"}],
  --   "groupBy":  "asesor_id",
  --   "orderBy":  {"field": "total_ot", "dir": "desc"},
  --   "chartType":"bar",          -- table | bar | line | pie | kpi
  --   "limit":    100
  -- }

  visibilidad TEXT DEFAULT 'privado'
    CHECK (visibilidad IN ('privado', 'sucursal', 'grupo')),
  roles_acceso rol_usuario[],                -- qué roles ven este reporte si es compartido

  es_favorito BOOLEAN DEFAULT FALSE,
  veces_ejecutado INTEGER DEFAULT 0,
  ultima_ejecucion_at TIMESTAMPTZ,

  creado_at TIMESTAMPTZ DEFAULT NOW(),
  actualizado_at TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════
-- RLS — TABLAS NUEVAS
-- ════════════════════════════════════════════════════

ALTER TABLE lineas_ot ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspecciones_vehiculo ENABLE ROW LEVEL SECURITY;
ALTER TABLE quejas ENABLE ROW LEVEL SECURITY;
ALTER TABLE seguimientos_queja ENABLE ROW LEVEL SECURITY;
ALTER TABLE campanas_servicio ENABLE ROW LEVEL SECURITY;
ALTER TABLE campanas_vehiculos ENABLE ROW LEVEL SECURITY;
ALTER TABLE reportes_guardados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lineas_ot_sucursal" ON lineas_ot FOR ALL
  USING (sucursal_id = get_mi_sucursal_id());

CREATE POLICY "inspecciones_sucursal" ON inspecciones_vehiculo FOR ALL
  USING (sucursal_id = get_mi_sucursal_id());

CREATE POLICY "quejas_sucursal" ON quejas FOR ALL
  USING (sucursal_id = get_mi_sucursal_id());

CREATE POLICY "seguimientos_queja_sucursal" ON seguimientos_queja FOR ALL
  USING (queja_id IN (SELECT id FROM quejas WHERE sucursal_id = get_mi_sucursal_id()));

CREATE POLICY "campanas_sucursal" ON campanas_servicio FOR ALL
  USING (sucursal_id = get_mi_sucursal_id());

CREATE POLICY "campanas_vehiculos_grupo" ON campanas_vehiculos FOR SELECT
  USING (cliente_id IN (SELECT id FROM clientes WHERE grupo_id = get_mi_grupo_id()));

CREATE POLICY "reportes_select" ON reportes_guardados FOR SELECT
  USING (
    usuario_id = auth.uid()
    OR (visibilidad = 'sucursal' AND sucursal_id = get_mi_sucursal_id())
    OR (visibilidad = 'grupo' AND sucursal_id IN (
      SELECT s.id FROM sucursales s
      JOIN razones_sociales rs ON rs.id = s.razon_social_id
      WHERE rs.grupo_id = get_mi_grupo_id()
    ))
  );

CREATE POLICY "reportes_insert" ON reportes_guardados FOR INSERT
  WITH CHECK (usuario_id = auth.uid() AND sucursal_id = get_mi_sucursal_id());

CREATE POLICY "reportes_update" ON reportes_guardados FOR UPDATE
  USING (usuario_id = auth.uid());

CREATE POLICY "reportes_delete" ON reportes_guardados FOR DELETE
  USING (usuario_id = auth.uid());

-- ════════════════════════════════════════════════════
-- ÍNDICES — TABLAS NUEVAS
-- ════════════════════════════════════════════════════

CREATE INDEX idx_lineas_ot_ot ON lineas_ot(ot_id);
CREATE INDEX idx_lineas_ot_tecnico ON lineas_ot(tecnico_id);
CREATE INDEX idx_lineas_ot_estado ON lineas_ot(estado);

CREATE INDEX idx_inspecciones_ot ON inspecciones_vehiculo(ot_id);
CREATE INDEX idx_inspecciones_cita ON inspecciones_vehiculo(cita_id);

-- Quejas (Atención a Clientes)
CREATE INDEX idx_quejas_estado ON quejas(estado);
CREATE INDEX idx_quejas_cliente ON quejas(cliente_id);
CREATE INDEX idx_quejas_sucursal ON quejas(sucursal_id);
CREATE INDEX idx_quejas_ot ON quejas(ot_id);
CREATE INDEX idx_quejas_folio ON quejas(folio);
CREATE INDEX idx_quejas_encargado ON quejas(encargado_ac_id);
CREATE INDEX idx_quejas_gerente ON quejas(gerente_area_id);
CREATE INDEX idx_quejas_area ON quejas(area_involucrada);

-- Seguimientos de queja
CREATE INDEX idx_seguimientos_queja ON seguimientos_queja(queja_id);
CREATE INDEX idx_seguimientos_responsable ON seguimientos_queja(responsable_id);
CREATE INDEX idx_seguimientos_paso ON seguimientos_queja(paso);
CREATE INDEX idx_seguimientos_completado ON seguimientos_queja(completado);

CREATE INDEX idx_campanas_activa ON campanas_servicio(activa);
CREATE INDEX idx_campanas_veh_estado ON campanas_vehiculos(estado);
CREATE INDEX idx_campanas_veh_vehiculo ON campanas_vehiculos(vehiculo_id);

-- Citas: check-in
CREATE INDEX idx_citas_checkin ON citas(checkin_at) WHERE checkin_at IS NOT NULL;
CREATE INDEX idx_citas_en_agencia ON citas(estado) WHERE estado = 'en_agencia';

-- Reportes guardados
CREATE INDEX idx_reportes_usuario ON reportes_guardados(usuario_id);
CREATE INDEX idx_reportes_modulo ON reportes_guardados(modulo);
CREATE INDEX idx_reportes_sucursal ON reportes_guardados(sucursal_id);
CREATE INDEX idx_reportes_visibilidad ON reportes_guardados(visibilidad);

-- ════════════════════════════════════════════════════
-- TRIGGERS — TABLAS NUEVAS
-- ════════════════════════════════════════════════════

CREATE TRIGGER t_quejas_updated BEFORE UPDATE ON quejas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Función para generar folio automático AC-YYYY-NNNN por sucursal
CREATE OR REPLACE FUNCTION generar_folio_queja()
RETURNS TRIGGER AS $$
DECLARE
  contador INTEGER;
  anio TEXT;
BEGIN
  anio := TO_CHAR(NOW(), 'YYYY');
  SELECT COUNT(*) + 1 INTO contador
  FROM quejas
  WHERE sucursal_id = NEW.sucursal_id
    AND EXTRACT(YEAR FROM creada_at) = EXTRACT(YEAR FROM NOW());
  NEW.folio := 'AC-' || anio || '-' || LPAD(contador::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER t_quejas_folio BEFORE INSERT ON quejas
  FOR EACH ROW EXECUTE FUNCTION generar_folio_queja();

CREATE TRIGGER t_lineas_ot_updated BEFORE UPDATE ON lineas_ot
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
