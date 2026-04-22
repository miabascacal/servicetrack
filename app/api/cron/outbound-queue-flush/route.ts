/**
 * Vercel Cron Job — se ejecuta cada 15 minutos.
 * Procesa la cola de mensajes diferidos (outbound_queue).
 *
 * Casos que maneja:
 *   - Mensajes encolados fuera del horario del bot (send_after pasó, ahora estamos en horario)
 *   - Reintentos de mensajes fallidos (intentos < max_intentos)
 *   - Mensajes aprobados manualmente por el asesor
 *
 * Horario del bot por defecto: 08:00–19:30 hora México (UTC-6).
 * Si la sucursal tiene ai_settings, usa su horario_bot_inicio/fin.
 *
 * Configurado en vercel.json con schedule "cada 15 minutos".
 */

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { enviarMensajeWA } from '@/lib/whatsapp'
import { Resend } from 'resend'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const resend = new Resend(process.env.RESEND_API_KEY)
const EMAIL_FROM = process.env.EMAIL_FROM ?? 'ServiceTrack <onboarding@resend.dev>'

// México usa UTC-6 (CST). Durante DST (verano) es UTC-5, pero usamos -6 como base.
const MEXICO_OFFSET_HOURS = -6

function minutosDelDiaMexico(now: Date): number {
  const utcMinutos = now.getUTCHours() * 60 + now.getUTCMinutes()
  return ((utcMinutos + MEXICO_OFFSET_HOURS * 60) + 24 * 60) % (24 * 60)
}

function esHorarioBot(
  now: Date,
  inicioMin: number = 8 * 60,
  finMin: number = 19 * 60 + 30,
): boolean {
  const minutos = minutosDelDiaMexico(now)
  return minutos >= inicioMin && minutos < finMin
}

function timeToMinutos(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

// Delay de reintento: crece exponencialmente (15 min → 30 min → 60 min)
function retryDelayMs(intentos: number): number {
  return Math.min(60, 15 * Math.pow(2, intentos)) * 60 * 1000
}

type QueueRow = {
  id: string
  sucursal_id: string
  canal: string
  workflow_key: string
  destinatario_tipo: string
  destinatario_id: string
  destinatario_telefono: string | null
  destinatario_email: string | null
  contenido: string
  message_source: string
  intentos: number
  max_intentos: number
  referencia_tipo: string | null
  referencia_id: string | null
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const now = new Date()

  // Mensajes listos para enviar: pending sin aprobación requerida + todos los approved
  const [pendingRes, approvedRes] = await Promise.all([
    supabase
      .from('outbound_queue')
      .select(`
        id, sucursal_id, canal, workflow_key,
        destinatario_tipo, destinatario_id,
        destinatario_telefono, destinatario_email,
        contenido, message_source,
        intentos, max_intentos,
        referencia_tipo, referencia_id
      `)
      .eq('estado', 'pending')
      .eq('approval_required', false)
      .lte('send_after', now.toISOString())
      .limit(50),
    supabase
      .from('outbound_queue')
      .select(`
        id, sucursal_id, canal, workflow_key,
        destinatario_tipo, destinatario_id,
        destinatario_telefono, destinatario_email,
        contenido, message_source,
        intentos, max_intentos,
        referencia_tipo, referencia_id
      `)
      .eq('estado', 'approved')
      .lte('send_after', now.toISOString())
      .limit(50),
  ])

  if (pendingRes.error) {
    return NextResponse.json({ error: pendingRes.error.message }, { status: 500 })
  }

  // Dedup por id (en caso de overlap entre las dos queries)
  const seen = new Set<string>()
  const toProcess = [
    ...((pendingRes.data as QueueRow[]) ?? []),
    ...((approvedRes.data as QueueRow[]) ?? []),
  ].filter(r => {
    if (seen.has(r.id)) return false
    seen.add(r.id)
    return true
  })

  if (!toProcess.length) {
    return NextResponse.json({ procesados: 0, enviados: 0, omitidos: 0, errores: 0 })
  }

  // Cargar config IA de las sucursales para respetar horario por sucursal
  const sucursalesIds = [...new Set(toProcess.map(r => r.sucursal_id))]
  const aiMap = new Map<string, { inicio: number; fin: number }>()

  const { data: configs } = await supabase
    .from('ai_settings')
    .select('sucursal_id, horario_bot_inicio, horario_bot_fin')
    .in('sucursal_id', sucursalesIds)

  for (const cfg of configs ?? []) {
    aiMap.set(cfg.sucursal_id, {
      inicio: timeToMinutos(cfg.horario_bot_inicio ?? '08:00'),
      fin:    timeToMinutos(cfg.horario_bot_fin    ?? '19:30'),
    })
  }

  let enviados = 0
  let omitidos = 0
  let errores  = 0

  for (const item of toProcess) {
    // Respetar horario del bot para esta sucursal
    const horario = aiMap.get(item.sucursal_id)
    if (!esHorarioBot(now, horario?.inicio, horario?.fin)) {
      omitidos++
      continue
    }

    let ok = false
    let errorDetalle: string | undefined

    try {
      if (item.canal === 'whatsapp' && item.destinatario_telefono) {
        const clienteId = item.destinatario_tipo === 'cliente' ? item.destinatario_id : undefined
        ok = await enviarMensajeWA({
          sucursal_id:     item.sucursal_id,
          modulo:          'general',
          telefono:        item.destinatario_telefono,
          mensaje:         item.contenido,
          tipo:            'custom',
          cliente_id:      clienteId,
          enviado_por_bot: item.message_source === 'bot',
          contexto_tipo:   'general',
        })
      } else if (item.canal === 'email' && item.destinatario_email) {
        const { error: emailErr } = await resend.emails.send({
          from:    EMAIL_FROM,
          to:      item.destinatario_email,
          subject: 'Mensaje de ServiceTrack',
          text:    item.contenido,
        })
        ok = !emailErr
        if (emailErr) errorDetalle = emailErr.message
      } else {
        errorDetalle = 'Sin destinatario válido para el canal'
      }
    } catch (e) {
      errorDetalle = e instanceof Error ? e.message : 'Error desconocido'
    }

    const nuevosIntentos = item.intentos + 1

    if (ok) {
      await supabase
        .from('outbound_queue')
        .update({ estado: 'sent', sent_at: new Date().toISOString(), intentos: nuevosIntentos })
        .eq('id', item.id)

      await supabase
        .from('automation_logs')
        .upsert(
          {
            sucursal_id:      item.sucursal_id,
            workflow_key:     item.workflow_key,
            idempotency_key:  `flush_ok_${item.id}`,
            estado:           'success',
            canal:            item.canal as 'whatsapp' | 'email',
            referencia_tipo:  item.referencia_tipo ?? 'cliente',
            referencia_id:    item.referencia_id ?? item.destinatario_id,
            executed_at:      new Date().toISOString(),
            resultado_detalle: `Enviado en intento ${nuevosIntentos}`,
          },
          { onConflict: 'idempotency_key', ignoreDuplicates: true },
        )

      enviados++
    } else {
      const agotar = nuevosIntentos >= item.max_intentos
      const queueUpdate: Record<string, unknown> = {
        estado:       agotar ? 'failed' : 'pending',
        intentos:     nuevosIntentos,
        error_detail: errorDetalle ?? null,
      }
      if (!agotar) {
        queueUpdate.send_after = new Date(Date.now() + retryDelayMs(nuevosIntentos)).toISOString()
      }

      await supabase
        .from('outbound_queue')
        .update(queueUpdate)
        .eq('id', item.id)

      await supabase
        .from('automation_logs')
        .upsert(
          {
            sucursal_id:      item.sucursal_id,
            workflow_key:     item.workflow_key,
            idempotency_key:  `flush_fail_${item.id}_i${nuevosIntentos}`,
            estado:           'failed',
            canal:            item.canal as 'whatsapp' | 'email',
            referencia_tipo:  item.referencia_tipo ?? 'cliente',
            referencia_id:    item.referencia_id ?? item.destinatario_id,
            executed_at:      new Date().toISOString(),
            resultado_detalle: errorDetalle ?? 'Fallo sin detalle',
          },
          { onConflict: 'idempotency_key', ignoreDuplicates: true },
        )

      errores++
    }
  }

  return NextResponse.json({ procesados: toProcess.length, enviados, omitidos, errores })
}
