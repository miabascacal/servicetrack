import { redirect }       from 'next/navigation'
import { createClient }  from '@/lib/supabase/server'
import { BandejaClient, type ThreadRow, type PreviewRow } from './_BandejaClient'

// ─────────────────────────────────────────────────────────
// Tipos locales para normalizar el response crudo de Supabase
// (el proyecto no usa tipos generados — cast explícito)
// ─────────────────────────────────────────────────────────

type RawThread = {
  id:                  string
  canal:               string
  estado:              string
  last_message_at:     string | null
  last_message_source: string | null
  assignee_id:         string | null
  // PostgREST devuelve FK many-to-one como objeto; se normaliza igual si llega array
  cliente:
    | { id: string; nombre: string | null; whatsapp: string | null }
    | Array<{ id: string; nombre: string | null; whatsapp: string | null }>
    | null
}

type RawMsg = PreviewRow & { thread_id: string }

export default async function BandejaPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // ── Query 1 — Hilos activos con cliente vinculado ─────
  // RLS filtra por sucursal via get_mi_sucursal_id().
  // nullsFirst: false → hilos sin actividad reciente van al final.
  const { data: rawThreads, error: threadsError } = await supabase
    .from('conversation_threads')
    .select(`
      id,
      canal,
      estado,
      last_message_at,
      last_message_source,
      assignee_id,
      cliente:clientes ( id, nombre, whatsapp )
    `)
    .in('estado', ['open', 'waiting_customer', 'waiting_agent', 'bot_active'])
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(50)

  if (threadsError) {
    console.error('[bandeja] error cargando hilos:', threadsError.message)
  }

  const threads: ThreadRow[] = ((rawThreads ?? []) as RawThread[]).map(t => ({
    id:                  t.id,
    canal:               t.canal as ThreadRow['canal'],
    estado:              t.estado as ThreadRow['estado'],
    last_message_at:     t.last_message_at,
    last_message_source: t.last_message_source,
    assignee_id:         t.assignee_id,
    // Normalizar: objeto directo (caso normal) o primer elemento si llega array
    cliente: (() => {
      const raw = Array.isArray(t.cliente) ? (t.cliente[0] ?? null) : (t.cliente ?? null)
      if (!raw) return null
      return { id: raw.id, nombre: raw.nombre, whatsapp: raw.whatsapp }
    })(),
  }))

  // ── Query 2 — Preview del último mensaje por hilo ─────
  //
  // ⚠ WORKAROUND TEMPORAL — no es diseño final.
  // Solución definitiva: columna last_message_preview TEXT en
  // conversation_threads (migración 005), actualizada en lib/whatsapp.ts
  // al mismo tiempo que last_message_at.
  // Con limit(200): si hay muchos hilos con alto volumen de mensajes,
  // algunos hilos pueden quedar sin preview en la lista.
  //
  const threadIds = threads.map(t => t.id)
  let lastMsgByThread: Record<string, PreviewRow> = {}

  if (threadIds.length > 0) {
    const { data: rawMsgs, error: msgsError } = await supabase
      .from('mensajes')
      .select('thread_id, contenido, enviado_at, message_source, direccion')
      .in('thread_id', threadIds)
      .order('enviado_at', { ascending: false })
      .limit(200)

    if (msgsError) {
      console.error('[bandeja] error cargando previews:', msgsError.message)
    }

    // Reducir a primer resultado por thread_id (ORDER BY enviado_at DESC → es el más reciente)
    lastMsgByThread = ((rawMsgs ?? []) as RawMsg[]).reduce<Record<string, PreviewRow>>(
      (acc, m) => {
        if (m.thread_id && !acc[m.thread_id]) {
          acc[m.thread_id] = {
            contenido:      m.contenido,
            enviado_at:     m.enviado_at,
            message_source: m.message_source,
            direccion:      m.direccion,
          }
        }
        return acc
      },
      {},
    )
  }

  return <BandejaClient threads={threads} lastMsgByThread={lastMsgByThread} />
}
