'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Save, Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { createOTAction } from '@/app/actions/taller'

type ClienteOption = { id: string; nombre: string; apellido: string; whatsapp: string }
type VehiculoOption = { id: string; marca: string; modelo: string; anio: number; placa: string | null }

export default function NuevaOTPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedCitaId = searchParams.get('cita_id') ?? ''

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Client search
  const [clienteQuery, setClienteQuery] = useState('')
  const [clientes, setClientes] = useState<ClienteOption[]>([])
  const [selectedCliente, setSelectedCliente] = useState<ClienteOption | null>(null)
  const [showClienteList, setShowClienteList] = useState(false)

  // Vehicles
  const [vehiculos, setVehiculos] = useState<VehiculoOption[]>([])
  const [selectedVehiculoId, setSelectedVehiculoId] = useState('')

  // Pre-load data from cita if cita_id is provided
  useEffect(() => {
    if (!preselectedCitaId) return
    const supabase = createClient()
    supabase
      .from('citas')
      .select(`
        cliente_id, vehiculo_id,
        cliente:clientes ( id, nombre, apellido, whatsapp ),
        vehiculo:vehiculos ( id, marca, modelo, anio, placa )
      `)
      .eq('id', preselectedCitaId)
      .single()
      .then(({ data }) => {
        if (!data) return
        type CitaRow = typeof data & {
          cliente: ClienteOption | null
          vehiculo: VehiculoOption | null
        }
        const row = data as unknown as CitaRow
        if (row.cliente) setSelectedCliente(row.cliente)
        if (row.vehiculo) {
          setVehiculos([row.vehiculo])
          setSelectedVehiculoId(row.vehiculo.id)
        }
      })
  }, [preselectedCitaId])

  // Search clients
  useEffect(() => {
    if (clienteQuery.length < 2) { setClientes([]); return }
    const supabase = createClient()
    const timeout = setTimeout(async () => {
      const { data } = await supabase
        .from('clientes')
        .select('id, nombre, apellido, whatsapp')
        .or(`nombre.ilike.%${clienteQuery}%,apellido.ilike.%${clienteQuery}%,whatsapp.ilike.%${clienteQuery}%`)
        .limit(8)
      setClientes(data ?? [])
      setShowClienteList(true)
    }, 250)
    return () => clearTimeout(timeout)
  }, [clienteQuery])

  // Load vehicles when client selected
  useEffect(() => {
    if (!selectedCliente || preselectedCitaId) return
    const supabase = createClient()
    supabase
      .from('vehiculo_personas')
      .select('vehiculo:vehiculos(id, marca, modelo, anio, placa)')
      .eq('cliente_id', selectedCliente.id)
      .then(({ data }) => {
        type Row = { vehiculo: VehiculoOption | null }
        const vs = ((data as unknown as Row[]) ?? [])
          .map((r) => r.vehiculo)
          .filter((v): v is VehiculoOption => v !== null)
        setVehiculos(vs)
        if (vs.length === 1) setSelectedVehiculoId(vs[0].id)
      })
  }, [selectedCliente, preselectedCitaId])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!selectedCliente) { setError('Selecciona un cliente'); return }
    setSaving(true)
    setError(null)
    const formData = new FormData(e.currentTarget)
    formData.set('cliente_id', selectedCliente.id)
    formData.set('vehiculo_id', selectedVehiculoId)
    if (preselectedCitaId) formData.set('cita_id', preselectedCitaId)
    const result = await createOTAction(formData)
    if (result?.error) { setError(result.error); setSaving(false) }
    else if (result?.id) router.push(`/taller/${result.id}`)
  }

  // Default promesa = tomorrow at 18:00
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const defaultPromesa = tomorrow.toISOString().slice(0, 16)

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/taller" className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors">
          <ChevronLeft size={18} />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-gray-900">Nueva Orden de Trabajo</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {preselectedCitaId ? 'Creando OT desde cita' : 'Crear OT manualmente'}
          </p>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-blue-400 transition-colors"
        >
          <Save size={16} />
          {saving ? 'Guardando...' : 'Crear OT'}
        </button>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg">{error}</p>}

      {/* Client selector */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Cliente</h2>

        {selectedCliente ? (
          <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div>
              <p className="text-sm font-medium text-gray-900">
                {selectedCliente.nombre} {selectedCliente.apellido}
              </p>
              <p className="text-xs text-gray-500 font-mono">{selectedCliente.whatsapp}</p>
            </div>
            {!preselectedCitaId && (
              <button
                type="button"
                onClick={() => { setSelectedCliente(null); setClienteQuery(''); setVehiculos([]); setSelectedVehiculoId('') }}
                className="text-xs text-blue-600 hover:underline"
              >
                Cambiar
              </button>
            )}
          </div>
        ) : (
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={clienteQuery}
              onChange={(e) => setClienteQuery(e.target.value)}
              placeholder="Buscar por nombre o WhatsApp..."
              className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {showClienteList && clientes.length > 0 && (
              <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                {clientes.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => { setSelectedCliente(c); setShowClienteList(false); setClienteQuery('') }}
                      className="w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors"
                    >
                      <p className="text-sm font-medium text-gray-900">{c.nombre} {c.apellido}</p>
                      <p className="text-xs text-gray-500 font-mono">{c.whatsapp}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Vehicle */}
        {selectedCliente && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Vehículo</label>
            {vehiculos.length === 0 ? (
              <p className="text-sm text-gray-500">Sin vehículos registrados</p>
            ) : (
              <select
                value={selectedVehiculoId}
                onChange={(e) => setSelectedVehiculoId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Sin vehículo especificado</option>
                {vehiculos.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.marca} {v.modelo} {v.anio}{v.placa ? ` — ${v.placa}` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>

      {/* Datos del servicio */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Servicio</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">KM de entrada</label>
            <input
              name="km_ingreso"
              type="number"
              min="0"
              placeholder="Ej: 35000"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Promesa de entrega</label>
            <input
              name="promesa_entrega"
              type="datetime-local"
              defaultValue={defaultPromesa}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              No. OT — ServiceTrack
            </label>
            <p className="text-xs text-gray-400 mt-0.5">Se genera automáticamente al crear la OT.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              No. OT — DMS{' '}
              <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <input
              name="numero_ot_dms"
              type="text"
              placeholder="Ej: 98765 (número en Autoline u otro DMS)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Diagnóstico / Descripción del servicio</label>
          <textarea
            name="diagnostico"
            rows={3}
            placeholder="Describe el trabajo a realizar o el problema reportado..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notas internas</label>
          <textarea
            name="notas_internas"
            rows={2}
            placeholder="Notas para el equipo interno (no visibles al cliente)..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>
      </div>
    </form>
  )
}
