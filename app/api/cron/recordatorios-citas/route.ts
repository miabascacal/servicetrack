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
import { enviarMensajeWA, mensajeRecordatorioCita } from '@/lib/whatsapp'
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
  return NextResponse.json({ fecha: fechaManana, total: rows.length, enviados, errores })
}
