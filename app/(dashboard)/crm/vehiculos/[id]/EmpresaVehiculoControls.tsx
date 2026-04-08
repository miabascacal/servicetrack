'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Building2, Plus, X, Search, Unlink, Loader2, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  vincularEmpresaVehiculoAction,
  desvincularEmpresaVehiculoAction,
} from '@/app/actions/vehiculos'

interface EmpresaInfo { id: string; nombre: string; rfc: string | null }

export function EmpresaVehiculoSection({
  vehiculoId,
  empresa,
}: {
  vehiculoId: string
  empresa: EmpresaInfo | null
}) {
  const router = useRouter()
  const [modal, setModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [resultados, setResultados] = useState<EmpresaInfo[]>([])
  const [buscando, setBuscando] = useState(false)

  useEffect(() => {
    if (!q || q.length < 2) { setResultados([]); return }
    const t = setTimeout(async () => {
      setBuscando(true)
      const supabase = createClient()
      const { data } = await supabase
        .from('empresas').select('id, nombre, rfc')
        .or(`nombre.ilike.%${q}%,rfc.ilike.%${q}%`)
        .eq('activo', true).limit(8)
      setResultados(data ?? [])
      setBuscando(false)
    }, 250)
    return () => clearTimeout(t)
  }, [q])

  async function vincular(emp: EmpresaInfo) {
    setLoading(true); setError(null)
    const res = await vincularEmpresaVehiculoAction(vehiculoId, emp.id)
    setLoading(false)
    if ('error' in res) { setError(res.error ?? 'Error'); return }
    setModal(false); router.refresh()
  }

  async function desvincular() {
    if (!confirm('¿Desvincular esta empresa del vehículo?')) return
    setLoading(true)
    const res = await desvincularEmpresaVehiculoAction(vehiculoId)
    setLoading(false)
    if ('error' in res) { alert(res.error); return }
    router.refresh()
  }

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Empresa</h2>
          {empresa ? (
            <button onClick={desvincular} disabled={loading}
              className="flex items-center gap-1 text-xs text-red-500 hover:bg-red-50 px-2 py-1 rounded transition-colors disabled:opacity-50">
              <Unlink size={12} /> Desvincular
            </button>
          ) : (
            <button onClick={() => { setModal(true); setQ(''); setError(null) }}
              className="flex items-center gap-1 text-xs text-blue-600 hover:bg-blue-50 px-2 py-1 rounded transition-colors">
              <Plus size={13} /> Vincular
            </button>
          )}
        </div>

        {empresa ? (
          <Link href={`/crm/empresas/${empresa.id}`}
            className="flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition-colors group">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-700 text-sm font-bold shrink-0">
              {empresa.nombre[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors truncate">
                {empresa.nombre}
              </p>
              {empresa.rfc && <p className="text-xs text-gray-400 font-mono">{empresa.rfc}</p>}
            </div>
            <ChevronRight size={14} className="text-gray-300 group-hover:text-indigo-400 shrink-0" />
          </Link>
        ) : (
          <div className="px-5 py-8 text-center">
            <Building2 size={22} className="mx-auto text-gray-300 mb-2" />
            <p className="text-xs text-gray-500 mb-3">Sin empresa vinculada</p>
            <button onClick={() => { setModal(true); setQ(''); setError(null) }}
              className="text-xs text-blue-600 hover:underline">
              + Vincular empresa
            </button>
          </div>
        )}
      </div>

      {modal && (
        <Modal title="Vincular empresa" onClose={() => setModal(false)}>
          <div className="relative mb-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input autoFocus value={q} onChange={e => setQ(e.target.value)}
              placeholder="Buscar por nombre o RFC..."
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          {buscando && <p className="text-xs text-gray-400 text-center py-2">Buscando...</p>}
          {resultados.length > 0 && (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {resultados.map(emp => (
                <button key={emp.id} onClick={() => vincular(emp)} disabled={loading}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:border-blue-300 hover:bg-blue-50 transition-all text-left disabled:opacity-60">
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-bold shrink-0">
                    {emp.nombre[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{emp.nombre}</p>
                    {emp.rfc && <p className="text-xs text-gray-400 font-mono">{emp.rfc}</p>}
                  </div>
                  {loading && <Loader2 size={13} className="animate-spin text-gray-400 shrink-0" />}
                </button>
              ))}
            </div>
          )}
          {q.length >= 2 && !buscando && resultados.length === 0 && (
            <p className="text-xs text-gray-500 text-center py-3">No se encontró &ldquo;{q}&rdquo;</p>
          )}
          {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg mt-3">{error}</p>}
        </Modal>
      )}
    </>
  )
}

function Modal({ title, onClose, children }: {
  title: string; onClose: () => void; children: React.ReactNode
}) {
  const overlayRef = useRef<HTMLDivElement>(null)
  function handleOverlay(e: React.MouseEvent) { if (e.target === overlayRef.current) onClose() }
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div ref={overlayRef} onClick={handleOverlay}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}
