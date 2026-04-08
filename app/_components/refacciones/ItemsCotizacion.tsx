'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { addItemCotizacionAction, deleteItemCotizacionAction } from '@/app/actions/refacciones'

type ItemCot = {
  id: string
  numero_parte: string | null
  descripcion: string
  cantidad: number
  precio_unitario: number | null
  total: number | null
}

interface ItemsCotizacionProps {
  cotizacionId: string
  items: ItemCot[]
  readonly?: boolean
}

export function ItemsCotizacion({ cotizacionId, items, readonly = false }: ItemsCotizacionProps) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const total = items.reduce((s, i) => s + (i.total ?? 0), 0)

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const formData = new FormData(e.currentTarget)
    formData.set('cotizacion_id', cotizacionId)
    const result = await addItemCotizacionAction(formData)
    if (result?.error) {
      setError(result.error)
    } else {
      setShowForm(false)
      ;(e.target as HTMLFormElement).reset()
      router.refresh()
    }
    setSaving(false)
  }

  async function handleDelete(itemId: string) {
    setDeleting(itemId)
    await deleteItemCotizacionAction(itemId, cotizacionId)
    router.refresh()
    setDeleting(null)
  }

  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">Sin ítems — agrega partes o servicios</p>
      ) : (
        <div className="space-y-2">
          {/* Header */}
          <div className="grid grid-cols-12 text-xs font-medium text-gray-500 px-2">
            <span className="col-span-5">Descripción</span>
            <span className="col-span-2 text-center">Cant.</span>
            <span className="col-span-2 text-right">Precio</span>
            <span className="col-span-2 text-right">Total</span>
            <span className="col-span-1" />
          </div>

          {items.map((item) => (
            <div key={item.id} className="grid grid-cols-12 items-center gap-1 p-2 bg-gray-50 rounded-lg border border-gray-200">
              <div className="col-span-5">
                <p className="text-sm text-gray-900">{item.descripcion}</p>
                {item.numero_parte && (
                  <p className="text-xs font-mono text-gray-400">{item.numero_parte}</p>
                )}
              </div>
              <p className="col-span-2 text-sm text-gray-600 text-center">{item.cantidad}</p>
              <p className="col-span-2 text-sm text-gray-600 text-right">
                {item.precio_unitario != null ? `$${item.precio_unitario.toLocaleString('es-MX')}` : '—'}
              </p>
              <p className="col-span-2 text-sm font-medium text-gray-900 text-right">
                {item.total != null ? `$${item.total.toLocaleString('es-MX')}` : '—'}
              </p>
              <div className="col-span-1 flex justify-end">
                {!readonly && (
                  <button onClick={() => handleDelete(item.id)} disabled={!!deleting}
                    className="text-gray-300 hover:text-red-400 transition-colors">
                    {deleting === item.id ? '...' : <Trash2 size={13} />}
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Total */}
          <div className="flex justify-end pt-2 border-t border-gray-200">
            <div className="text-right">
              <p className="text-xs text-gray-500">Total</p>
              <p className="text-lg font-bold text-gray-900">${total.toLocaleString('es-MX')}</p>
            </div>
          </div>
        </div>
      )}

      {!readonly && (
        <>
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          {showForm ? (
            <form onSubmit={handleAdd} className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
              <p className="text-sm font-medium text-blue-900">Agregar ítem</p>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Descripción</label>
                  <input name="descripcion" required type="text" placeholder="Ej: Pastillas de freno delanteras"
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">No. de parte (opcional)</label>
                  <input name="numero_parte" type="text" placeholder="AB-12345"
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Cantidad</label>
                  <input name="cantidad" type="number" min="1" defaultValue="1" required
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Precio unitario</label>
                  <input name="precio_unitario" type="number" min="0" step="0.01" defaultValue="0" required
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => { setShowForm(false); setError(null) }}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 transition-colors">Cancelar</button>
                <button type="submit" disabled={saving}
                  className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-blue-400 transition-colors">
                  {saving ? 'Guardando...' : 'Agregar'}
                </button>
              </div>
            </form>
          ) : (
            <button onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors">
              <Plus size={15} />
              Agregar ítem
            </button>
          )}
        </>
      )}
    </div>
  )
}
