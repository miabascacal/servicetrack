'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Save, Loader2 } from 'lucide-react'
import { updateEmpresaAction } from '@/app/actions/empresas'
import { createClient } from '@/lib/supabase/client'

interface PageProps {
  params: Promise<{ id: string }>
}

type EmpresaData = {
  id: string
  nombre: string
  rfc: string | null
  telefono: string | null
  email: string | null
}

export default function EditarEmpresaPage({ params }: PageProps) {
  const router = useRouter()
  const [id, setId] = useState<string | null>(null)
  const [empresa, setEmpresa] = useState<EmpresaData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    params.then(({ id: empresaId }) => {
      setId(empresaId)
      const supabase = createClient()
      supabase
        .from('empresas')
        .select('id, nombre, rfc, telefono, email')
        .eq('id', empresaId)
        .single()
        .then(({ data, error: e }) => {
          if (e || !data) { setError('No se encontró la empresa'); setLoading(false); return }
          setEmpresa(data as EmpresaData)
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
    const result = await updateEmpresaAction(id, formData)
    setSaving(false)
    if ('error' in result) { setError(result.error ?? 'Error al guardar'); return }
    router.push(`/crm/empresas/${id}`)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    )
  }

  if (!empresa || !id) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-gray-500">{error ?? 'Empresa no encontrada'}</p>
        <Link href="/crm/empresas" className="mt-3 inline-block text-sm text-blue-600 hover:underline">
          Volver a Empresas
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <Link href={`/crm/empresas/${id}`} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <ChevronLeft size={16} /> {empresa.nombre}
        </Link>
        <h1 className="text-lg font-semibold text-gray-900">Editar empresa</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">
            Nombre <span className="text-red-500">*</span>
          </label>
          <input
            name="nombre"
            required
            defaultValue={empresa.nombre}
            maxLength={120}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">RFC</label>
            <input
              name="rfc"
              defaultValue={empresa.rfc ?? ''}
              maxLength={13}
              placeholder="AAA010101AAA"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Teléfono</label>
            <input
              name="telefono"
              defaultValue={empresa.telefono ?? ''}
              maxLength={20}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">Email</label>
          <input
            name="email"
            type="email"
            defaultValue={empresa.email ?? ''}
            maxLength={120}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            href={`/crm/empresas/${id}`}
            className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  )
}
