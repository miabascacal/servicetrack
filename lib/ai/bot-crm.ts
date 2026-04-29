import { createAdminClient } from '@/lib/supabase/admin'

export interface VehiculoInfo {
  id:     string
  marca:  string
  modelo: string
  anio:   number
  placa:  string | null
  vin:    string | null
  color:  string | null
}

export interface InfoSucursal {
  nombre:           string
  direccion:        string | null
  telefono:         string | null
  horario_inicio:   string
  horario_fin:      string
  dias_disponibles: number[]
}

export async function buscarVehiculosCliente(
  cliente_id: string,
): Promise<VehiculoInfo[]> {
  const admin = createAdminClient()

  const { data } = await admin
    .from('vehiculo_personas')
    .select('vehiculo:vehiculos(id, marca, modelo, anio, placa, vin, color)')
    .eq('cliente_id', cliente_id)

  if (!data) return []

  return data
    .map(row => {
      const v = Array.isArray(row.vehiculo) ? row.vehiculo[0] : row.vehiculo
      if (!v || typeof v !== 'object') return null
      const vt = v as Record<string, unknown>
      return {
        id:     vt.id     as string,
        marca:  vt.marca  as string,
        modelo: vt.modelo as string,
        anio:   vt.anio   as number,
        placa:  (vt.placa  as string | null) ?? null,
        vin:    (vt.vin    as string | null) ?? null,
        color:  (vt.color  as string | null) ?? null,
      }
    })
    .filter((v): v is VehiculoInfo => v !== null)
}

export async function crearVehiculoYVincularBot(params: {
  grupo_id:   string
  cliente_id: string
  marca:      string
  modelo:     string
  anio:       number
  placa?:     string | null
  color?:     string | null
}): Promise<{ id: string; descripcion: string } | { error: string }> {
  const admin = createAdminClient()

  const { data: vehiculo, error: vError } = await admin
    .from('vehiculos')
    .insert({
      grupo_id: params.grupo_id,
      marca:    params.marca.toUpperCase(),
      modelo:   params.modelo.toUpperCase(),
      anio:     params.anio,
      placa:    params.placa?.toUpperCase() ?? null,
      color:    params.color?.toUpperCase() ?? null,
    })
    .select('id')
    .single()

  if (vError || !vehiculo) {
    return { error: 'No se pudo registrar el vehículo. Un asesor lo hará manualmente.' }
  }

  // best-effort link; ignore duplicate-key errors
  await admin
    .from('vehiculo_personas')
    .insert({
      vehiculo_id:  vehiculo.id,
      cliente_id:   params.cliente_id,
      rol_vehiculo: 'propietario',
    })

  const desc = `${params.marca} ${params.modelo} ${params.anio}${params.placa ? ` (${params.placa})` : ''}`
  return { id: vehiculo.id, descripcion: desc }
}

export async function actualizarNombreClienteBot(params: {
  cliente_id: string
  nombre:     string
  apellido:   string
}): Promise<{ ok: boolean; error?: string }> {
  const admin = createAdminClient()

  const { error } = await admin
    .from('clientes')
    .update({
      nombre:   params.nombre.toUpperCase(),
      apellido: params.apellido.toUpperCase(),
    })
    .eq('id', params.cliente_id)

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function actualizarPlacaVehiculoBot(params: {
  vehiculo_id: string
  placa:       string
}): Promise<{ ok: boolean; error?: string }> {
  const admin = createAdminClient()

  const { error } = await admin
    .from('vehiculos')
    .update({ placa: params.placa.toUpperCase() })
    .eq('id', params.vehiculo_id)

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function buscarClientesPorNombre(
  grupo_id: string,
  nombre: string,
  apellido: string,
): Promise<Array<{ id: string; nombre: string; apellido: string; whatsapp: string | null }>> {
  const admin = createAdminClient()

  const { data } = await admin
    .from('clientes')
    .select('id, nombre, apellido, whatsapp')
    .eq('grupo_id', grupo_id)
    .eq('nombre', nombre.toUpperCase())
    .eq('apellido', apellido.toUpperCase())
    .eq('activo', true)

  return (data ?? []) as Array<{ id: string; nombre: string; apellido: string; whatsapp: string | null }>
}

export async function leerInfoSucursal(
  sucursal_id: string,
): Promise<InfoSucursal | null> {
  const admin = createAdminClient()

  const [sucRes, cfgRes] = await Promise.all([
    admin
      .from('sucursales')
      .select('nombre, direccion, telefono')
      .eq('id', sucursal_id)
      .single(),
    admin
      .from('configuracion_citas_sucursal')
      .select('horario_inicio, horario_fin, dias_disponibles')
      .eq('sucursal_id', sucursal_id)
      .maybeSingle(),
  ])

  if (!sucRes.data) return null

  const suc = sucRes.data
  const cfg = cfgRes.data

  return {
    nombre:           suc.nombre as string,
    direccion:        (suc.direccion as string | null) ?? null,
    telefono:         (suc.telefono as string | null) ?? null,
    horario_inicio:   (cfg?.horario_inicio as string) ?? '08:00',
    horario_fin:      (cfg?.horario_fin    as string) ?? '18:00',
    dias_disponibles: (cfg?.dias_disponibles as number[]) ?? [1, 2, 3, 4, 5, 6],
  }
}
