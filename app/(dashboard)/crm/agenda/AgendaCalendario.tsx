'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ActividadCalendario {
  id: string
  tipo: string
  descripcion: string
  estado: string
  prioridad: string
  fecha_vencimiento: string | null
}

const PRIORIDAD_DOT: Record<string, string> = {
  normal:  'bg-gray-400',
  alta:    'bg-yellow-400',
  urgente: 'bg-red-500',
}

type Vista = 'semana' | 'mes'

function startOfWeek(d: Date): Date {
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(d.getFullYear(), d.getMonth(), diff)
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

function formatDiaSemana(d: Date) {
  return d.toLocaleDateString('es-MX', { weekday: 'short' }).replace('.', '')
}

function formatMesAnio(d: Date) {
  return d.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
}

export function AgendaCalendario({ actividades }: { actividades: ActividadCalendario[] }) {
  const [vista, setVista] = useState<Vista>('semana')
  const [base, setBase] = useState(() => new Date())

  const today = new Date()

  // ── Semana ────────────────────────────────────────────────
  const weekStart = startOfWeek(base)
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    return d
  })

  // ── Mes ───────────────────────────────────────────────────
  const mesAnio = new Date(base.getFullYear(), base.getMonth(), 1)
  const primerDia = mesAnio.getDay() === 0 ? 6 : mesAnio.getDay() - 1
  const diasEnMes = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate()
  const celdas = Array.from({ length: primerDia + diasEnMes }, (_, i) => {
    if (i < primerDia) return null
    return new Date(base.getFullYear(), base.getMonth(), i - primerDia + 1)
  })

  function actividadesDelDia(d: Date) {
    return actividades.filter(a => {
      if (!a.fecha_vencimiento) return false
      return isSameDay(new Date(a.fecha_vencimiento), d)
    })
  }

  function navSemana(dir: 1 | -1) {
    const d = new Date(base)
    d.setDate(d.getDate() + dir * 7)
    setBase(d)
  }
  function navMes(dir: 1 | -1) {
    setBase(new Date(base.getFullYear(), base.getMonth() + dir, 1))
  }

  const DIAS_HEADER = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {(['semana', 'mes'] as Vista[]).map(v => (
            <button
              key={v}
              onClick={() => setVista(v)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize',
                vista === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              )}
            >
              {v}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => vista === 'semana' ? navSemana(-1) : navMes(-1)}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-medium text-gray-700 min-w-[140px] text-center capitalize">
            {vista === 'semana'
              ? `${weekDays[0].getDate()} – ${weekDays[6].getDate()} ${formatMesAnio(weekDays[0])}`
              : formatMesAnio(mesAnio)
            }
          </span>
          <button
            onClick={() => vista === 'semana' ? navSemana(1) : navMes(1)}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ChevronRight size={16} />
          </button>
          <button
            onClick={() => setBase(new Date())}
            className="px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            Hoy
          </button>
        </div>
      </div>

      {/* Vista semana */}
      {vista === 'semana' && (
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((d, i) => {
            const acts = actividadesDelDia(d)
            const esHoy = isSameDay(d, today)
            return (
              <div key={i} className={cn(
                'border rounded-xl p-2 min-h-[120px]',
                esHoy ? 'border-blue-300 bg-blue-50/30' : 'border-gray-200 bg-white'
              )}>
                <div className="text-center mb-2">
                  <span className="text-[10px] text-gray-400 uppercase">{formatDiaSemana(d)}</span>
                  <div className={cn(
                    'w-7 h-7 rounded-full flex items-center justify-center mx-auto text-sm font-semibold',
                    esHoy ? 'bg-blue-600 text-white' : 'text-gray-700'
                  )}>
                    {d.getDate()}
                  </div>
                </div>
                <div className="space-y-1">
                  {acts.slice(0, 4).map(a => (
                    <Link key={a.id} href={`/crm/agenda`} className="block">
                      <div className={cn(
                        'flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] truncate',
                        a.estado === 'realizada' ? 'bg-green-100 text-green-700' :
                        new Date(a.fecha_vencimiento!) < today ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-700'
                      )}>
                        <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', PRIORIDAD_DOT[a.prioridad ?? 'normal'])} />
                        <span className="truncate">{a.descripcion}</span>
                      </div>
                    </Link>
                  ))}
                  {acts.length > 4 && (
                    <p className="text-[10px] text-gray-400 text-center">+{acts.length - 4} más</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Vista mes */}
      {vista === 'mes' && (
        <div>
          <div className="grid grid-cols-7 mb-1">
            {DIAS_HEADER.map(d => (
              <div key={d} className="text-center text-[11px] font-medium text-gray-400 py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {celdas.map((d, i) => {
              if (!d) return <div key={i} />
              const acts = actividadesDelDia(d)
              const esHoy = isSameDay(d, today)
              return (
                <div key={i} className={cn(
                  'border rounded-lg p-1.5 min-h-[70px]',
                  esHoy ? 'border-blue-300 bg-blue-50/30' : 'border-gray-100 bg-white'
                )}>
                  <div className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium mb-1',
                    esHoy ? 'bg-blue-600 text-white' : 'text-gray-700'
                  )}>
                    {d.getDate()}
                  </div>
                  <div className="space-y-0.5">
                    {acts.slice(0, 2).map(a => (
                      <div key={a.id} className={cn(
                        'flex items-center gap-1 text-[10px] truncate',
                        new Date(a.fecha_vencimiento!) < today && a.estado !== 'realizada'
                          ? 'text-red-500' : 'text-gray-600'
                      )}>
                        <div className={cn('w-1 h-1 rounded-full shrink-0', PRIORIDAD_DOT[a.prioridad ?? 'normal'])} />
                        <span className="truncate">{a.descripcion}</span>
                      </div>
                    ))}
                    {acts.length > 2 && (
                      <p className="text-[10px] text-blue-500">+{acts.length - 2}</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
