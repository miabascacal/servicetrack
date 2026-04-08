'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Save, Loader2 } from 'lucide-react'
import { updateVehiculoAction } from '@/app/actions/vehiculos'
import { createClient } from '@/lib/supabase/client'

interface PageProps {
  params: Promise<{ id: string }>
}

type VehiculoData = {
  id: string
  marca: string
  modelo: string
  version: string | null
  anio: number
  color: string | null
  placa: string | null
  vin: string | null
  km_actual: number | null
  intervalo_servicio_meses: number | null
  fecha_compra: string | null
  fecha_fin_garantia: string | null
  estado_verificacion: string
  fecha_verificacion: string | null
  proxima_verificacion: string | null
  lugar_verificacion: string | null
}

export default function EditarVehiculoPage({ params }: PageProps) {
  const router = useRouter()
  const [id, setId] = useState<string | null>(null)
  const [vehiculo, setVehiculo] = useState<VehiculoData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    params.then(({ id: vid }) => {
      setId(vid)
      const supabase = createClient()
      supabase
        .from('vehiculos')
        .select(`
          id, marca, modelo, version, anio, color, placa, vin,
          km_actual, intervalo_servicio_meses,
          fecha_compra, fecha_fin_garantia,
          estado_verificacion, fecha_verificacion, proxima_verificacion, lugar_verificacion
        `)
        .eq('id', vid)
        .single()
        .then(({ data, error: e }) => {
          if (e || !data) { setError('No se encontró el vehículo'); setLoading(false); return }
          setVehiculo(data as VehiculoData)
          setLoading(false)
        })
    })
  }, [params])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!id) return
    setSaving(true)
    setError(null)
    const formData = new FormData(e.currentTarget)
    const result = await updateVehiculoAction(id, formData)
    setSaving(false)
    if ('error' in result) { setError(result.error ?? 'Error al guardar'); return }
    router.push(`/crm/vehiculos/${id}`)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    )
  }

  if (!vehiculo || !id) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-gray-500">{error ?? 'Vehículo no encontrado'}</p>
        <Link href="/crm/vehiculos" className="mt-3 inline-block text-sm text-blue-600 hover:underline">
          Volver a Vehículos
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <Link href={`/crm/vehiculos/${id}`} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <ChevronLeft size={16} /> {vehiculo.marca} {vehiculo.modelo}
        </Link>
        <h1 className="text-lg font-semibold text-gray-900">Editar vehículo</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">

        {/* ── Identificación ── */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Identificación</p>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Marca <span className="text-red-500">*</span>
              </label>
              <input name="marca" required defaultValue={vehiculo.marca} maxLength={50} placeholder="Toyota"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Modelo <span className="text-red-500">*</span>
              </label>
              <input name="modelo" required defaultValue={vehiculo.modelo} maxLength={60} placeholder="Corolla"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Año <span className="text-red-500">*</span>
              </label>
              <input name="anio" required type="number" defaultValue={vehiculo.anio}
                min={1960} max={new Date().getFullYear() + 1}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Versión / Trim</label>
            <input name="version" defaultValue={vehiculo.version ?? ''} maxLength={80}
              placeholder="LE, XLE, SE, Sport..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        {/* ── Físico ── */}
        <div className="border-t border-gray-100 pt-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Datos físicos</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Color <span className="text-red-500">*</span>
              </label>
              <input name="color" required defaultValue={vehiculo.color ?? ''} maxLength={30} placeholder="Blanco"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Placa <span className="text-red-500">*</span>
              </label>
              <input name="placa" required defaultValue={vehiculo.placa ?? ''} maxLength={10} placeholder="ABC-123"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              VIN <span className="text-red-500">*</span>{' '}
              <span className="text-xs text-gray-400 font-normal">(17 caracteres)</span>
            </label>
            <input name="vin" required defaultValue={vehiculo.vin ?? ''} maxLength={17} minLength={17}
              placeholder="1HGCM82633A004352"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        {/* ── Servicio ── */}
        <div className="border-t border-gray-100 pt-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Servicio</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Kilometraje actual</label>
              <input name="km_actual" type="number" defaultValue={vehiculo.km_actual ?? ''} min={0} max={9999999} placeholder="45000"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Intervalo servicio (meses)</label>
              <input name="intervalo_servicio_meses" type="number" defaultValue={vehiculo.intervalo_servicio_meses ?? 6} min={1} max={24}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Fecha de compra</label>
              <input name="fecha_compra" type="date" defaultValue={vehiculo.fecha_compra ?? ''}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Fin de garantía</label>
              <input name="fecha_fin_garantia" type="date" defaultValue={vehiculo.fecha_fin_garantia ?? ''}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        </div>

        {/* ── Verificación ── */}
        <div className="border-t border-gray-100 pt-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Verificación vehicular</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Estado verificación</label>
              <select name="estado_verificacion" defaultValue={vehiculo.estado_verificacion ?? 'no_aplica'}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="no_aplica">No aplica</option>
                <option value="vigente">Vigente</option>
                <option value="por_vencer">Por vencer</option>
                <option value="vencida">Vencida</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Lugar de verificación</label>
              <input name="lugar_verificacion" defaultValue={vehiculo.lugar_verificacion ?? ''} maxLength={100}
                placeholder="Centro de verificación..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Fecha de verificación</label>
              <input name="fecha_verificacion" type="date" defaultValue={vehiculo.fecha_verificacion ?? ''}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Próxima verificación</label>
              <input name="proxima_verificacion" type="date" defaultValue={vehiculo.proxima_verificacion ?? ''}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button type="submit" disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
          <Link href={`/crm/vehiculos/${id}`}
            className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  )
}
