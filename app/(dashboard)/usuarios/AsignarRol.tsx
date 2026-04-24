'use client'

import { useState, useTransition } from 'react'
import { Plus, X } from 'lucide-react'
import { asignarRolAction, removerRolAction } from '@/app/actions/roles'

interface RolOpcion {
  id: string
  nombre: string
  es_super_admin: boolean
}

interface RolAsignado {
  asignacionId: string
  rolId: string
  nombre: string
  es_super_admin: boolean
}

interface Props {
  usuarioId: string
  rolesDisponibles: RolOpcion[]
  rolesAsignados: RolAsignado[]
}

export function AsignarRol({ usuarioId, rolesDisponibles, rolesAsignados }: Props) {
  const [mostrarSelect, setMostrarSelect] = useState(false)
  const [rolSeleccionado, setRolSeleccionado] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const rolesNoAsignados = rolesDisponibles.filter(
    r => !rolesAsignados.some(ra => ra.rolId === r.id)
  )

  function handleAsignar() {
    if (!rolSeleccionado) return
    startTransition(async () => {
      setMsg(null)
      const result = await asignarRolAction(usuarioId, rolSeleccionado)
      if (result?.error) setMsg(result.error)
      else { setMostrarSelect(false); setRolSeleccionado('') }
    })
  }

  function handleRemover(asignacionId: string) {
    startTransition(async () => {
      setMsg(null)
      const result = await removerRolAction(asignacionId)
      if (result?.error) setMsg(result.error)
    })
  }

  return (
    <div className="flex flex-wrap gap-1 items-center">
      {rolesAsignados.length === 0 && !mostrarSelect && (
        <span className="text-xs text-gray-400">Sin rol</span>
      )}

      {rolesAsignados.map(ra => (
        <span
          key={ra.asignacionId}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
            ra.es_super_admin ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'
          }`}
        >
          {ra.nombre}
          <button
            onClick={() => handleRemover(ra.asignacionId)}
            disabled={isPending}
            title="Quitar rol"
            className="hover:text-red-600 disabled:opacity-50 transition-colors"
          >
            <X size={10} />
          </button>
        </span>
      ))}

      {!mostrarSelect && rolesNoAsignados.length > 0 && (
        <button
          onClick={() => setMostrarSelect(true)}
          title="Asignar rol"
          className="inline-flex items-center justify-center w-5 h-5 rounded bg-gray-100 text-gray-500 hover:bg-blue-100 hover:text-blue-600 transition-colors"
        >
          <Plus size={10} />
        </button>
      )}

      {mostrarSelect && (
        <div className="flex items-center gap-1 mt-0.5">
          <select
            value={rolSeleccionado}
            onChange={e => setRolSeleccionado(e.target.value)}
            className="text-xs border border-gray-300 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Seleccionar...</option>
            {rolesNoAsignados.map(r => (
              <option key={r.id} value={r.id}>{r.nombre}</option>
            ))}
          </select>
          <button
            onClick={handleAsignar}
            disabled={!rolSeleccionado || isPending}
            className="text-xs px-2 py-0.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? '...' : 'OK'}
          </button>
          <button
            onClick={() => { setMostrarSelect(false); setRolSeleccionado('') }}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {msg && (
        <span className="text-xs text-red-600 w-full mt-0.5">{msg}</span>
      )}
    </div>
  )
}
