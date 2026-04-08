import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatDate, formatDateTime, cn } from '@/lib/utils'
import { ChevronLeft, User, Car, FileText, Phone } from 'lucide-react'
import { ItemsCotizacion } from '@/app/_components/refacciones/ItemsCotizacion'
import { CambiarEstadoCotizacion } from '@/app/_components/refacciones/CambiarEstadoCotizacion'

interface PageProps {
  params: Promise<{ id: string }>
}

const ESTADO_CONFIG: Record<string, { label: string; color: string }> = {
  borrador:  { label: 'Borrador',  color: 'bg-gray-100 text-gray-600' },
  enviada:   { label: 'Enviada',   color: 'bg-blue-100 text-blue-700' },
  abierta:   { label: 'Abierta',   color: 'bg-indigo-100 text-indigo-700' },
  aprobada:  { label: 'Aprobada',  color: 'bg-green-100 text-green-700' },
  rechazada: { label: 'Rechazada', color: 'bg-red-100 text-red-600' },
  vencida:   { label: 'Vencida',   color: 'bg-yellow-100 text-yellow-700' },
}

export default async function CotizacionDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: cot } = await supabase
    .from('cotizaciones')
    .select(`
      id, numero_cotizacion, tipo, estado, total, notas,
      fecha_emision, fecha_vencimiento, enviada_at, aprobada_at, rechazada_at,
      cliente:clientes ( id, nombre, apellido, apellido_2, whatsapp, email ),
      vehiculo:vehiculos ( id, marca, modelo, anio, placa ),
      asesor:usuarios ( id, nombre, apellido ),
      ot:ordenes_trabajo ( id, numero_ot )
    `)
    .eq('id', id)
    .single()

  if (!cot) notFound()

  const { data: items } = await supabase
    .from('cotizacion_items')
    .select('id, numero_parte, descripcion, cantidad, precio_unitario, total, imagen_oem_url')
    .eq('cotizacion_id', id)
    .order('id')

  type CotFull = typeof cot & {
    cliente: { id: string; nombre: string; apellido: string; apellido_2: string | null; whatsapp: string; email: string | null } | null
    vehiculo: { id: string; marca: string; modelo: string; anio: number; placa: string | null } | null
    asesor: { id: string; nombre: string; apellido: string } | null
    ot: { id: string; numero_ot: string } | null
  }

  const c = cot as unknown as CotFull
  const estadoCfg = ESTADO_CONFIG[c.estado] ?? { label: c.estado, color: 'bg-gray-100 text-gray-600' }
  const isFinal = ['aprobada', 'rechazada', 'vencida'].includes(c.estado)

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Link href="/refacciones/cotizaciones" className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors">
            <ChevronLeft size={18} />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-gray-900 font-mono">{c.numero_cotizacion}</h1>
              <span className={cn('px-2.5 py-0.5 rounded-full text-xs font-medium', estadoCfg.color)}>
                {estadoCfg.label}
              </span>
              <span className="text-xs text-gray-400 capitalize">{c.tipo}</span>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              {c.total != null ? `Total: $${c.total.toLocaleString('es-MX')}` : 'Sin ítems'}
              {c.fecha_vencimiento && ` · Vence: ${formatDate(c.fecha_vencimiento)}`}
            </p>
          </div>
        </div>
        {c.cliente?.whatsapp && (
          <a
            href={`https://wa.me/${c.cliente.whatsapp.replace(/\D/g, '')}?text=Hola%20${c.cliente.nombre},%20te%20enviamos%20la%20cotizaci%C3%B3n%20${c.numero_cotizacion}`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors"
          >
            <Phone size={14} />
            Enviar por WhatsApp
          </a>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left */}
        <div className="space-y-5">
          {c.cliente && (
            <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-3">
              <h2 className="text-sm font-semibold text-gray-900">Cliente</h2>
              <Link href={`/crm/clientes/${c.cliente.id}`}
                className="flex items-center gap-3 hover:bg-gray-50 rounded-lg p-1 -m-1 transition-colors">
                <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-sm font-bold shrink-0">
                  {c.cliente.nombre[0]}{c.cliente.apellido[0]}
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">
                    {c.cliente.nombre} {c.cliente.apellido}{c.cliente.apellido_2 ? ` ${c.cliente.apellido_2}` : ''}
                  </p>
                  <p className="text-xs text-gray-500 font-mono">{c.cliente.whatsapp}</p>
                </div>
              </Link>
            </div>
          )}

          {c.vehiculo && (
            <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-3">
              <h2 className="text-sm font-semibold text-gray-900">Vehículo</h2>
              <Link href={`/crm/vehiculos/${c.vehiculo.id}`}
                className="flex items-center gap-3 hover:bg-gray-50 rounded-lg p-1 -m-1 transition-colors">
                <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                  <Car size={16} className="text-gray-500" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">
                    {c.vehiculo.marca} {c.vehiculo.modelo} {c.vehiculo.anio}
                  </p>
                  {c.vehiculo.placa && (
                    <span className="text-xs font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{c.vehiculo.placa}</span>
                  )}
                </div>
              </Link>
            </div>
          )}

          {c.ot && (
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h2 className="text-sm font-semibold text-gray-900 mb-2">OT vinculada</h2>
              <Link href={`/taller/${c.ot.id}`} className="text-sm text-blue-600 hover:underline font-mono">
                {c.ot.numero_ot}
              </Link>
            </div>
          )}

          <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-900">Estado</h2>
            <CambiarEstadoCotizacion cotId={c.id} estadoActual={c.estado} />
          </div>
        </div>

        {/* Right */}
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">Ítems</h2>
              <div className="flex items-center gap-2">
                <FileText size={13} className="text-gray-400" />
                <span className="text-xs text-gray-400">{items?.length ?? 0} ítem{(items?.length ?? 0) !== 1 ? 's' : ''}</span>
              </div>
            </div>
            <ItemsCotizacion cotizacionId={c.id} items={items ?? []} readonly={isFinal} />
          </div>

          {c.notas && (
            <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-2">
              <h2 className="text-sm font-semibold text-gray-900">Notas</h2>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.notas}</p>
            </div>
          )}

          <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
            <div className="grid grid-cols-2 gap-3 text-xs text-gray-500">
              <div>
                <p className="font-medium text-gray-700">Emitida</p>
                <p>{formatDateTime(c.fecha_emision)}</p>
              </div>
              {c.enviada_at && (
                <div>
                  <p className="font-medium text-gray-700">Enviada</p>
                  <p>{formatDateTime(c.enviada_at)}</p>
                </div>
              )}
              {c.aprobada_at && (
                <div>
                  <p className="font-medium text-gray-700">Aprobada</p>
                  <p>{formatDateTime(c.aprobada_at)}</p>
                </div>
              )}
              {c.rechazada_at && (
                <div>
                  <p className="font-medium text-gray-700">Rechazada</p>
                  <p>{formatDateTime(c.rechazada_at)}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
