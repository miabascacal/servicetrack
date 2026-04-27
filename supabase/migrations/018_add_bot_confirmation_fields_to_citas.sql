-- Migration 018: campos de trazabilidad del bot en citas
-- Agrega columnas usadas por lib/ai/bot-tools.ts (confirmarCitaBot, crearCitaBot)
-- para registrar si la cita fue creada/confirmada por el bot y cuándo.
-- Detectado como schema drift en validación pre-deploy 2026-04-27.

alter table public.citas
  add column if not exists contacto_bot        boolean     default false,
  add column if not exists confirmacion_cliente boolean,
  add column if not exists confirmacion_at      timestamptz;
