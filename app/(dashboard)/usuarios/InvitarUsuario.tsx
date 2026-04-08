'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, Mail } from 'lucide-react'
import { invitarUsuarioAction } from '@/app/actions/usuarios'

const ROLES = [
  { value: 'admin',             label: 'Administrador' },
  { value: 'gerente',           label: 'Gerente' },
  { value: 'asesor_servicio',   label: 'Asesor de Servicio' },
  { value: 'asesor_ventas',     label: 'Asesor de Ventas' },
  { value: 'encargada_citas',   label: 'Encargada de Citas' },
  { value: 'refacciones',       label: 'Refacciones' },
  { value: 'tecnico',           label: 'Técnico' },
  { value: 'mk_atencion',       label: 'MK / Atención a Clientes' },
  { value: 'viewer',            label: 'Solo lectura' },
]

export function InvitarUsuario() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const result = await invitarUsuarioAction(new FormData(e.currentTarget))
    if (result?.error) {
      setError(result.error)
      setSaving(false)
    } else {
      setSuccess(`Invitación enviada a ${result.email}`)
      setSaving(false)
      router.refresh()
      setTimeout(() => { setOpen(false); setSuccess(null) }, 2000)
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-blue-200">
        <Plus size={14} />
        Invitar usuario
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Mail size={16} className="text-blue-600" />
            <h2 className="text-base font-semibold text-gray-900">Invitar usuario</h2>
          </div>
          <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          {success && <p className="text-sm text-green-600 bg-green-50 px-3 py-2 rounded-lg">{success}</p>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Nombre <span className="text-red-500">*</span></label>
              <input name="nombre" required type="text" placeholder="Juan"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Apellido</label>
              <input name="apellido" type="text" placeholder="Pérez"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
            <input name="email" required type="email" placeholder="juan@empresa.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <p className="text-xs text-gray-400 mt-1">Le llegará un email con acceso a la plataforma</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Rol</label>
            <select name="rol" defaultValue="asesor_servicio"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={() => setOpen(false)}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-blue-400 transition-colors">
              {saving ? 'Enviando...' : 'Enviar invitación'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
