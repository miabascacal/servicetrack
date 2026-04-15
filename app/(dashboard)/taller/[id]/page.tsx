import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatDate, formatDateTime, cn } from '@/lib/utils'
import { ChevronLeft, Car, Phone, Clock, User, Calendar, AlertCircle } from 'lucide-react'
import type { EstadoOT } from '@/types/database'
import { CambiarEstadoOT } from '@/app/_components/taller/CambiarEstadoOT'
import { LineasOT } from '@/app/_components/taller/LineasOT'

interface PageProps {
  params: Promise<{ id: string }>
}

const ESTADO_COLORS: Record<EstadoOT, string> = {
  recibido:      'bg-blue-100 text-blue-700',
  diagnostico:   'bg-yellow-100 text-yellow-700',
  en_reparacion: 'bg-purple-100 text-purple-700',
  listo:         'bg-green-100 text-green-700',
  entregado:     'bg-gray-100 text-gray-600',
  cancelado:     'bg-red-100 text-red-600',
}

const ESTADO_LABELS: Record<EstadoOT, string> = {
  recibido:      'Recibido',
  diagnostico:   'Diagnóstico',
  en_reparacion: 'En reparación',
  listo:         'Listo',
  entregado:     'Entregado',
  cancelado:     'Cancelado',
}

const ESTADO_READONLY: EstadoOT[] = ['entregado', 'cancelado']

export default async function OTDetailPage({ params }: PageProps) {
  const { id } = await params
  // createClient() aplica RLS — solo devuelve OTs de la sucursal del usuario autenticado.
  // Si el UUID existe pero pertenece a otra sucursal, .single() devuelve null → notFound().
  const supabase = await createClient()

  const { data: ot } = await supabase
    .from('ordenes_trabajo')
    .select(`
      id, numero_ot, estado, diagnostico, notas_internas,
      km_ingreso, promesa_entrega, fecha_entrega, created_at, updated_at,
      cliente:clientes ( id, nombre, apellido, apellido_2, whatsapp, email ),
      vehiculo:vehiculos ( id, marca, modelo, anio, color, placa, km_actual ),
      asesor:usuarios ( id, nombre, apellido ),
      cita:citas ( id, fecha_cita, hora_cita )
    `)
    .eq('id', id)
    .single()

  if (!ot) notFound()

  const { data: lineas } = await supabase
    .from('lineas_ot')
    .select('id, tipo, descripcion, numero_parte, cantidad, precio_unitario, total, estado, aprobado_cliente')
    .eq('ot_id', id)
    .order('created_at')

  type OTFull = typeof ot & {
    cliente: { id: string; nombre: string; apellido: string; apellido_2: string | null; whatsapp: string; email: string | null } | null
    vehiculo: { id: string; marca: string; modelo: string; anio: number; color: string | null; placa: string | null; km_actual: number | null } | null
    asesor: { id: string; nombre: string; apellido: string } | null
    cita: { id: string; fecha_cita: string; hora_cita: string } | null
  }

  const o = ot as unknown as OTFull
  const estado = o.estado as EstadoOT
  const isReadonly = ESTADO_READONLY.includes(estado)

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Link href="/taller" className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors">
            <ChevronLeft size={18} />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-gray-900 font-mono">{o.numero_ot}</h1>
              <span className={cn('px-2.5 py-0.5 rounded-full text-xs font-medium', ESTADO_COLORS[estado])}>
                {ESTADO_LABELS[estado]}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">{o.diagnostico ?? 'Sin diagnóstico especificado'}</p>
          </div>
        </div>

        {/* WhatsApp action */}
        {o.cliente?.whatsapp && (
          <a
            href={`https://wa.me/${o.cliente.whatsapp.replace(/\D/g, '')}?text=Hola%20${o.cliente.nombre},%20tu%20veh%C3%ADculo%20est%C3%A1%20en%20proceso%20de%20servicio%20(OT:%20${o.numero_ot})`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors"
          >
            <Phone size={14} />
            WhatsApp
          </a>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="space-y-5">
          {/* Client */}
          {o.cliente && (
            <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-3">
              <h2 className="text-sm font-semibold text-gray-900">Cliente</h2>
              <Link
                href={`/crm/clientes/${o.cliente.id}`}
                className="flex items-center gap-3 hover:bg-gray-50 rounded-lg p-1 -m-1 transition-colors"
              >
                <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-sm font-bold shrink-0">
                  {o.cliente.nombre.slice(0, 1)}{o.cliente.apellido.slice(0, 1)}
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">
                    {o.cliente.nombre} {o.cliente.apellido}
                    {o.cliente.apellido_2 ? ` ${o.cliente.apellido_2}` : ''}
                  </p>
                  <p className="text-xs text-gray-500 font-mono">{o.cliente.whatsapp}</p>
                </div>
              </Link>
              {o.cliente.email && (
                <p className="text-xs text-gray-500">{o.cliente.email}</p>
              )}
            </div>
          )}

          {/* Vehicle */}
          {o.vehiculo && (
            <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-3">
              <h2 className="text-sm font-semibold text-gray-900">Vehículo</h2>
              <Link
                href={`/crm/vehiculos/${o.vehiculo.id}`}
                className="flex items-center gap-3 hover:bg-gray-50 rounded-lg p-1 -m-1 transition-colors"
              >
                <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                  <Car size={16} className="text-gray-500" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">
                    {o.vehiculo.marca} {o.vehiculo.modelo} {o.vehiculo.anio}
                  </p>
                  <div className="flex gap-2 mt-0.5">
                    {o.vehiculo.placa && (
                      <span className="text-xs font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                        {o.vehiculo.placa}
                      </span>
                    )}
                    {o.vehiculo.color && (
                      <span className="text-xs text-gray-500">{o.vehiculo.color}</span>
                    )}
                  </div>
                </div>
              </Link>
              {o.km_ingreso && (
                <p className="text-xs text-gray-500">
                  KM entrada: {o.km_ingreso.toLocaleString('es-MX')}
                </p>
              )}
            </div>
          )}

          {/* Asesor */}
          {o.asesor && (
            <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-2">
              <h2 className="text-sm font-semibold text-gray-900">Asesor</h2>
              <div className="flex items-center gap-2">
                <User size={14} className="text-gray-400" />
                <span className="text-sm text-gray-700">
                  {o.asesor.nombre} {o.asesor.apellido}
                </span>
              </div>
            </div>
          )}

          {/* Cita origen */}
          {o.cita && (
            <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-2">
              <h2 className="text-sm font-semibold text-gray-900">Cita origen</h2>
              <Link
                href={`/citas/${o.cita.id}`}
                className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
              >
                <Calendar size={14} />
                {formatDate(o.cita.fecha_cita)} a las {o.cita.hora_cita.slice(0, 5)}
              </Link>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="lg:col-span-2 space-y-5">
          {/* Estado */}
          <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-900">Estado de la OT</h2>
            <CambiarEstadoOT otId={o.id} estadoActual={estado} />
          </div>

          {/* Líneas OT */}
          <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">Líneas de trabajo</h2>
              <span className="text-xs text-gray-400">{lineas?.length ?? 0} línea{(lineas?.length ?? 0) !== 1 ? 's' : ''}</span>
            </div>
            <LineasOT
              otId={o.id}
              lineas={lineas ?? []}
              readonly={isReadonly}
            />
          </div>

          {/* Notas internas */}
          {o.notas_internas && (
            <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-2">
              <div className="flex items-center gap-1.5">
                <AlertCircle size={13} className="text-gray-400" />
                <h2 className="text-sm font-semibold text-gray-900">Notas internas</h2>
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{o.notas_internas}</p>
            </div>
          )}

          {/* Meta */}
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
            <div className="grid grid-cols-2 gap-3 text-xs text-gray-500">
              <div>
                <p className="font-medium text-gray-700">Creada</p>
                <p>{formatDateTime(o.created_at)}</p>
              </div>
              {o.promesa_entrega && (
                <div>
                  <p className="font-medium text-gray-700 flex items-center gap-1">
                    <Clock size={11} />
                    Promesa de entrega
                  </p>
                  <p>{formatDateTime(o.promesa_entrega)}</p>
                </div>
              )}
              {o.fecha_entrega && (
                <div>
                  <p className="font-medium text-gray-700">Entregada</p>
                  <p>{formatDateTime(o.fecha_entrega)}</p>
                </div>
              )}
              {o.updated_at && (
                <div>
                  <p className="font-medium text-gray-700">Última actualización</p>
                  <p>{formatDateTime(o.updated_at)}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
