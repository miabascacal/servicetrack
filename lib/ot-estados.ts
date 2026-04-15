/**
 * Transiciones permitidas de estado para Órdenes de Trabajo.
 * ÚNICA fuente de verdad — importar desde aquí en acciones y componentes UI.
 * No duplicar esta lógica en ningún otro archivo.
 */
import type { EstadoOT } from '@/types/database'

export const OT_TRANSITIONS: Record<EstadoOT, EstadoOT[]> = {
  recibido:      ['diagnostico', 'en_reparacion', 'cancelado'],
  diagnostico:   ['en_reparacion', 'cancelado'],
  en_reparacion: ['listo', 'cancelado'],
  listo:         ['entregado'],
  entregado:     [],
  cancelado:     [],
}

export const ESTADO_OT_LABELS: Record<EstadoOT, string> = {
  recibido:      'Recibido',
  diagnostico:   'Diagnóstico',
  en_reparacion: 'En reparación',
  listo:         'Listo',
  entregado:     'Entregado',
  cancelado:     'Cancelado',
}
