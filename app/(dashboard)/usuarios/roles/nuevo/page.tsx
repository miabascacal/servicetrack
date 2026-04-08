'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Save } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ModuloPermiso } from '@/types/database'
import { createRolAction } from '@/app/actions/roles'

const MODULOS: { key: ModuloPermiso; label: string; descripcion: string }[] = [
  { key: 'crm', label: 'CRM', descripcion: 'Clientes, vehículos, empresas' },
  { key: 'citas', label: 'Citas', descripcion: 'Agenda y gestión de citas' },
  { key: 'taller', label: 'Taller', descripcion: 'Órdenes de trabajo' },
  { key: 'refacciones', label: 'Refacciones', descripcion: 'Catálogo y cotizaciones' },
  { key: 'ventas', label: 'Ventas', descripcion: 'Pipeline y leads' },
  { key: 'bandeja', label: 'Bandeja + IA', descripcion: 'Mensajes unificados' },
  { key: 'atencion_clientes', label: 'Atención a Clientes', descripcion: 'Quejas y seguimiento' },
  { key: 'csi', label: 'CSI', descripcion: 'Encuestas de satisfacción' },
  { key: 'seguros', label: 'Seguros', descripcion: 'Pólizas vehiculares' },
  { key: 'usuarios', label: 'Usuarios', descripcion: 'Gestión de accesos' },
  { key: 'reportes', label: 'Reportes', descripcion: 'Exportación y análisis' },
]

type PermisoRow = {
  puede_ver: boolean
  puede_crear: boolean
  puede_editar: boolean
  puede_eliminar: boolean
  puede_exportar: boolean
}

function emptyPermiso(): PermisoRow {
  return {
    puede_ver: false,
    puede_crear: false,
    puede_editar: false,
    puede_eliminar: false,
    puede_exportar: false,
  }
}

export default function NuevoRolPage() {
  const router = useRouter()
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [permisos, setPermisos] = useState<Record<ModuloPermiso, PermisoRow>>(
    () =>
      Object.fromEntries(MODULOS.map(({ key }) => [key, emptyPermiso()])) as Record<
        ModuloPermiso,
        PermisoRow
      >
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggle(modulo: ModuloPermiso, campo: keyof PermisoRow) {
    setPermisos((prev) => {
      const next = { ...prev[modulo], [campo]: !prev[modulo][campo] }
      // Si desactivan ver, desactivar todo lo demás
      if (campo === 'puede_ver' && !next.puede_ver) {
        next.puede_crear = false
        next.puede_editar = false
        next.puede_eliminar = false
        next.puede_exportar = false
      }
      // Si activan cualquier acción, activar ver automáticamente
      if (campo !== 'puede_ver' && next[campo]) {
        next.puede_ver = true
      }
      return { ...prev, [modulo]: next }
    })
  }

  function toggleAll(modulo: ModuloPermiso, value: boolean) {
    setPermisos((prev) => ({
      ...prev,
      [modulo]: {
        puede_ver: value,
        puede_crear: value,
        puede_editar: value,
        puede_eliminar: value,
        puede_exportar: value,
      },
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nombre.trim()) {
      setError('El nombre del rol es requerido')
      return
    }
    setSaving(true)
    setError(null)

    const result = await createRolAction({ nombre, descripcion, permisos })
    if (result?.error) {
      setError(result.error)
      setSaving(false)
    } else {
      router.push('/usuarios/roles')
    }
  }

  const PERMISOS_COLS: { key: keyof PermisoRow; label: string }[] = [
    { key: 'puede_ver', label: 'Ver' },
    { key: 'puede_crear', label: 'Crear' },
    { key: 'puede_editar', label: 'Editar' },
    { key: 'puede_eliminar', label: 'Eliminar' },
    { key: 'puede_exportar', label: 'Exportar' },
  ]

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/usuarios/roles"
          className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ChevronLeft size={18} />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-gray-900">Nuevo Rol</h1>
          <p className="text-sm text-gray-500 mt-0.5">Define nombre y permisos por módulo</p>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-blue-400 transition-colors"
        >
          <Save size={16} />
          {saving ? 'Guardando...' : 'Guardar Rol'}
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg">{error}</p>
      )}

      {/* Basic info */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Información del rol</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Asesor de Servicio"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descripción
            </label>
            <input
              type="text"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Ej: Puede ver y crear citas y OTs"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Permissions matrix */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">Permisos por módulo</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Activa Ver para dar acceso a un módulo. Las demás acciones requieren Ver activo.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase w-52">
                  Módulo
                </th>
                {PERMISOS_COLS.map(({ label }) => (
                  <th
                    key={label}
                    className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase"
                  >
                    {label}
                  </th>
                ))}
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                  Todo
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {MODULOS.map(({ key, label, descripcion: desc }) => {
                const p = permisos[key]
                const allEnabled = Object.values(p).every(Boolean)
                return (
                  <tr key={key} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-900 text-sm">{label}</p>
                      <p className="text-xs text-gray-500">{desc}</p>
                    </td>
                    {PERMISOS_COLS.map(({ key: campo }) => (
                      <td key={campo} className="text-center px-4 py-3">
                        <button
                          type="button"
                          onClick={() => toggle(key, campo)}
                          className={cn(
                            'w-5 h-5 rounded border-2 transition-all',
                            p[campo]
                              ? 'bg-blue-600 border-blue-600'
                              : 'bg-white border-gray-300 hover:border-blue-400',
                            campo !== 'puede_ver' && !p.puede_ver && 'opacity-30 cursor-not-allowed'
                          )}
                          disabled={campo !== 'puede_ver' && !p.puede_ver}
                        >
                          {p[campo] && (
                            <svg viewBox="0 0 10 8" className="w-full p-0.5 text-white fill-white">
                              <path d="M1 4l3 3 5-5" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </button>
                      </td>
                    ))}
                    <td className="text-center px-4 py-3">
                      <button
                        type="button"
                        onClick={() => toggleAll(key, !allEnabled)}
                        className={cn(
                          'px-2 py-0.5 rounded text-xs font-medium transition-colors',
                          allEnabled
                            ? 'bg-red-100 text-red-600 hover:bg-red-200'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        )}
                      >
                        {allEnabled ? 'Quitar todo' : 'Todo'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </form>
  )
}
