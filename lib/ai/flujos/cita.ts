import type { DefinicionFlujo } from './tipos'

// Campos requeridos para el flujo de agendamiento de cita.
// El bot (bot-citas.ts) recolecta estos datos antes de llamar a crear_cita.
export const flujoCita: DefinicionFlujo = {
  id:     'cita',
  nombre: 'Agendamiento de cita',
  campos: [
    { key: 'servicio', label: 'Tipo de servicio', required: false, descripcion: 'Cambio de aceite, revisión general, frenos, etc.' },
    { key: 'fecha',    label: 'Fecha',            required: true,  descripcion: 'Fecha deseada para la cita (YYYY-MM-DD)' },
    { key: 'hora',     label: 'Hora',             required: true,  descripcion: 'Horario seleccionado de los disponibles (HH:MM)' },
  ],
}
