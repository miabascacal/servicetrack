/**
 * Vercel Cron Job — se ejecuta cada día a las 9:00 AM (America/Mexico_City)
 * Envía recordatorio de WhatsApp a clientes con cita confirmada para mañana.
 *
 * Configurado en vercel.json:
 * { "crons": [{ "path": "/api/cron/recordatorios-citas", "schedule": "0 15 * * *" }] }
 * (15 UTC = 9 AM Ciudad de México)
 */

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { enviarMensajeWA, mensajeRecordatorioCita, mensajeNoShow } from '@/lib/whatsapp'
import { enviarEmail } from '@/lib/email'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  // Verificar que viene de Vercel Cron (o de nosotros en dev)
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const supabase = createAdminClient()

  // Calcular fecha de mañana
  const manana = new Date()
  manana.setDate(manana.getDate() + 1)
  const fechaManana = manana.toISOString().split('T')[0]

  // Traer citas confirmadas para mañana
  const { data: citas, error } = await supabase
    .from('citas')
    .select(`
      id, hora_cita, fecha_cita, sucursal_id,
      cliente:clientes ( id, nombre, whatsapp, email ),
      sucursal:sucursales ( nombre )
    `)
    .eq('fecha_cita', fechaManana)
    .eq('estado', 'confirmada')

  if (error) {
    console.error('Error obteniendo citas para recordatorio:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  type CitaRow = {
    id: string
    hora_cita: string
    fecha_cita: string
    sucursal_id: string
    cliente: { id: string; nombre: string; whatsapp: string; email: string | null } | null
    sucursal: { nombre: string } | null
  }

  const rows = (citas as unknown as CitaRow[]) ?? []
  let enviados = 0
  let errores = 0

  for (const cita of rows) {
    if (!cita.cliente) continue

    const datosMensaje = {
      nombre: cita.cliente.nombre,
      fecha: new Date(cita.fecha_cita + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }),
      hora: cita.hora_cita.slice(0, 5),
      agencia: cita.sucursal?.nombre ?? 'la agencia',
    }

    let ok = false

    // WhatsApp
    if (cita.cliente.whatsapp) {
      ok = await enviarMensajeWA({
        sucursal_id: cita.sucursal_id,
        modulo: 'citas',
        telefono: cita.cliente.whatsapp,
        mensaje: mensajeRecordatorioCita(datosMensaje),
        tipo: 'recordatorio_cita',
        entidad_tipo: 'cita',
        entidad_id: cita.id,
        cliente_id: cita.cliente.id,
      })
    }

    // Email
    if (cita.cliente.email) {
      const emailOk = await enviarEmail({
        to: cita.cliente.email,
        tipo: 'recordatorio_cita',
        datos: datosMensaje,
      })
      ok = ok || emailOk
    }

    if (ok) { enviados++ } else { errores++ }
  }

  console.log(`Recordatorios citas ${fechaManana}: ${enviados} enviados, ${errores} errores`)

  // ── Detección de no-show: citas pasadas sin asistencia ──────────────────────
  // 1) Citas de ayer aún confirmadas (full-day missed)
  // 2) Citas de hoy cuya hora ya pasó hace ≥30 min (mismo día)
  const ahora = new Date()
  const ayer = new Date(ahora)
  ayer.setDate(ayer.getDate() - 1)
  const fechaAyer = ayer.toISOString().split('T')[0]
  const hoy = ahora.toISOString().split('T')[0]

  // Hora límite: 30 minutos antes del momento actual (en formato HH:MM)
  const cutoffDate = new Date(ahora.getTime() - 30 * 60 * 1000)
  const cutoffHora = cutoffDate.toTimeString().slice(0, 5)

  const [{ data: noShowsAyer }, { data: noShowsHoy }] = await Promise.all([
    supabase
      .from('citas')
      .select(`
        id, hora_cita, fecha_cita, sucursal_id,
        cliente:clientes ( id, nombre, whatsapp, email ),
        sucursal:sucursales ( nombre )
      `)
      .eq('fecha_cita', fechaAyer)
      .eq('estado', 'confirmada'),
    supabase
      .from('citas')
      .select(`
        id, hora_cita, fecha_cita, sucursal_id,
        cliente:clientes ( id, nombre, whatsapp, email ),
        sucursal:sucursales ( nombre )
      `)
      .eq('fecha_cita', hoy)
      .eq('estado', 'confirmada')
      .lte('hora_cita', cutoffHora),
  ])

  const noShows = [...(noShowsAyer ?? []), ...(noShowsHoy ?? [])]

  let noShowsActualizados = 0

  for (const ns of (noShows as unknown as CitaRow[]) ?? []) {
    if (!ns.cliente) continue

    // Actualizar estado a no_show
    await supabase
      .from('citas')
      .update({ estado: 'no_show' })
      .eq('id', ns.id)

    const msg = mensajeNoShow({
      nombre:  ns.cliente.nombre,
      hora:    ns.hora_cita.slice(0, 5),
      agencia: ns.sucursal?.nombre ?? 'la agencia',
    })

    if (ns.cliente.whatsapp) {
      void enviarMensajeWA({
        sucursal_id: ns.sucursal_id,
        modulo:      'citas',
        telefono:    ns.cliente.whatsapp,
        mensaje:     msg,
        tipo:        'custom',
        entidad_tipo: 'cita',
        entidad_id:   ns.id,
        cliente_id:   ns.cliente.id,
      })
    }
    if (ns.cliente.email) {
      await enviarEmail({
        to:   ns.cliente.email,
        tipo: 'recordatorio_cita',
        datos: {
          nombre:  ns.cliente.nombre,
          hora:    ns.hora_cita.slice(0, 5),
          agencia: ns.sucursal?.nombre ?? 'la agencia',
          fecha:   ns.fecha_cita,
        },
      })
    }

    noShowsActualizados++
  }

  console.log(`No-shows ${fechaAyer}: ${noShowsActualizados} actualizados`)
  return NextResponse.json({ fecha: fechaManana, total: rows.length, enviados, errores, noShowsActualizados })
}
