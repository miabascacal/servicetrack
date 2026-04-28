-- 019_add_cita_id_to_actividades.sql
-- Trazabilidad BotIA/Citas: vincula actividades generadas automáticamente
-- a la cita que las originó. Permite consultar agenda por cita.

alter table public.actividades
  add column if not exists cita_id uuid references public.citas(id) on delete set null;

create index if not exists idx_actividades_cita_id
  on public.actividades(cita_id);
