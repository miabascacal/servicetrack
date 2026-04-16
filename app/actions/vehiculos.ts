'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { RolVehiculo } from '@/types/database'
import { ensureUsuario } from '@/lib/ensure-usuario'
import { tieneRol } from '@/lib/permisos'

export async function createVehiculoAction(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  let usuario: import('@/lib/ensure-usuario').UsuarioCtx
  try { usuario = await ensureUsuario(supabase, user.id, user.email ?? '') }
  catch (e) { return { error: e instanceof Error ? e.message : 'Error al obtener perfil' } }

  const marca = (formData.get('marca') as string)?.trim().toUpperCase()
  const modelo = (formData.get('modelo') as string)?.trim().toUpperCase()
  const anio = parseInt(formData.get('anio') as string)
  const dueno_cliente_id = formData.get('dueno_cliente_id') as string

  if (!marca || !modelo || !anio) {
    return { error: 'Marca, modelo y año son requeridos' }
  }
  if (!dueno_cliente_id) {
    return { error: 'Debes asignar al menos un dueño' }
  }

  // Create vehicle
  const { data: vehiculo, error: vError } = await supabase
    .from('vehiculos')
    .insert({
      grupo_id: usuario.grupo_id,
      marca,
      modelo,
      version: (formData.get('version') as string)?.trim().toUpperCase() || null,
      anio,
      color: (formData.get('color') as string)?.trim().toUpperCase() || null,
      placa: (formData.get('placa') as string)?.trim().toUpperCase() || null,
      vin: (formData.get('vin') as string)?.trim().toUpperCase() || null,
      km_actual: parseInt(formData.get('km_actual') as string) || null,
      intervalo_servicio_meses: parseInt(formData.get('intervalo_servicio_meses') as string) || 6,
      fecha_compra: (formData.get('fecha_compra') as string) || null,
      fecha_fin_garantia: (formData.get('fecha_fin_garantia') as string) || null,
      estado_verificacion: 'no_aplica',
      activo: true,
    })
    .select('id')
    .single()

  if (vError) return { error: 'Error al crear el vehículo' }

  // The trigger t_crear_dueno_vehiculo should auto-create the dueno link
  // But the trigger needs dueno_cliente_id — we pass it as a separate insert
  // Trigger creates it on INSERT to vehiculos with dueno_cliente_id in NEW
  // Since we can't pass extra fields, insert vehiculo_personas manually:
  const { error: vpError } = await supabase
    .from('vehiculo_personas')
    .insert({
      vehiculo_id: vehiculo.id,
      cliente_id: dueno_cliente_id,
      rol_vehiculo: 'dueno' as RolVehiculo,
    })

  if (vpError) {
    // Rollback: delete the vehicle if persona insert fails
    await supabase.from('vehiculos').delete().eq('id', vehiculo.id)
    return { error: 'Error al asignar el dueño del vehículo' }
  }

  // Add conductor if provided
  const conductor_cliente_id = (formData.get('conductor_cliente_id') as string)?.trim()
  if (conductor_cliente_id && conductor_cliente_id !== dueno_cliente_id) {
    await supabase.from('vehiculo_personas').insert({
      vehiculo_id: vehiculo.id,
      cliente_id: conductor_cliente_id,
      rol_vehiculo: 'conductor' as RolVehiculo,
    })
  }

  revalidatePath('/crm/vehiculos')
  if (dueno_cliente_id) {
    revalidatePath(`/crm/clientes/${dueno_cliente_id}`)
  }
  return { id: vehiculo.id }
}

// ── Crear Vehículo y vincular como dueño ────────────────────────────────────
export async function createVehiculoYVincularAction(clienteId: string, formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  let usuario: import('@/lib/ensure-usuario').UsuarioCtx
  try { usuario = await ensureUsuario(supabase, user.id, user.email ?? '') }
  catch (e) { return { error: e instanceof Error ? e.message : 'Error al obtener perfil' } }

  const marca = (formData.get('marca') as string)?.trim().toUpperCase()
  const modelo = (formData.get('modelo') as string)?.trim().toUpperCase()
  const anio = parseInt(formData.get('anio') as string)

  if (!marca || !modelo || !anio) return { error: 'Marca, modelo y año son requeridos' }

  const { data: vehiculo, error: vError } = await supabase
    .from('vehiculos')
    .insert({
      grupo_id: usuario.grupo_id,
      marca,
      modelo,
      version: (formData.get('version') as string)?.trim().toUpperCase() || null,
      anio,
      color: (formData.get('color') as string)?.trim().toUpperCase() || null,
      placa: (formData.get('placa') as string)?.trim().toUpperCase() || null,
      vin: (formData.get('vin') as string)?.trim().toUpperCase() || null,
      km_actual: parseInt(formData.get('km_actual') as string) || null,
      intervalo_servicio_meses: 6,
      estado_verificacion: 'no_aplica',
      activo: true,
    })
    .select('id')
    .single()

  if (vError) return { error: 'Error al crear el vehículo' }

  const { error: vpError } = await supabase
    .from('vehiculo_personas')
    .insert({ vehiculo_id: vehiculo.id, cliente_id: clienteId, rol_vehiculo: 'dueno' as RolVehiculo })

  if (vpError) {
    await supabase.from('vehiculos').delete().eq('id', vehiculo.id)
    return { error: 'Error al asignar el dueño del vehículo' }
  }

  revalidatePath(`/crm/clientes/${clienteId}`)
  revalidatePath('/crm/vehiculos')
  return { id: vehiculo.id, marca, modelo, anio }
}

// ── Update Vehículo ─────────────────────────────────────────────────────────
export async function updateVehiculoAction(id: string, formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  let ctx: import('@/lib/ensure-usuario').UsuarioCtx
  try { ctx = await ensureUsuario(supabase, user.id, user.email ?? '') }
  catch (e) { return { error: e instanceof Error ? e.message : 'Error al obtener perfil' } }

  if (!tieneRol(ctx.rol, 'asesor_servicio'))
    return { success: false, error: 'Sin permisos para esta operación' }

  const marca = (formData.get('marca') as string)?.trim().toUpperCase()
  const modelo = (formData.get('modelo') as string)?.trim().toUpperCase()
  const anio = parseInt(formData.get('anio') as string)
  const color = (formData.get('color') as string)?.trim().toUpperCase()
  const placa = (formData.get('placa') as string)?.trim()
  const vin = (formData.get('vin') as string)?.trim()

  if (!marca || !modelo || !anio) return { error: 'Marca, modelo y año son requeridos' }
  if (!color) return { error: 'El color es requerido' }
  if (!placa) return { error: 'La placa es requerida' }
  if (!vin || vin.length !== 17) return { error: 'El VIN debe tener exactamente 17 caracteres' }

  const { error } = await supabase
    .from('vehiculos')
    .update({
      marca,
      modelo,
      version: (formData.get('version') as string)?.trim().toUpperCase() || null,
      anio,
      color,
      placa: placa.toUpperCase(),
      vin: vin.toUpperCase(),
      km_actual: parseInt(formData.get('km_actual') as string) || null,
      intervalo_servicio_meses: parseInt(formData.get('intervalo_servicio_meses') as string) || 6,
      fecha_compra: (formData.get('fecha_compra') as string) || null,
      fecha_fin_garantia: (formData.get('fecha_fin_garantia') as string) || null,
      estado_verificacion: (formData.get('estado_verificacion') as string) || 'no_aplica',
      fecha_verificacion: (formData.get('fecha_verificacion') as string) || null,
      proxima_verificacion: (formData.get('proxima_verificacion') as string) || null,
      lugar_verificacion: (formData.get('lugar_verificacion') as string)?.trim() || null,
    })
    .eq('id', id)

  if (error) return { error: `Error al actualizar el vehículo: ${error.message}` }

  revalidatePath(`/crm/vehiculos/${id}`)
  revalidatePath('/crm/vehiculos')
  return { success: true }
}

// ── Vincular / Desvincular Empresa a Vehículo ───────────────────────────────
export async function vincularEmpresaVehiculoAction(vehiculoId: string, empresaId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  let ctx: import('@/lib/ensure-usuario').UsuarioCtx
  try { ctx = await ensureUsuario(supabase, user.id, user.email ?? '') }
  catch (e) { return { error: e instanceof Error ? e.message : 'Error al obtener perfil' } }

  if (!tieneRol(ctx.rol, 'asesor_servicio'))
    return { success: false, error: 'Sin permisos para esta operación' }

  const { error } = await supabase
    .from('vehiculos')
    .update({ empresa_id: empresaId })
    .eq('id', vehiculoId)

  if (error) return { error: `Error al vincular empresa al vehículo: ${error.message}` }
  revalidatePath(`/crm/vehiculos/${vehiculoId}`)
  return { success: true }
}

export async function desvincularEmpresaVehiculoAction(vehiculoId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  let ctx: import('@/lib/ensure-usuario').UsuarioCtx
  try { ctx = await ensureUsuario(supabase, user.id, user.email ?? '') }
  catch (e) { return { error: e instanceof Error ? e.message : 'Error al obtener perfil' } }

  if (!tieneRol(ctx.rol, 'gerente'))
    return { success: false, error: 'Sin permisos para esta operación' }

  const { error } = await supabase
    .from('vehiculos')
    .update({ empresa_id: null })
    .eq('id', vehiculoId)

  if (error) return { error: `Error al desvincular empresa: ${error.message}` }
  revalidatePath(`/crm/vehiculos/${vehiculoId}`)
  return { success: true }
}

// ── Desvincular Vehículo de Cliente ─────────────────────────────────────────
export async function desvincularVehiculoClienteAction(vehiculoId: string, clienteId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  let ctx: import('@/lib/ensure-usuario').UsuarioCtx
  try { ctx = await ensureUsuario(supabase, user.id, user.email ?? '') }
  catch (e) { return { error: e instanceof Error ? e.message : 'Error al obtener perfil' } }

  if (!tieneRol(ctx.rol, 'gerente'))
    return { success: false, error: 'Sin permisos para esta operación' }

  const { error } = await supabase
    .from('vehiculo_personas')
    .delete()
    .eq('vehiculo_id', vehiculoId)
    .eq('cliente_id', clienteId)

  if (error) return { error: 'Error al desvincular el vehículo' }

  revalidatePath(`/crm/clientes/${clienteId}`)
  revalidatePath(`/crm/vehiculos/${vehiculoId}`)
  return { success: true }
}

// ── Vincular Vehículo existente con Cliente ─────────────────────────────────
export async function addVehiculoPersonaAction(
  vehiculoId: string,
  clienteId: string,
  rol: RolVehiculo
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  let ctx: import('@/lib/ensure-usuario').UsuarioCtx
  try { ctx = await ensureUsuario(supabase, user.id, user.email ?? '') }
  catch (e) { return { error: e instanceof Error ? e.message : 'Error al obtener perfil' } }

  if (!tieneRol(ctx.rol, 'asesor_servicio'))
    return { success: false, error: 'Sin permisos para esta operación' }

  const { error } = await supabase.from('vehiculo_personas').upsert(
    { vehiculo_id: vehiculoId, cliente_id: clienteId, rol_vehiculo: rol },
    { onConflict: 'vehiculo_id,cliente_id' }
  )

  if (error) return { error: 'Error al vincular cliente al vehículo' }

  revalidatePath(`/crm/vehiculos/${vehiculoId}`)
  return { success: true }
}
