'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Save, Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { createVehiculoAction } from '@/app/actions/vehiculos'

type ClienteOption = { id: string; nombre: string; apellido: string; whatsapp: string }

export default function NuevoVehiculoPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedClienteId = searchParams.get('cliente_id') ?? ''

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [clienteQuery, setClienteQuery] = useState('')
  const [clientes, setClientes] = useState<ClienteOption[]>([])
  const [selectedDueno, setSelectedDueno] = useState<ClienteOption | null>(null)
  const [showList, setShowList] = useState(false)

  // Pre-load client if coming from cliente page
  useEffect(() => {
    if (!preselectedClienteId) return
    const supabase = createClient()
    supabase
      .from('clientes')
      .select('id, nombre, apellido, whatsapp')
      .eq('id', preselectedClienteId)
      .single()
      .then(({ data }) => { if (data) setSelectedDueno(data) })
  }, [preselectedClienteId])

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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!selectedDueno) { setError('Selecciona al dueño del vehículo'); return }
    setSaving(true)
    setError(null)
    const formData = new FormData(e.currentTarget)
    formData.set('dueno_cliente_id', selectedDueno.id)
    const result = await createVehiculoAction(formData)
    if (result?.error) { setError(result.error); setSaving(false) }
    else if (result?.id) {
      if (preselectedClienteId) router.push(`/crm/clientes/${preselectedClienteId}`)
      else router.push(`/crm/vehiculos/${result.id}`)
    }
  }

  const currentYear = new Date().getFullYear()

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/crm/vehiculos" className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors">
          <ChevronLeft size={18} />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-gray-900">Nuevo Vehículo</h1>
          <p className="text-sm text-gray-500 mt-0.5">Registra un vehículo y asígnale un dueño</p>
        </div>
        <Link href="/crm/vehiculos" className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-blue-400 transition-colors"
        >
          <Save size={16} />
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg">{error}</p>}

      {/* Dueño */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Dueño del vehículo <span className="text-red-500">*</span></h2>
        {selectedDueno ? (
          <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div>
              <p className="text-sm font-medium text-gray-900">{selectedDueno.nombre} {selectedDueno.apellido}</p>
              <p className="text-xs text-gray-500 font-mono">{selectedDueno.whatsapp}</p>
            </div>
            {!preselectedClienteId && (
              <button type="button" onClick={() => { setSelectedDueno(null); setClienteQuery('') }}
                className="text-xs text-blue-600 hover:underline">Cambiar</button>
            )}
          </div>
        ) : (
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={clienteQuery}
              onChange={(e) => setClienteQuery(e.target.value)}
              placeholder="Buscar cliente por nombre o WhatsApp..."
              className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {showList && clientes.length > 0 && (
              <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                {clientes.map((c) => (
                  <li key={c.id}>
                    <button type="button"
                      onClick={() => { setSelectedDueno(c); setShowList(false); setClienteQuery('') }}
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
      </div>

      {/* Datos del vehículo */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Datos del vehículo</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Marca <span className="text-red-500">*</span></label>
            <input name="marca" required type="text" placeholder="Toyota"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Modelo <span className="text-red-500">*</span></label>
            <input name="modelo" required type="text" placeholder="Camry"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Año <span className="text-red-500">*</span></label>
            <input name="anio" required type="number" min="1900" max={currentYear + 1} defaultValue={currentYear}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
            <input name="color" type="text" placeholder="Blanco"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Placa</label>
            <input name="placa" type="text" placeholder="ABC-123-D"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">VIN</label>
            <input name="vin" type="text" placeholder="17 caracteres"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono uppercase" />
          </div>
        </div>
      </div>

      {/* Servicio */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Servicio</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">KM actuales</label>
            <input name="km_actual" type="number" min="0" placeholder="35000"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Intervalo de servicio (meses)</label>
            <select name="intervalo_servicio_meses" defaultValue="6"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="3">3 meses</option>
              <option value="6">6 meses</option>
              <option value="12">12 meses</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de compra</label>
            <input name="fecha_compra" type="date"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fin de garantía</label>
            <input name="fecha_fin_garantia" type="date"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
      </div>
    </form>
  )
}
