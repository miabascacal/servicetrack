import type { DefinicionFlujo } from './tipos'

// Stub — flujo de OT por bot pendiente de implementar.
// Cuando se construya el webhook de recepción, este flujo guiará
// al bot para recolectar los datos mínimos antes de crear la OT.
export const flujoOT: DefinicionFlujo = {
  id:     'ot',
  nombre: 'Creación de Orden de Trabajo',
  campos: [
    { key: 'vehiculo',      label: 'Vehículo',       required: true,  descripcion: 'Marca, modelo y año del vehículo' },
    { key: 'diagnostico',   label: 'Diagnóstico',    required: true,  descripcion: 'Descripción del problema reportado por el cliente' },
    { key: 'fecha_promesa', label: 'Fecha promesa',  required: false, descripcion: 'Fecha estimada de entrega del vehículo' },
  ],
}
