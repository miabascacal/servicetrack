'use server'

import { createClient } from '@/lib/supabase/server'
import { ensureUsuario } from '@/lib/ensure-usuario'
import { revalidatePath } from 'next/cache'

export async function createPolizaAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  let ctx: import('@/lib/ensure-usuario').UsuarioCtx
  try { ctx = await ensureUsuario(supabase, user.id, user.email ?? '') }
  catch (e) { return { error: e instanceof Error ? e.message : 'Error al obtener perfil' } }

  const vehiculo_id = (formData.get('vehiculo_id') as string)?.trim() || null
  const cliente_id = (formData.get('cliente_id') as string)?.trim() || null
  const compania_seguro_id = (formData.get('compania_seguro_id') as string)?.trim() || null
  const numero_poliza = (formData.get('numero_poliza') as string)?.trim() || null
  const tipo_poliza = (formData.get('tipo_poliza') as string) || null
  const estado = (formData.get('estado') as string) || 'N'
  const fecha_inicio = (formData.get('fecha_inicio') as string) || null
  const fecha_fin = (formData.get('fecha_fin') as string) || null
  const notas = (formData.get('notas') as string)?.trim() || null
  const referencia = (formData.get('referencia') as string)?.trim() || null

  if (!vehiculo_id) return { error: 'Vehículo requerido' }
  if (!cliente_id) return { error: 'El vehículo debe tener un cliente vinculado' }
  if (!fecha_fin) return { error: 'Fecha de vencimiento requerida' }

  const { data, error } = await supabase
    .from('seguros_vehiculo')
    .insert({
      sucursal_id: ctx.sucursal_id,
      vehiculo_id,
      cliente_id,
      compania_seguro_id: compania_seguro_id || null,
      numero_poliza,
      tipo_poliza: tipo_poliza || null,
      estado,
      fecha_inicio: fecha_inicio || null,
      fecha_fin,
      notas,
      referencia: referencia || null,
      operario_creacion_id: user.id,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }
  revalidatePath('/seguros')
  return { id: data.id }
}
