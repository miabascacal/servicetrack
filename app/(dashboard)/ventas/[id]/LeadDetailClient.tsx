'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Edit2, Save, X, Phone, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { updateLeadEstadoAction, updateLeadAction } from '@/app/actions/ventas'
import type { LeadFull } from './page'

type EstadoLead = 'nuevo' | 'contactado' | 'cotizado' | 'negociando' | 'cerrado_ganado' | 'cerrado_perdido'

const ESTADOS: { value: EstadoLead; label: string; color: string; bg: string }[] = [
  { value: 'nuevo',           label: 'Nuevo',       color: 'text-gray-700',   bg: 'bg-gray-100 border-gray-300' },
  { value: 'contactado',      label: 'Contactado',  color: 'text-blue-700',   bg: 'bg-blue-100 border-blue-300' },
  { value: 'cotizado',        label: 'Cotizado',    color: 'text-yellow-700', bg: 'bg-yellow-100 border-yellow-300' },
  { value: 'negociando',      label: 'Negociando',  color: 'text-orange-700', bg: 'bg-orange-100 border-orange-300' },
  { value: 'cerrado_ganado',  label: 'Ganado',      color: 'text-green-700',  bg: 'bg-green-100 border-green-300' },
  { value: 'cerrado_perdido', label: 'Perdido',     color: 'text-red-700',    bg: 'bg-red-100 border-red-300' },
]

const FUENTE_OPCIONES = [
  { value: 'manual', label: 'Manual' }, { value: 'organico', label: 'Orgánico' },
  { value: 'recomendacion', label: 'Recomendación' }, { value: 'campana', label: 'Campaña' },
  { value: 'walk_in', label: 'Walk-in' }, { value: 'web', label: 'Web' }, { value: 'otro', label: 'Otro' },
]

export default function LeadDetailClient({ lead }: { lead: LeadFull }) {
  const router = useRouter()
  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [moviendo, setMoviendo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const estadoActual = ESTADOS.find(e => e.value === lead.estado) ?? ESTADOS[0]
  const displayName = lead.cliente
    ? `${lead.cliente.nombre} ${lead.cliente.apellido}`
    : lead.nombre ?? 'Sin nombre'

  async function moverEstado(nuevoEstado: EstadoLead) {
    setMoviendo(nuevoEstado)
    setError(null)
    const result = await updateLeadEstadoAction(lead.id, nuevoEstado)
    if (result?.error) setError(result.error)
    else router.refresh()
    setMoviendo(null)
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const result = await updateLeadAction(lead.id, new FormData(e.currentTarget))
    if (result?.error) { setError(result.error); setSaving(false) }
    else { setEditMode(false); setSaving(false); router.refresh() }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/ventas" className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors">
            <ChevronLeft size={18} />
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{displayName}</h1>
            <span className={cn('text-xs px-2 py-0.5 rounded-full border font-medium', estadoActual.bg, estadoActual.color)}>
              {estadoActual.label}
            </span>
          </div>
        </div>
        <button
          onClick={() => setEditMode(!editMode)}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
        >
          {editMode ? <><X size={14} /> Cancelar</> : <><Edit2 size={14} /> Editar</>}
        </button>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg">{error}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: contact + pipeline */}
        <div className="space-y-4">
          {/* Contact */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
            <h2 className="text-sm font-semibold text-gray-900">Contacto</h2>
            {lead.cliente ? (
              <Link href={`/crm/clientes/${lead.cliente.id}`} className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
                <User size={13} />
                {lead.cliente.nombre} {lead.cliente.apellido}
              </Link>
            ) : lead.nombre && (
              <p className="text-sm text-gray-700 flex items-center gap-2"><User size={13} className="text-gray-400" />{lead.nombre}</p>
            )}
            {lead.whatsapp && (
              <a href={`https://wa.me/${lead.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-green-600 hover:underline">
                <Phone size={13} />{lead.whatsapp}
              </a>
            )}
            {lead.email && <p className="text-xs text-gray-500">{lead.email}</p>}
            {lead.asesor && (
              <p className="text-xs text-gray-400">Asesor: {lead.asesor.nombre} {lead.asesor.apellido}</p>
            )}
          </div>

          {/* Pipeline */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-2">
            <h2 className="text-sm font-semibold text-gray-900">Mover a etapa</h2>
            <div className="flex flex-col gap-1.5">
              {ESTADOS.map(e => (
                <button
                  key={e.value}
                  onClick={() => moverEstado(e.value)}
                  disabled={e.value === lead.estado || !!moviendo}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-all text-left',
                    e.value === lead.estado
                      ? `${e.bg} ${e.color} cursor-default font-bold`
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 disabled:opacity-40'
                  )}
                >
                  <span className={cn('w-2 h-2 rounded-full shrink-0', e.value === lead.estado ? 'bg-current' : 'bg-gray-300')} />
                  {e.label}
                  {moviendo === e.value && <span className="ml-auto text-gray-400">...</span>}
                  {e.value === lead.estado && <span className="ml-auto text-[10px] opacity-60">actual</span>}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: details / edit form */}
        <div className="lg:col-span-2">
          {editMode ? (
            <form onSubmit={handleSave} className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
              <h2 className="text-sm font-semibold text-gray-900">Editar datos</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Nombre</label>
                  <input name="nombre" defaultValue={lead.nombre ?? ''} type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">WhatsApp</label>
                  <input name="whatsapp" defaultValue={lead.whatsapp ?? ''} type="tel"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                  <input name="email" defaultValue={lead.email ?? ''} type="email"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Fuente</label>
                  <select name="fuente" defaultValue={lead.fuente ?? 'manual'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                    {FUENTE_OPCIONES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Vehículo de interés</label>
                  <input name="vehiculo_interes" defaultValue={lead.vehiculo_interes ?? ''} type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Presupuesto ($)</label>
                  <input name="presupuesto_estimado" defaultValue={lead.presupuesto_estimado ?? ''} type="number" min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Necesidad</label>
                <textarea name="necesidad" defaultValue={lead.necesidad ?? ''} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Notas internas</label>
                <textarea name="notas" defaultValue={lead.notas ?? ''} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setEditMode(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
                <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                  <Save size={14} />{saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
              <h2 className="text-sm font-semibold text-gray-900">Detalle del lead</h2>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {lead.vehiculo_interes && (
                  <div><p className="text-xs text-gray-500">Vehículo de interés</p><p className="font-medium text-gray-900">{lead.vehiculo_interes}</p></div>
                )}
                {lead.presupuesto_estimado && (
                  <div><p className="text-xs text-gray-500">Presupuesto</p><p className="font-medium text-green-700">${lead.presupuesto_estimado.toLocaleString('es-MX')}</p></div>
                )}
                {lead.fuente && (
                  <div><p className="text-xs text-gray-500">Fuente</p><p className="text-gray-700">{lead.fuente}</p></div>
                )}
                <div><p className="text-xs text-gray-500">Registrado</p><p className="text-gray-700">{new Date(lead.creado_at).toLocaleDateString('es-MX')}</p></div>
              </div>
              {lead.necesidad && (
                <div><p className="text-xs text-gray-500 mb-1">Necesidad</p><p className="text-sm text-gray-700">{lead.necesidad}</p></div>
              )}
              {lead.notas && (
                <div><p className="text-xs text-gray-500 mb-1">Notas internas</p><p className="text-sm text-gray-700 whitespace-pre-wrap">{lead.notas}</p></div>
              )}
              {!lead.vehiculo_interes && !lead.necesidad && !lead.notas && (
                <p className="text-sm text-gray-400 italic">Sin detalle adicional — usa Editar para completar</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
