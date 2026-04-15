'use client'

import { useState, useEffect, useRef } from 'react'
import {
  MessageSquare,
  Mail,
  Instagram,
  Facebook,
  Bot,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ChevronRight,
  User,
  Car,
  Wrench,
  Wifi,
} from 'lucide-react'
import Link from 'next/link'
import { getThreadMessagesAction, type MensajeRow } from '@/app/actions/bandeja'

// ─────────────────────────────────────────────────────────
// Tipos exportados — usados por page.tsx (Server Component)
// ─────────────────────────────────────────────────────────

export type BandejaCanal   = 'whatsapp' | 'email' | 'facebook' | 'instagram'
export type BandejaEstado  = 'open' | 'waiting_customer' | 'waiting_agent'

export interface ThreadRow {
  id:                  string
  canal:               BandejaCanal
  estado:              BandejaEstado
  last_message_at:     string | null
  last_message_source: string | null
  assignee_id:         string | null
  cliente:             { id: string; nombre: string | null } | null
}

export interface PreviewRow {
  contenido:      string | null
  enviado_at:     string
  message_source: string | null
  direccion:      string
}

interface BandejaClientProps {
  threads:          ThreadRow[]
  lastMsgByThread:  Record<string, PreviewRow>
}

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

function formatRelativeTime(ts: string | null): string {
  if (!ts) return '—'
  const diffMin = Math.floor((Date.now() - new Date(ts).getTime()) / 60_000)
  if (diffMin < 1)  return 'ahora'
  if (diffMin < 60) return `hace ${diffMin} min`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24)   return `hace ${diffH}h`
  return `hace ${Math.floor(diffH / 24)}d`
}

function formatTime(ts: string): string {
  return new Date(ts).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
}

/**
 * Minutos sin respuesta del cliente.
 * Solo cuenta cuando el ÚLTIMO mensaje del hilo es del cliente ('customer').
 * Si el último mensaje fue del agente o bot, devuelve 0.
 */
function calcSinRespuestaMin(
  last_message_at:     string | null,
  last_message_source: string | null,
): number {
  if (!last_message_at || last_message_source !== 'customer') return 0
  return Math.max(0, Math.floor((Date.now() - new Date(last_message_at).getTime()) / 60_000))
}

// ─────────────────────────────────────────────────────────
// Canal config — valores del ENUM de BD únicamente
// Fallback para valores inesperados (e.g. si la BD agrega
// un canal nuevo antes de actualizar el frontend)
// ─────────────────────────────────────────────────────────

const CANAL_CONFIG: Record<string, {
  label: string
  color: string
  bg:    string
  icon:  React.ReactNode
}> = {
  whatsapp:  { label: 'WhatsApp', color: 'text-green-600', bg: 'bg-green-500',  icon: <MessageSquare size={13} /> },
  email:     { label: 'Email',    color: 'text-blue-600',  bg: 'bg-blue-500',   icon: <Mail size={13} /> },
  instagram: { label: 'IG',       color: 'text-pink-600',  bg: 'bg-gradient-to-br from-purple-500 to-pink-500', icon: <Instagram size={13} /> },
  facebook:  { label: 'Facebook', color: 'text-blue-700',  bg: 'bg-blue-600',   icon: <Facebook size={13} /> },
}

function getCanalCfg(canal: string) {
  return CANAL_CONFIG[canal] ?? {
    label: canal,
    color: 'text-gray-600',
    bg:    'bg-gray-500',
    icon:  <MessageSquare size={13} />,
  }
}

const FILTERS = ['Todos', 'WhatsApp', 'Email', 'Instagram', 'Facebook', 'Sin respuesta', 'Escaladas'] as const
type FilterKey = typeof FILTERS[number]

/** Minutos sin respuesta del cliente para considerar un hilo escalado */
const ESCALADA_MIN = 45

// ─────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────

export function BandejaClient({ threads, lastMsgByThread }: BandejaClientProps) {
  const [selected,       setSelected]       = useState<string | null>(threads[0]?.id ?? null)
  const [filter,         setFilter]         = useState<FilterKey>('Todos')
  const [threadMessages, setThreadMessages] = useState<Record<string, MensajeRow[]>>({})
  const [loadingThread,  setLoadingThread]  = useState<string | null>(null)
  const [threadErrors,   setThreadErrors]   = useState<Record<string, string>>({})

  // Ref para prevenir cargas concurrentes del mismo hilo
  const inFlightRef  = useRef<Set<string>>(new Set())
  // Ref para el efecto de carga inicial (previene doble invocación en Strict Mode)
  const initializedRef = useRef(false)

  async function loadMessages(threadId: string) {
    if (threadMessages[threadId] !== undefined) return   // ya cargado
    if (inFlightRef.current.has(threadId))      return   // ya en curso

    inFlightRef.current.add(threadId)
    setLoadingThread(threadId)
    // Limpiar error previo del mismo hilo antes de reintentar
    setThreadErrors(prev => { const next = { ...prev }; delete next[threadId]; return next })
    try {
      const result = await getThreadMessagesAction(threadId)
      if (result.error) {
        // Error explícito de la action — no confundir con hilo vacío
        setThreadErrors(prev => ({ ...prev, [threadId]: result.error! }))
      } else {
        setThreadMessages(prev => ({ ...prev, [threadId]: result.data ?? [] }))
      }
    } finally {
      inFlightRef.current.delete(threadId)
      setLoadingThread(prev => (prev === threadId ? null : prev))
    }
  }

  // Cargar mensajes del primer hilo al montar
  useEffect(() => {
    if (!initializedRef.current && threads[0]?.id) {
      initializedRef.current = true
      void loadMessages(threads[0].id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleSelectThread(threadId: string) {
    setSelected(threadId)
    void loadMessages(threadId)
  }

  // ── Datos derivados ───────────────────────────────────

  const threadsEnhanced = threads.map(t => {
    const sinRespuestaMin = calcSinRespuestaMin(t.last_message_at, t.last_message_source)
    return {
      ...t,
      clienteNombre: t.cliente?.nombre ?? 'Sin cliente',
      preview:       lastMsgByThread[t.id] ?? null,
      sinRespuestaMin,
      escalada:      sinRespuestaMin >= ESCALADA_MIN,
    }
  })

  const filtered = threadsEnhanced.filter(t => {
    if (filter === 'WhatsApp')      return t.canal === 'whatsapp'
    if (filter === 'Email')         return t.canal === 'email'
    if (filter === 'Instagram')     return t.canal === 'instagram'
    if (filter === 'Facebook')      return t.canal === 'facebook'
    if (filter === 'Sin respuesta') return t.sinRespuestaMin > 15
    if (filter === 'Escaladas')     return t.escalada
    return true
  })

  const conv     = selected ? (threadsEnhanced.find(t => t.id === selected) ?? null) : null
  const messages = selected ? (threadMessages[selected] ?? []) : []

  // KPIs — calculados desde el arreglo real
  const totalActivos   = threadsEnhanced.length
  const countSinResp   = threadsEnhanced.filter(t => t.sinRespuestaMin > 15).length
  const countEscaladas = threadsEnhanced.filter(t => t.escalada).length
  const countBot       = threadsEnhanced.filter(t => t.last_message_source === 'agent_bot').length
  const tiempoPromedio = (() => {
    const con = threadsEnhanced.filter(t => t.sinRespuestaMin > 0)
    if (!con.length) return 0
    return Math.round(con.reduce((s, t) => s + t.sinRespuestaMin, 0) / con.length)
  })()

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] -mx-6 -my-6">

      {/* ── KPI bar ──────────────────────────────────────────── */}
      <div className="flex items-center gap-6 px-6 py-3 bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-xs text-gray-500">Activo</span>
        </div>
        <div className="h-4 w-px bg-gray-200" />
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            <MessageSquare size={14} className="text-gray-400" />
            <span className="font-semibold text-gray-900">{totalActivos}</span>
            <span className="text-gray-500">conversaciones activas</span>
          </div>
          <div className="flex items-center gap-1.5">
            <AlertTriangle size={14} className="text-orange-500" />
            <span className="font-semibold text-orange-600">{countSinResp}</span>
            <span className="text-gray-500">sin respuesta +15 min</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Bot size={14} className="text-blue-500" />
            <span className="font-semibold text-blue-600">{countBot}</span>
            <span className="text-gray-500">bot actuó</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock size={14} className="text-gray-400" />
            <span className="font-semibold text-gray-900">{tiempoPromedio} min</span>
            <span className="text-gray-500">tiempo prom. espera</span>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2 text-xs text-gray-400">
          <Wifi size={13} />
          WA · Email · IG · FB
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* ── Panel izquierdo — lista ─────────────────────────── */}
        <div className="w-80 shrink-0 flex flex-col border-r border-gray-200 bg-white">

          {/* Filtros */}
          <div className="flex gap-1 p-3 border-b border-gray-100 overflow-x-auto">
            {FILTERS.map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`shrink-0 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  filter === f ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                {f}
                {f === 'Sin respuesta' && countSinResp > 0 && (
                  <span className="ml-1 bg-orange-500 text-white rounded-full px-1 py-0.5 text-[10px]">
                    {countSinResp}
                  </span>
                )}
                {f === 'Escaladas' && countEscaladas > 0 && (
                  <span className="ml-1 bg-red-500 text-white rounded-full px-1 py-0.5 text-[10px]">
                    {countEscaladas}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Lista de conversaciones */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
            {filtered.length === 0 && (
              <div className="py-12 text-center text-sm text-gray-400">
                Sin conversaciones
              </div>
            )}
            {filtered.map(t => {
              const cfg     = getCanalCfg(t.canal)
              const overdue = t.sinRespuestaMin > 15
              const isSel   = t.id === selected
              const preview = t.preview?.contenido?.slice(0, 60) ?? '—'

              return (
                <button
                  key={t.id}
                  onClick={() => handleSelectThread(t.id)}
                  className={`w-full text-left px-4 py-3.5 transition-colors ${
                    isSel ? 'bg-blue-50 border-r-2 border-blue-600' : 'hover:bg-gray-50'
                  } ${
                    t.escalada ? 'border-l-2 border-l-red-500'
                    : overdue  ? 'border-l-2 border-l-orange-400'
                    : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-white text-sm font-bold ${
                        t.canal === 'instagram' ? 'bg-gradient-to-br from-purple-500 to-pink-500'
                        : t.canal === 'whatsapp' ? 'bg-green-500'
                        : t.canal === 'email'    ? 'bg-blue-500'
                        : 'bg-blue-600'
                      }`}>
                        {t.clienteNombre.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {t.clienteNombre}
                          </p>
                          {t.escalada && <AlertTriangle size={12} className="text-red-500 shrink-0" />}
                        </div>
                        <p className="text-xs text-gray-500 truncate">{preview}</p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs text-gray-400">{formatRelativeTime(t.last_message_at)}</p>
                      <div className={`inline-flex items-center gap-0.5 mt-1 px-1.5 py-0.5 rounded-full text-white text-[10px] ${cfg.bg}`}>
                        {cfg.icon}
                      </div>
                    </div>
                  </div>
                  {overdue && !t.escalada && (
                    <div className="mt-1.5 flex items-center gap-1 text-[11px] text-orange-600">
                      <Clock size={10} />
                      Sin respuesta {t.sinRespuestaMin} min
                    </div>
                  )}
                  {t.escalada && (
                    <div className="mt-1.5 flex items-center gap-1 text-[11px] text-red-600 font-medium">
                      <AlertTriangle size={10} />
                      ESCALADA — {t.sinRespuestaMin} min sin respuesta
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Panel derecho — chat ────────────────────────────── */}
        <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden">
          {!conv ? (
            <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
              {threads.length === 0
                ? 'No hay conversaciones activas'
                : 'Selecciona una conversación'}
            </div>
          ) : (
            <>
              {/* Header */}
              <div className={`flex items-center gap-4 px-5 py-3.5 bg-white border-b shrink-0 ${
                conv.escalada ? 'border-red-300 bg-red-50' : 'border-gray-200'
              }`}>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-sm font-semibold text-gray-900">{conv.clienteNombre}</h2>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white ${getCanalCfg(conv.canal).bg}`}>
                      {getCanalCfg(conv.canal).icon}
                      {getCanalCfg(conv.canal).label}
                    </span>
                    {conv.escalada && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                        <AlertTriangle size={11} />
                        Escalada
                      </span>
                    )}
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      conv.estado === 'waiting_customer' ? 'bg-yellow-100 text-yellow-700'
                      : conv.estado === 'waiting_agent'  ? 'bg-orange-100 text-orange-700'
                      : 'bg-green-100 text-green-700'
                    }`}>
                      {conv.estado === 'waiting_customer' ? 'Esperando cliente'
                        : conv.estado === 'waiting_agent' ? 'Esperando asesor'
                        : 'Abierto'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                    {/* Vehículo no disponible en conversation_threads — pendiente Phase 2 */}
                    <span className="flex items-center gap-1"><Car size={11} /> —</span>
                    {conv.assignee_id && (
                      <span className="flex items-center gap-1"><User size={11} /> Asignado</span>
                    )}
                  </div>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  {conv.cliente?.id && (
                    <Link
                      href={`/crm/clientes/${conv.cliente.id}`}
                      className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                    >
                      Ver cliente <ChevronRight size={12} />
                    </Link>
                  )}
                  <Link
                    href="/taller/nuevo"
                    className="flex items-center gap-1.5 px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-700 hover:bg-gray-50"
                  >
                    <Wrench size={12} /> Abrir OT
                  </Link>
                  <Link
                    href="/citas/nuevo"
                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700"
                  >
                    + Agendar cita
                  </Link>
                </div>
              </div>

              {/* Banner de escalación */}
              {conv.escalada && (
                <div className="px-5 py-2.5 bg-red-100 border-b border-red-200 flex items-center gap-2 text-sm text-red-700">
                  <AlertTriangle size={15} />
                  <strong>Sin respuesta</strong> — {conv.sinRespuestaMin} min desde el último mensaje del cliente.
                </div>
              )}

              {/* Mensajes */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                {loadingThread === conv.id ? (
                  <div className="flex items-center justify-center py-8 text-sm text-gray-400">
                    Cargando mensajes…
                  </div>
                ) : threadErrors[conv.id] ? (
                  <div className="flex items-center justify-center py-8 text-sm text-red-500">
                    Error cargando mensajes — selecciona la conversación nuevamente para reintentar
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex items-center justify-center py-8 text-sm text-gray-400">
                    Sin mensajes registrados en este hilo
                  </div>
                ) : (
                  messages.map(m => {
                    const isOutgoing = m.direccion === 'saliente'
                    return (
                      <div key={m.id} className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[70%] flex flex-col gap-1 ${isOutgoing ? 'items-end' : 'items-start'}`}>
                          {m.enviado_por_bot && (
                            <div className="flex items-center gap-1 text-[11px] text-blue-500 px-1">
                              <Bot size={11} />
                              <span>Bot actuó automáticamente</span>
                            </div>
                          )}
                          <div className={`px-3.5 py-2.5 rounded-2xl text-sm ${
                            isOutgoing
                              ? m.enviado_por_bot
                                ? 'bg-blue-100 text-blue-800 rounded-tr-sm'
                                : 'bg-blue-600 text-white rounded-tr-sm'
                              : 'bg-white text-gray-900 border border-gray-200 rounded-tl-sm shadow-sm'
                          }`}>
                            {m.contenido ?? ''}
                          </div>
                          <div className={`flex items-center gap-1.5 px-1 ${isOutgoing ? 'flex-row-reverse' : ''}`}>
                            <span className="text-[11px] text-gray-400">{formatTime(m.enviado_at)}</span>
                            {m.estado_entrega === 'read' && isOutgoing && (
                              <CheckCircle2 size={11} className="text-blue-400" />
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  )
}
