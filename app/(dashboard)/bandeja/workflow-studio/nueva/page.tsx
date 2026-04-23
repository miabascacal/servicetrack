'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Plus, Trash2, Save } from 'lucide-react'
import { createAutomationRuleAction } from '@/app/actions/automatizaciones'

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
  { value: 'enviar_wa',          label: 'Enviar WhatsApp' },
  { value: 'enviar_email',       label: 'Enviar email' },
  { value: 'crear_actividad',    label: 'Crear actividad CRM' },
  { value: 'cambiar_estado',     label: 'Cambiar estado' },
  { value: 'notificar_usuario',  label: 'Notificar a usuario' },
]

type Accion = { tipo: string; mensaje?: string; nota?: string }

export default function NuevaReglaPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [acciones, setAcciones] = useState<Accion[]>([{ tipo: 'enviar_wa', mensaje: '' }])

  function addAccion() {
    setAcciones(prev => [...prev, { tipo: 'enviar_wa', mensaje: '' }])
  }

  function removeAccion(idx: number) {
    setAcciones(prev => prev.filter((_, i) => i !== idx))
  }

  function updateAccion(idx: number, field: keyof Accion, value: string) {
    setAcciones(prev => prev.map((a, i) => i === idx ? { ...a, [field]: value } : a))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const formData = new FormData(e.currentTarget)
    formData.set('acciones', JSON.stringify(acciones))
    const result = await createAutomationRuleAction(formData)
    if (result?.error) { setError(result.error); setSaving(false) }
    else router.push('/bandeja/workflow-studio')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/bandeja/workflow-studio" className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors">
          <ChevronLeft size={18} />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-gray-900">Nueva Regla</h1>
          <p className="text-sm text-gray-500 mt-0.5">Define qué dispara la regla y qué acciones ejecuta</p>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          <Save size={16} />
          {saving ? 'Guardando...' : 'Guardar regla'}
        </button>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg">{error}</p>}

      {/* Basic info */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Información</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nombre <span className="text-red-500">*</span></label>
          <input
            name="nombre"
            type="text"
            required
            placeholder="Ej: Recordatorio 24h antes de cita"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
          <textarea
            name="descripcion"
            rows={2}
            placeholder="Qué hace esta regla y cuándo aplica..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
        </div>
      </div>

      {/* Trigger */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Trigger — ¿qué lo dispara?</h2>
        <select
          name="trigger_tipo"
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Seleccionar evento...</option>
          {TRIGGER_OPCIONES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {/* Actions */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Acciones</h2>
          <button
            type="button"
            onClick={addAccion}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-indigo-600 border border-indigo-300 rounded-lg hover:bg-indigo-50 transition-colors"
          >
            <Plus size={13} />
            Añadir acción
          </button>
        </div>

        {acciones.map((accion, idx) => (
          <div key={idx} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
              {idx + 1}
            </div>
            <div className="flex-1 space-y-2">
              <select
                value={accion.tipo}
                onChange={e => updateAccion(idx, 'tipo', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                {ACCION_TIPOS.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              {(accion.tipo === 'enviar_wa' || accion.tipo === 'enviar_email') && (
                <textarea
                  value={accion.mensaje ?? ''}
                  onChange={e => updateAccion(idx, 'mensaje', e.target.value)}
                  rows={2}
                  placeholder="Mensaje a enviar... (usa {nombre}, {fecha_cita})"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none bg-white"
                />
              )}
              {accion.tipo === 'crear_actividad' && (
                <input
                  value={accion.nota ?? ''}
                  onChange={e => updateAccion(idx, 'nota', e.target.value)}
                  placeholder="Descripción de la actividad a crear..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                />
              )}
            </div>
            {acciones.length > 1 && (
              <button
                type="button"
                onClick={() => removeAccion(idx)}
                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
      </div>
    </form>
  )
}
