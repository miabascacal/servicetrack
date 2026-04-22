'use server'

import { revalidatePath } from 'next/cache'
import { createClient }       from '@/lib/supabase/server'
import { createAdminClient }  from '@/lib/supabase/admin'
import type { EstadoCita }    from '@/types/database'
import { ensureUsuario }      from '@/lib/ensure-usuario'
import { tieneRol }           from '@/lib/permisos'
import {
  enviarMensajeWA,
  mensajeConfirmacionCita,
  mensajeCitaCancelada,
  mensajeRecordatorio2h,
} from '@/lib/whatsapp'
import { enviarEmail } from '@/lib/email'

// ── Helpers ────────────────────────────────────────────────────────────────

function formatearFecha(fecha: string): string {
  return new Date(fecha + 'T12:00:00').toLocaleDateString('es-MX', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}

// ── Crear cita ─────────────────────────────────────────────────────────────

export async function createCitaAction(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  let usuario: import('@/lib/ensure-usuario').UsuarioCtx
  try { usuario = await ensureUsuario(supabase, user.id, user.email ?? '') }
  catch (e) { return { error: e instanceof Error ? e.message : 'Error al obtener perfil' } }

  const cliente_id  = formData.get('cliente_id')  as string
  const fecha_cita  = formData.get('fecha_cita')  as string
  const hora_cita   = formData.get('hora_cita')   as string

  if (!cliente_id || !fecha_cita || !hora_cita) {
    return { error: 'Cliente, fecha y hora son requeridos' }
  }

  const vehiculo_id = (formData.get('vehiculo_id') as string) || null
  const servicio    = (formData.get('servicio')    as string)?.trim() || null
  const notas       = (formData.get('notas')       as string)?.trim() || null

  const { data, error } = await supabase
    .from('citas')
    .insert({
      sucursal_id: usuario.sucursal_id,
      cliente_id,
      vehiculo_id: vehiculo_id || null,
      fecha_cita,
      hora_cita,
      servicio:    servicio    || null,
      notas:       notas       || null,
      estado:      'pendiente_contactar' as unknown as EstadoCita,
    })
    .select('id')
    .single()

  if (error) return { error: `Error al crear la cita: ${error.message}` }

  revalidatePath('/citas')
  return { id: data.id }
}

// ── Cambiar estado ─────────────────────────────────────────────────────────

export async function updateCitaEstadoAction(citaId: string, nuevoEstado: EstadoCita) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  // Resolver usuario de la tabla usuarios para propagar usuario_asesor_id
  // en mensajes salientes (Sprint 8 Fase 1).
  let usuario: import('@/lib/ensure-usuario').UsuarioCtx
  try { usuario = await ensureUsuario(supabase, user.id, user.email ?? '') }
  catch (e) { return { error: e instanceof Error ? e.message : 'Error al obtener perfil' } }

  if (!tieneRol(usuario.rol, 'asesor_servicio'))
    return { success: false, error: 'Sin permisos para esta operación' }

  const ALLOWED_TRANSITIONS: Record<string, string[]> = {
    pendiente_contactar: ['contactada', 'confirmada', 'no_show', 'cancelada'],
    contactada:          ['confirmada', 'no_show', 'cancelada'],
    confirmada:          ['en_agencia', 'no_show', 'cancelada'],
    en_agencia:          ['show', 'no_show', 'cancelada'],
    show:                [],
    no_show:             ['confirmada'],
    cancelada:           [],
  }

  // Traer cita con datos del cliente y sucursal para WA + Email
  const adminSupabase = createAdminClient()
  const { data: cita } = await adminSupabase
    .from('citas')
    .select(`
      estado, sucursal_id, fecha_cita, hora_cita, servicio,
      cliente:clientes ( id, nombre, whatsapp, email ),
      sucursal:sucursales ( nombre, direccion )
    `)
    .eq('id', citaId)
    .single()

  if (!cita) return { error: 'Cita no encontrada' }

  const allowed = ALLOWED_TRANSITIONS[cita.estado] ?? []
  if (!allowed.includes(nuevoEstado)) {
    return { error: `No se puede mover de "${cita.estado}" a "${nuevoEstado}"` }
  }

  const { error } = await adminSupabase
    .from('citas')
    .update({ estado: nuevoEstado })
    .eq('id', citaId)

  if (error) return { error: 'Error al actualizar el estado' }

  // ── Enviar WhatsApp según el nuevo estado ──────────────────────────────
  type CitaConRelaciones = typeof cita & {
    cliente:  { id: string; nombre: string; whatsapp: string; email: string | null } | null
    sucursal: { nombre: string; direccion: string | null } | null
  }
  const c = cita as unknown as CitaConRelaciones

  if (c.cliente && c.sucursal_id) {
    const datosMensaje = {
      nombre:   c.cliente.nombre,
      fecha:    formatearFecha(c.fecha_cita),
      hora:     c.hora_cita.slice(0, 5),
      agencia:  c.sucursal?.nombre ?? 'la agencia',
      direccion: c.sucursal?.direccion ?? undefined,
      servicio: (cita as unknown as { servicio: string | null }).servicio ?? undefined,
    }

    if (nuevoEstado === 'confirmada') {
      if (c.cliente.whatsapp) {
        void enviarMensajeWA({
          sucursal_id:      c.sucursal_id,
          modulo:           'citas',
          telefono:         c.cliente.whatsapp,
          mensaje:          mensajeConfirmacionCita(datosMensaje),
          tipo:             'confirmacion_cita',
          entidad_tipo:     'cita',
          entidad_id:       citaId,
          cliente_id:       c.cliente.id,
          usuario_asesor_id: user.id,
          contexto_tipo:    'cita',
          contexto_id:      citaId,
        })
      }
      if (c.cliente.email) {
        void enviarEmail({
          to:          c.cliente.email,
          tipo:        'confirmacion_cita',
          datos:       datosMensaje,
          sucursal_id: c.sucursal_id,
          modulo:      'citas',
        })
      }

      // Encolar recordatorio 2h antes de la cita (best-effort)
      try {
        const fechaCita    = c.fecha_cita as unknown as string
        const horaCita     = (cita as unknown as { hora_cita: string }).hora_cita
        const citaDatetime = new Date(`${fechaCita}T${horaCita}-06:00`)
        const sendAfter    = new Date(citaDatetime.getTime() - 2 * 60 * 60 * 1000)

        if (sendAfter > new Date()) {
          const msg2h = mensajeRecordatorio2h({
            nombre:  c.cliente.nombre,
            hora:    horaCita.slice(0, 5),
            agencia: c.sucursal?.nombre ?? 'la agencia',
          })
          type QueueInsert = {
            sucursal_id: string; canal: string; workflow_key: string
            destinatario_tipo: string; destinatario_id: string
            destinatario_telefono: string | null; destinatario_email: string | null
            contenido: string; message_source: string; send_after: string
            estado: string; approval_required: boolean; intentos: number
            max_intentos: number; referencia_tipo: string; referencia_id: string
          }
          const base: Omit<QueueInsert, 'canal' | 'destinatario_telefono' | 'destinatario_email'> = {
            sucursal_id:       c.sucursal_id,
            workflow_key:      'recordatorio_2h_cita',
            destinatario_tipo: 'cliente',
            destinatario_id:   c.cliente.id,
            contenido:         msg2h,
            message_source:    'agent_bot',
            send_after:        sendAfter.toISOString(),
            estado:            'pending',
            approval_required: false,
            intentos:          0,
            max_intentos:      3,
            referencia_tipo:   'cita',
            referencia_id:     citaId,
          }
          const rows: QueueInsert[] = []
          if (c.cliente.whatsapp)
            rows.push({ ...base, canal: 'whatsapp', destinatario_telefono: c.cliente.whatsapp, destinatario_email: null })
          if (c.cliente.email)
            rows.push({ ...base, canal: 'email', destinatario_telefono: null, destinatario_email: c.cliente.email })
          if (rows.length) void adminSupabase.from('outbound_queue').insert(rows)
        }
      } catch {
        // Best-effort: no falla la confirmación
      }
    }

    if (nuevoEstado === 'cancelada') {
      if (c.cliente.whatsapp) {
        void enviarMensajeWA({
          sucursal_id:      c.sucursal_id,
          modulo:           'citas',
          telefono:         c.cliente.whatsapp,
          mensaje:          mensajeCitaCancelada(datosMensaje),
          tipo:             'cita_cancelada',
          entidad_tipo:     'cita',
          entidad_id:       citaId,
          cliente_id:       c.cliente.id,
          // Sprint 8 Fase 1: propagar contexto para persistencia conversacional
          usuario_asesor_id: user.id,   // usuarios.id == auth UUID (ver ensure-usuario.ts)
          contexto_tipo:    'cita',
          contexto_id:      citaId,
        })
      }
      if (c.cliente.email) {
        void enviarEmail({
          to:          c.cliente.email,
          tipo:        'cita_cancelada',
          datos:       datosMensaje,
          sucursal_id: c.sucursal_id,
          modulo:      'citas',
        })
      }
    }
  }

  revalidatePath('/citas')
  revalidatePath(`/citas/${citaId}`)
  return { success: true }
}

// ── Cancelar cita ──────────────────────────────────────────────────────────

export async function cancelarCitaAction(citaId: string) {
  return updateCitaEstadoAction(citaId, 'cancelada')
}
