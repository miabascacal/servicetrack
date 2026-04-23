import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ChevronLeft, Save } from 'lucide-react'
import { upsertConfigCitasAction } from '@/app/actions/configuracion'

async function guardarConfigCitas(formData: FormData) {
  'use server'
  await upsertConfigCitasAction(formData)
}

const DIAS_SEMANA = [
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mié' },
  { value: 4, label: 'Jue' },
  { value: 5, label: 'Vie' },
  { value: 6, label: 'Sáb' },
  { value: 0, label: 'Dom' },
]

type ConfigCitas = {
  horario_inicio: string
  horario_fin: string
  dias_disponibles: number[]
  intervalo_minutos: number
  activa: boolean
}

export default async function ConfigCitasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: usuario } = await supabase
    .from('usuarios')
    .select('sucursal_id')
    .eq('id', user.id)
    .single()

  const { data: cfg } = usuario?.sucursal_id
    ? await supabase
        .from('configuracion_citas_sucursal')
        .select('horario_inicio, horario_fin, dias_disponibles, intervalo_minutos, activa')
        .eq('sucursal_id', usuario.sucursal_id)
        .single()
    : { data: null }

  const config = (cfg as unknown as ConfigCitas | null) ?? {
    horario_inicio: '08:00',
    horario_fin: '18:00',
    dias_disponibles: [1, 2, 3, 4, 5, 6],
    intervalo_minutos: 30,
    activa: true,
  }

  return (
    <form action={guardarConfigCitas} className="space-y-6 max-w-xl">
      <div className="flex items-center gap-3">
        <Link href="/configuracion" className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors">
          <ChevronLeft size={18} />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-gray-900">Configuración de Citas</h1>
          <p className="text-sm text-gray-500 mt-0.5">Horarios y disponibilidad de agenda</p>
        </div>
        <button
          type="submit"
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
        >
          <Save size={16} />
          Guardar
        </button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Horario de atención</h2>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="hidden" name="activa" value="false" />
            <input type="checkbox" name="activa" value="true" defaultChecked={config.activa}
              className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500" />
            <span className="text-sm text-gray-700">Activo</span>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hora de inicio</label>
            <input
              name="horario_inicio"
              type="time"
              defaultValue={config.horario_inicio}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hora de cierre</label>
            <input
              name="horario_fin"
              type="time"
              defaultValue={config.horario_fin}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Intervalo entre citas</label>
          <select
            name="intervalo_minutos"
            defaultValue={config.intervalo_minutos}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value={15}>15 minutos</option>
            <option value={30}>30 minutos</option>
            <option value={60}>1 hora</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Días disponibles</label>
          <div className="flex gap-2 flex-wrap">
            {DIAS_SEMANA.map(d => (
              <label key={d.value} className="flex flex-col items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  name="dias_disponibles"
                  value={d.value}
                  defaultChecked={config.dias_disponibles.includes(d.value)}
                  className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                />
                <span className="text-xs text-gray-600">{d.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </form>
  )
}
