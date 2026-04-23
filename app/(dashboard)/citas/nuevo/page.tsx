'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Save, Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { createCitaAction } from '@/app/actions/citas'
import { DisponibilidadHoras } from '../DisponibilidadHoras'

type ClienteOption = { id: string; nombre: string; apellido: string; whatsapp: string }
type VehiculoOption = { id: string; marca: string; modelo: string; anio: number; placa: string | null }

export default function NuevaCitaPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedClienteId = searchParams.get('cliente_id') ?? ''

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Client search
  const [clienteQuery, setClienteQuery] = useState('')
  const [clientes, setClientes] = useState<ClienteOption[]>([])
  const [selectedCliente, setSelectedCliente] = useState<ClienteOption | null>(null)
  const [showClienteList, setShowClienteList] = useState(false)

  // Vehicles for selected client
  const [vehiculos, setVehiculos] = useState<VehiculoOption[]>([])
  const [selectedVehiculoId, setSelectedVehiculoId] = useState('')

  // Date / availability
  const now = new Date()
  const defaultDate = now.toISOString().split('T')[0]
  const [fechaCita, setFechaCita] = useState(defaultDate)
  const [horaCita, setHoraCita] = useState('')
  const [citasOcupadas, setCitasOcupadas] = useState<{ hora_cita: string; estado: string }[]>([])

  // Load preselected client
  useEffect(() => {
    if (!preselectedClienteId) return
    const supabase = createClient()
    supabase
      .from('clientes')
      .select('id, nombre, apellido, whatsapp')
      .eq('id', preselectedClienteId)
      .single()
      .then(({ data }) => {
        if (data) setSelectedCliente(data)
      })
  }, [preselectedClienteId])

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

  // Fetch occupied slots when date changes
  useEffect(() => {
    if (!fechaCita) return
    const supabase = createClient()
    supabase
      .from('citas')
      .select('hora_cita, estado')
      .eq('fecha_cita', fechaCita)
      .then(({ data }) => setCitasOcupadas(data ?? []))
  }, [fechaCita])

  // Load vehicles when client selected
  useEffect(() => {
    if (!selectedCliente) { setVehiculos([]); setSelectedVehiculoId(''); return }
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
  }, [selectedCliente])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!selectedCliente) { setError('Selecciona un cliente'); return }
    if (!horaCita) { setError('Selecciona un horario disponible'); return }
    setSaving(true)
    setError(null)
    const formData = new FormData(e.currentTarget)
    formData.set('cliente_id', selectedCliente.id)
    formData.set('vehiculo_id', selectedVehiculoId)
    const result = await createCitaAction(formData)
    if (result?.error) { setError(result.error); setSaving(false) }
    else if (result?.id) router.push(`/citas/${result.id}`)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/citas" className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors">
          <ChevronLeft size={18} />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-gray-900">Nueva Cita</h1>
          <p className="text-sm text-gray-500 mt-0.5">Agenda una cita de servicio</p>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-blue-400 transition-colors"
        >
          <Save size={16} />
          {saving ? 'Guardando...' : 'Agendar Cita'}
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
            <button
              type="button"
              onClick={() => { setSelectedCliente(null); setClienteQuery('') }}
              className="text-xs text-blue-600 hover:underline"
            >
              Cambiar
            </button>
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
            {showClienteList && clientes.length === 0 && clienteQuery.length >= 2 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-center">
                <p className="text-sm text-gray-500 mb-2">No se encontraron clientes</p>
                <Link
                  href={`/crm/clientes/nuevo?return_to=/citas/nuevo`}
                  className="text-sm text-blue-600 hover:underline font-medium"
                >
                  + Crear cliente nuevo
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Vehicle selector */}
        {selectedCliente && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Vehículo</label>
            {vehiculos.length === 0 ? (
              <p className="text-sm text-gray-500">Este cliente no tiene vehículos registrados</p>
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

      {/* Date & time */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Fecha y hora</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Fecha <span className="text-red-500">*</span>
          </label>
          <input
            name="fecha_cita"
            type="date"
            required
            value={fechaCita}
            min={defaultDate}
            onChange={(e) => { setFechaCita(e.target.value); setHoraCita('') }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Hora disponible <span className="text-red-500">*</span>
          </label>
          <DisponibilidadHoras
            fecha={fechaCita}
            citasOcupadas={citasOcupadas}
            onSelect={setHoraCita}
            horaSeleccionada={horaCita}
          />
        </div>
        <input type="hidden" name="hora_cita" value={horaCita} />
      </div>

      {/* Motivo + notes */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Detalles del servicio</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Motivo de la cita</label>
          <input
            name="servicio"
            type="text"
            placeholder="Ej: Servicio de 10,000 km, revisión de frenos..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
          <textarea
            name="notas"
            rows={3}
            placeholder="Información adicional, síntomas reportados por el cliente..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>
      </div>
    </form>
  )
}
