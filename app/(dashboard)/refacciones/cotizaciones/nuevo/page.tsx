'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Save, Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { createCotizacionAction } from '@/app/actions/refacciones'

type ClienteOption = { id: string; nombre: string; apellido: string; whatsapp: string }
type VehiculoOption = { id: string; marca: string; modelo: string; anio: number; placa: string | null }

export default function NuevaCotizacionPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preOtId = searchParams.get('ot_id') ?? ''

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [clienteQuery, setClienteQuery] = useState('')
  const [clientes, setClientes] = useState<ClienteOption[]>([])
  const [selectedCliente, setSelectedCliente] = useState<ClienteOption | null>(null)
  const [showList, setShowList] = useState(false)
  const [vehiculos, setVehiculos] = useState<VehiculoOption[]>([])
  const [selectedVehiculoId, setSelectedVehiculoId] = useState('')

  useEffect(() => {
    if (clienteQuery.length < 2) { setClientes([]); return }
    const supabase = createClient()
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('clientes')
        .select('id, nombre, apellido, whatsapp')
        .or(`nombre.ilike.%${clienteQuery}%,apellido.ilike.%${clienteQuery}%,whatsapp.ilike.%${clienteQuery}%`)
        .limit(8)
      setClientes(data ?? [])
      setShowList(true)
    }, 250)
    return () => clearTimeout(t)
  }, [clienteQuery])

  useEffect(() => {
    if (!selectedCliente) { setVehiculos([]); setSelectedVehiculoId(''); return }
    const supabase = createClient()
    supabase
      .from('vehiculo_personas')
      .select('vehiculo:vehiculos(id, marca, modelo, anio, placa)')
      .eq('cliente_id', selectedCliente.id)
      .then(({ data }) => {
        type Row = { vehiculo: VehiculoOption | null }
        const vs = ((data as unknown as Row[]) ?? []).map(r => r.vehiculo).filter((v): v is VehiculoOption => v !== null)
        setVehiculos(vs)
        if (vs.length === 1) setSelectedVehiculoId(vs[0].id)
      })
  }, [selectedCliente])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!selectedCliente) { setError('Selecciona un cliente'); return }
    setSaving(true)
    setError(null)
    const formData = new FormData(e.currentTarget)
    formData.set('cliente_id', selectedCliente.id)
    formData.set('vehiculo_id', selectedVehiculoId)
    if (preOtId) formData.set('ot_id', preOtId)
    const result = await createCotizacionAction(formData)
    if (result?.error) { setError(result.error); setSaving(false) }
    else if (result?.id) router.push(`/refacciones/cotizaciones/${result.id}`)
  }

  // Default: vence en 7 días
  const vence = new Date()
  vence.setDate(vence.getDate() + 7)
  const defaultVencimiento = vence.toISOString().split('T')[0]

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/refacciones/cotizaciones" className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors">
          <ChevronLeft size={18} />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-gray-900">Nueva Cotización</h1>
          <p className="text-sm text-gray-500 mt-0.5">Crea una cotización de refacciones o servicio</p>
        </div>
        <Link href="/refacciones/cotizaciones" className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
          Cancelar
        </Link>
        <button type="submit" disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-blue-400 transition-colors">
          <Save size={16} />
          {saving ? 'Guardando...' : 'Crear cotización'}
        </button>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg">{error}</p>}

      {/* Cliente */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Cliente</h2>
        {selectedCliente ? (
          <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div>
              <p className="text-sm font-medium text-gray-900">{selectedCliente.nombre} {selectedCliente.apellido}</p>
              <p className="text-xs text-gray-500 font-mono">{selectedCliente.whatsapp}</p>
            </div>
            <button type="button" onClick={() => { setSelectedCliente(null); setClienteQuery('') }}
              className="text-xs text-blue-600 hover:underline">Cambiar</button>
          </div>
        ) : (
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={clienteQuery} onChange={(e) => setClienteQuery(e.target.value)}
              placeholder="Buscar cliente..."
              className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            {showList && clientes.length > 0 && (
              <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                {clientes.map((c) => (
                  <li key={c.id}>
                    <button type="button"
                      onClick={() => { setSelectedCliente(c); setShowList(false); setClienteQuery('') }}
                      className="w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors">
                      <p className="text-sm font-medium text-gray-900">{c.nombre} {c.apellido}</p>
                      <p className="text-xs text-gray-500 font-mono">{c.whatsapp}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {selectedCliente && vehiculos.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Vehículo</label>
            <select value={selectedVehiculoId} onChange={(e) => setSelectedVehiculoId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Sin vehículo</option>
              {vehiculos.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.marca} {v.modelo} {v.anio}{v.placa ? ` — ${v.placa}` : ''}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Detalles */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Detalles</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
            <select name="tipo" defaultValue="refacciones"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="refacciones">Refacciones</option>
              <option value="servicio">Servicio</option>
              <option value="mixta">Mixta</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Vence el</label>
            <input name="fecha_vencimiento" type="date" defaultValue={defaultVencimiento}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
          <textarea name="notas" rows={3} placeholder="Observaciones para el cliente..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </div>
      </div>
    </form>
  )
}
