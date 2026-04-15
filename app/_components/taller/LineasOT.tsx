'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { addLineaOTAction, deleteLineaOTAction } from '@/app/actions/taller'

type LineaOT = {
  id: string
  tipo: string
  descripcion: string
  numero_parte: string | null
  cantidad: number
  precio_unitario: number | null
  total: number | null
  estado: string
  aprobado_cliente: boolean
}

const TIPO_CONFIG: Record<string, { label: string; color: string }> = {
  mano_obra:  { label: 'Mano de obra', color: 'bg-blue-100 text-blue-700' },
  refaccion:  { label: 'Refacción',    color: 'bg-orange-100 text-orange-700' },
  fluido:     { label: 'Fluido',       color: 'bg-cyan-100 text-cyan-700' },
  externo:    { label: 'Externo',      color: 'bg-purple-100 text-purple-700' },
  cortesia:   { label: 'Cortesía',     color: 'bg-green-100 text-green-700' },
}

const ESTADO_LINEA: Record<string, string> = {
  pendiente:   'Pendiente',
  en_proceso:  'En proceso',
  terminado:   'Terminado',
  cancelado:   'Cancelado',
}

interface LineasOTProps {
  otId: string
  lineas: LineaOT[]
  readonly?: boolean
}

export function LineasOT({ otId, lineas, readonly = false }: LineasOTProps) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const total = lineas.reduce((sum, l) => sum + (l.total ?? 0), 0)

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const formData = new FormData(e.currentTarget)
    formData.set('ot_id', otId)
    const result = await addLineaOTAction(formData)
    if (result?.error) {
      setError(result.error)
    } else {
      setShowForm(false)
      ;(e.target as HTMLFormElement).reset()
      router.refresh()
    }
    setSaving(false)
  }

  async function handleDelete(lineaId: string) {
    setDeleting(lineaId)
    setError(null)
    const result = await deleteLineaOTAction(lineaId, otId)
    if (result?.error) {
      setError(result.error)
    } else {
      router.refresh()
    }
    setDeleting(null)
  }

  return (
    <div className="space-y-3">
      {/* Error global — visible tanto en add como en delete */}
      {error && !showForm && (
        <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
      )}

      {/* Lines list */}
      {lineas.length === 0 ? (
        <p className="text-sm text-gray-400 py-4 text-center">Sin líneas registradas</p>
      ) : (
        <div className="space-y-2">
          {lineas.map((linea) => {
            const tipoCfg = TIPO_CONFIG[linea.tipo] ?? { label: linea.tipo, color: 'bg-gray-100 text-gray-600' }
            return (
              <div key={linea.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', tipoCfg.color)}>
                      {tipoCfg.label}
                    </span>
                    {linea.numero_parte && (
                      <span className="text-xs font-mono text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded">
                        {linea.numero_parte}
                      </span>
                    )}
                    <span className="text-xs text-gray-400">{ESTADO_LINEA[linea.estado] ?? linea.estado}</span>
                  </div>
                  <p className="text-sm text-gray-900 mt-1">{linea.descripcion}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {linea.cantidad} × {linea.precio_unitario !== null ? `$${linea.precio_unitario.toLocaleString('es-MX')}` : '—'}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-gray-900">
                    {linea.total !== null ? `$${linea.total.toLocaleString('es-MX')}` : '—'}
                  </p>
                  {!readonly && (
                    <button
                      onClick={() => handleDelete(linea.id)}
                      disabled={!!deleting}
                      className="text-xs text-red-400 hover:text-red-600 mt-1 transition-colors"
                    >
                      {deleting === linea.id ? '...' : <Trash2 size={12} />}
                    </button>
                  )}
                </div>
              </div>
            )
          })}

          {/* Total */}
          <div className="flex justify-end pt-2 border-t border-gray-200">
            <div className="text-right">
              <p className="text-xs text-gray-500">Total estimado</p>
              <p className="text-lg font-bold text-gray-900">${total.toLocaleString('es-MX')}</p>
            </div>
          </div>
        </div>
      )}

      {/* Add line form */}
      {!readonly && (
        <>
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          {showForm ? (
            <form onSubmit={handleAdd} className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
              <p className="text-sm font-medium text-blue-900">Agregar línea</p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Tipo</label>
                  <select
                    name="tipo"
                    required
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="mano_obra">Mano de obra</option>
                    <option value="refaccion">Refacción</option>
                    <option value="fluido">Fluido</option>
                    <option value="externo">Externo</option>
                    <option value="cortesia">Cortesía</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">No. de parte (opcional)</label>
                  <input
                    name="numero_parte"
                    type="text"
                    placeholder="Ej: AB-12345"
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Descripción</label>
                <input
                  name="descripcion"
                  type="text"
                  required
                  placeholder="Describe el servicio o la pieza..."
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Cantidad</label>
                  <input
                    name="cantidad"
                    type="number"
                    min="0.01"
                    step="0.01"
                    defaultValue="1"
                    required
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Precio unitario</label>
                  <input
                    name="precio_unitario"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue="0"
                    required
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setError(null) }}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-blue-400 transition-colors"
                >
                  {saving ? 'Guardando...' : 'Agregar'}
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
            >
              <Plus size={15} />
              Agregar línea
            </button>
          )}
        </>
      )}
    </div>
  )
}
