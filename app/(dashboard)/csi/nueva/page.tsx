'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Save } from 'lucide-react'
import { createEncuestaAction } from '@/app/actions/csi'

const MODULO_OPCIONES = [
  { value: 'taller', label: 'Taller' },
  { value: 'ventas', label: 'Ventas' },
  { value: 'citas',  label: 'Citas' },
]

export default function NuevaEncuestaPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const result = await createEncuestaAction(new FormData(e.currentTarget))
    if (result?.error) { setError(result.error); setSaving(false) }
    else router.push('/csi')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-xl">
      <div className="flex items-center gap-3">
        <Link href="/csi" className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors">
          <ChevronLeft size={18} />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-gray-900">Nueva Encuesta CSI</h1>
          <p className="text-sm text-gray-500 mt-0.5">Configura una encuesta de satisfacción post-servicio</p>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg text-sm font-medium hover:bg-yellow-600 disabled:opacity-50 transition-colors"
        >
          <Save size={16} />
          {saving ? 'Guardando...' : 'Guardar encuesta'}
        </button>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg">{error}</p>}

      <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nombre <span className="text-red-500">*</span></label>
          <input
            name="nombre"
            type="text"
            required
            placeholder="Ej: Satisfacción Post-Servicio Taller"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Módulo origen <span className="text-red-500">*</span></label>
          <select
            name="modulo_origen"
            required
            defaultValue=""
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
          >
            <option value="">Seleccionar módulo...</option>
            {MODULO_OPCIONES.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Días de espera tras evento</label>
            <input
              name="dias_espera"
              type="number"
              min="0"
              max="30"
              defaultValue={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
            />
            <p className="text-xs text-gray-400 mt-1">Días después del servicio para enviar la encuesta</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Alerta si score menor a</label>
            <input
              name="score_alerta"
              type="number"
              min="1"
              max="10"
              defaultValue={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
            />
            <p className="text-xs text-gray-400 mt-1">Genera alerta cuando el cliente califica por debajo</p>
          </div>
        </div>
      </div>
    </form>
  )
}
