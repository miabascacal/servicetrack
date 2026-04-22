'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Save } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ModuloPermiso } from '@/types/database'
import { updateRolPermisosAction } from '@/app/actions/roles'

const MODULOS: { key: ModuloPermiso; label: string; descripcion: string }[] = [
  { key: 'crm',             label: 'CRM',                 descripcion: 'Clientes, vehículos, empresas' },
  { key: 'citas',           label: 'Citas',               descripcion: 'Agenda y gestión de citas' },
  { key: 'taller',          label: 'Taller',              descripcion: 'Órdenes de trabajo' },
  { key: 'refacciones',     label: 'Refacciones',         descripcion: 'Catálogo y cotizaciones' },
  { key: 'ventas',          label: 'Ventas',              descripcion: 'Pipeline y leads' },
  { key: 'bandeja',         label: 'Bandeja + IA',        descripcion: 'Mensajes unificados' },
  { key: 'atencion_clientes', label: 'Atención a Clientes', descripcion: 'Quejas y seguimiento' },
  { key: 'csi',             label: 'CSI',                 descripcion: 'Encuestas de satisfacción' },
  { key: 'seguros',         label: 'Seguros',             descripcion: 'Pólizas vehiculares' },
  { key: 'usuarios',        label: 'Usuarios',            descripcion: 'Gestión de accesos' },
  { key: 'reportes',        label: 'Reportes',            descripcion: 'Exportación y análisis' },
]

const PERMISOS_COLS = [
  { key: 'puede_ver'      as const, label: 'Ver' },
  { key: 'puede_crear'    as const, label: 'Crear' },
  { key: 'puede_editar'   as const, label: 'Editar' },
  { key: 'puede_eliminar' as const, label: 'Eliminar' },
  { key: 'puede_exportar' as const, label: 'Exportar' },
]

type PermisoRow = {
  puede_ver: boolean
  puede_crear: boolean
  puede_editar: boolean
  puede_eliminar: boolean
  puede_exportar: boolean
}

interface Props {
  rolId:     string
  rolNombre: string
  esSuperAdmin: boolean
  initialPermisos: Record<ModuloPermiso, PermisoRow>
}

export function EditRolClient({ rolId, rolNombre, esSuperAdmin, initialPermisos }: Props) {
  const router = useRouter()
  const [permisos, setPermisos] = useState<Record<ModuloPermiso, PermisoRow>>(initialPermisos)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  function toggle(modulo: ModuloPermiso, campo: keyof PermisoRow) {
    setPermisos((prev) => {
      const next = { ...prev[modulo], [campo]: !prev[modulo][campo] }
      if (campo === 'puede_ver' && !next.puede_ver) {
        next.puede_crear = false
        next.puede_editar = false
        next.puede_eliminar = false
        next.puede_exportar = false
      }
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
    setSaving(true)
    setError(null)
    setSaved(false)
    const result = await updateRolPermisosAction(rolId, permisos)
    if (result?.error) {
      setError(result.error)
      setSaving(false)
    } else {
      setSaved(true)
      setSaving(false)
      router.refresh()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/usuarios/roles"
          className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ChevronLeft size={18} />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-gray-900">{rolNombre}</h1>
          <p className="text-sm text-gray-500 mt-0.5">Editar permisos por módulo</p>
        </div>
        <button
          type="submit"
          disabled={saving || esSuperAdmin}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-blue-400 transition-colors"
        >
          <Save size={16} />
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg">{error}</p>
      )}
      {saved && (
        <p className="text-sm text-green-600 bg-green-50 px-4 py-3 rounded-lg">Permisos guardados correctamente</p>
      )}

      {esSuperAdmin ? (
        <div className="bg-purple-50 rounded-lg border border-purple-200 px-5 py-4 text-sm text-purple-700">
          Este rol tiene acceso total a todos los módulos. Los permisos individuales no aplican para roles Super Admin.
        </div>
      ) : (
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
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase w-52">Módulo</th>
                  {PERMISOS_COLS.map(({ label }) => (
                    <th key={label} className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                      {label}
                    </th>
                  ))}
                  <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Todo</th>
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
      )}
    </form>
  )
}
