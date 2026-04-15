import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  ChevronLeft, Car, User, Pencil, Hash, Calendar,
  Gauge, Shield, Palette, FileText, MapPin,
} from 'lucide-react'
import { EmpresaVehiculoSection } from './EmpresaVehiculoControls'

interface PageProps {
  params: Promise<{ id: string }>
}

const VERIFICACION_LABELS: Record<string, { label: string; cls: string }> = {
  vigente:    { label: 'Verificación vigente', cls: 'bg-green-100 text-green-700' },
  por_vencer: { label: 'Por vencer',           cls: 'bg-yellow-100 text-yellow-700' },
  vencida:    { label: 'Verificación vencida', cls: 'bg-red-100 text-red-700' },
  no_aplica:  { label: 'No aplica',            cls: 'bg-gray-100 text-gray-500' },
}

const ROL_LABELS: Record<string, string> = {
  dueno:     'Dueño',
  conductor: 'Conductor',
  otro:      'Otro',
}

function Campo({ icon: Icon, label, value }: {
  icon: React.ComponentType<{ size?: number; className?: string }>
  label: string
  value: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1">
        <Icon size={11} /> {label}
      </div>
      <p className="text-sm text-gray-900">{value}</p>
    </div>
  )
}

export default async function VehiculoDetailPage({ params }: PageProps) {
  const { id } = await params
  const admin = createAdminClient()

  // Obtener rol del usuario autenticado para pasar a componentes interactivos
  const authClient = await createClient()
  const { data: { user: authUser } } = await authClient.auth.getUser()
  let rolUsuario = 'viewer'
  if (authUser) {
    const { data: usr } = await admin
      .from('usuarios').select('rol').eq('id', authUser.id).single()
    rolUsuario = (usr as unknown as { rol: string | null } | null)?.rol ?? 'viewer'
  }

  const { data: v, error } = await admin
    .from('vehiculos')
    .select(`
      id, marca, modelo, version, anio, color, placa, vin,
      km_actual, intervalo_servicio_meses,
      fecha_compra, fecha_fin_garantia,
      estado_verificacion, fecha_verificacion, proxima_verificacion, lugar_verificacion,
      activo,
      empresa:empresas ( id, nombre, rfc ),
      vehiculo_personas (
        id, rol_vehiculo,
        cliente:clientes ( id, nombre, apellido, whatsapp, email )
      )
    `)
    .eq('id', id)
    .single()

  if (error || !v) return notFound()

  type EmpresaRow = { id: string; nombre: string; rfc: string | null } | null
  const empresa = (v.empresa as unknown as EmpresaRow)

  type PersonaRow = {
    id: string
    rol_vehiculo: string
    cliente: { id: string; nombre: string; apellido: string; whatsapp: string | null; email: string | null } | null
  }
  const personas = (v.vehiculo_personas as unknown as PersonaRow[]).filter(p => p.cliente)
  const ver = VERIFICACION_LABELS[v.estado_verificacion ?? 'no_aplica'] ?? VERIFICACION_LABELS.no_aplica

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Nav */}
      <div className="flex items-center justify-between">
        <Link href="/crm/vehiculos" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <ChevronLeft size={16} /> Vehículos
        </Link>
        <Link href={`/crm/vehiculos/${v.id}/editar`}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
          <Pencil size={14} /> Editar
        </Link>
      </div>

      {/* Hero */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-orange-100 flex items-center justify-center shrink-0">
            <Car size={26} className="text-orange-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-gray-900">{v.marca} {v.modelo}</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {v.anio}{v.version ? ` · ${v.version}` : ''}{v.color ? ` · ${v.color}` : ''}
            </p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ver.cls}`}>
                {ver.label}
              </span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${v.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {v.activo ? 'Activo' : 'Inactivo'}
              </span>
            </div>
          </div>
          {v.placa && (
            <div className="shrink-0 bg-gray-900 text-white rounded-lg px-3 py-2 text-center">
              <p className="text-xs text-gray-400 mb-0.5">Placa</p>
              <p className="font-mono font-bold tracking-widest text-sm">{v.placa}</p>
            </div>
          )}
        </div>
      </div>

      {/* Datos técnicos */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Datos técnicos</h2>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          {v.vin && (
            <div className="col-span-2">
              <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1"><Hash size={11} /> VIN</div>
              <p className="text-sm font-mono text-gray-900 tracking-wider">{v.vin}</p>
            </div>
          )}
          {v.km_actual != null && (
            <Campo icon={Gauge} label="Kilometraje" value={`${v.km_actual.toLocaleString('es-MX')} km`} />
          )}
          {v.intervalo_servicio_meses && (
            <Campo icon={Gauge} label="Intervalo servicio" value={`${v.intervalo_servicio_meses} meses`} />
          )}
          {v.fecha_compra && (
            <Campo icon={Calendar} label="Fecha de compra"
              value={new Date(v.fecha_compra).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })} />
          )}
          {v.fecha_fin_garantia && (
            <Campo icon={Shield} label="Fin de garantía"
              value={new Date(v.fecha_fin_garantia).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })} />
          )}
        </div>
      </div>

      {/* Verificación */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Verificación vehicular</h2>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          <Campo icon={FileText} label="Estado"
            value={<span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${ver.cls}`}>{ver.label}</span>} />
          {v.lugar_verificacion && (
            <Campo icon={MapPin} label="Lugar de verificación" value={v.lugar_verificacion} />
          )}
          {v.fecha_verificacion && (
            <Campo icon={Calendar} label="Fecha de verificación"
              value={new Date(v.fecha_verificacion).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })} />
          )}
          {v.proxima_verificacion && (
            <Campo icon={Calendar} label="Próxima verificación"
              value={
                <span className={new Date(v.proxima_verificacion) < new Date() ? 'text-red-600 font-medium' : ''}>
                  {new Date(v.proxima_verificacion).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}
                </span>
              } />
          )}
          {!v.fecha_verificacion && !v.proxima_verificacion && !v.lugar_verificacion && (
            <p className="col-span-2 text-sm text-gray-400">Sin datos de verificación registrados</p>
          )}
        </div>
      </div>

      {/* Empresa */}
      <EmpresaVehiculoSection vehiculoId={v.id} empresa={empresa} rolUsuario={rolUsuario} />

      {/* Personas vinculadas */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">
          Personas vinculadas ({personas.length})
        </h2>
        {personas.length === 0 ? (
          <p className="text-sm text-gray-400">Sin propietarios o conductores registrados</p>
        ) : (
          <div className="space-y-3">
            {personas.map((p) => (
              <Link key={p.id} href={`/crm/clientes/${p.cliente!.id}`}
                className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:border-blue-200 hover:bg-blue-50 transition-all group">
                <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold shrink-0">
                  {p.cliente!.nombre[0]}{p.cliente!.apellido[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                    {p.cliente!.nombre} {p.cliente!.apellido}
                  </p>
                  {p.cliente!.whatsapp && (
                    <p className="text-xs text-gray-400 font-mono">{p.cliente!.whatsapp}</p>
                  )}
                </div>
                <span className="text-xs font-medium px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full shrink-0">
                  {ROL_LABELS[p.rol_vehiculo] ?? p.rol_vehiculo}
                </span>
                <User size={14} className="text-gray-300 group-hover:text-blue-400 shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
