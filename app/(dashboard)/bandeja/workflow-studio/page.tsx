import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, Zap, Pause, ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ToggleRuleButton } from './ToggleRuleButton'

const TRIGGER_LABELS: Record<string, string> = {
  cita_confirmada:   'Cita confirmada',
  cita_cancelada:    'Cita cancelada',
  cita_no_show:      'Cita no-show',
  ot_creada:         'OT creada',
  ot_estado_cambio:  'OT cambio de estado',
  ot_entregada:      'OT entregada',
  lead_creado:       'Lead creado',
  lead_estado_cambio:'Lead cambio de estado',
  csi_respondida:    'CSI respondida',
  manual:            'Manual',
}

type RuleRow = {
  id: string
  nombre: string
  descripcion: string | null
  trigger_tipo: string
  activa: boolean
  ejecuciones_total: number
  ultima_ejecucion_at: string | null
  acciones: unknown[]
}

export default async function WorkflowStudioPage() {
  const supabase = await createClient()

  const { data: rules } = await supabase
    .from('automation_rules')
    .select('id, nombre, descripcion, trigger_tipo, activa, ejecuciones_total, ultima_ejecucion_at, acciones')
    .order('creada_at', { ascending: false })

  const rows = (rules as unknown as RuleRow[]) ?? []
  const activas = rows.filter(r => r.activa).length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/bandeja" className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors">
          <ChevronLeft size={18} />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-gray-900">Workflow Studio</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {rows.length} regla{rows.length !== 1 ? 's' : ''} · {activas} activa{activas !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          href="/bandeja/workflow-studio/nueva"
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          <Plus size={16} />
          Nueva regla
        </Link>
      </div>

      {/* Empty state */}
      {rows.length === 0 && (
        <div className="flex flex-col items-center justify-center h-64 bg-gray-50 rounded-xl border border-dashed border-gray-300">
          <Zap size={32} className="text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-500">Sin reglas configuradas</p>
          <p className="text-xs text-gray-400 mt-1 mb-4">Crea tu primera regla de automatización</p>
          <Link
            href="/bandeja/workflow-studio/nueva"
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <Plus size={14} />
            Crear primera regla
          </Link>
        </div>
      )}

      {/* Rules list */}
      {rows.length > 0 && (
        <div className="space-y-3">
          {rows.map(rule => {
            const accionesCount = Array.isArray(rule.acciones) ? rule.acciones.length : 0
            return (
              <div
                key={rule.id}
                className={cn(
                  'bg-white rounded-xl border p-5 flex items-start gap-4',
                  rule.activa ? 'border-gray-200' : 'border-gray-100 opacity-70'
                )}
              >
                {/* Icon */}
                <div className={cn(
                  'w-10 h-10 rounded-xl shrink-0 flex items-center justify-center',
                  rule.activa ? 'bg-green-100' : 'bg-gray-100'
                )}>
                  {rule.activa
                    ? <Zap size={18} className="text-green-600" />
                    : <Pause size={18} className="text-gray-400" />
                  }
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-gray-900">{rule.nombre}</h3>
                    {rule.activa
                      ? <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-green-100 text-green-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />Activa
                        </span>
                      : <span className="px-2 py-0.5 rounded-full text-[11px] bg-gray-100 text-gray-500">Pausada</span>
                    }
                  </div>

                  {rule.descripcion && (
                    <p className="text-sm text-gray-500 mt-0.5">{rule.descripcion}</p>
                  )}

                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                    <span>Trigger: <span className="text-gray-600 font-medium">{TRIGGER_LABELS[rule.trigger_tipo] ?? rule.trigger_tipo}</span></span>
                    <span>{accionesCount} acción{accionesCount !== 1 ? 'es' : ''}</span>
                    <span>{rule.ejecuciones_total} ejecucion{rule.ejecuciones_total !== 1 ? 'es' : ''}</span>
                  </div>
                </div>

                {/* Toggle */}
                <ToggleRuleButton id={rule.id} activa={rule.activa} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
