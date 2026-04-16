/**
 * Transiciones permitidas de estado para Órdenes de Trabajo.
 * ÚNICA fuente de verdad — importar desde aquí en acciones y componentes UI.
 * No duplicar esta lógica en ningún otro archivo.
 */
import type { EstadoOT } from '@/types/database'

export const OT_TRANSITIONS: Record<EstadoOT, EstadoOT[]> = {
  recibido:    ['diagnostico', 'en_proceso', 'cancelado'],
  diagnostico: ['en_proceso', 'cancelado'],
  en_proceso:  ['listo', 'cancelado'],
  listo:       ['entregado'],
  entregado:   [],
  cancelado:   [],
}

export const ESTADO_OT_LABELS: Record<EstadoOT, string> = {
  recibido:    'Recibido',
  diagnostico: 'Diagnóstico',
  en_proceso:  'En proceso',
  listo:       'Listo',
  entregado:   'Entregado',
  cancelado:   'Cancelado',
}
