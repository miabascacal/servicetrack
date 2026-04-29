import { createAdminClient } from '@/lib/supabase/admin'

export type SlotDisponible = { hora: string; disponible: boolean }

export async function buscarDisponibilidad(
  sucursal_id: string,
  fecha: string,
): Promise<{ slots: SlotDisponible[]; mensaje: string }> {
  const supabase = createAdminClient()

  const diaSemana = new Date(fecha + 'T12:00:00').getDay()

  const [cfgRes, horarioDiaRes, diaNoLaborableRes, citasRes] = await Promise.all([
    supabase
      .from('configuracion_citas_sucursal')
      .select('horario_inicio, horario_fin, intervalo_minutos, dias_disponibles, activa, timezone')
      .eq('sucursal_id', sucursal_id)
      .single(),
    // Per-day schedule override (migration 020)
    supabase
      .from('configuracion_horarios_sucursal')
      .select('horario_inicio, horario_fin')
      .eq('sucursal_id', sucursal_id)
      .eq('modulo', 'citas')
      .eq('dia_semana', diaSemana)
      .eq('activo', true)
      .maybeSingle(),
    // Holiday / non-working day check (migration 020)
    supabase
      .from('configuracion_dias_no_laborables')
      .select('motivo')
      .eq('sucursal_id', sucursal_id)
      .eq('fecha', fecha)
      .eq('activa', true)
      .or('modulo.eq.citas,modulo.is.null')
      .limit(1)
      .maybeSingle(),
    supabase
      .from('citas')
      .select('hora_cita, estado')
      .eq('sucursal_id', sucursal_id)
      .eq('fecha_cita', fecha),
  ])

  if (!cfgRes.data) {
    return { slots: [], mensaje: 'Necesito validar disponibilidad con un asesor antes de confirmarte horario.' }
  }

  const cfg = cfgRes.data

  if (!cfg.activa) {
    return { slots: [], mensaje: 'El servicio de citas no está disponible en este momento.' }
  }

  // Holiday / non-working day takes priority over day-of-week check
  if (diaNoLaborableRes.data) {
    const motivo = (diaNoLaborableRes.data as { motivo?: string | null }).motivo
    const msg = motivo
      ? `Lo sentimos, ese día no hay servicio (${motivo}). Por favor elige otra fecha.`
      : 'Lo sentimos, ese día no hay servicio. Por favor elige otra fecha.'
    return { slots: [], mensaje: msg }
  }

  const diasDisponibles: number[] = (cfgRes.data?.dias_disponibles as number[]) ?? [1, 2, 3, 4, 5, 6]
  const tieneOverrideDia = !!horarioDiaRes.data
  if (!diasDisponibles.includes(diaSemana) && !tieneOverrideDia) {
    return { slots: [], mensaje: 'Lo sentimos, no atendemos ese día de la semana.' }
  }

  // Per-day override takes precedence over global horario
  const horarioEfectivo = horarioDiaRes.data ?? cfg
  const tz = (cfg.timezone as string | null) ?? 'America/Mexico_City'

  const ocupadas = new Set(
    (citasRes.data ?? [])
      .filter(c => !['cancelada', 'no_show'].includes(c.estado))
      .map(c => (c.hora_cita as string).slice(0, 5)),
  )

  // Filter past slots when fecha is today (use sucursal timezone)
  const nowMX = new Date(new Date().toLocaleString('en-US', { timeZone: tz }))
  const todayMX = [
    nowMX.getFullYear(),
    String(nowMX.getMonth() + 1).padStart(2, '0'),
    String(nowMX.getDate()).padStart(2, '0'),
  ].join('-')
  const isToday = fecha === todayMX
  const BUFFER_MIN = 30
  const nowTotalMin = nowMX.getHours() * 60 + nowMX.getMinutes()

  const [startH = 0, startM = 0] = (horarioEfectivo.horario_inicio as string).split(':').map(Number)
  const [endH = 0, endM = 0] = (horarioEfectivo.horario_fin as string).split(':').map(Number)
  const intervalo = (cfg.intervalo_minutos as number) ?? 30

  const slots: SlotDisponible[] = []
  let currentMin = startH * 60 + startM
  const endMin = endH * 60 + endM

  while (currentMin < endMin) {
    const h = Math.floor(currentMin / 60).toString().padStart(2, '0')
    const m = (currentMin % 60).toString().padStart(2, '0')
    const hora = `${h}:${m}`
    const disponible = !ocupadas.has(hora) && (!isToday || currentMin > nowTotalMin + BUFFER_MIN)
    slots.push({ hora, disponible })
    currentMin += intervalo
  }

  const libres = slots.filter(s => s.disponible)
  if (libres.length === 0) {
    const msg = isToday
      ? `Para hoy ya no hay horarios disponibles. ¿Te puedo ofrecer mañana?`
      : `No hay horarios disponibles para ${fecha}. Por favor elige otra fecha.`
    return { slots, mensaje: msg }
  }

  const horasStr = libres.slice(0, 8).map(s => s.hora).join(', ')
  return { slots, mensaje: `Horarios disponibles el ${fecha}: ${horasStr}` }
}

export async function crearCitaBot(params: {
  sucursal_id:  string
  cliente_id:   string
  fecha:        string
  hora:         string
  servicio?:    string | null
  confirmada?:  boolean    // true → estado 'confirmada' (cliente ya confirmó)
  vehiculo_id?: string | null
  notas?:       string | null
  tipoActividad?: string | null
}): Promise<{ id: string; confirmacion: string } | { error: string }> {
  // Hard gates — protect DB against incomplete citas regardless of caller
  if (!params.vehiculo_id) {
    return { error: 'Se requiere el vehículo para crear la cita. Por favor confirma qué vehículo vas a traer.' }
  }
  if (!params.servicio) {
    return { error: 'Se requiere el tipo de servicio para crear la cita. ¿Qué servicio necesitas?' }
  }

  const supabase = createAdminClient()

  // Guard: prevent duplicate citas for same client/date
  const { data: citaExistente } = await supabase
    .from('citas')
    .select('id, fecha_cita, hora_cita')
    .eq('sucursal_id', params.sucursal_id)
    .eq('cliente_id', params.cliente_id)
    .eq('fecha_cita', params.fecha)
    .not('estado', 'in', '(cancelada,no_show)')
    .maybeSingle()

  if (citaExistente) {
    return { error: 'Ya tienes una cita registrada para ese día. ¿Quieres confirmarla o prefieres una fecha diferente?' }
  }

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

  // Obtener responsable configurado en ai_settings (sin hardcodear)
  const { data: aiCfg } = await supabase
    .from('ai_settings')
    .select('escalation_assignee_id')
    .eq('sucursal_id', params.sucursal_id)
    .maybeSingle()
  const responsableId: string | null = (aiCfg as { escalation_assignee_id?: string | null } | null)?.escalation_assignee_id ?? null

  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('citas')
    .insert({
      sucursal_id:          params.sucursal_id,
      cliente_id:           params.cliente_id,
      vehiculo_id:          params.vehiculo_id ?? null,
      fecha_cita:           params.fecha,
      hora_cita:            params.hora,
      servicio:             params.servicio ?? null,
      estado:               params.confirmada ? 'confirmada' : 'pendiente_contactar',
      contacto_bot:         true,
      confirmacion_cliente: params.confirmada ? true : null,
      confirmacion_at:      params.confirmada ? now : null,
      asesor_id:            responsableId ?? null,
    })
    .select('id')
    .single()

  if (error || !data) {
    return { error: 'No se pudo crear la cita. Por favor intenta de nuevo.' }
  }

  const citaId = data.id

  // Crear actividad de trazabilidad (best-effort — no falla la operación principal)
  try {
    const fechaProgr = new Date(`${params.fecha}T${params.hora}:00`).toISOString()
    const srv = params.servicio ? `: ${params.servicio}` : ''
    const descripcion = params.confirmada
      ? `Cita confirmada por BotIA${srv} — ${params.fecha} ${params.hora}`
      : `Cita creada por BotIA pendiente de confirmacion humana${srv} — ${params.fecha} ${params.hora}`

    const actividadData: Record<string, unknown> = {
      sucursal_id:      params.sucursal_id,
      cliente_id:       params.cliente_id,
      cita_id:          citaId,
      tipo:             params.tipoActividad ?? (params.confirmada ? 'cita_agendada' : 'confirmacion_cita'),
      descripcion,
      estado:           params.confirmada ? 'realizada' : 'pendiente',
      prioridad:        'normal',
      completada:       params.confirmada,
      realizada_at:     params.confirmada ? now : null,
      fecha_programada: fechaProgr,
      fecha_vencimiento: fechaProgr,
      modulo_origen:    'ia',
      notas: (() => {
        const lines: string[] = []
        if (!responsableId)      lines.push('Sin responsable configurado en ai_settings.escalation_assignee_id')
        if (!params.vehiculo_id) lines.push('Vehículo pendiente por confirmar')
        if (params.notas)        lines.push(params.notas)
        return lines.length > 0 ? lines.join(' — ') : null
      })(),
    }
    if (responsableId) actividadData.usuario_asignado_id = responsableId

    await supabase.from('actividades').insert(actividadData)
  } catch (actErr) {
    console.error('[crearCitaBot] actividad best-effort falló:', actErr)
  }

  const fechaLegible = new Date(params.fecha + 'T12:00:00').toLocaleDateString('es-MX', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Mexico_City',
  })
  const srvLabel = params.servicio ? ` para ${params.servicio}` : ''
  const confirmacion = params.confirmada
    ? `Cita${srvLabel} confirmada para el ${fechaLegible} a las ${params.hora} hrs.`
    : `Cita${srvLabel} registrada como pendiente de confirmación para el ${fechaLegible} a las ${params.hora} hrs.`

  return {
    id:           citaId,
    confirmacion,
  }
}

export async function crearActividadBot(params: {
  sucursal_id:          string
  cliente_id:           string
  tipo:                 string
  descripcion:          string
  prioridad?:           string
  fecha_programada?:    string | null
  cita_id?:             string | null
  vehiculo_id?:         string | null
  modulo_origen?:       string
  notas?:               string | null
  usuario_asignado_id?: string | null
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('actividades')
    .insert({
      sucursal_id:        params.sucursal_id,
      cliente_id:         params.cliente_id,
      cita_id:            params.cita_id ?? null,
      vehiculo_id:        params.vehiculo_id ?? null,
      tipo:               params.tipo,
      descripcion:        params.descripcion,
      estado:             'pendiente',
      prioridad:          params.prioridad ?? 'normal',
      fecha_programada:   params.fecha_programada ?? null,
      fecha_vencimiento:  params.fecha_programada ?? null,
      modulo_origen:      params.modulo_origen ?? 'ia',
      notas:              params.notas ?? null,
      usuario_asignado_id: params.usuario_asignado_id ?? null,
      completada:         false,
    })

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function obtenerEscalationAssigneeId(
  sucursal_id: string,
): Promise<string | null> {
  const supabase = createAdminClient()
  const { data: aiCfg } = await supabase
    .from('ai_settings')
    .select('escalation_assignee_id')
    .eq('sucursal_id', sucursal_id)
    .maybeSingle()

  return (aiCfg as { escalation_assignee_id?: string | null } | null)?.escalation_assignee_id ?? null
}

// ── Seguimiento de citas existentes ──────────────────────────────────────────

export async function registrarAutomationLogBot(params: {
  sucursal_id: string
  event: 'botia_cita_creada' | 'botia_cita_pendiente_contactar' | 'botia_escalado_asesor' | 'botia_refacciones_enrutado' | 'botia_recordatorio_solicitado'
  referencia_tipo: 'cita' | 'thread' | 'cliente'
  referencia_id: string
  detalle: string
  canal?: 'whatsapp' | 'email' | 'push' | null
  idempotency_key: string
}): Promise<void> {
  const supabase = createAdminClient()

  try {
    await supabase
      .from('automation_logs')
      .upsert(
        {
          sucursal_id: params.sucursal_id,
          workflow_key: 'botia',
          rule_key: params.event,
          idempotency_key: params.idempotency_key,
          estado: 'success',
          canal: params.canal ?? 'whatsapp',
          referencia_tipo: params.referencia_tipo,
          referencia_id: params.referencia_id,
          executed_at: new Date().toISOString(),
          resultado_detalle: params.detalle,
        },
        { onConflict: 'idempotency_key', ignoreDuplicates: true },
      )
  } catch (error) {
    console.error('[registrarAutomationLogBot] best-effort falló:', error)
  }
}

export interface CitaResumen {
  id:         string
  fecha_cita: string
  hora_cita:  string
  estado:     string
  servicio:   string | null
}

const ESTADO_CITA_LABEL: Record<string, string> = {
  pendiente_contactar: 'pendiente de contacto',
  contactada:          'contactada, pendiente confirmar',
  confirmada:          'confirmada ✓',
  en_agencia:          'en agencia',
  show:                'ya asistió',
  no_show:             'no se presentó',
  cancelada:           'cancelada',
}

/**
 * Devuelve TODAS las citas recientes y próximas del cliente (incluye no_show y cancelada).
 * El bot necesita ver todos los estados para dar contexto correcto al cliente.
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
    .gte('fecha_cita', desde)
    .order('fecha_cita', { ascending: true })
    .limit(5)

  const citas = (data ?? []) as CitaResumen[]

  if (citas.length === 0) {
    return { citas: [], mensaje: 'El cliente no tiene citas registradas en los últimos 30 días ni próximas.' }
  }

  const resumen = citas.map(c => {
    const hora  = (c.hora_cita as string).slice(0, 5)
    const srv   = c.servicio ? ` — ${c.servicio}` : ''
    const label = ESTADO_CITA_LABEL[c.estado] ?? c.estado
    return `- ${c.fecha_cita} a las ${hora}${srv} [estado: ${label}] [id: ${c.id}]`
  }).join('\n')

  return { citas, mensaje: `Citas del cliente:\n${resumen}` }
}

/**
 * Confirma la asistencia del cliente a una cita ya agendada.
 * Mueve estado de 'pendiente_contactar'/'contactada' a 'confirmada'.
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

  if (!['pendiente_contactar', 'contactada'].includes(cita.estado)) {
    return {
      ok:      true,
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
    ok:      true,
    mensaje: `Asistencia confirmada. Cita${srv} el ${cita.fecha_cita} a las ${hora} hrs — actualizada a confirmada.`,
  }
}

/**
 * Cancela una cita existente. Solo aplica a estados activos (no show ni cancelada previa).
 */
export async function cancelarCitaBot(params: {
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

  const cancellable = ['pendiente_contactar', 'contactada', 'confirmada', 'en_agencia']
  if (!cancellable.includes(cita.estado)) {
    return { ok: false, mensaje: `La cita ya está en estado "${cita.estado}" y no puede cancelarse por este medio.` }
  }

  const { error } = await supabase
    .from('citas')
    .update({ estado: 'cancelada' })
    .eq('id', params.cita_id)

  if (error) {
    return { ok: false, mensaje: 'Error al cancelar la cita. Un asesor se pondrá en contacto.' }
  }

  const hora = (cita.hora_cita as string).slice(0, 5)
  const srv  = cita.servicio ? ` de ${cita.servicio}` : ''
  return {
    ok:      true,
    mensaje: `Cita${srv} del ${cita.fecha_cita} a las ${hora} cancelada correctamente.`,
  }
}

// ── Pending confirmation state (deterministic flow) ───────────────────────────

export interface ConfirmacionPendiente {
  fecha:    string
  hora:     string
  servicio: string | null
}

/**
 * Guarda los parámetros de una cita pendiente de confirmación en el thread metadata.
 * Se llama desde el bot justo antes de pedir confirmación al cliente.
 */
export async function guardarConfirmacionPendiente(params: {
  thread_id: string
  fecha:     string
  hora:      string
  servicio?: string
}): Promise<void> {
  const admin = createAdminClient()

  const { data: current } = await admin
    .from('conversation_threads')
    .select('metadata')
    .eq('id', params.thread_id)
    .single()

  const existing = (current?.metadata ?? {}) as Record<string, unknown>
  await admin
    .from('conversation_threads')
    .update({
      metadata: {
        ...existing,
        confirmacion_pendiente: {
          fecha:    params.fecha,
          hora:     params.hora,
          servicio: params.servicio ?? null,
        },
      },
    })
    .eq('id', params.thread_id)
}

/**
 * Lee la confirmación pendiente desde el thread metadata.
 * Returns null si no hay ninguna pendiente.
 */
export async function leerConfirmacionPendiente(thread_id: string): Promise<ConfirmacionPendiente | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('conversation_threads')
    .select('metadata')
    .eq('id', thread_id)
    .single()

  const pending = (data?.metadata as Record<string, unknown> | null)?.confirmacion_pendiente
  if (!pending || typeof pending !== 'object') return null
  const p = pending as Record<string, unknown>
  if (typeof p.fecha !== 'string' || typeof p.hora !== 'string') return null
  return {
    fecha:    p.fecha,
    hora:     p.hora,
    servicio: typeof p.servicio === 'string' ? p.servicio : null,
  }
}

/**
 * Limpia la confirmación pendiente del thread metadata una vez que se creó la cita.
 */
export async function limpiarConfirmacionPendiente(thread_id: string): Promise<void> {
  const admin = createAdminClient()

  const { data: current } = await admin
    .from('conversation_threads')
    .select('metadata')
    .eq('id', thread_id)
    .single()

  const existing = { ...(current?.metadata ?? {}) as Record<string, unknown> }
  delete existing.confirmacion_pendiente

  await admin
    .from('conversation_threads')
    .update({ metadata: existing })
    .eq('id', thread_id)
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
