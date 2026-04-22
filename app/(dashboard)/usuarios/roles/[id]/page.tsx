import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ensureUsuario } from '@/lib/ensure-usuario'
import { tieneRol } from '@/lib/permisos'
import type { ModuloPermiso } from '@/types/database'
import { EditRolClient } from './EditRolClient'

const MODULOS_KEYS: ModuloPermiso[] = [
  'crm', 'citas', 'taller', 'refacciones', 'ventas', 'bandeja',
  'atencion_clientes', 'csi', 'seguros', 'usuarios', 'reportes',
]

function emptyPermiso() {
  return {
    puede_ver: false,
    puede_crear: false,
    puede_editar: false,
    puede_eliminar: false,
    puede_exportar: false,
  }
}

export default async function EditRolPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  let ctx: import('@/lib/ensure-usuario').UsuarioCtx
  try {
    ctx = await ensureUsuario(supabase, user.id, user.email ?? '')
  } catch {
    notFound()
  }

  if (!tieneRol(ctx.rol, 'admin')) notFound()

  const [rolRes, permisosRes] = await Promise.all([
    admin
      .from('roles')
      .select('id, nombre, es_super_admin, activo, grupo_id')
      .eq('id', id)
      .eq('grupo_id', ctx.grupo_id)
      .single(),
    admin
      .from('rol_permisos')
      .select('modulo, puede_ver, puede_crear, puede_editar, puede_eliminar, puede_exportar')
      .eq('rol_id', id),
  ])

  if (rolRes.error || !rolRes.data) notFound()

  const rol = rolRes.data
  const permisosDB = rolRes.data.es_super_admin ? [] : (permisosRes.data ?? [])

  const initialPermisos = Object.fromEntries(
    MODULOS_KEYS.map((key) => {
      const found = permisosDB.find((p) => p.modulo === key)
      return [key, found ?? emptyPermiso()]
    })
  ) as Record<ModuloPermiso, ReturnType<typeof emptyPermiso>>

  return (
    <EditRolClient
      rolId={rol.id}
      rolNombre={rol.nombre}
      esSuperAdmin={rol.es_super_admin}
      initialPermisos={initialPermisos}
    />
  )
}
