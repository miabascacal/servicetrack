// lib/permisos.ts
// Jerarquía de roles del sistema (orden ascendente de privilegio).
// viewer tiene el menor privilegio; super_admin el mayor.

const JERARQUIA: readonly string[] = [
  'viewer',
  'asesor_servicio',
  'gerente',
  'admin',
  'super_admin',
]

/**
 * Retorna true si `rol` tiene al menos el nivel de `minimo`.
 *
 * - Roles desconocidos o nulos se tratan como 'viewer' (mínimo privilegio).
 * - Si `minimo` no existe en la jerarquía, retorna false por seguridad.
 */
export function tieneRol(rol: string | null | undefined, minimo: string): boolean {
  const idxRol  = JERARQUIA.indexOf(rol ?? 'viewer')
  const idxMin  = JERARQUIA.indexOf(minimo)
  if (idxMin === -1) return false   // minimo inválido → denegar
  if (idxRol === -1) return false   // rol desconocido → tratar como viewer
  return idxRol >= idxMin
}
