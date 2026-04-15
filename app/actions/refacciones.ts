'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { ensureUsuario } from '@/lib/ensure-usuario'
import { tieneRol } from '@/lib/permisos'

function generarNumCotizacion(): string {
  const now = new Date()
  const y = now.getFullYear().toString().slice(-2)
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const rand = Math.floor(Math.random() * 9000) + 1000
  return `COT-${y}${m}${d}-${rand}`
}

// ── Maestro de partes ─────────────────────────────────────────────────────

export async function createParteAction(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  let usuario: import('@/lib/ensure-usuario').UsuarioCtx
  try { usuario = await ensureUsuario(supabase, user.id, user.email ?? '') }
  catch (e) { return { error: e instanceof Error ? e.message : 'Error al obtener perfil' } }

  const numero_parte = (formData.get('numero_parte') as string)?.trim()
  const descripcion = (formData.get('descripcion') as string)?.trim()

  if (!numero_parte || !descripcion) return { error: 'Número de parte y descripción son requeridos' }

  const precio_lista = parseFloat(formData.get('precio_lista') as string) || null
  const precio_costo = parseFloat(formData.get('precio_costo') as string) || null
  const precio_venta = parseFloat(formData.get('precio_venta') as string) || null

  const { data, error } = await supabase
    .from('maestro_partes')
    .insert({
      sucursal_id: usuario.sucursal_id,
      numero_parte,
      descripcion,
      categoria: (formData.get('categoria') as string)?.trim() || null,
      marca_vehiculo: (formData.get('marca_vehiculo') as string)?.trim() || null,
      marca_parte: (formData.get('marca_parte') as string)?.trim() || null,
      precio_lista,
      precio_costo,
      precio_venta,
      margen_porcentaje: precio_costo && precio_venta
        ? Math.round(((precio_venta - precio_costo) / precio_costo) * 100 * 100) / 100
        : null,
      unidad_medida: (formData.get('unidad_medida') as string) || 'pieza',
      proveedor_principal: (formData.get('proveedor_principal') as string)?.trim() || null,
      tiempo_entrega_dias: parseInt(formData.get('tiempo_entrega_dias') as string) || null,
      disponible: true,
      activo: true,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') return { error: 'Ya existe una parte con ese número en esta sucursal' }
    return { error: 'Error al crear la parte' }
  }

  revalidatePath('/refacciones/partes')
  return { id: data.id }
}

// ── Cotizaciones ──────────────────────────────────────────────────────────

export async function createCotizacionAction(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  let usuario: import('@/lib/ensure-usuario').UsuarioCtx
  try { usuario = await ensureUsuario(supabase, user.id, user.email ?? '') }
  catch (e) { return { error: e instanceof Error ? e.message : 'Error al obtener perfil' } }

  const cliente_id = formData.get('cliente_id') as string
  if (!cliente_id) return { error: 'Cliente es requerido' }

  const vehiculo_id = (formData.get('vehiculo_id') as string) || null
  const ot_id = (formData.get('ot_id') as string) || null
  const tipo = (formData.get('tipo') as string) || 'refacciones'
  const notas = (formData.get('notas') as string)?.trim() || null
  const fecha_vencimiento = (formData.get('fecha_vencimiento') as string) || null

  const { data, error } = await supabase
    .from('cotizaciones')
    .insert({
      sucursal_id: usuario.sucursal_id,
      cliente_id,
      vehiculo_id,
      ot_id,
      asesor_id: user.id,
      numero_cotizacion: generarNumCotizacion(),
      tipo,
      estado: 'borrador',
      notas,
      fecha_vencimiento: fecha_vencimiento || null,
    })
    .select('id')
    .single()

  if (error) return { error: 'Error al crear la cotización' }

  revalidatePath('/refacciones/cotizaciones')
  return { id: data.id }
}

export async function updateEstadoCotizacionAction(cotId: string, nuevoEstado: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  let ctx: import('@/lib/ensure-usuario').UsuarioCtx
  try { ctx = await ensureUsuario(supabase, user.id, user.email ?? '') }
  catch (e) { return { error: e instanceof Error ? e.message : 'Error al obtener perfil' } }

  if (!tieneRol(ctx.rol, 'asesor_servicio'))
    return { success: false, error: 'Sin permisos para esta operación' }

  const updateData: Record<string, unknown> = { estado: nuevoEstado }
  if (nuevoEstado === 'enviada') updateData.enviada_at = new Date().toISOString()
  if (nuevoEstado === 'aprobada') updateData.aprobada_at = new Date().toISOString()
  if (nuevoEstado === 'rechazada') updateData.rechazada_at = new Date().toISOString()

  const { error } = await supabase
    .from('cotizaciones')
    .update(updateData)
    .eq('id', cotId)

  if (error) return { error: 'Error al actualizar el estado' }

  revalidatePath('/refacciones/cotizaciones')
  revalidatePath(`/refacciones/cotizaciones/${cotId}`)
  return { success: true }
}

export async function addItemCotizacionAction(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  let ctx: import('@/lib/ensure-usuario').UsuarioCtx
  try { ctx = await ensureUsuario(supabase, user.id, user.email ?? '') }
  catch (e) { return { error: e instanceof Error ? e.message : 'Error al obtener perfil' } }

  if (!tieneRol(ctx.rol, 'asesor_servicio'))
    return { success: false, error: 'Sin permisos para esta operación' }

  const cotizacion_id = formData.get('cotizacion_id') as string
  const descripcion = (formData.get('descripcion') as string)?.trim()
  const cantidad = parseInt(formData.get('cantidad') as string) || 1
  const precio_unitario = parseFloat(formData.get('precio_unitario') as string) || 0
  const numero_parte = (formData.get('numero_parte') as string)?.trim() || null

  if (!cotizacion_id || !descripcion) return { error: 'Datos incompletos' }

  const total = cantidad * precio_unitario

  const { error: itemError } = await supabase
    .from('cotizacion_items')
    .insert({ cotizacion_id, descripcion, cantidad, precio_unitario, total, numero_parte })

  if (itemError) return { error: 'Error al agregar el ítem' }

  // Recalculate total
  const { data: items } = await supabase
    .from('cotizacion_items')
    .select('total')
    .eq('cotizacion_id', cotizacion_id)

  const nuevoTotal = (items ?? []).reduce((s, i) => s + (i.total ?? 0), 0)
  await supabase.from('cotizaciones').update({ total: nuevoTotal }).eq('id', cotizacion_id)

  revalidatePath(`/refacciones/cotizaciones/${cotizacion_id}`)
  return { success: true }
}

export async function deleteItemCotizacionAction(itemId: string, cotizacionId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  let ctx: import('@/lib/ensure-usuario').UsuarioCtx
  try { ctx = await ensureUsuario(supabase, user.id, user.email ?? '') }
  catch (e) { return { error: e instanceof Error ? e.message : 'Error al obtener perfil' } }

  if (!tieneRol(ctx.rol, 'gerente'))
    return { success: false, error: 'Sin permisos para esta operación' }

  await supabase.from('cotizacion_items').delete().eq('id', itemId)

  const { data: items } = await supabase
    .from('cotizacion_items')
    .select('total')
    .eq('cotizacion_id', cotizacionId)

  const nuevoTotal = (items ?? []).reduce((s, i) => s + (i.total ?? 0), 0)
  await supabase.from('cotizaciones').update({ total: nuevoTotal }).eq('id', cotizacionId)

  revalidatePath(`/refacciones/cotizaciones/${cotizacionId}`)
  return { success: true }
}
