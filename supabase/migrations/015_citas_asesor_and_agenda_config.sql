-- 015_citas_asesor_and_agenda_config.sql
-- Dos correcciones independientes:
-- 1. asesor_id en citas: columna presente en el schema de diseño pero nunca
--    aplicada en producción. Se agrega de forma idempotente.
-- 2. agenda_vista_default en configuracion_citas_sucursal: permite definir
--    la vista por defecto del calendario (/agenda) desde Configuración > Citas.

-- ── 1. asesor_id en citas ────────────────────────────────────────────────────
ALTER TABLE citas
  ADD COLUMN IF NOT EXISTS asesor_id UUID REFERENCES usuarios(id);

-- Índice para consultas de agenda por asesor (mismo patrón que idx_citas_estado)
CREATE INDEX IF NOT EXISTS idx_citas_asesor ON citas(asesor_id);

-- ── 2. agenda_vista_default en configuracion_citas_sucursal ──────────────────
-- Valores permitidos: 'mes' | 'semana' | 'dia'
-- Default 'semana' mantiene el comportamiento actual si no se configura.
ALTER TABLE configuracion_citas_sucursal
  ADD COLUMN IF NOT EXISTS agenda_vista_default TEXT
    NOT NULL DEFAULT 'semana'
    CHECK (agenda_vista_default IN ('mes', 'semana', 'dia'));
