import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatDate, formatDateTime } from '@/lib/utils'
import { ChevronLeft, Car, Phone, User } from 'lucide-react'
import type { EstadoCita } from '@/types/database'
import { CambiarEstadoCita } from '@/app/_components/citas/CambiarEstadoCita'

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
  const supabase = createAdminClient()

  const { data: cita, error: citaError } = await supabase
    .from('citas')
    .select(`
      id, fecha_cita, hora_cita, estado, servicio, notas, creado_at,
      cliente:clientes ( id, nombre, apellido, apellido_2, whatsapp, email ),
      vehiculo:vehiculos ( id, marca, modelo, anio, color, placa, km_actual ),
      asesor:usuarios ( id, nombre, apellido )
    `)
    .eq('id', id)
    .single()

  if (citaError || !cita) notFound()

  type CitaFull = typeof cita & {
    cliente: { id: string; nombre: string; apellido: string; apellido_2: string | null; whatsapp: string; email: string | null } | null
    vehiculo: { id: string; marca: string; modelo: string; anio: number; color: string | null; placa: string | null; km_actual: number | null } | null
    asesor: { id: string; nombre: string; apellido: string } | null
  }

  const c = cita as unknown as CitaFull
  const estado = c.estado as EstadoCita
  const transitions = ALLOWED_TRANSITIONS[estado] ?? []

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
          {estado === 'show' && (
            <Link
              href={`/taller/nuevo?cita_id=${c.id}`}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
            >
              <Wrench size={14} />
              Abrir OT
            </Link>
          )}
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
                    {c.cliente.apellido_2 ? ` ${c.cliente.apellido_2}` : ''}
                  </p>
                  <p className="text-xs text-gray-500 font-mono">{c.cliente.whatsapp}</p>
                </div>
              </Link>
              {c.cliente.email && (
                <p className="text-xs text-gray-500">{c.cliente.email}</p>
              )}
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
                  <div className="flex gap-2 mt-0.5">
                    {c.vehiculo.placa && (
                      <span className="text-xs font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                        {c.vehiculo.placa}
                      </span>
                    )}
                    {c.vehiculo.color && (
                      <span className="text-xs text-gray-500">{c.vehiculo.color}</span>
                    )}
                  </div>
                </div>
              </Link>
              {c.vehiculo.km_actual && (
                <p className="text-xs text-gray-500">
                  KM actuales: {c.vehiculo.km_actual.toLocaleString('es-MX')}
                </p>
              )}
            </div>
          )}

          {/* Asesor */}
          {c.asesor && (
            <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-2">
              <h2 className="text-sm font-semibold text-gray-900">Asesor asignado</h2>
              <div className="flex items-center gap-2">
                <User size={14} className="text-gray-400" />
                <span className="text-sm text-gray-700">
                  {c.asesor.nombre} {c.asesor.apellido}
                </span>
              </div>
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
          </div>

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
