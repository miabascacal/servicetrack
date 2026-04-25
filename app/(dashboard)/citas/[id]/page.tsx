import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatDate, formatDateTime } from '@/lib/utils'
import { ChevronLeft, Car, Phone, Wrench } from 'lucide-react'
import type { EstadoCita, EstadoOT } from '@/types/database'
import { CambiarEstadoCita } from '@/app/_components/citas/CambiarEstadoCita'
import { VincularOTCita } from '@/app/_components/citas/VincularOTCita'
import { DemoNoShowButton } from '@/app/_components/citas/DemoNoShowButton'

interface PageProps {
  params: Promise<{ id: string }>
}

const ESTADO_LABELS: Record<EstadoCita, string> = {
  pendiente_contactar: 'Por contactar',
  contactada:          'Contactada',
  confirmada:          'Confirmada',
  en_agencia:          'En agencia',
  show:                'Show',
  no_show:             'No show',
  cancelada:           'Cancelada',
}

const ESTADO_COLORS: Record<EstadoCita, string> = {
  pendiente_contactar: 'bg-yellow-100 text-yellow-700',
  contactada:          'bg-sky-100 text-sky-700',
  confirmada:          'bg-blue-100 text-blue-700',
  en_agencia:          'bg-indigo-100 text-indigo-700',
  show:                'bg-purple-100 text-purple-700',
  no_show:             'bg-red-100 text-red-700',
  cancelada:           'bg-gray-100 text-gray-500',
}

const ALLOWED_TRANSITIONS: Record<EstadoCita, EstadoCita[]> = {
  pendiente_contactar: ['contactada', 'confirmada', 'no_show', 'cancelada'],
  contactada:          ['confirmada', 'no_show', 'cancelada'],
  confirmada:          ['en_agencia', 'no_show', 'cancelada'],
  en_agencia:          ['show', 'no_show', 'cancelada'],
  show:                [],
  no_show:             ['confirmada'],
  cancelada:           [],
}

export default async function CitaDetailPage({ params }: PageProps) {
  const { id } = await params
  // createClient() aplica RLS — solo devuelve citas de la sucursal del usuario autenticado
  const supabase = await createClient()

  const { data: cita } = await supabase
    .from('citas')
    .select(`
      id, fecha_cita, hora_cita, estado, servicio, notas, creado_at,
      cliente:clientes ( id, nombre, apellido, whatsapp ),
      vehiculo:vehiculos ( id, marca, modelo, anio, placa )
    `)
    .eq('id', id)
    .single()

  if (!cita) notFound()

  type CitaFull = typeof cita & {
    cliente: { id: string; nombre: string; apellido: string; whatsapp: string } | null
    vehiculo: { id: string; marca: string; modelo: string; anio: number; placa: string | null } | null
  }

  const c = cita as unknown as CitaFull
  const estado = c.estado as EstadoCita
  const transitions = ALLOWED_TRANSITIONS[estado] ?? []

  // Queries de OT — solo cuando el estado permite abrir/vincular OT
  type OTRow = { id: string; numero_ot: string; numero_ot_dms: string | null; estado: EstadoOT }
  let otVinculada: OTRow | null = null
  let otsDisponibles: OTRow[] = []

  if (estado === 'en_agencia' || estado === 'show') {
    // OT ya vinculada a esta cita
    const { data: otLinked } = await supabase
      .from('ordenes_trabajo')
      .select('id, numero_ot, numero_ot_dms, estado')
      .eq('cita_id', id)
      .limit(1)
      .maybeSingle()
    otVinculada = (otLinked as OTRow | null) ?? null

    // OTs disponibles para vincular: mismo cliente + mismo vehículo, no cerradas, sin cita
    if (!otVinculada && c.cliente) {
      let otQuery = supabase
        .from('ordenes_trabajo')
        .select('id, numero_ot, numero_ot_dms, estado')
        .eq('cliente_id', c.cliente.id)
        .not('estado', 'in', '("entregado","cancelado")')
        .is('cita_id', null)
        .order('created_at', { ascending: false })
        .limit(10)

      if (c.vehiculo) {
        otQuery = otQuery.eq('vehiculo_id', c.vehiculo.id)
      }

      const { data: otsData } = await otQuery
      otsDisponibles = (otsData as OTRow[] | null) ?? []
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Link href="/citas" className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors">
            <ChevronLeft size={18} />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-gray-900">
                Cita {formatDate(c.fecha_cita)} — {c.hora_cita.slice(0, 5)}
              </h1>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${ESTADO_COLORS[estado]}`}>
                {ESTADO_LABELS[estado]}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">{c.servicio ?? 'Sin servicio especificado'}</p>
          </div>
        </div>
        {/* Actions */}
        <div className="flex gap-2 shrink-0">
          {c.cliente?.whatsapp && (
            <a
              href={`https://wa.me/${c.cliente.whatsapp.replace(/\D/g, '')}?text=Hola%20${c.cliente.nombre},%20te%20contactamos%20por%20tu%20cita%20del%20${formatDate(c.fecha_cita)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors"
            >
              <Phone size={14} />
              WhatsApp
            </a>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="space-y-5">
          {/* Client */}
          {c.cliente && (
            <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-3">
              <h2 className="text-sm font-semibold text-gray-900">Cliente</h2>
              <Link
                href={`/crm/clientes/${c.cliente.id}`}
                className="flex items-center gap-3 hover:bg-gray-50 rounded-lg p-1 -m-1 transition-colors"
              >
                <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-sm font-bold shrink-0">
                  {c.cliente.nombre.slice(0, 1)}{c.cliente.apellido.slice(0, 1)}
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">
                    {c.cliente.nombre} {c.cliente.apellido}
                  </p>
                  <p className="text-xs text-gray-500 font-mono">{c.cliente.whatsapp}</p>
                </div>
              </Link>
            </div>
          )}

          {/* Vehicle */}
          {c.vehiculo && (
            <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-3">
              <h2 className="text-sm font-semibold text-gray-900">Vehículo</h2>
              <Link
                href={`/crm/vehiculos/${c.vehiculo.id}`}
                className="flex items-center gap-3 hover:bg-gray-50 rounded-lg p-1 -m-1 transition-colors"
              >
                <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                  <Car size={16} className="text-gray-500" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">
                    {c.vehiculo.marca} {c.vehiculo.modelo} {c.vehiculo.anio}
                  </p>
                  {c.vehiculo.placa && (
                    <p className="text-xs font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded inline-block mt-0.5">
                      {c.vehiculo.placa}
                    </p>
                  )}
                </div>
              </Link>
            </div>
          )}

        </div>

        {/* Right column */}
        <div className="lg:col-span-2 space-y-5">
          {/* Estado + transitions */}
          <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-900">Estado de la cita</h2>
            <CambiarEstadoCita
              citaId={c.id}
              estadoActual={estado}
              transitions={transitions}
            />
            {(estado === 'confirmada' || estado === 'en_agencia') && (
              <div className="pt-2 border-t border-gray-100">
                <p className="text-[11px] text-gray-400 mb-2 font-medium uppercase tracking-wide">Demo</p>
                <DemoNoShowButton citaId={c.id} />
              </div>
            )}
          </div>

          {/* OT — vincular o ver */}
          {(estado === 'en_agencia' || estado === 'show') && (
            <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
              <h2 className="text-sm font-semibold text-gray-900">Orden de Trabajo</h2>
              {!otVinculada && (
                <Link
                  href={`/taller/nuevo?cita_id=${c.id}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors w-fit"
                >
                  <Wrench size={14} />
                  Crear nueva OT
                </Link>
              )}
              <VincularOTCita
                citaId={c.id}
                otVinculada={otVinculada}
                otsDisponibles={otsDisponibles}
              />
            </div>
          )}

          {/* Notes */}
          {c.notas && (
            <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-2">
              <h2 className="text-sm font-semibold text-gray-900">Notas</h2>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.notas}</p>
            </div>
          )}

          {/* Meta */}
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
            <div className="grid grid-cols-2 gap-3 text-xs text-gray-500">
              <div>
                <p className="font-medium text-gray-700">Fecha de cita</p>
                <p>{formatDate(c.fecha_cita)} a las {c.hora_cita.slice(0, 5)}</p>
              </div>
              <div>
                <p className="font-medium text-gray-700">Creada</p>
                <p>{formatDateTime(c.creado_at)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
