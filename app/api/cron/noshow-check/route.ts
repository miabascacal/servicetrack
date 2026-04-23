/**
 * Vercel Cron — 5 PM CDT (23:00 UTC)
 * Detecta no-shows de citas de la tarde que pasaron después del cron de las 9 AM.
 * El cron de recordatorios-citas (9 AM CDT) ya maneja citas de ayer y las
 * primeras horas del día; este cron captura las del resto del día.
 *
 * vercel.json: { "path": "/api/cron/noshow-check", "schedule": "0 23 * * *" }
 */

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { enviarMensajeWA, mensajeNoShow } from '@/lib/whatsapp'
import { enviarEmail } from '@/lib/email'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const ahora = new Date()
  const hoy = ahora.toISOString().split('T')[0]
  const cutoffDate = new Date(ahora.getTime() - 30 * 60 * 1000)
  const cutoffHora = cutoffDate.toTimeString().slice(0, 5)

  type CitaRow = {
    id: string
    hora_cita: string
    fecha_cita: string
    sucursal_id: string
    cliente: { id: string; nombre: string; whatsapp: string; email: string | null } | null
    sucursal: { nombre: string } | null
  }

  const { data: noShows } = await supabase
    .from('citas')
    .select(`
      id, hora_cita, fecha_cita, sucursal_id,
      cliente:clientes ( id, nombre, whatsapp, email ),
      sucursal:sucursales ( nombre )
    `)
    .eq('fecha_cita', hoy)
    .eq('estado', 'confirmada')
    .lte('hora_cita', cutoffHora)

  let actualizados = 0

  for (const ns of (noShows as unknown as CitaRow[]) ?? []) {
    if (!ns.cliente) continue

    await supabase.from('citas').update({ estado: 'no_show' }).eq('id', ns.id)

    const msg = mensajeNoShow({
      nombre:  ns.cliente.nombre,
      hora:    ns.hora_cita.slice(0, 5),
      agencia: ns.sucursal?.nombre ?? 'la agencia',
    })

    if (ns.cliente.whatsapp) {
      void enviarMensajeWA({
        sucursal_id:  ns.sucursal_id,
        modulo:       'citas',
        telefono:     ns.cliente.whatsapp,
        mensaje:      msg,
        tipo:         'custom',
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

    actualizados++
  }

  return NextResponse.json({ hoy, cutoffHora, actualizados })
}
