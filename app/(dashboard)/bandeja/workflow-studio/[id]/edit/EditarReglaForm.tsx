'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Plus, Trash2, Save } from 'lucide-react'
import { updateAutomationRuleAction } from '@/app/actions/automatizaciones'
import type { RuleData } from './page'

const TRIGGER_OPCIONES = [
  { value: 'cita_confirmada',    label: 'Cita confirmada' },
  { value: 'cita_cancelada',     label: 'Cita cancelada' },
  { value: 'cita_no_show',       label: 'Cita no-show' },
  { value: 'ot_creada',          label: 'OT creada' },
  { value: 'ot_estado_cambio',   label: 'OT cambio de estado' },
  { value: 'ot_entregada',       label: 'OT entregada' },
  { value: 'lead_creado',        label: 'Lead creado' },
  { value: 'lead_estado_cambio', label: 'Lead cambio de estado' },
  { value: 'csi_respondida',     label: 'CSI respondida' },
  { value: 'manual',             label: 'Manual' },
]

const ACCION_TIPOS = [
  { value: 'enviar_wa',         label: 'Enviar WhatsApp' },
  { value: 'enviar_email',      label: 'Enviar email' },
  { value: 'crear_actividad',   label: 'Crear actividad CRM' },
  { value: 'cambiar_estado',    label: 'Cambiar estado' },
  { value: 'notificar_usuario', label: 'Notificar a usuario' },
]

type Accion = { tipo: string; mensaje?: string; nota?: string }

export default function EditarReglaForm({ rule }: { rule: RuleData }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [acciones, setAcciones] = useState<Accion[]>(
    Array.isArray(rule.acciones) && rule.acciones.length > 0
      ? (rule.acciones as Accion[])
      : [{ tipo: 'enviar_wa', mensaje: '' }]
  )

  function addAccion() { setAcciones(prev => [...prev, { tipo: 'enviar_wa', mensaje: '' }]) }
  function removeAccion(idx: number) { setAcciones(prev => prev.filter((_, i) => i !== idx)) }
  function updateAccion(idx: number, field: keyof Accion, value: string) {
    setAcciones(prev => prev.map((a, i) => i === idx ? { ...a, [field]: value } : a))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const formData = new FormData(e.currentTarget)
    formData.set('acciones', JSON.stringify(acciones))
    const result = await updateAutomationRuleAction(rule.id, formData)
    if (result?.error) { setError(result.error); setSaving(false) }
    else router.push('/bandeja/workflow-studio')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/bandeja/workflow-studio" className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors">
          <ChevronLeft size={18} />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-gray-900">Editar Regla</h1>
          <p className="text-sm text-gray-500 mt-0.5">Modifica trigger y acciones de esta automatización</p>
        </div>
        <button type="submit" disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
          <Save size={16} />{saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg">{error}</p>}

      <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Información</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nombre <span className="text-red-500">*</span></label>
          <input name="nombre" type="text" required defaultValue={rule.nombre}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
          <textarea name="descripcion" rows={2} defaultValue={rule.descripcion ?? ''}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Trigger</h2>
        <select name="trigger_tipo" required defaultValue={rule.trigger_tipo}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">Seleccionar evento...</option>
          {TRIGGER_OPCIONES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Acciones</h2>
          <button type="button" onClick={addAccion}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-indigo-600 border border-indigo-300 rounded-lg hover:bg-indigo-50 transition-colors">
            <Plus size={13} />Añadir acción
          </button>
        </div>
        {acciones.map((accion, idx) => (
          <div key={idx} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">{idx + 1}</div>
            <div className="flex-1 space-y-2">
              <select value={accion.tipo} onChange={e => updateAccion(idx, 'tipo', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                {ACCION_TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              {(accion.tipo === 'enviar_wa' || accion.tipo === 'enviar_email') && (
                <textarea value={accion.mensaje ?? ''} onChange={e => updateAccion(idx, 'mensaje', e.target.value)}
                  rows={2} placeholder="Mensaje a enviar... (usa {nombre}, {fecha_cita})"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none bg-white" />
              )}
              {accion.tipo === 'crear_actividad' && (
                <input value={accion.nota ?? ''} onChange={e => updateAccion(idx, 'nota', e.target.value)}
                  placeholder="Descripción de la actividad a crear..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
              )}
            </div>
            {acciones.length > 1 && (
              <button type="button" onClick={() => removeAccion(idx)}
                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0">
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
      </div>
    </form>
  )
}
