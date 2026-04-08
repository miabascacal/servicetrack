'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Save, Loader2 } from 'lucide-react'
import { updateClienteAction } from '@/app/actions/clientes'
import { createClient } from '@/lib/supabase/client'

interface PageProps {
  params: Promise<{ id: string }>
}

type ClienteData = {
  id: string
  nombre: string
  apellido: string
  apellido_2: string | null
  whatsapp: string | null
  telefono_contacto: string | null
  telefono_alterno: string | null
  email: string | null
  email_2: string | null
  notas: string | null
}

export default function EditarClientePage({ params }: PageProps) {
  const router = useRouter()
  const [id, setId] = useState<string | null>(null)
  const [cliente, setCliente] = useState<ClienteData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    params.then(({ id: clienteId }) => {
      setId(clienteId)
      const supabase = createClient()
      supabase
        .from('clientes')
        .select('id, nombre, apellido, apellido_2, whatsapp, telefono_contacto, telefono_alterno, email, email_2, notas')
        .eq('id', clienteId)
        .single()
        .then(({ data, error: e }) => {
          if (e || !data) { setError('No se encontró el cliente'); setLoading(false); return }
          setCliente(data as ClienteData)
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
    const result = await updateClienteAction(id, formData)
    setSaving(false)
    if ('error' in result) { setError(result.error ?? 'Error al guardar'); return }
    router.push(`/crm/clientes/${id}`)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    )
  }

  if (!cliente || !id) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-gray-500">{error ?? 'Cliente no encontrado'}</p>
        <Link href="/crm/clientes" className="mt-3 inline-block text-sm text-blue-600 hover:underline">
          Volver a CRM
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link href={`/crm/clientes/${id}`} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <ChevronLeft size={16} /> {cliente.nombre} {cliente.apellido}
        </Link>
        <h1 className="text-lg font-semibold text-gray-900">Editar cliente</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        {/* Nombre */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Nombre <span className="text-red-500">*</span>
            </label>
            <input
              name="nombre"
              required
              defaultValue={cliente.nombre}
              maxLength={80}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Apellido paterno <span className="text-red-500">*</span>
            </label>
            <input
              name="apellido"
              required
              defaultValue={cliente.apellido}
              maxLength={80}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">Apellido materno</label>
          <input
            name="apellido_2"
            defaultValue={cliente.apellido_2 ?? ''}
            maxLength={80}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Contacto */}
        <div className="border-t border-gray-100 pt-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Contacto</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                WhatsApp <span className="text-red-500">*</span>
              </label>
              <input
                name="whatsapp"
                required
                defaultValue={cliente.whatsapp ?? ''}
                maxLength={20}
                placeholder="10 dígitos"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Teléfono contacto</label>
              <input
                name="telefono_contacto"
                defaultValue={cliente.telefono_contacto ?? ''}
                maxLength={20}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Teléfono alterno</label>
              <input
                name="telefono_alterno"
                defaultValue={cliente.telefono_alterno ?? ''}
                maxLength={20}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Email */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Email principal</label>
            <input
              name="email"
              type="email"
              defaultValue={cliente.email ?? ''}
              maxLength={120}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Email secundario</label>
            <input
              name="email_2"
              type="email"
              defaultValue={cliente.email_2 ?? ''}
              maxLength={120}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Notas */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">Notas internas</label>
          <textarea
            name="notas"
            defaultValue={cliente.notas ?? ''}
            rows={3}
            maxLength={500}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
          <Link
            href={`/crm/clientes/${id}`}
            className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  )
}
