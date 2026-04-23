'use server'

import { createClient } from '@/lib/supabase/server'
import { ensureUsuario } from '@/lib/ensure-usuario'
import { revalidatePath } from 'next/cache'

export async function createLeadAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  let ctx: import('@/lib/ensure-usuario').UsuarioCtx
  try { ctx = await ensureUsuario(supabase, user.id, user.email ?? '') }
  catch (e) { return { error: e instanceof Error ? e.message : 'Error al obtener perfil' } }

  const nombre = (formData.get('nombre') as string)?.trim().toUpperCase() || null
  const whatsapp = (formData.get('whatsapp') as string)?.trim() || null
  const email = (formData.get('email') as string)?.trim() || null
  const vehiculo_interes = (formData.get('vehiculo_interes') as string)?.trim().toUpperCase() || null
  const presupuesto_str = (formData.get('presupuesto_estimado') as string)?.trim()
  const presupuesto_estimado = presupuesto_str ? parseFloat(presupuesto_str) : null
  const fuente = (formData.get('fuente') as string) || 'manual'
  const necesidad = (formData.get('necesidad') as string)?.trim() || null
  const estado = 'nuevo'

  if (!nombre && !whatsapp) return { error: 'Nombre o WhatsApp requerido' }

  const { data, error } = await supabase
    .from('leads')
    .insert({
      sucursal_id: ctx.sucursal_id,
      nombre,
      whatsapp,
      email,
      vehiculo_interes,
      presupuesto_estimado,
      fuente,
      necesidad,
      estado,
      asesor_id: user.id,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }
  revalidatePath('/ventas')
  return { id: data.id }
}

export async function updateLeadEstadoAction(id: string, estado: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { error } = await supabase
    .from('leads')
    .update({ estado, actualizado_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/ventas')
  revalidatePath(`/ventas/${id}`)
  return { ok: true }
}

export async function updateLeadAction(id: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const nombre = (formData.get('nombre') as string)?.trim().toUpperCase() || null
  const whatsapp = (formData.get('whatsapp') as string)?.trim() || null
  const email = (formData.get('email') as string)?.trim() || null
  const vehiculo_interes = (formData.get('vehiculo_interes') as string)?.trim().toUpperCase() || null
  const presupuesto_str = (formData.get('presupuesto_estimado') as string)?.trim()
  const presupuesto_estimado = presupuesto_str ? parseFloat(presupuesto_str) : null
  const fuente = (formData.get('fuente') as string) || null
  const necesidad = (formData.get('necesidad') as string)?.trim() || null
  const notas = (formData.get('notas') as string)?.trim() || null

  if (!nombre && !whatsapp) return { error: 'Nombre o WhatsApp requerido' }

  const { error } = await supabase
    .from('leads')
    .update({ nombre, whatsapp, email, vehiculo_interes, presupuesto_estimado, fuente, necesidad, notas, actualizado_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/ventas')
  revalidatePath(`/ventas/${id}`)
  return { ok: true }
}
