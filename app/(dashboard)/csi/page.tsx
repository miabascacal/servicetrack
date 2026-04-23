import { createClient } from '@/lib/supabase/server'
import { Star, Send, CheckCircle2, Clock, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

type EncuestaRow = {
  id: string
  nombre: string
  modulo_origen: string
  activa: boolean
  dias_espera: number
  score_alerta: number
}

type EnvioRow = {
  id: string
  estado: string
  enviado_at: string | null
  respondido_at: string | null
  csi_respuestas: { score: number | null }[]
}

const MODULO_LABEL: Record<string, string> = {
  ot: 'Taller', cita: 'Citas', venta: 'Ventas',
}

export default async function CsiPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: usuario } = await supabase
    .from('usuarios')
    .select('sucursal_id, grupo_id')
    .eq('auth_user_id', user.id)
    .single()

  const grupoId = (usuario as { grupo_id?: string } | null)?.grupo_id ?? null

  const [{ data: encuestas }, { data: envios }] = await Promise.all([
    grupoId
      ? supabase.from('csi_encuestas').select('id, nombre, modulo_origen, activa, dias_espera, score_alerta').eq('grupo_id', grupoId).order('creado_at')
      : Promise.resolve({ data: [] }),
    supabase.from('csi_envios').select('id, estado, enviado_at, respondido_at, csi_respuestas(score)').order('enviado_at', { ascending: false }).limit(100),
  ])

  const rows = (encuestas as unknown as EncuestaRow[]) ?? []
  const envioRows = (envios as unknown as EnvioRow[]) ?? []

  const totalEnvios = envioRows.length
  const respondidas = envioRows.filter(e => e.estado === 'respondida').length
  const pendientes = envioRows.filter(e => e.estado === 'enviada').length
  const scores = envioRows
    .flatMap(e => e.csi_respuestas)
    .map(r => r.score)
    .filter((s): s is number => s !== null)
  const avgScore = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : '—'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">CSI — Satisfacción del Cliente</h1>
          <p className="text-sm text-gray-500 mt-0.5">Encuestas post-servicio y seguimiento de NPS</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg text-sm font-medium hover:bg-yellow-600 transition-colors">
          <Plus size={16} />
          Nueva encuesta
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Score promedio', value: avgScore, icon: Star, color: 'text-yellow-600', bg: 'bg-yellow-50' },
          { label: 'Total enviadas', value: totalEnvios, icon: Send, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Respondidas', value: respondidas, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Pendientes', value: pendientes, icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-3">
            <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', bg)}>
              <Icon size={18} className={color} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Encuestas configuradas */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Encuestas configuradas</h2>
        </div>

        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center">
            <Star size={28} className="text-gray-300 mb-2" />
            <p className="text-sm text-gray-500">Sin encuestas configuradas</p>
            <p className="text-xs text-gray-400 mt-1">Crea tu primera encuesta CSI para empezar</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {rows.map(enc => (
              <div key={enc.id} className="px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{enc.nombre}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {MODULO_LABEL[enc.modulo_origen] ?? enc.modulo_origen} · {enc.dias_espera}d de espera · alerta en score &lt; {enc.score_alerta}
                  </p>
                </div>
                <span className={cn(
                  'text-xs px-2 py-0.5 rounded-full font-medium',
                  enc.activa ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                )}>
                  {enc.activa ? 'Activa' : 'Inactiva'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Últimos envíos */}
      {envioRows.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Últimos envíos</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {envioRows.slice(0, 10).map(envio => (
              <div key={envio.id} className="px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'w-2 h-2 rounded-full',
                    envio.estado === 'respondida' ? 'bg-green-500' :
                    envio.estado === 'enviada' ? 'bg-yellow-400' : 'bg-gray-300'
                  )} />
                  <span className="text-sm text-gray-700">{envio.estado}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-400">
                  {envio.csi_respuestas?.[0]?.score != null && (
                    <span className="font-medium text-yellow-600">⭐ {envio.csi_respuestas[0].score}</span>
                  )}
                  {envio.enviado_at && <span>{new Date(envio.enviado_at).toLocaleDateString('es-MX')}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
