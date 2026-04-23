'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

type TriggerTipo =
  | 'cita_confirmada' | 'cita_cancelada' | 'cita_no_show'
  | 'ot_creada' | 'ot_estado_cambio' | 'ot_entregada'
  | 'lead_creado' | 'lead_estado_cambio'
  | 'csi_respondida' | 'manual'

export async function createAutomationRuleAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: usuario } = await supabase
    .from('usuarios')
    .select('sucursal_id')
    .eq('auth_user_id', user.id)
    .single()
  if (!usuario?.sucursal_id) return { error: 'Sin sucursal asignada' }

  const nombre = (formData.get('nombre') as string)?.trim().toUpperCase()
  const descripcion = (formData.get('descripcion') as string)?.trim() ?? null
  const trigger_tipo = formData.get('trigger_tipo') as TriggerTipo
  const accionesRaw = formData.get('acciones') as string

  if (!nombre || !trigger_tipo) return { error: 'Nombre y trigger son requeridos' }

  let acciones: unknown[]
  try {
    acciones = accionesRaw ? JSON.parse(accionesRaw) : []
  } catch {
    return { error: 'Formato de acciones inválido (JSON)' }
  }

  const { data, error } = await supabase
    .from('automation_rules')
    .insert({
      sucursal_id: usuario.sucursal_id,
      nombre,
      descripcion,
      trigger_tipo,
      acciones,
      creada_por_id: user.id,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }
  revalidatePath('/bandeja/workflow-studio')
  return { id: data.id }
}

export async function toggleAutomationRuleAction(id: string, activa: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { error } = await supabase
    .from('automation_rules')
    .update({ activa, actualizada_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/bandeja/workflow-studio')
  return { ok: true }
}
