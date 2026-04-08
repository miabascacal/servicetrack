import Link from 'next/link'
import { Settings, Users, ClipboardList, Building2, AlertTriangle } from 'lucide-react'

const MODULOS = [
  {
    href: '/usuarios',
    icon: Users,
    color: 'bg-blue-100 text-blue-600',
    titulo: 'Usuarios y Permisos',
    descripcion: 'Administra usuarios, roles y accesos del sistema',
    disponible: true,
  },
  {
    href: '/configuracion/sucursal',
    icon: Building2,
    color: 'bg-indigo-100 text-indigo-600',
    titulo: 'Mi Sucursal',
    descripcion: 'Edita nombre, teléfono, WhatsApp y datos de la sucursal',
    disponible: false,
  },
  {
    href: '/configuracion/auditoria',
    icon: ClipboardList,
    color: 'bg-purple-100 text-purple-600',
    titulo: 'Auditoría',
    descripcion: 'Historial de cambios: quién editó qué y cuándo',
    disponible: false,
  },
  {
    href: '/configuracion/errores',
    icon: AlertTriangle,
    color: 'bg-red-100 text-red-600',
    titulo: 'Errores del sistema',
    descripcion: 'Log técnico de errores para diagnóstico',
    disponible: false,
  },
]

export default function ConfiguracionPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <Settings size={20} className="text-gray-500" />
          Configuración
        </h1>
        <p className="text-sm text-gray-500 mt-1">Administración del sistema y preferencias</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {MODULOS.map((m) => {
          const Icon = m.icon
          const content = (
            <div className={`bg-white rounded-xl border p-5 flex items-start gap-4 transition-all ${
              m.disponible
                ? 'border-gray-200 hover:border-blue-300 hover:shadow-sm cursor-pointer'
                : 'border-gray-100 opacity-60 cursor-not-allowed'
            }`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${m.color}`}>
                <Icon size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{m.titulo}</p>
                <p className="text-xs text-gray-500 mt-0.5">{m.descripcion}</p>
                {!m.disponible && (
                  <span className="inline-block mt-2 text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                    Próximamente
                  </span>
                )}
              </div>
            </div>
          )

          return m.disponible ? (
            <Link key={m.href} href={m.href}>{content}</Link>
          ) : (
            <div key={m.href}>{content}</div>
          )
        })}
      </div>
    </div>
  )
}
