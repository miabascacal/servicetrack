'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { ensureUsuario } from '@/lib/ensure-usuario'
import { tieneRol } from '@/lib/permisos'

// ── Create Cliente ─────────────────────────────────────────────────────────
export async function createClienteAction(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  let ctx: import('@/lib/ensure-usuario').UsuarioCtx
  try { ctx = await ensureUsuario(supabase, user.id, user.email ?? '') }
  catch (e) { return { error: e instanceof Error ? e.message : 'Error al obtener perfil' } }

  const nombre = (formData.get('nombre') as string)?.trim().toUpperCase()
  const apellido = (formData.get('apellido') as string)?.trim().toUpperCase()
  const whatsapp = (formData.get('whatsapp') as string)?.trim()

  if (!nombre || !apellido || !whatsapp) {
    return { error: 'Nombre, apellido y WhatsApp son requeridos' }
  }

  const { data, error } = await supabase
    .from('clientes')
    .insert({
      grupo_id: ctx.grupo_id,
      nombre,
      apellido,
      apellido_2: (formData.get('apellido_2') as string)?.trim().toUpperCase() || null,
      whatsapp,
      telefono_contacto: (formData.get('telefono_contacto') as string)?.trim() || null,
      telefono_alterno: (formData.get('telefono_alterno') as string)?.trim() || null,
      email: (formData.get('email') as string)?.trim() || null,
      email_2: (formData.get('email_2') as string)?.trim() || null,
      activo: true,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') return { error: 'Ya existe un cliente con ese WhatsApp' }
    return { error: `Error al crear el cliente: ${error.message}` }
  }

  revalidatePath('/crm/clientes')
  return { id: data.id, nombre, apellido }
}

// ── Vincular Cliente con Empresa ───────────────────────────────────────────
export async function vincularClienteEmpresaAction(clienteId: string, empresaId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  let ctx: import('@/lib/ensure-usuario').UsuarioCtx
  try { ctx = await ensureUsuario(supabase, user.id, user.email ?? '') }
  catch (e) { return { error: e instanceof Error ? e.message : 'Error al obtener perfil' } }

  if (!tieneRol(ctx.rol, 'asesor_servicio'))
    return { success: false, error: 'Sin permisos para esta operación' }

  const { error } = await supabase
    .from('clientes')
    .update({ empresa_id: empresaId })
    .eq('id', clienteId)

  if (error) return { error: 'Error al vincular con empresa' }

  revalidatePath(`/crm/clientes/${clienteId}`)
  return { success: true }
}

// ── Crear Empresa y Vincular con Cliente ────────────────────────────────────
export async function createEmpresaYVincularAction(clienteId: string, formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  let ctx: import('@/lib/ensure-usuario').UsuarioCtx
  try { ctx = await ensureUsuario(supabase, user.id, user.email ?? '') }
  catch (e) { return { error: e instanceof Error ? e.message : 'Error al obtener perfil' } }

  if (!tieneRol(ctx.rol, 'asesor_servicio'))
    return { success: false, error: 'Sin permisos para esta operación' }

  const nombre = (formData.get('nombre') as string)?.trim().toUpperCase()
  if (!nombre) return { error: 'El nombre de la empresa es requerido' }

  const { data: empresa, error: eError } = await supabase
    .from('empresas')
    .insert({
      grupo_id: ctx.grupo_id,
      nombre,
      rfc: (formData.get('rfc') as string)?.trim().toUpperCase() || null,
      telefono: (formData.get('telefono') as string)?.trim() || null,
      email: (formData.get('email') as string)?.trim() || null,
      activo: true,
    })
    .select('id, nombre')
    .single()

  if (eError) {
    if (eError.code === '23505') return { error: 'Ya existe una empresa con ese nombre o RFC' }
    return { error: 'Error al crear la empresa' }
  }

  const { error: vError } = await supabase
    .from('clientes')
    .update({ empresa_id: empresa.id })
    .eq('id', clienteId)

  if (vError) return { error: 'Empresa creada pero no se pudo vincular' }

  revalidatePath(`/crm/clientes/${clienteId}`)
  revalidatePath('/crm/empresas')
  return { id: empresa.id, nombre: empresa.nombre }
}

// ── Desvincular Cliente de Empresa ─────────────────────────────────────────
export async function desvincularClienteEmpresaAction(clienteId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  let ctx: import('@/lib/ensure-usuario').UsuarioCtx
  try { ctx = await ensureUsuario(supabase, user.id, user.email ?? '') }
  catch (e) { return { error: e instanceof Error ? e.message : 'Error al obtener perfil' } }

  if (!tieneRol(ctx.rol, 'gerente'))
    return { success: false, error: 'Sin permisos para esta operación' }

  const { error } = await supabase
    .from('clientes')
    .update({ empresa_id: null })
    .eq('id', clienteId)

  if (error) return { error: 'Error al desvincular la empresa' }

  revalidatePath(`/crm/clientes/${clienteId}`)
  return { success: true }
}

// ── Update Cliente ─────────────────────────────────────────────────────────
export async function updateClienteAction(id: string, formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  let ctx: import('@/lib/ensure-usuario').UsuarioCtx
  try { ctx = await ensureUsuario(supabase, user.id, user.email ?? '') }
  catch (e) { return { error: e instanceof Error ? e.message : 'Error al obtener perfil' } }

  if (!tieneRol(ctx.rol, 'asesor_servicio'))
    return { success: false, error: 'Sin permisos para esta operación' }

  const nombre = (formData.get('nombre') as string)?.trim().toUpperCase()
  const apellido = (formData.get('apellido') as string)?.trim().toUpperCase()
  const whatsapp = (formData.get('whatsapp') as string)?.trim()

  if (!nombre || !apellido || !whatsapp) {
    return { error: 'Nombre, apellido y WhatsApp son requeridos' }
  }

  const { error } = await supabase
    .from('clientes')
    .update({
      nombre,
      apellido,
      apellido_2: (formData.get('apellido_2') as string)?.trim().toUpperCase() || null,
      whatsapp,
      telefono_contacto: (formData.get('telefono_contacto') as string)?.trim() || null,
      telefono_alterno: (formData.get('telefono_alterno') as string)?.trim() || null,
      email: (formData.get('email') as string)?.trim() || null,
      email_2: (formData.get('email_2') as string)?.trim() || null,
    })
    .eq('id', id)

  if (error) return { error: 'Error al actualizar el cliente' }

  revalidatePath(`/crm/clientes/${id}`)
  revalidatePath('/crm/clientes')
  return { success: true }
}
