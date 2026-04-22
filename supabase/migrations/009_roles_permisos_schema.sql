-- ════════════════════════════════════════════════════
-- MIGRACIÓN 009 — ROLES Y PERMISOS: SCHEMA COMPLETO
--
-- Problema que resuelve:
--   Las tablas roles/rol_permisos/usuario_roles existen en SUPABASE_SCHEMA.sql
--   pero sus políticas RLS referenciaban get_mi_grupo_id() ANTES de que esa
--   función fuera definida en el script. Resultado: RLS activo sin políticas
--   = acceso denegado para todos. PostgREST reporta esto como "table not found".
--   Además, la tabla usuarios no tenía política SELECT, bloqueando la lista de
--   usuarios cuando se usa createClient() (con JWT del usuario).
--
-- Cambios:
--   1. Agrega política SELECT a tabla usuarios (lista de equipo)
--   2. Crea roles, rol_permisos, usuario_roles con IF NOT EXISTS (idempotente)
--   3. Elimina y recrea políticas RLS correctamente
--   4. Grants a role authenticated
-- ════════════════════════════════════════════════════

-- ── 1. USUARIOS — agregar política SELECT faltante ────────────────────────
-- Con RLS habilitado y sin políticas, SELECT siempre retornaba vacío.
-- Esto permitía que la página /usuarios mostrara el equipo de la misma sucursal.

DROP POLICY IF EXISTS "usuarios_por_sucursal" ON usuarios;
CREATE POLICY "usuarios_por_sucursal" ON usuarios
  FOR SELECT
  USING (sucursal_id = get_mi_sucursal_id());

-- ── 2. TABLA roles ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS roles (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  grupo_id    UUID REFERENCES grupos(id) NOT NULL,
  nombre      TEXT NOT NULL,
  descripcion TEXT,
  es_super_admin BOOLEAN DEFAULT FALSE,
  activo      BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (grupo_id, nombre)
);

CREATE INDEX IF NOT EXISTS idx_roles_grupo ON roles(grupo_id);

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

-- Eliminar política previa (pudo haberse creado fallida en el schema original)
DROP POLICY IF EXISTS "roles_grupo" ON roles;

CREATE POLICY "roles_grupo" ON roles
  FOR ALL
  USING (grupo_id = get_mi_grupo_id())
  WITH CHECK (grupo_id = get_mi_grupo_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON roles TO authenticated;

-- ── 3. TABLA rol_permisos ─────────────────────────────────────────────────
-- Sin CHECK constraint en modulo para alinear con el tipo ModuloPermiso de TS
-- que incluye 'csi', que no estaba en la constraint original del schema.

CREATE TABLE IF NOT EXISTS rol_permisos (
  id             UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  rol_id         UUID REFERENCES roles(id) ON DELETE CASCADE NOT NULL,
  modulo         TEXT NOT NULL,
  puede_ver      BOOLEAN DEFAULT FALSE,
  puede_crear    BOOLEAN DEFAULT FALSE,
  puede_editar   BOOLEAN DEFAULT FALSE,
  puede_eliminar BOOLEAN DEFAULT FALSE,
  puede_exportar BOOLEAN DEFAULT FALSE,
  UNIQUE (rol_id, modulo)
);

CREATE INDEX IF NOT EXISTS idx_rol_permisos_rol ON rol_permisos(rol_id);

ALTER TABLE rol_permisos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rol_permisos_grupo" ON rol_permisos;

CREATE POLICY "rol_permisos_grupo" ON rol_permisos
  FOR ALL
  USING (
    rol_id IN (SELECT id FROM roles WHERE grupo_id = get_mi_grupo_id())
  )
  WITH CHECK (
    rol_id IN (SELECT id FROM roles WHERE grupo_id = get_mi_grupo_id())
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON rol_permisos TO authenticated;

-- ── 4. TABLA usuario_roles ────────────────────────────────────────────────
-- Relación M:N entre usuarios y roles.
-- Sin sucursal_id por ahora — puede agregarse en migración futura si se
-- necesita scoping de rol por sucursal específica.

CREATE TABLE IF NOT EXISTS usuario_roles (
  id         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE NOT NULL,
  rol_id     UUID REFERENCES roles(id) ON DELETE CASCADE NOT NULL,
  activo     BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (usuario_id, rol_id)
);

CREATE INDEX IF NOT EXISTS idx_usuario_roles_usuario ON usuario_roles(usuario_id);
CREATE INDEX IF NOT EXISTS idx_usuario_roles_rol ON usuario_roles(rol_id);

ALTER TABLE usuario_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usuario_roles_grupo" ON usuario_roles;

CREATE POLICY "usuario_roles_grupo" ON usuario_roles
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = usuario_id
        AND u.sucursal_id = get_mi_sucursal_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = usuario_id
        AND u.sucursal_id = get_mi_sucursal_id()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON usuario_roles TO authenticated;
