'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
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
  UserCheck,
  X,
  Send,
  Phone,
} from 'lucide-react'
import Link from 'next/link'
import {
  getThreadMessagesAction,
  simularMensajeAction,
  tomarConversacionAction,
  enviarMensajeAsesorAction,
  type MensajeRow,
  type SimularResult,
} from '@/app/actions/bandeja'

// ─────────────────────────────────────────────────────────
// Tipos exportados — usados por page.tsx (Server Component)
// ─────────────────────────────────────────────────────────

export type BandejaCanal   = 'whatsapp' | 'email' | 'facebook' | 'instagram' | 'interno'
export type BandejaEstado  = 'open' | 'waiting_customer' | 'waiting_agent' | 'bot_active'

export interface ThreadRow {
  id:                  string
  canal:               BandejaCanal
  estado:              BandejaEstado
  last_message_at:     string | null
  last_message_source: string | null
  assignee_id:         string | null
  cliente:             { id: string; nombre: string | null; whatsapp: string | null } | null
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

function calcSinRespuestaMin(
  last_message_at:     string | null,
  last_message_source: string | null,
): number {
  if (!last_message_at || last_message_source !== 'customer') return 0
  return Math.max(0, Math.floor((Date.now() - new Date(last_message_at).getTime()) / 60_000))
}

// ─────────────────────────────────────────────────────────
// Canal config
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
  interno:   { label: 'Interno',  color: 'text-gray-600',  bg: 'bg-gray-500',   icon: <Wrench size={13} /> },
}

function getCanalCfg(canal: string) {
  return CANAL_CONFIG[canal] ?? {
    label: canal,
    color: 'text-gray-600',
    bg:    'bg-gray-500',
    icon:  <MessageSquare size={13} />,
  }
}

const FILTERS = ['Todos', 'WhatsApp', 'Email', 'Instagram', 'Facebook', 'Sin respuesta', 'Escaladas', 'Requiere asesor'] as const
type FilterKey = typeof FILTERS[number]

const ESCALADA_MIN = 45

// ─────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────

export function BandejaClient({ threads, lastMsgByThread }: BandejaClientProps) {
  const router = useRouter()

  const [selected,       setSelected]       = useState<string | null>(threads[0]?.id ?? null)
  const [filter,         setFilter]         = useState<FilterKey>('Todos')
  const [threadMessages, setThreadMessages] = useState<Record<string, MensajeRow[]>>({})
  const [loadingThread,  setLoadingThread]  = useState<string | null>(null)
  const [threadErrors,   setThreadErrors]   = useState<Record<string, string>>({})

  // Demo panel state
  const [showDemo,    setShowDemo]    = useState(false)
  const [demoPhone,   setDemoPhone]   = useState('')
  const [demoMsg,     setDemoMsg]     = useState('')
  const [demoResult,  setDemoResult]  = useState<SimularResult | null>(null)
  // threadId activo en la conversación demo — se mantiene entre turnos del mismo cliente
  const [demoThreadId, setDemoThreadId] = useState<string | null>(null)
  const [asesorMsg,    setAsesorMsg]  = useState('')
  const [demoPending,  startDemo]    = useTransition()
  const [tomarPending, startTomar]   = useTransition()
  const [asesorPending, startAsesor] = useTransition()

  const inFlightRef     = useRef<Set<string>>(new Set())
  // loadedThreadsRef tracks which threads have been fetched — using a Ref (not state)
  // so that invalidation before calling loadMessages is always synchronous.
  const loadedThreadsRef = useRef<Set<string>>(new Set())
  const initializedRef  = useRef(false)
  const messagesEndRef  = useRef<HTMLDivElement | null>(null)

  async function loadMessages(threadId: string) {
    if (loadedThreadsRef.current.has(threadId)) return
    if (inFlightRef.current.has(threadId))      return

    loadedThreadsRef.current.add(threadId)
    inFlightRef.current.add(threadId)
    setLoadingThread(threadId)
    setThreadErrors(prev => { const next = { ...prev }; delete next[threadId]; return next })
    try {
      const result = await getThreadMessagesAction(threadId)
      if (result.error) {
        loadedThreadsRef.current.delete(threadId)  // allow retry on error
        setThreadErrors(prev => ({ ...prev, [threadId]: result.error! }))
      } else {
        setThreadMessages(prev => ({ ...prev, [threadId]: result.data ?? [] }))
      }
    } finally {
      inFlightRef.current.delete(threadId)
      setLoadingThread(prev => (prev === threadId ? null : prev))
    }
  }

  useEffect(() => {
    if (!initializedRef.current && threads[0]?.id) {
      initializedRef.current = true
      void loadMessages(threads[0].id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-scroll al fondo cuando llegan mensajes nuevos
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [threadMessages, selected])

  function handleSelectThread(threadId: string) {
    setSelected(threadId)
    void loadMessages(threadId)
  }

  function handleSimular() {
    startDemo(async () => {
      const result = await simularMensajeAction({ telefono: demoPhone, mensaje: demoMsg })
      setDemoResult(result)
      if (result.ok && result.thread_id) {
        setDemoThreadId(result.thread_id)
        setSelected(result.thread_id)
        // Synchronous ref invalidation — must happen before loadMessages call,
        // otherwise the stale closure in loadMessages would skip the reload.
        loadedThreadsRef.current.delete(result.thread_id)
        void loadMessages(result.thread_id)
        router.refresh()
      }
    })
  }

  // Continúa la conversación con el mismo teléfono — solo limpia el mensaje
  function handleContinuarConversacion() {
    setDemoResult(null)
    setDemoMsg('')
  }

  // Inicia conversación con número diferente
  function handleNuevoNumero() {
    setDemoResult(null)
    setDemoPhone('')
    setDemoMsg('')
    setDemoThreadId(null)
  }

  function handleEnviarAsesor(threadId: string) {
    if (!asesorMsg.trim()) return
    const msg = asesorMsg
    startAsesor(async () => {
      const result = await enviarMensajeAsesorAction({ thread_id: threadId, contenido: msg })
      if (result.ok) {
        setAsesorMsg('')
        loadedThreadsRef.current.delete(threadId)
        void loadMessages(threadId)
      }
    })
  }

  function handleTomar(threadId: string) {
    startTomar(async () => {
      const result = await tomarConversacionAction(threadId)
      if (result.ok) {
        // Reload messages for the thread so asesor sees full context immediately
        loadedThreadsRef.current.delete(threadId)
        void loadMessages(threadId)
        router.refresh()
      }
    })
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
    if (filter === 'WhatsApp')        return t.canal === 'whatsapp'
    if (filter === 'Email')           return t.canal === 'email'
    if (filter === 'Instagram')       return t.canal === 'instagram'
    if (filter === 'Facebook')        return t.canal === 'facebook'
    if (filter === 'Sin respuesta')   return t.sinRespuestaMin > 15
    if (filter === 'Escaladas')       return t.escalada
    if (filter === 'Requiere asesor') return t.estado === 'waiting_agent'
    return true
  })

  const conv     = selected ? (threadsEnhanced.find(t => t.id === selected) ?? null) : null
  const messages = selected ? (threadMessages[selected] ?? []) : []

  const totalActivos         = threadsEnhanced.length
  const countSinResp         = threadsEnhanced.filter(t => t.sinRespuestaMin > 15).length
  const countEscaladas       = threadsEnhanced.filter(t => t.escalada).length
  const countBot             = threadsEnhanced.filter(t => t.last_message_source === 'agent_bot').length
  const countRequiereAsesor  = threadsEnhanced.filter(t => t.estado === 'waiting_agent').length
  const tiempoPromedio = (() => {
    const con = threadsEnhanced.filter(t => t.sinRespuestaMin > 0)
    if (!con.length) return 0
    return Math.round(con.reduce((s, t) => s + t.sinRespuestaMin, 0) / con.length)
  })()

  const needsAttention = conv?.estado === 'waiting_agent' || conv?.estado === 'bot_active'

  // ─── La conversación demo tiene un hilo activo si demoThreadId está seteado
  const demoEnCurso = demoThreadId !== null

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
          {countRequiereAsesor > 0 && (
            <button
              onClick={() => setFilter('Requiere asesor')}
              className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-100 hover:bg-red-200 transition-colors"
            >
              <UserCheck size={14} className="text-red-600" />
              <span className="font-bold text-red-700">{countRequiereAsesor}</span>
              <span className="text-red-600 text-xs">requieren asesor</span>
            </button>
          )}
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
                {f === 'Requiere asesor' && countRequiereAsesor > 0 && (
                  <span className="ml-1 bg-red-600 text-white rounded-full px-1 py-0.5 text-[10px] font-bold">
                    {countRequiereAsesor}
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
              const isBotActive = t.estado === 'bot_active'
              const isDemoThread = t.id === demoThreadId

              return (
                <button
                  key={t.id}
                  onClick={() => handleSelectThread(t.id)}
                  className={`w-full text-left px-4 py-3.5 transition-colors ${
                    isSel ? 'bg-blue-50 border-r-2 border-blue-600' : 'hover:bg-gray-50'
                  } ${
                    t.escalada    ? 'border-l-2 border-l-red-500'
                    : t.estado === 'waiting_agent' ? 'border-l-2 border-l-orange-400'
                    : isBotActive ? 'border-l-2 border-l-blue-400'
                    : overdue     ? 'border-l-2 border-l-orange-400'
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
                          {isBotActive && <Bot size={12} className="text-blue-500 shrink-0" />}
                          {isDemoThread && <span className="text-[10px] text-blue-400 font-medium">DEMO</span>}
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
                  {t.estado === 'waiting_agent' && !t.escalada && (
                    <div className="mt-1.5 flex items-center gap-1 text-[11px] text-orange-700 font-semibold">
                      <UserCheck size={10} />
                      Requiere asesor
                    </div>
                  )}
                  {isBotActive && !t.escalada && t.estado !== 'waiting_agent' && (
                    <div className="mt-1.5 flex items-center gap-1 text-[11px] text-blue-600">
                      <Bot size={10} />
                      Bot gestionando
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
                conv.escalada ? 'border-red-300 bg-red-50'
                : conv.estado === 'waiting_agent' ? 'border-orange-200 bg-orange-50'
                : 'border-gray-200'
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
                      : conv.estado === 'bot_active'     ? 'bg-blue-100 text-blue-700'
                      : 'bg-green-100 text-green-700'
                    }`}>
                      {conv.estado === 'waiting_customer' ? 'Esperando cliente'
                        : conv.estado === 'waiting_agent' ? '⚡ Requiere asesor'
                        : conv.estado === 'bot_active'    ? '🤖 Bot activo'
                        : 'Abierto'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                    <span className="flex items-center gap-1"><Car size={11} /> —</span>
                    {conv.cliente?.whatsapp && (
                      <span className="flex items-center gap-1">
                        <Phone size={11} className="text-green-600" />
                        <span className="text-green-700 font-medium">{conv.cliente.whatsapp}</span>
                      </span>
                    )}
                    {conv.assignee_id && (
                      <span className="flex items-center gap-1"><User size={11} /> Asignado</span>
                    )}
                  </div>
                </div>
                <div className="ml-auto flex items-center gap-2 flex-wrap justify-end">
                  {conv.cliente?.id && (
                    <Link
                      href={`/crm/clientes/${conv.cliente.id}`}
                      className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                    >
                      Ver cliente <ChevronRight size={12} />
                    </Link>
                  )}
                  {needsAttention && (
                    <button
                      onClick={() => handleTomar(conv.id)}
                      disabled={tomarPending}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 border border-orange-300 rounded-lg text-xs text-orange-700 hover:bg-orange-50 disabled:opacity-50 transition-colors"
                    >
                      <UserCheck size={12} />
                      {tomarPending ? 'Tomando…' : 'Tomar conversación'}
                    </button>
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

              {/* Banner escalación */}
              {conv.escalada && (
                <div className="px-5 py-2.5 bg-red-100 border-b border-red-200 flex items-center gap-2 text-sm text-red-700">
                  <AlertTriangle size={15} />
                  <strong>Sin respuesta</strong> — {conv.sinRespuestaMin} min desde el último mensaje del cliente.
                </div>
              )}
              {conv.estado === 'waiting_agent' && !conv.escalada && (
                <div className="px-5 py-2.5 bg-orange-50 border-b border-orange-200 flex items-center gap-2 text-sm text-orange-700">
                  <UserCheck size={15} />
                  El bot escaló esta conversación. Un asesor debe tomarla.
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
                          <div className={`px-3.5 py-2.5 rounded-2xl text-sm whitespace-pre-wrap ${
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
                <div ref={messagesEndRef} />
              </div>

              {/* Área de respuesta — visible cuando el asesor tomó la conversación */}
              {conv.estado === 'open' && conv.assignee_id && (
                <div className="shrink-0 border-t border-gray-200 bg-white px-4 py-3 flex items-end gap-2">
                  <textarea
                    value={asesorMsg}
                    onChange={e => setAsesorMsg(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey && asesorMsg.trim()) {
                        e.preventDefault()
                        handleEnviarAsesor(conv.id)
                      }
                    }}
                    placeholder="Responder al cliente… (Enter para enviar)"
                    rows={2}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={() => handleEnviarAsesor(conv.id)}
                    disabled={asesorPending || !asesorMsg.trim()}
                    className="shrink-0 p-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    title="Enviar"
                  >
                    <Send size={15} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>

      </div>

      {/* ── Demo Bot — Panel flotante ──────────────────────────── */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        {showDemo && (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-2xl w-80 overflow-hidden">

            {/* Header del panel demo */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Bot size={15} className="text-blue-500" />
                Demo Bot
                {demoEnCurso && (
                  <span className="text-[10px] font-normal text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded-full">
                    En conversación
                  </span>
                )}
              </h3>
              <button
                onClick={() => { setShowDemo(false) }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={15} />
              </button>
            </div>

            <div className="p-4 space-y-3">

              {/* Indicador de número activo cuando hay conversación en curso */}
              {demoEnCurso && (
                <div className="flex items-center justify-between px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Phone size={12} className="text-green-600" />
                    <div>
                      <p className="text-[10px] text-green-600 font-medium">Conversación activa</p>
                      <p className="text-xs font-mono text-green-800">{demoPhone}</p>
                    </div>
                  </div>
                  <button
                    onClick={handleNuevoNumero}
                    className="text-[10px] text-gray-400 hover:text-red-500 transition-colors"
                    title="Iniciar con nuevo número"
                  >
                    Cambiar
                  </button>
                </div>
              )}

              {demoResult ? (
                /* ── Vista de resultado ── */
                <div className="space-y-3">
                  {demoResult.error ? (
                    <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
                      {demoResult.error}
                    </div>
                  ) : (
                    <div className="p-3 rounded-lg bg-blue-50 border border-blue-100 text-xs space-y-2">
                      <div className="flex gap-2 items-center">
                        <span className="text-gray-500">Intent:</span>
                        <span className="font-medium text-gray-800">{demoResult.intent}</span>
                        <span className="text-gray-300">·</span>
                        <span className="font-medium text-gray-600">{demoResult.sentiment}</span>
                      </div>
                      {demoResult.handoff && (
                        <div className="flex items-center gap-1.5 text-orange-600 font-medium">
                          <UserCheck size={11} />
                          Escaló a asesor — toma la conversación en la bandeja
                        </div>
                      )}
                      {demoResult.cita_id && (
                        <div className="flex items-center gap-1.5 text-green-600 font-medium">
                          <CheckCircle2 size={11} />
                          ¡Cita agendada exitosamente!
                        </div>
                      )}
                      <div className="pt-1.5 border-t border-blue-200">
                        <p className="text-gray-500 mb-1 font-medium">Ara respondió:</p>
                        <p className="text-gray-800 leading-relaxed text-[12px] whitespace-pre-wrap">
                          {demoResult.respuesta}
                        </p>
                      </div>
                    </div>
                  )}

                  {!demoResult.error && (
                    <button
                      onClick={handleContinuarConversacion}
                      className="w-full py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 flex items-center justify-center gap-1.5"
                    >
                      <Send size={11} />
                      Continuar conversación
                    </button>
                  )}
                  <button
                    onClick={handleNuevoNumero}
                    className="w-full py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    Nuevo número
                  </button>
                </div>
              ) : (
                /* ── Vista de entrada ── */
                <div className="space-y-3">
                  {/* Teléfono — solo editable si no hay conversación activa */}
                  {!demoEnCurso && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Teléfono (10 dígitos, sin +52)
                      </label>
                      <input
                        type="tel"
                        value={demoPhone}
                        onChange={e => setDemoPhone(e.target.value)}
                        placeholder="5512345678"
                        maxLength={10}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      {demoEnCurso ? 'Siguiente mensaje del cliente' : 'Mensaje del cliente'}
                    </label>
                    <textarea
                      value={demoMsg}
                      onChange={e => setDemoMsg(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey && demoPhone.trim() && demoMsg.trim()) {
                          e.preventDefault()
                          handleSimular()
                        }
                      }}
                      placeholder={demoEnCurso
                        ? 'Escribe la respuesta del cliente...'
                        : 'Hola, quiero agendar una cita para cambio de aceite...'}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  {!demoEnCurso && (
                    <p className="text-[10px] text-gray-400">
                      Simula un mensaje entrante de WA sin número Meta activo. Enter para enviar.
                    </p>
                  )}
                  <button
                    onClick={handleSimular}
                    disabled={demoPending || !demoPhone.trim() || !demoMsg.trim()}
                    className="w-full py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Send size={12} />
                    {demoPending ? 'Procesando…' : 'Enviar al bot'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        <button
          onClick={() => setShowDemo(prev => !prev)}
          className={`w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-colors ${
            showDemo ? 'bg-gray-700 hover:bg-gray-800' : 'bg-blue-600 hover:bg-blue-700'
          } text-white`}
          title="Demo Bot"
        >
          {showDemo ? <X size={20} /> : <Bot size={20} />}
        </button>
      </div>

    </div>
  )
}
