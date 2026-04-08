'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Building2, Car, Plus, X, Search, Unlink, Loader2, ChevronRight, CheckCircle2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  vincularClienteEmpresaAction,
  desvincularClienteEmpresaAction,
  createEmpresaYVincularAction,
} from '@/app/actions/clientes'
import {
  addVehiculoPersonaAction,
  desvincularVehiculoClienteAction,
  vincularEmpresaVehiculoAction,
} from '@/app/actions/vehiculos'

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────
interface EmpresaInfo { id: string; nombre: string; rfc: string | null }
export interface VehiculoInfo {
  id: string; marca: string; modelo: string; anio: number
  placa: string | null; rol_vehiculo: string
}

// ─────────────────────────────────────────────────────────────────
// SECTION: Empresa
// ─────────────────────────────────────────────────────────────────

export function EmpresaSection({
  clienteId,
  empresa,
  vehiculos,          // vehículos del cliente para el prompt
}: {
  clienteId: string
  empresa: EmpresaInfo | null
  vehiculos: VehiculoInfo[]
}) {
  const router = useRouter()
  const [modal, setModal] = useState<'vincular' | 'crear' | 'preguntar_vehiculos' | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [empresaVinculada, setEmpresaVinculada] = useState<EmpresaInfo | null>(null)

  // search
  const [q, setQ] = useState('')
  const [resultados, setResultados] = useState<EmpresaInfo[]>([])
  const [buscando, setBuscando] = useState(false)

  // vehiculos seleccionados para vincular con la empresa
  const [vehiculosSeleccionados, setVehiculosSeleccionados] = useState<Set<string>>(new Set())

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

  function abrirPromptVehiculos(emp: EmpresaInfo) {
    setEmpresaVinculada(emp)
    // Pre-seleccionar todos
    setVehiculosSeleccionados(new Set(vehiculos.map(v => v.id)))
    setModal('preguntar_vehiculos')
  }

  async function vincular(emp: EmpresaInfo) {
    setLoading(true); setError(null)
    const res = await vincularClienteEmpresaAction(clienteId, emp.id)
    setLoading(false)
    if ('error' in res) { setError(res.error ?? 'Error'); return }
    // Si tiene vehículos, preguntar si también vincularlos
    if (vehiculos.length > 0) {
      abrirPromptVehiculos(emp)
    } else {
      setModal(null); router.refresh()
    }
  }

  async function confirmarVinculacionVehiculos(vincularTambien: boolean) {
    if (vincularTambien && empresaVinculada && vehiculosSeleccionados.size > 0) {
      setLoading(true)
      await Promise.all(
        Array.from(vehiculosSeleccionados).map(vid =>
          vincularEmpresaVehiculoAction(vid, empresaVinculada.id)
        )
      )
      setLoading(false)
    }
    setModal(null)
    router.refresh()
  }

  async function desvincular() {
    if (!confirm('¿Desvincular esta empresa del cliente?')) return
    setLoading(true)
    const res = await desvincularClienteEmpresaAction(clienteId)
    setLoading(false)
    if ('error' in res) { alert(res.error); return }
    router.refresh()
  }

  async function crear(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true); setError(null)
    const res = await createEmpresaYVincularAction(clienteId, new FormData(e.currentTarget))
    setLoading(false)
    if ('error' in res) { setError(res.error ?? 'Error'); return }
    const emp = { id: res.id!, nombre: res.nombre!, rfc: null }
    if (vehiculos.length > 0) {
      abrirPromptVehiculos(emp)
    } else {
      setModal(null); router.refresh()
    }
  }

  function toggleVehiculo(id: string) {
    setVehiculosSeleccionados(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Empresa</h2>
          {empresa ? (
            <button onClick={desvincular} disabled={loading}
              className="flex items-center gap-1 text-xs text-red-500 hover:bg-red-50 px-2 py-1 rounded transition-colors disabled:opacity-50">
              <Unlink size={12} /> Desvincular
            </button>
          ) : (
            <button onClick={() => { setModal('vincular'); setQ(''); setError(null) }}
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
            <button onClick={() => { setModal('vincular'); setQ(''); setError(null) }}
              className="text-xs text-blue-600 hover:underline">
              + Vincular empresa
            </button>
          </div>
        )}
      </div>

      {/* Modal: buscar empresa */}
      {modal === 'vincular' && (
        <Modal title="Vincular empresa" onClose={() => setModal(null)}>
          <div className="relative mb-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input autoFocus value={q} onChange={e => setQ(e.target.value)}
              placeholder="Buscar por nombre o RFC..."
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          {buscando && <p className="text-xs text-gray-400 text-center py-2">Buscando...</p>}
          {resultados.length > 0 && (
            <div className="space-y-1 mb-3 max-h-48 overflow-y-auto">
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
            <p className="text-xs text-gray-500 text-center py-2 mb-3">No se encontró &ldquo;{q}&rdquo;</p>
          )}
          {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg mb-3">{error}</p>}
          <button onClick={() => setModal('crear')}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors">
            <Plus size={14} /> Crear nueva empresa
          </button>
        </Modal>
      )}

      {/* Modal: crear empresa */}
      {modal === 'crear' && (
        <Modal title="Nueva empresa" onClose={() => setModal('vincular')}>
          <form onSubmit={crear} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Nombre <span className="text-red-500">*</span></label>
              <input name="nombre" required maxLength={120} autoFocus
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">RFC</label>
              <input name="rfc" maxLength={13} placeholder="AAA010101AAA"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Teléfono</label>
              <input name="telefono" maxLength={20}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setModal('vincular')}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                Atrás
              </button>
              <button type="submit" disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60">
                {loading && <Loader2 size={14} className="animate-spin" />}
                Crear y vincular
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: preguntar si vincular vehículos */}
      {modal === 'preguntar_vehiculos' && empresaVinculada && (
        <Modal title="¿Vincular también los vehículos?" onClose={() => confirmarVinculacionVehiculos(false)}>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              El cliente quedó vinculado a <span className="font-semibold">{empresaVinculada.nombre}</span>.
              ¿Deseas vincular también sus vehículos a esta empresa?
            </p>

            <div className="space-y-2">
              {vehiculos.map(v => (
                <button key={v.id} type="button"
                  onClick={() => toggleVehiculo(v.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                    vehiculosSeleccionados.has(v.id)
                      ? 'border-blue-400 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}>
                  <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 border-2 transition-colors ${
                    vehiculosSeleccionados.has(v.id) ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                  }`}>
                    {vehiculosSeleccionados.has(v.id) && <CheckCircle2 size={12} className="text-white" />}
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center shrink-0">
                    <Car size={14} className="text-orange-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{v.marca} {v.modelo} {v.anio}</p>
                    {v.placa && <p className="text-xs text-gray-400 font-mono">{v.placa}</p>}
                  </div>
                </button>
              ))}
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={() => confirmarVinculacionVehiculos(false)} disabled={loading}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                No, solo el cliente
              </button>
              <button onClick={() => confirmarVinculacionVehiculos(true)} disabled={loading || vehiculosSeleccionados.size === 0}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60">
                {loading && <Loader2 size={14} className="animate-spin" />}
                Sí, vincular {vehiculosSeleccionados.size > 0 ? `(${vehiculosSeleccionados.size})` : ''}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────────
// SECTION: Vehículos
// ─────────────────────────────────────────────────────────────────

export function VehiculosSection({
  clienteId,
  vehiculos,
}: {
  clienteId: string
  vehiculos: VehiculoInfo[]
}) {
  const router = useRouter()
  const [modal, setModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [resultados, setResultados] = useState<{ id: string; marca: string; modelo: string; anio: number; placa: string | null }[]>([])
  const [buscando, setBuscando] = useState(false)

  const vinculadosIds = new Set(vehiculos.map(v => v.id))

  useEffect(() => {
    if (!q || q.length < 2) { setResultados([]); return }
    const t = setTimeout(async () => {
      setBuscando(true)
      const supabase = createClient()
      const { data } = await supabase
        .from('vehiculos').select('id, marca, modelo, anio, placa')
        .or(`marca.ilike.%${q}%,modelo.ilike.%${q}%,placa.ilike.%${q}%,vin.ilike.%${q}%`)
        .eq('activo', true).limit(8)
      setResultados((data ?? []).filter(v => !vinculadosIds.has(v.id)))
      setBuscando(false)
    }, 250)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  async function vincular(vehiculoId: string) {
    setLoading(true); setError(null)
    const res = await addVehiculoPersonaAction(vehiculoId, clienteId, 'dueno')
    setLoading(false)
    if ('error' in res) { setError(res.error ?? 'Error'); return }
    setModal(false); setQ(''); router.refresh()
  }

  async function desvincular(vehiculoId: string, nombre: string) {
    if (!confirm(`¿Desvincular "${nombre}" de este cliente?`)) return
    setLoading(true)
    const res = await desvincularVehiculoClienteAction(vehiculoId, clienteId)
    setLoading(false)
    if ('error' in res) { alert(res.error); return }
    router.refresh()
  }

  const ROL_LABELS: Record<string, string> = { dueno: 'Dueño', conductor: 'Conductor', otro: 'Otro' }

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Vehículos <span className="text-gray-400 font-normal normal-case">({vehiculos.length})</span>
          </h2>
          <button onClick={() => { setModal(true); setQ(''); setError(null) }}
            className="flex items-center gap-1 text-xs text-blue-600 hover:bg-blue-50 px-2 py-1 rounded transition-colors">
            <Plus size={13} /> Vincular
          </button>
        </div>

        {vehiculos.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <Car size={22} className="mx-auto text-gray-300 mb-2" />
            <p className="text-xs text-gray-500 mb-3">Sin vehículos vinculados</p>
            <button onClick={() => { setModal(true); setQ(''); setError(null) }}
              className="text-xs text-blue-600 hover:underline">
              + Vincular vehículo
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {vehiculos.map((v) => (
              <li key={v.id} className="flex items-center gap-3 px-5 py-3.5 group hover:bg-gray-50 transition-colors">
                <Link href={`/crm/vehiculos/${v.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-orange-50">
                    <Car size={14} className="text-orange-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{v.marca} {v.modelo}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-gray-500">{v.anio}</span>
                      {v.placa && <span className="text-xs font-mono text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">{v.placa}</span>}
                      <span className="text-xs text-gray-400 capitalize">{ROL_LABELS[v.rol_vehiculo] ?? v.rol_vehiculo}</span>
                    </div>
                  </div>
                </Link>
                <button onClick={() => desvincular(v.id, `${v.marca} ${v.modelo}`)} disabled={loading}
                  title="Desvincular vehículo"
                  className="opacity-0 group-hover:opacity-100 p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-all disabled:opacity-30">
                  <Unlink size={13} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="px-5 py-3 border-t border-gray-100">
          <Link href={`/crm/vehiculos/nuevo?cliente_id=${clienteId}`}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 transition-colors">
            <Plus size={12} /> Crear nuevo vehículo
          </Link>
        </div>
      </div>

      {modal && (
        <Modal title="Vincular vehículo" onClose={() => setModal(false)}>
          <div className="relative mb-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input autoFocus value={q} onChange={e => setQ(e.target.value)}
              placeholder="Buscar por marca, modelo, placa o VIN..."
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          {buscando && <p className="text-xs text-gray-400 text-center py-2">Buscando...</p>}
          {resultados.length > 0 && (
            <div className="space-y-1 mb-3 max-h-52 overflow-y-auto">
              {resultados.map(v => (
                <button key={v.id} onClick={() => vincular(v.id)} disabled={loading}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:border-orange-300 hover:bg-orange-50 transition-all text-left">
                  <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center shrink-0">
                    <Car size={14} className="text-orange-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{v.marca} {v.modelo} {v.anio}</p>
                    {v.placa && <p className="text-xs text-gray-400 font-mono">{v.placa}</p>}
                  </div>
                  {loading && <Loader2 size={13} className="animate-spin text-gray-400 shrink-0" />}
                </button>
              ))}
            </div>
          )}
          {q.length >= 2 && !buscando && resultados.length === 0 && (
            <p className="text-xs text-gray-500 text-center py-2 mb-3">No se encontró &ldquo;{q}&rdquo;</p>
          )}
          {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg mb-3">{error}</p>}
          <Link href={`/crm/vehiculos/nuevo?cliente_id=${clienteId}`}
            className="flex items-center justify-center gap-2 px-4 py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-orange-400 hover:text-orange-600 transition-colors">
            <Plus size={14} /> Crear nuevo vehículo
          </Link>
        </Modal>
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────────
// Shared Modal wrapper
// ─────────────────────────────────────────────────────────────────
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
