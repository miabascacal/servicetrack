import type { DefinicionFlujo } from './tipos'

// El flujo de queja siempre termina en handoff a asesor humano.
// El bot recopila el motivo y escala — nunca resuelve quejas solo.
export const flujoQueja: DefinicionFlujo = {
  id:     'queja',
  nombre: 'Atención de queja',
  campos: [
    { key: 'motivo', label: 'Motivo', required: true, descripcion: 'Descripción de la insatisfacción o problema' },
  ],
}
