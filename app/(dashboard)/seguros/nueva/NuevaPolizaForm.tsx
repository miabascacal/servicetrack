'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Save } from 'lucide-react'
import { createPolizaAction } from '@/app/actions/seguros'

interface VehiculoOpt {
  id: string
  marca: string
  modelo: string
  anio: number
  placa: string | null
  cliente_id: string | null
  cliente: { nombre: string; apellido: string } | null
}

interface Props {
  companias: { id: string; nombre: string }[]
  vehiculos: VehiculoOpt[]
}

const TIPO_OPCIONES = [
  { value: 'NF', label: 'Nuevo / Full' },
  { value: 'NP', label: 'Nuevo / Parcial' },
  { value: 'XF', label: 'Usado / Full' },
  { value: 'XP', label: 'Usado / Parcial' },
]

const ESTADO_OPCIONES = [
  { value: 'N', label: 'Vigente' },
  { value: 'M', label: 'Vencida' },
  { value: 'C', label: 'Cancelada' },
  { value: 'I', label: 'Inactiva' },
]

export default function NuevaPolizaForm({ companias, vehiculos }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [vehiculoId, setVehiculoId] = useState('')

  const vehiculoSel = vehiculos.find(v => v.id === vehiculoId)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const fd = new FormData(e.currentTarget)
    // set cliente_id from vehicle's owner
    if (vehiculoSel?.cliente_id) fd.set('cliente_id', vehiculoSel.cliente_id)
    const result = await createPolizaAction(fd)
    if (result?.error) { setError(result.error); setSaving(false) }
    else router.push('/seguros')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/seguros" className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors">
          <ChevronLeft size={18} />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-gray-900">Nueva Póliza</h1>
          <p className="text-sm text-gray-500 mt-0.5">Registra una póliza de seguro vehicular</p>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors"
        >
          <Save size={16} />
          {saving ? 'Guardando...' : 'Guardar póliza'}
        </button>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg">{error}</p>}

      {/* Vehículo */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Vehículo <span className="text-red-500">*</span></h2>
        <select
          name="vehiculo_id"
          required
          value={vehiculoId}
          onChange={e => setVehiculoId(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value="">Seleccionar vehículo...</option>
          {vehiculos.map(v => (
            <option key={v.id} value={v.id}>
              {v.marca} {v.modelo} {v.anio}{v.placa ? ` — ${v.placa}` : ''}
              {v.cliente ? ` (${v.cliente.nombre} ${v.cliente.apellido})` : ''}
            </option>
          ))}
        </select>
        {vehiculoSel?.cliente && (
          <p className="text-xs text-gray-500">
            Cliente vinculado: <span className="font-medium text-gray-700">{vehiculoSel.cliente.nombre} {vehiculoSel.cliente.apellido}</span>
          </p>
        )}
        {vehiculos.length === 0 && (
          <p className="text-xs text-gray-500">
            Sin vehículos registrados.{' '}
            <Link href="/crm/vehiculos/nuevo?return_to=/seguros/nueva" className="text-purple-600 hover:underline">
              Registrar nuevo vehículo
            </Link>
          </p>
        )}
      </div>

      {/* Póliza */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Datos de la póliza</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Compañía aseguradora</label>
            <select
              name="compania_seguro_id"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="">Sin compañía</option>
              {companias.map(c => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Número de póliza</label>
            <input
              name="numero_poliza"
              type="text"
              placeholder="Ej: POL-2025-001234"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de póliza</label>
            <select
              name="tipo_poliza"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="">Sin tipo</option>
              {TIPO_OPCIONES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
            <select
              name="estado"
              defaultValue="N"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {ESTADO_OPCIONES.map(e => (
                <option key={e.value} value={e.value}>{e.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de inicio</label>
            <input
              name="fecha_inicio"
              type="date"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de vencimiento <span className="text-red-500">*</span></label>
            <input
              name="fecha_fin"
              type="date"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Referencia</label>
            <input
              name="referencia"
              type="text"
              placeholder="Número de referencia adicional"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
          <textarea
            name="notas"
            rows={2}
            placeholder="Observaciones adicionales..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
          />
        </div>
      </div>
    </form>
  )
}
