'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Users,
  Calendar,
  Wrench,
  Package,
  TrendingUp,
  MessageSquare,
  HeartHandshake,
  Star,
  Shield,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { logoutAction } from '@/app/actions/auth'

const NAV_ITEMS = [
  { label: 'CRM', href: '/crm', icon: Users },
  { label: 'Citas', href: '/citas', icon: Calendar },
  { label: 'Taller', href: '/taller', icon: Wrench },
  { label: 'Refacciones', href: '/refacciones', icon: Package },
  { label: 'Ventas', href: '/ventas', icon: TrendingUp },
  { label: 'Automatizaciones', href: '/bandeja', icon: MessageSquare },
  { label: 'Atención a Clientes', href: '/atencion', icon: HeartHandshake },
  { label: 'CSI', href: '/csi', icon: Star },
  { label: 'Seguros', href: '/seguros', icon: Shield },
  { label: 'Reportes', href: '/reportes', icon: BarChart3 },
  { label: 'Configuración', href: '/configuracion', icon: Settings },
]

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()

  return (
    <aside
      className={cn(
        'flex flex-col h-screen bg-gray-900 text-white transition-all duration-200 ease-in-out shrink-0',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-14 border-b border-gray-800">
        {!collapsed && (
          <span className="text-sm font-bold tracking-wide text-white">ServiceTrack</span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded hover:bg-gray-800 text-gray-400 hover:text-white transition-colors ml-auto"
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto">
        <ul className="space-y-0.5 px-2">
          {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(href + '/')
            return (
              <li key={href}>
                <Link
                  href={href}
                  title={collapsed ? label : undefined}
                  className={cn(
                    'flex items-center gap-3 px-2 py-2 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                  )}
                >
                  <Icon size={18} className="shrink-0" />
                  {!collapsed && <span className="truncate">{label}</span>}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Logout */}
      <div className="px-2 pb-4 border-t border-gray-800 pt-4">
        <form action={logoutAction}>
          <button
            type="submit"
            title={collapsed ? 'Cerrar sesión' : undefined}
            className="flex items-center gap-3 w-full px-2 py-2 rounded-lg text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
          >
            <LogOut size={18} className="shrink-0" />
            {!collapsed && <span>Cerrar sesión</span>}
          </button>
        </form>
      </div>
    </aside>
  )
}
