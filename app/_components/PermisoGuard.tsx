'use client'

import { usePermisos } from '@/hooks/usePermisos'
import type { ModuloPermiso, PermisoModulo } from '@/types/database'

interface PermisoGuardProps {
  modulo: ModuloPermiso
  accion?: keyof PermisoModulo
  /** Rendered when user has permission */
  children: React.ReactNode
  /** Rendered when user does NOT have permission (optional) */
  fallback?: React.ReactNode
}

/**
 * Renders children only if the current user has the specified permission.
 *
 * Usage:
 *   <PermisoGuard modulo="crm" accion="puede_crear">
 *     <button>Nuevo Cliente</button>
 *   </PermisoGuard>
 */
export function PermisoGuard({
  modulo,
  accion = 'puede_ver',
  children,
  fallback = null,
}: PermisoGuardProps) {
  const { can, loading } = usePermisos()

  if (loading) return null
  if (!can(modulo, accion)) return <>{fallback}</>

  return <>{children}</>
}
