import {
  Bot,
  Zap,
  Clock,
  MessageSquare,
  Calendar,
  Wrench,
  Star,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Play,
  Pause,
  Settings,
  Sparkles,
  MapPin,
  Phone,
  Mail,
} from 'lucide-react'

interface Flujo {
  id: string
  nombre: string
  descripcion: string
  trigger: string
  acciones: string[]
  activo: boolean
  ejecucionesHoy: number
  categoria: 'citas' | 'taller' | 'crm' | 'venta' | 'csi'
}

const FLUJOS: Flujo[] = [
  {
    id: '1',
    nombre: 'Regla de los 15 minutos',
    descripcion: 'Si la encargada no contacta al cliente en 15 min tras asignar la cita, el bot actúa automáticamente.',
    trigger: 'Cita asignada → sin acción en 15 min',
    acciones: [
      'WA personalizado al cliente con nombre, fecha/hora y sucursal',
      'Link de Google Maps integrado en el mensaje',
      'Actividad marcada en agenda de la encargada: "Bot actuó"',
      'Registro del contacto como "realizado por sistema"',
    ],
    activo: true,
    ejecucionesHoy: 3,
    categoria: 'citas',
  },
  {
    id: '2',
    nombre: 'Recordatorio 24h y 2h antes de cita',
    descripcion: 'Bot envía recordatorios automáticos antes de cada cita y registra la respuesta del cliente.',
    trigger: '24 horas y 2 horas antes de la cita',
    acciones: [
      'WA 24h antes: confirmación de cita con mapa de la sucursal',
      'WA 2h antes si no confirmó: recordatorio urgente',
      'CRM actualiza estado: Confirmada / Sin confirmar',
      'Gerente recibe reporte de no-confirmados del día',
    ],
    activo: true,
    ejecucionesHoy: 8,
    categoria: 'citas',
  },
  {
    id: '3',
    nombre: 'Recuperación de No-Show',
    descripcion: 'Cuando el cliente no se presenta, el bot activa un flujo de recuperación automático.',
    trigger: 'Encargada marca "No-Show" con 1 clic',
    acciones: [
      'WA empático 2h después con 2-3 fechas disponibles',
      'Si no responde en 48h: actividad en agenda de encargada',
      'WA de seguimiento a encargada + Outlook reminder',
      'Resultado registrado: reagendado / cancelado / sin contacto',
    ],
    activo: true,
    ejecucionesHoy: 1,
    categoria: 'citas',
  },
  {
    id: '4',
    nombre: 'Escalación OT — 3 niveles',
    descripcion: 'Si el asesor no actualiza la OT, el sistema escala automáticamente hasta que alguien actúe.',
    trigger: 'OT sin actualización en 4 horas',
    acciones: [
      'Nivel 1 (+4h): alerta WA al asesor',
      'Nivel 2 (+2h más): alerta WA al gerente',
      'Nivel 3 (+1h más): bot actualiza al cliente con el último estado conocido',
      'Todo queda registrado con timestamp en el expediente',
    ],
    activo: true,
    ejecucionesHoy: 2,
    categoria: 'taller',
  },
  {
    id: '5',
    nombre: 'Campaña de mantenimiento proactivo',
    descripcion: 'Detecta vehículos próximos a mantenimiento y genera citas automáticamente.',
    trigger: 'Vehículo a 500 km o 30 días del próximo servicio',
    acciones: [
      'WA personalizado con nombre del cliente y datos del vehículo',
      'Si no responde en 3 días: actividad en agenda del asesor con guión IA',
      'Si agenda: cita vinculada al expediente automáticamente',
      'Si no: nuevo recordatorio a 30 días',
    ],
    activo: true,
    ejecucionesHoy: 5,
    categoria: 'crm',
  },
  {
    id: '6',
    nombre: 'Venta cruzada inteligente',
    descripcion: 'IA analiza el historial del vehículo y sugiere al asesor productos y servicios en el momento correcto.',
    trigger: 'Asesor abre conversación de un cliente activo',
    acciones: [
      'IA analiza: km, modelo, año, servicios anteriores, garantía',
      'Sugerencia visible en pantalla del asesor (no invasiva)',
      'Si cliente no compra: WA post-servicio con oferta personalizada',
      'Modelo mejora con cada interacción (aprendizaje)',
    ],
    activo: true,
    ejecucionesHoy: 12,
    categoria: 'venta',
  },
  {
    id: '7',
    nombre: 'CSI post-entrega automático',
    descripcion: 'Encuesta de satisfacción enviada automáticamente 24h después de la entrega del vehículo.',
    trigger: 'OT marcada como "Entregada"',
    acciones: [
      'WA con encuesta simple (5 preguntas, escala 1-10)',
      'Score bajo → queja automática en módulo Atención a Clientes',
      'Score alto → solicitud de reseña en Google',
      'Resultados en dashboard CSI del gerente en tiempo real',
    ],
    activo: true,
    ejecucionesHoy: 4,
    categoria: 'csi',
  },
  {
    id: '8',
    nombre: 'Recepción Express — Flujo sin papel',
    descripcion: 'Cliente hace check-in por WhatsApp o QR. Asesor recibe toda la info antes de que el cliente llegue.',
    trigger: 'Cliente confirma llegada (WA o QR)',
    acciones: [
      'Pre-llegada: bot captura km, notas extra, necesidad de cortesía',
      'Check-in activa notificación inmediata al asesor con datos pre-llenados',
      'Timer visible en Kanban: minutos de espera del cliente',
      'OT se crea automáticamente con todos los datos al confirmar el asesor',
    ],
    activo: false,
    ejecucionesHoy: 0,
    categoria: 'citas',
  },
]

const CATEGORIA_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  citas:  { label: 'Citas',   color: 'text-blue-700',   bg: 'bg-blue-100' },
  taller: { label: 'Taller',  color: 'text-orange-700', bg: 'bg-orange-100' },
  crm:    { label: 'CRM',     color: 'text-indigo-700', bg: 'bg-indigo-100' },
  venta:  { label: 'Ventas',  color: 'text-green-700',  bg: 'bg-green-100' },
  csi:    { label: 'CSI',     color: 'text-purple-700', bg: 'bg-purple-100' },
}

const totalEjecucionesHoy = FLUJOS.reduce((s, f) => s + f.ejecucionesHoy, 0)
const activos = FLUJOS.filter((f) => f.activo).length

export default function AutomatizacionesPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">IA y Automatizaciones</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Flujos activos que trabajan solos — el sistema actúa cuando las personas no pueden
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
          <Sparkles size={15} />
          Nuevo flujo
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center">
              <Zap size={18} className="text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{activos}</p>
              <p className="text-xs text-gray-500">flujos activos</p>
            </div>
          </div>
          <div className="flex gap-1">
            {FLUJOS.map((f) => (
              <div key={f.id} className={`flex-1 h-1.5 rounded-full ${f.activo ? 'bg-green-400' : 'bg-gray-200'}`} />
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
              <Bot size={18} className="text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{totalEjecucionesHoy}</p>
              <p className="text-xs text-gray-500">ejecuciones hoy</p>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3">
            El bot actuó por los asesores {FLUJOS.find((f) => f.id === '1')?.ejecucionesHoy ?? 0} veces hoy
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center">
              <Sparkles size={18} className="text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{FLUJOS.find((f) => f.id === '6')?.ejecucionesHoy ?? 0}</p>
              <p className="text-xs text-gray-500">sugerencias IA hoy</p>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3">Venta cruzada inteligente activa</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-orange-100 flex items-center justify-center">
              <AlertTriangle size={18} className="text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{FLUJOS.find((f) => f.id === '4')?.ejecucionesHoy ?? 0}</p>
              <p className="text-xs text-gray-500">escalaciones hoy</p>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3">OTs sin actualizar detectadas</p>
        </div>
      </div>

      {/* Cómo trabaja el sistema */}
      <div className="bg-gradient-to-r from-indigo-900 to-blue-900 rounded-xl p-6 text-white">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles size={18} className="text-indigo-300" />
          <h2 className="text-sm font-semibold text-indigo-200 uppercase tracking-wide">Cómo funciona la IA</h2>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[
            { icon: <MessageSquare size={20} />, label: 'Detecta', desc: 'El sistema monitorea todos los canales y timers en tiempo real' },
            { icon: <Bot size={20} />, label: 'Actúa', desc: 'Si nadie responde, el bot actúa con el mensaje correcto en el momento correcto' },
            { icon: <Sparkles size={20} />, label: 'Sugiere', desc: 'IA analiza el historial y recomienda al asesor la mejor acción' },
            { icon: <TrendingUp size={20} />, label: 'Aprende', desc: 'Cada interacción mejora el modelo para la siguiente vez' },
          ].map(({ icon, label, desc }) => (
            <div key={label} className="flex flex-col gap-2">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-indigo-300">
                {icon}
              </div>
              <p className="text-sm font-semibold text-white">{label}</p>
              <p className="text-xs text-indigo-300 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Flujos */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Flujos configurados</h2>
        <div className="space-y-3">
          {FLUJOS.map((f) => {
            const cat = CATEGORIA_CONFIG[f.categoria]
            return (
              <div key={f.id} className={`bg-white rounded-xl border ${f.activo ? 'border-gray-200' : 'border-gray-100 opacity-60'} p-5`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    {/* Status indicator */}
                    <div className={`w-10 h-10 rounded-xl shrink-0 flex items-center justify-center ${
                      f.activo ? 'bg-green-100' : 'bg-gray-100'
                    }`}>
                      {f.activo ? (
                        <Zap size={18} className="text-green-600" />
                      ) : (
                        <Pause size={18} className="text-gray-400" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-gray-900">{f.nombre}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cat.bg} ${cat.color}`}>
                          {cat.label}
                        </span>
                        {f.activo ? (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                            Activo
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500">
                            Pausado
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{f.descripcion}</p>

                      {/* Trigger */}
                      <div className="mt-3 flex items-center gap-2 text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded-lg w-fit">
                        <Clock size={12} className="text-gray-400" />
                        <span className="font-medium">Trigger:</span>
                        {f.trigger}
                      </div>

                      {/* Actions */}
                      <div className="mt-3 space-y-1">
                        {f.acciones.map((a, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs text-gray-600">
                            <ArrowRight size={12} className="text-indigo-400 mt-0.5 shrink-0" />
                            <span>{a}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right side: stats + controls */}
                  <div className="shrink-0 text-right space-y-3">
                    {f.ejecucionesHoy > 0 && (
                      <div>
                        <p className="text-lg font-bold text-gray-900">{f.ejecucionesHoy}</p>
                        <p className="text-xs text-gray-400">hoy</p>
                      </div>
                    )}
                    <div className="flex items-center gap-2 justify-end">
                      <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                        <Settings size={15} />
                      </button>
                      <button className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        f.activo
                          ? 'text-gray-600 border border-gray-300 hover:bg-gray-50'
                          : 'bg-green-600 text-white hover:bg-green-700'
                      }`}>
                        {f.activo ? <><Pause size={12} /> Pausar</> : <><Play size={12} /> Activar</>}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Canales conectados */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Canales conectados</h2>
        <div className="grid grid-cols-5 gap-4">
          {[
            { icon: <MessageSquare size={20} />, label: 'WhatsApp Business', status: 'conectado', color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
            { icon: <Mail size={20} />, label: 'Email / SMTP', status: 'conectado', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
            { icon: <Phone size={20} />, label: 'Llamadas VoIP', status: 'próximamente', color: 'text-gray-400', bg: 'bg-gray-50 border-gray-200' },
            { icon: <Star size={20} />, label: 'Instagram DM', status: 'beta', color: 'text-pink-600', bg: 'bg-pink-50 border-pink-200' },
            { icon: <MapPin size={20} />, label: 'Google Maps', status: 'conectado', color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
          ].map(({ icon, label, status, color, bg }) => (
            <div key={label} className={`border rounded-xl p-4 text-center ${bg}`}>
              <div className={`w-10 h-10 mx-auto rounded-xl bg-white border border-gray-200 flex items-center justify-center mb-3 ${color}`}>
                {icon}
              </div>
              <p className="text-xs font-semibold text-gray-800 mb-1">{label}</p>
              <div className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full ${
                status === 'conectado' ? 'bg-green-100 text-green-700' :
                status === 'beta' ? 'bg-yellow-100 text-yellow-700' :
                'bg-gray-100 text-gray-500'
              }`}>
                {status === 'conectado' && <CheckCircle2 size={10} />}
                {status}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
