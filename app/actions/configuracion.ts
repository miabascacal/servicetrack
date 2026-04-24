'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { ensureUsuario } from '@/lib/ensure-usuario'

export async function upsertConfigCitasAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  let ctx: import('@/lib/ensure-usuario').UsuarioCtx
  try { ctx = await ensureUsuario(supabase, user.id, user.email ?? '') }
  catch (e) { return { error: e instanceof Error ? e.message : 'Error al obtener perfil' } }

  const horario_inicio = formData.get('horario_inicio') as string
  const horario_fin    = formData.get('horario_fin')    as string
  const intervalo_minutos = parseInt(formData.get('intervalo_minutos') as string) || 30
  const activa = formData.get('activa') === 'true'
  const rawVista = formData.get('agenda_vista_default') as string
  const agenda_vista_default = (['mes', 'semana', 'dia'] as const).includes(rawVista as 'mes' | 'semana' | 'dia')
    ? rawVista
    : 'semana'

  const rawDias = formData.getAll('dias_disponibles').map(Number)
  const dias_disponibles = rawDias.length > 0 ? rawDias : [1, 2, 3, 4, 5, 6]

  if (!horario_inicio || !horario_fin) return { error: 'Horario requerido' }

  const { error } = await supabase
    .from('configuracion_citas_sucursal')
    .upsert(
      { sucursal_id: ctx.sucursal_id, horario_inicio, horario_fin, dias_disponibles, intervalo_minutos, activa, agenda_vista_default },
      { onConflict: 'sucursal_id' }
    )

  if (error) return { error: error.message }
  revalidatePath('/configuracion/citas')
  return { ok: true }
}

export async function upsertConfigTallerAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  let ctx: import('@/lib/ensure-usuario').UsuarioCtx
  try { ctx = await ensureUsuario(supabase, user.id, user.email ?? '') }
  catch (e) { return { error: e instanceof Error ? e.message : 'Error al obtener perfil' } }

  const horario_inicio     = formData.get('horario_inicio')     as string
  const horario_fin        = formData.get('horario_fin')        as string
  const capacidad_bahias   = parseInt(formData.get('capacidad_bahias') as string) || 4
  const notas_operativas   = (formData.get('notas_operativas') as string)?.trim() || null

  const rawDias = formData.getAll('dias_disponibles').map(Number)
  const dias_disponibles = rawDias.length > 0 ? rawDias : [1, 2, 3, 4, 5, 6]

  if (!horario_inicio || !horario_fin) return { error: 'Horario requerido' }

  const { error } = await supabase
    .from('configuracion_taller_sucursal')
    .upsert({ sucursal_id: ctx.sucursal_id, horario_inicio, horario_fin, dias_disponibles, capacidad_bahias, notas_operativas }, { onConflict: 'sucursal_id' })

  if (error) return { error: error.message }
  revalidatePath('/configuracion/taller')
  return { ok: true }
}
