'use client'

import { useState } from 'react'
import {
  MessageSquare,
  Mail,
  Instagram,
  Facebook,
  Phone,
  Bot,
  Zap,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Send,
  Sparkles,
  ChevronRight,
  User,
  Car,
  Wrench,
  TrendingUp,
  X,
  Wifi,
} from 'lucide-react'
import Link from 'next/link'

// ──────────────────────────────────────────────────────────────
// Demo data — in production this comes from Supabase `mensajes`
// table, grouped by cliente_id + canal
// ──────────────────────────────────────────────────────────────

type Canal = 'whatsapp' | 'email' | 'instagram' | 'facebook' | 'llamada'
type MensajeDir = 'entrante' | 'saliente'

interface Mensaje {
  id: string
  texto: string
  dir: MensajeDir
  hora: string
  bot?: boolean
  leido?: boolean
}

interface Conversacion {
  id: string
  cliente: string
  vehiculo: string
  canal: Canal
  ultimoMensaje: string
  hora: string
  sinRespuestaMin: number
  asesor: string | null
  escalada: boolean
  mensajes: Mensaje[]
  sugerenciaIA?: string
  alertaVenta?: string
}

const CONV: Conversacion[] = [
  {
    id: '1',
    cliente: 'Carlos Mendoza',
    vehiculo: 'Toyota Camry 2022',
    canal: 'whatsapp',
    ultimoMensaje: 'Cuándo estará listo mi carro? Ya son las 4pm',
    hora: 'hace 3 min',
    sinRespuestaMin: 3,
    asesor: 'Jorge R.',
    escalada: false,
    sugerenciaIA: 'El cliente pregunta por el estatus de su OT-240318-0042 (cambio de aceite y frenos). Tiempo estimado: 30 min. Puedes confirmar con el técnico Juan y responder: "Hola Carlos, ya casi terminamos — en aprox. 30 min te avisamos para que pases a recoger tu Camry."',
    alertaVenta: 'Vehículo a 2,400 km del próximo afinamiento. Buen momento para agendar.',
    mensajes: [
      { id: 'm1', texto: 'Hola! Dejé mi carro esta mañana para cambio de aceite y frenos', dir: 'entrante', hora: '09:15' },
      { id: 'm2', texto: 'Hola Carlos! Confirmado, ya está en taller con el técnico Juan. Te avisamos en cuanto esté listo ✅', dir: 'saliente', hora: '09:18', leido: true },
      { id: 'm3', texto: 'Ok gracias', dir: 'entrante', hora: '09:19' },
      { id: 'm4', texto: '⏰ Hola Carlos, tu vehículo sigue en proceso. En breve te actualizamos. Cualquier duda estamos aquí.', dir: 'saliente', hora: '13:00', bot: true },
      { id: 'm5', texto: 'Cuándo estará listo mi carro? Ya son las 4pm', dir: 'entrante', hora: '15:57' },
    ],
  },
  {
    id: '2',
    cliente: 'Laura Gutiérrez',
    vehiculo: 'Nissan Sentra 2020',
    canal: 'whatsapp',
    ultimoMensaje: 'Perfecto, confirmo para el martes a las 10am 👍',
    hora: 'hace 8 min',
    sinRespuestaMin: 0,
    asesor: 'Ana M.',
    escalada: false,
    sugerenciaIA: 'Cliente confirmó cita. Considera enviar el recordatorio de Google Maps 24h antes — el bot puede hacerlo automáticamente si activas el flujo.',
    mensajes: [
      { id: 'm1', texto: 'Hola, quería agendar una revisión para mi Sentra', dir: 'entrante', hora: '11:20' },
      { id: 'm2', texto: '¡Claro Laura! Tenemos disponibilidad el martes a las 10am o el miércoles a las 2pm, ¿cuál te viene mejor?', dir: 'saliente', hora: '11:22' },
      { id: 'm3', texto: 'El martes perfecto', dir: 'entrante', hora: '11:25' },
      { id: 'm4', texto: 'Listo, quedó agendada tu cita para el martes 18 de marzo a las 10:00am en Sucursal Norte. Te mando el mapa 📍', dir: 'saliente', hora: '11:26' },
      { id: 'm5', texto: 'Perfecto, confirmo para el martes a las 10am 👍', dir: 'entrante', hora: '11:34' },
    ],
  },
  {
    id: '3',
    cliente: 'Roberto Sánchez',
    vehiculo: 'Honda CR-V 2019',
    canal: 'whatsapp',
    ultimoMensaje: 'No entiendo por qué me cobraron eso si no lo autoricé',
    hora: 'hace 47 min',
    sinRespuestaMin: 47,
    asesor: 'Jorge R.',
    escalada: true,
    sugerenciaIA: 'ESCALACIÓN ACTIVA — el cliente lleva 47 min sin respuesta. Nivel 1 activado: alerta enviada al asesor. En 13 min pasa a Nivel 2 (gerente). Sugiero tomar la conversación de inmediato y ofrecer disculpa + explicación del cargo.',
    mensajes: [
      { id: 'm1', texto: 'Oye, acabo de ver mi factura y hay un cargo de $850 que no reconozco', dir: 'entrante', hora: '15:10' },
      { id: 'm2', texto: 'Hola Roberto, dame un momento para revisar tu factura', dir: 'saliente', hora: '15:12' },
      { id: 'm3', texto: 'Ya va media hora y nada', dir: 'entrante', hora: '15:40' },
      { id: 'm4', texto: 'No entiendo por qué me cobraron eso si no lo autoricé', dir: 'entrante', hora: '15:45' },
      { id: 'm5', texto: '⚠️ Hola Roberto, lamentamos la demora. Un asesor te atenderá en los próximos minutos.', dir: 'saliente', hora: '15:48', bot: true },
    ],
  },
  {
    id: '4',
    cliente: 'María Fernández',
    vehiculo: 'Volkswagen Jetta 2021',
    canal: 'email',
    ultimoMensaje: 'Adjunto la factura de garantía que me solicitaron',
    hora: 'hace 1h',
    sinRespuestaMin: 60,
    asesor: null,
    escalada: false,
    sugerenciaIA: 'Email con adjunto de garantía. Revisar y confirmar al cliente que se recibió. Si la garantía aplica, crear actividad de seguimiento en CRM.',
    mensajes: [
      { id: 'm1', texto: 'Buenos días, les envío la factura de compra del Jetta para la garantía de pintura que reportamos la semana pasada.', dir: 'entrante', hora: '10:15' },
      { id: 'm2', texto: 'Adjunto la factura de garantía que me solicitaron', dir: 'entrante', hora: '10:16' },
    ],
  },
  {
    id: '5',
    cliente: 'Diego Ramírez',
    vehiculo: 'Ford F-150 2023',
    canal: 'instagram',
    ultimoMensaje: 'Hola, ¿tienen servicio express para cambio de aceite sin cita?',
    hora: 'hace 2h',
    sinRespuestaMin: 120,
    asesor: null,
    escalada: false,
    sugerenciaIA: 'Lead nuevo desde Instagram DM. El cliente pregunta por servicio express. Responde confirmando el horario de servicio express (Lunes-Viernes 8-12h) y ofrece agendar cita rápida. Capturar como lead en CRM.',
    alertaVenta: 'F-150 2023 — posible cliente nuevo. Primera interacción. Crear perfil en CRM.',
    mensajes: [
      { id: 'm1', texto: 'Hola, ¿tienen servicio express para cambio de aceite sin cita?', dir: 'entrante', hora: '13:45' },
    ],
  },
  {
    id: '6',
    cliente: 'Patricia López',
    vehiculo: 'Mazda CX-5 2020',
    canal: 'whatsapp',
    ultimoMensaje: '¡Gracias! Todo excelente como siempre 🙌',
    hora: 'hace 3h',
    sinRespuestaMin: 0,
    asesor: 'Ana M.',
    escalada: false,
    mensajes: [
      { id: 'm1', texto: '✅ Patricia, tu Mazda CX-5 está listo. Puedes pasar a recogerlo cuando gustes. ¡Fue un placer atenderte!', dir: 'saliente', hora: '13:00', bot: false },
      { id: 'm2', texto: '¡Gracias! Todo excelente como siempre 🙌', dir: 'entrante', hora: '13:12' },
    ],
  },
]

const CANAL_CONFIG: Record<Canal, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  whatsapp:  { label: 'WhatsApp', color: 'text-green-600',  bg: 'bg-green-500',   icon: <MessageSquare size={13} /> },
  email:     { label: 'Email',    color: 'text-blue-600',   bg: 'bg-blue-500',    icon: <Mail size={13} /> },
  instagram: { label: 'Instagram',color: 'text-pink-600',   bg: 'bg-gradient-to-br from-purple-500 to-pink-500', icon: <Instagram size={13} /> },
  facebook:  { label: 'Facebook', color: 'text-blue-700',   bg: 'bg-blue-600',    icon: <Facebook size={13} /> },
  llamada:   { label: 'Llamada',  color: 'text-gray-600',   bg: 'bg-gray-500',    icon: <Phone size={13} /> },
}

const FILTERS = ['Todos', 'WhatsApp', 'Email', 'Instagram', 'Facebook', 'Sin respuesta', 'Escaladas']

export default function BandejaPage() {
  const [selected, setSelected] = useState<string>(CONV[0].id)
  const [filter, setFilter] = useState('Todos')
  const [draft, setDraft] = useState('')

  const conv = CONV.find((c) => c.id === selected)!

  const filtered = CONV.filter((c) => {
    if (filter === 'WhatsApp') return c.canal === 'whatsapp'
    if (filter === 'Email') return c.canal === 'email'
    if (filter === 'Instagram') return c.canal === 'instagram'
    if (filter === 'Facebook') return c.canal === 'facebook'
    if (filter === 'Sin respuesta') return c.sinRespuestaMin > 15
    if (filter === 'Escaladas') return c.escalada
    return true
  })

  // KPIs
  const totalHoy = CONV.length
  const sinRespuesta = CONV.filter((c) => c.sinRespuestaMin > 15).length
  const botActuaciones = CONV.flatMap((c) => c.mensajes).filter((m) => m.bot).length
  const tiempoPromedio = Math.round(
    CONV.filter((c) => c.sinRespuestaMin > 0).reduce((s, c) => s + c.sinRespuestaMin, 0) /
      Math.max(1, CONV.filter((c) => c.sinRespuestaMin > 0).length)
  )

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] -mx-6 -my-6">
      {/* Top KPI bar */}
      <div className="flex items-center gap-6 px-6 py-3 bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs text-gray-500">Conectado</span>
        </div>
        <div className="h-4 w-px bg-gray-200" />
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            <MessageSquare size={14} className="text-gray-400" />
            <span className="font-semibold text-gray-900">{totalHoy}</span>
            <span className="text-gray-500">conversaciones hoy</span>
          </div>
          <div className="flex items-center gap-1.5">
            <AlertTriangle size={14} className="text-orange-500" />
            <span className="font-semibold text-orange-600">{sinRespuesta}</span>
            <span className="text-gray-500">sin respuesta +15 min</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Bot size={14} className="text-blue-500" />
            <span className="font-semibold text-blue-600">{botActuaciones}</span>
            <span className="text-gray-500">bot actuó</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock size={14} className="text-gray-400" />
            <span className="font-semibold text-gray-900">{tiempoPromedio} min</span>
            <span className="text-gray-500">tiempo prom. respuesta</span>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2 text-xs text-gray-400">
          <Wifi size={13} />
          WA · Email · IG · FB
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Conversation list panel */}
        <div className="w-80 shrink-0 flex flex-col border-r border-gray-200 bg-white">
          {/* Filter tabs */}
          <div className="flex gap-1 p-3 border-b border-gray-100 overflow-x-auto">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`shrink-0 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  filter === f
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                {f}
                {f === 'Sin respuesta' && sinRespuesta > 0 && (
                  <span className="ml-1 bg-orange-500 text-white rounded-full px-1 py-0.5 text-[10px]">
                    {sinRespuesta}
                  </span>
                )}
                {f === 'Escaladas' && CONV.filter((c) => c.escalada).length > 0 && (
                  <span className="ml-1 bg-red-500 text-white rounded-full px-1 py-0.5 text-[10px]">
                    {CONV.filter((c) => c.escalada).length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
            {filtered.map((c) => {
              const cfg = CANAL_CONFIG[c.canal]
              const overdue = c.sinRespuestaMin > 15
              const isSelected = c.id === selected
              return (
                <button
                  key={c.id}
                  onClick={() => setSelected(c.id)}
                  className={`w-full text-left px-4 py-3.5 transition-colors ${
                    isSelected ? 'bg-blue-50 border-r-2 border-blue-600' : 'hover:bg-gray-50'
                  } ${c.escalada ? 'border-l-2 border-l-red-500' : overdue ? 'border-l-2 border-l-orange-400' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {/* Avatar */}
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-white text-sm font-bold ${
                        c.canal === 'instagram' ? 'bg-gradient-to-br from-purple-500 to-pink-500' :
                        c.canal === 'whatsapp' ? 'bg-green-500' :
                        c.canal === 'email' ? 'bg-blue-500' : 'bg-blue-600'
                      }`}>
                        {c.cliente.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-semibold text-gray-900 truncate">{c.cliente}</p>
                          {c.escalada && (
                            <AlertTriangle size={12} className="text-red-500 shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-gray-500 truncate">{c.ultimoMensaje}</p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs text-gray-400">{c.hora}</p>
                      <div className={`inline-flex items-center gap-0.5 mt-1 px-1.5 py-0.5 rounded-full text-white text-[10px] ${cfg.bg}`}>
                        {cfg.icon}
                      </div>
                    </div>
                  </div>
                  {overdue && !c.escalada && (
                    <div className="mt-1.5 flex items-center gap-1 text-[11px] text-orange-600">
                      <Clock size={10} />
                      Sin respuesta {c.sinRespuestaMin} min
                    </div>
                  )}
                  {c.escalada && (
                    <div className="mt-1.5 flex items-center gap-1 text-[11px] text-red-600 font-medium">
                      <AlertTriangle size={10} />
                      ESCALADA — {c.sinRespuestaMin} min sin respuesta
                    </div>
                  )}
                </button>
              )
            })}
            {filtered.length === 0 && (
              <div className="py-12 text-center text-sm text-gray-400">
                Sin conversaciones
              </div>
            )}
          </div>
        </div>

        {/* Chat panel */}
        <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden">
          {/* Chat header */}
          <div className={`flex items-center gap-4 px-5 py-3.5 bg-white border-b shrink-0 ${
            conv.escalada ? 'border-red-300 bg-red-50' : 'border-gray-200'
          }`}>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-gray-900">{conv.cliente}</h2>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white ${CANAL_CONFIG[conv.canal].bg}`}>
                  {CANAL_CONFIG[conv.canal].icon}
                  {CANAL_CONFIG[conv.canal].label}
                </span>
                {conv.escalada && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                    <AlertTriangle size={11} />
                    Escalada — Nivel 1
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                <span className="flex items-center gap-1"><Car size={11} /> {conv.vehiculo}</span>
                {conv.asesor && <span className="flex items-center gap-1"><User size={11} /> {conv.asesor}</span>}
              </div>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Link href="/crm/clientes" className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                Ver cliente <ChevronRight size={12} />
              </Link>
              <Link href={`/taller/nuevo`} className="flex items-center gap-1.5 px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-700 hover:bg-gray-50">
                <Wrench size={12} /> Abrir OT
              </Link>
              <Link href={`/citas/nuevo`} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700">
                + Agendar cita
              </Link>
            </div>
          </div>

          {/* Escalation banner */}
          {conv.escalada && (
            <div className="px-5 py-2.5 bg-red-100 border-b border-red-200 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-red-700">
                <AlertTriangle size={15} />
                <strong>Nivel 1 activo</strong> — Se notificó al asesor hace 2 min. En 13 min escala a gerente.
              </div>
              <div className="flex gap-2">
                <button className="px-3 py-1 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700">
                  Tomar conversación
                </button>
                <button className="px-3 py-1 border border-red-300 text-red-600 text-xs rounded-lg hover:bg-red-50">
                  Escalar ya a gerente
                </button>
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {conv.mensajes.map((m) => (
              <div key={m.id} className={`flex ${m.dir === 'saliente' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[70%] ${m.dir === 'saliente' ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                  {m.bot && (
                    <div className="flex items-center gap-1 text-[11px] text-blue-500 px-1">
                      <Bot size={11} />
                      <span>Bot actuó automáticamente</span>
                    </div>
                  )}
                  <div className={`px-3.5 py-2.5 rounded-2xl text-sm ${
                    m.dir === 'saliente'
                      ? m.bot
                        ? 'bg-blue-100 text-blue-800 rounded-tr-sm'
                        : 'bg-blue-600 text-white rounded-tr-sm'
                      : 'bg-white text-gray-900 border border-gray-200 rounded-tl-sm shadow-sm'
                  }`}>
                    {m.texto}
                  </div>
                  <div className={`flex items-center gap-1.5 px-1 ${m.dir === 'saliente' ? 'flex-row-reverse' : ''}`}>
                    <span className="text-[11px] text-gray-400">{m.hora}</span>
                    {m.leido && m.dir === 'saliente' && (
                      <CheckCircle2 size={11} className="text-blue-400" />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* AI Suggestion panel */}
          {conv.sugerenciaIA && (
            <div className="mx-5 mb-3 bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
                  <Sparkles size={14} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <p className="text-xs font-semibold text-indigo-800">IA Sugiere</p>
                    <span className="text-[10px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full">GPT-4o</span>
                  </div>
                  <p className="text-xs text-indigo-700 leading-relaxed">{conv.sugerenciaIA}</p>
                  <button
                    onClick={() => setDraft(conv.sugerenciaIA?.split('"')[1] ?? '')}
                    className="mt-2 text-xs text-indigo-600 font-medium hover:underline flex items-center gap-1"
                  >
                    <Zap size={11} />
                    Usar esta respuesta
                  </button>
                </div>
                <button className="text-gray-400 hover:text-gray-600">
                  <X size={14} />
                </button>
              </div>
              {conv.alertaVenta && (
                <div className="mt-3 pt-3 border-t border-indigo-200 flex items-center gap-2 text-xs text-orange-700">
                  <TrendingUp size={13} className="text-orange-500 shrink-0" />
                  <span><strong>Oportunidad:</strong> {conv.alertaVenta}</span>
                  <button className="ml-auto shrink-0 px-2 py-1 bg-orange-500 text-white rounded-lg text-[11px] hover:bg-orange-600">
                    Crear cita
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Reply bar */}
          <div className="px-5 pb-4 shrink-0">
            <div className="flex items-end gap-2 bg-white border border-gray-300 rounded-xl px-3 py-2 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100">
              <textarea
                rows={1}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Escribe un mensaje..."
                className="flex-1 text-sm text-gray-900 placeholder-gray-400 resize-none outline-none py-1 max-h-32"
              />
              <button
                disabled={!draft.trim()}
                className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 transition-colors shrink-0"
              >
                <Send size={16} />
              </button>
            </div>
            <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
              <span>Enviando por {CANAL_CONFIG[conv.canal].label}</span>
              <span>·</span>
              <button className="text-blue-500 hover:underline flex items-center gap-0.5">
                <Bot size={11} /> Respuesta automática
              </button>
              <button className="text-gray-500 hover:underline">
                Plantillas
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
