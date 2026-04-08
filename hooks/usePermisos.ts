'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ModuloPermiso, PermisoModulo } from '@/types/database'

const DEFAULT_PERMISO: PermisoModulo = {
  puede_ver: false,
  puede_crear: false,
  puede_editar: false,
  puede_eliminar: false,
  puede_exportar: false,
}

type PermisosMap = Record<ModuloPermiso, PermisoModulo>

/**
 * Returns the current user's effective permissions for all modules.
 * Merges role-level permissions with individual override permissions.
 * Super admins get full access to everything.
 */
export function usePermisos() {
  const [permisos, setPermisos] = useState<PermisosMap | null>(null)
  const [loading, setLoading] = useState(true)
  const [esSuperAdmin, setEsSuperAdmin] = useState(false)

  useEffect(() => {
    async function fetchPermisos() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setLoading(false)
        return
      }

      // Get all role permissions for this user
      const { data: usuarioRoles } = await supabase
        .from('usuario_roles')
        .select(`
          sucursal_id,
          rol:roles (
            es_super_admin,
            rol_permisos ( modulo, puede_ver, puede_crear, puede_editar, puede_eliminar, puede_exportar )
          )
        `)
        .eq('usuario_id', user.id)
        .eq('activo', true)

      // Get individual overrides
      const { data: overrides } = await supabase
        .from('usuario_permisos_override')
        .select('modulo, puede_ver, puede_crear, puede_editar, puede_eliminar, puede_exportar')
        .eq('usuario_id', user.id)

      type RolWithPermisos = {
        es_super_admin: boolean
        rol_permisos: {
          modulo: string
          puede_ver: boolean
          puede_crear: boolean
          puede_editar: boolean
          puede_eliminar: boolean
          puede_exportar: boolean
        }[]
      }
      type UsuarioRolRow = { sucursal_id: string | null; rol: RolWithPermisos }
      const typedRoles = (usuarioRoles ?? []) as unknown as UsuarioRolRow[]

      // Check super admin
      const isSuperAdmin = typedRoles.some((ur) => ur.rol?.es_super_admin) ?? false

      setEsSuperAdmin(isSuperAdmin)

      if (isSuperAdmin) {
        // Super admin has full access to all modules
        const allModulos: ModuloPermiso[] = [
          'crm', 'citas', 'taller', 'refacciones', 'ventas',
          'bandeja', 'atencion_clientes', 'csi', 'seguros', 'usuarios', 'reportes',
        ]
        const fullAccess = Object.fromEntries(
          allModulos.map((m) => [
            m,
            {
              puede_ver: true,
              puede_crear: true,
              puede_editar: true,
              puede_eliminar: true,
              puede_exportar: true,
            },
          ])
        ) as PermisosMap
        setPermisos(fullAccess)
        setLoading(false)
        return
      }

      // Merge role permissions (OR logic: if any role grants it, user has it)
      const merged: PermisosMap = {} as PermisosMap

      for (const ur of typedRoles) {
        const rol = ur.rol
        if (!rol) continue
        for (const rp of rol.rol_permisos ?? []) {
          const modulo = rp.modulo as ModuloPermiso
          if (!merged[modulo]) {
            merged[modulo] = { ...DEFAULT_PERMISO }
          }
          merged[modulo].puede_ver = merged[modulo].puede_ver || rp.puede_ver
          merged[modulo].puede_crear = merged[modulo].puede_crear || rp.puede_crear
          merged[modulo].puede_editar = merged[modulo].puede_editar || rp.puede_editar
          merged[modulo].puede_eliminar = merged[modulo].puede_eliminar || rp.puede_eliminar
          merged[modulo].puede_exportar = merged[modulo].puede_exportar || rp.puede_exportar
        }
      }

      // Apply individual overrides (null = inherit, true/false = explicit)
      for (const override of overrides ?? []) {
        const modulo = override.modulo as ModuloPermiso
        if (!merged[modulo]) merged[modulo] = { ...DEFAULT_PERMISO }
        if (override.puede_ver !== null) merged[modulo].puede_ver = override.puede_ver
        if (override.puede_crear !== null) merged[modulo].puede_crear = override.puede_crear
        if (override.puede_editar !== null) merged[modulo].puede_editar = override.puede_editar
        if (override.puede_eliminar !== null) merged[modulo].puede_eliminar = override.puede_eliminar
        if (override.puede_exportar !== null) merged[modulo].puede_exportar = override.puede_exportar
      }

      setPermisos(merged)
      setLoading(false)
    }

    fetchPermisos()
  }, [])

  function can(modulo: ModuloPermiso, accion: keyof PermisoModulo = 'puede_ver'): boolean {
    if (esSuperAdmin) return true
    return permisos?.[modulo]?.[accion] ?? false
  }

  return { permisos, loading, esSuperAdmin, can }
}
