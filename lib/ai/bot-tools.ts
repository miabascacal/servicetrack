import { createAdminClient } from '@/lib/supabase/admin'

export type SlotDisponible = { hora: string; disponible: boolean }

export async function buscarDisponibilidad(
  sucursal_id: string,
  fecha: string,
): Promise<{ slots: SlotDisponible[]; mensaje: string }> {
  const supabase = createAdminClient()

  const [cfgRes, citasRes] = await Promise.all([
    supabase
      .from('configuracion_citas_sucursal')
      .select('horario_inicio, horario_fin, intervalo_minutos, dias_disponibles, activa')
      .eq('sucursal_id', sucursal_id)
      .single(),
    supabase
      .from('citas')
      .select('hora_cita, estado')
      .eq('sucursal_id', sucursal_id)
      .eq('fecha_cita', fecha),
  ])

  const cfg = cfgRes.data ?? {
    horario_inicio: '08:00',
    horario_fin: '18:00',
    intervalo_minutos: 30,
    dias_disponibles: [1, 2, 3, 4, 5, 6],
    activa: true,
  }

  if (!cfg.activa) {
    return { slots: [], mensaje: 'El servicio de citas no está disponible en este momento.' }
  }

  // Verificar que la fecha es un día operativo
  const diaSemana = new Date(fecha + 'T12:00:00').getDay()
  const diasDisponibles: number[] = cfgRes.data?.dias_disponibles ?? [1, 2, 3, 4, 5, 6]
  if (!diasDisponibles.includes(diaSemana)) {
    return { slots: [], mensaje: `Lo sentimos, no atendemos ese día de la semana.` }
  }

  const ocupadas = new Set(
    (citasRes.data ?? [])
      .filter(c => !['cancelada', 'no_show'].includes(c.estado))
      .map(c => (c.hora_cita as string).slice(0, 5)),
  )

  const [startH = 8, startM = 0] = (cfg.horario_inicio as string).split(':').map(Number)
  const [endH = 18, endM = 0] = (cfg.horario_fin as string).split(':').map(Number)
  const intervalo = cfg.intervalo_minutos as number ?? 30

  const slots: SlotDisponible[] = []
  let currentMin = startH * 60 + startM
  const endMin = endH * 60 + endM

  while (currentMin < endMin) {
    const h = Math.floor(currentMin / 60).toString().padStart(2, '0')
    const m = (currentMin % 60).toString().padStart(2, '0')
    const hora = `${h}:${m}`
    slots.push({ hora, disponible: !ocupadas.has(hora) })
    currentMin += intervalo
  }

  const libres = slots.filter(s => s.disponible)
  if (libres.length === 0) {
    return { slots, mensaje: `No hay horarios disponibles para ${fecha}. Por favor elige otra fecha.` }
  }

  const horasStr = libres.map(s => s.hora).join(', ')
  return { slots, mensaje: `Horarios disponibles el ${fecha}: ${horasStr}` }
}

export async function crearCitaBot(params: {
  sucursal_id: string
  cliente_id: string
  fecha: string
  hora: string
  servicio?: string
}): Promise<{ id: string; confirmacion: string } | { error: string }> {
  const supabase = createAdminClient()

  // Verificar que el slot sigue disponible antes de insertar
  const { data: conflicto } = await supabase
    .from('citas')
    .select('id')
    .eq('sucursal_id', params.sucursal_id)
    .eq('fecha_cita', params.fecha)
    .eq('hora_cita', params.hora)
    .not('estado', 'in', '(cancelada,no_show)')
    .maybeSingle()

  if (conflicto) {
    return { error: 'Ese horario ya no está disponible. Por favor elige otro.' }
  }

  const { data, error } = await supabase
    .from('citas')
    .insert({
      sucursal_id: params.sucursal_id,
      cliente_id: params.cliente_id,
      fecha_cita: params.fecha,
      hora_cita: params.hora,
      servicio: params.servicio ?? null,
      estado: 'pendiente_contactar',
    })
    .select('id')
    .single()

  if (error || !data) {
    return { error: 'No se pudo crear la cita. Por favor intenta de nuevo.' }
  }

  return {
    id: data.id,
    confirmacion: `Cita confirmada para el ${params.fecha} a las ${params.hora} hrs.`,
  }
}

// ── Seguimiento de citas existentes ──────────────────────────────────────────

export interface CitaResumen {
  id:         string
  fecha_cita: string
  hora_cita:  string
  estado:     string
  servicio:   string | null
}

/**
 * Devuelve las citas recientes y próximas de un cliente.
 * Incluye citas de los últimos 30 días + futuras (excluye canceladas y no-show).
 */
export async function consultarCitasCliente(params: {
  sucursal_id: string
  cliente_id:  string
}): Promise<{ citas: CitaResumen[]; mensaje: string }> {
  const supabase = createAdminClient()

  const desde = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const { data } = await supabase
    .from('citas')
    .select('id, fecha_cita, hora_cita, estado, servicio')
    .eq('sucursal_id', params.sucursal_id)
    .eq('cliente_id', params.cliente_id)
    .not('estado', 'in', '(cancelada,no_show)')
    .gte('fecha_cita', desde)
    .order('fecha_cita', { ascending: true })
    .limit(3)

  const citas = (data ?? []) as CitaResumen[]

  if (citas.length === 0) {
    return { citas: [], mensaje: 'El cliente no tiene citas agendadas en los últimos 30 días ni próximas.' }
  }

  const resumen = citas.map(c => {
    const hora = (c.hora_cita as string).slice(0, 5)
    const srv  = c.servicio ? ` — ${c.servicio}` : ''
    return `- ${c.fecha_cita} a las ${hora}${srv} [estado: ${c.estado}] [id: ${c.id}]`
  }).join('\n')

  return { citas, mensaje: `Citas del cliente:\n${resumen}` }
}

/**
 * Confirma la asistencia del cliente a una cita ya agendada.
 * Mueve estado de 'pendiente_contactar'/'contactada' a 'confirmada'.
 * Registra que el bot hizo el contacto y el cliente confirmó.
 */
export async function confirmarCitaBot(params: {
  cita_id:     string
  sucursal_id: string
}): Promise<{ ok: boolean; mensaje: string }> {
  const supabase = createAdminClient()

  const { data: cita } = await supabase
    .from('citas')
    .select('id, estado, fecha_cita, hora_cita, servicio')
    .eq('id', params.cita_id)
    .eq('sucursal_id', params.sucursal_id)
    .single()

  if (!cita) {
    return { ok: false, mensaje: 'No se encontró la cita en el sistema.' }
  }

  const hora = (cita.hora_cita as string).slice(0, 5)

  // Si ya está confirmada o más avanzada, no hacer nada
  if (!['pendiente_contactar', 'contactada'].includes(cita.estado)) {
    return {
      ok:     true,
      mensaje: `La cita del ${cita.fecha_cita} a las ${hora} ya está en estado "${cita.estado}".`,
    }
  }

  const { error } = await supabase
    .from('citas')
    .update({
      estado:               'confirmada',
      contacto_bot:         true,
      confirmacion_cliente: true,
      confirmacion_at:      new Date().toISOString(),
    })
    .eq('id', params.cita_id)

  if (error) {
    return { ok: false, mensaje: 'No se pudo registrar la confirmación. Por favor intenta de nuevo.' }
  }

  const srv = cita.servicio ? ` para ${cita.servicio}` : ''
  return {
    ok:     true,
    mensaje: `Asistencia confirmada. Cita${srv} el ${cita.fecha_cita} a las ${hora} hrs — estado actualizado a confirmada.`,
  }
}

export async function buscarClientePorTelefono(
  sucursal_id: string,
  telefono: string,
): Promise<{ id: string; nombre: string; apellido: string } | null> {
  const supabase = createAdminClient()
  const tel = telefono.replace(/\D/g, '')

  const { data } = await supabase
    .from('clientes')
    .select('id, nombre, apellido')
    .eq('sucursal_id', sucursal_id)
    .or(`whatsapp.eq.${tel},whatsapp.eq.+${tel}`)
    .maybeSingle()

  return data ?? null
}
