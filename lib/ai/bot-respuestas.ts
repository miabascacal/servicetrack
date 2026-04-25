import type { IntentTipo } from './types'

export interface RespuestaSimpleParams {
  intent:         IntentTipo
  sentiment:      string
  cliente_nombre: string | null
}

export interface RespuestaSimpleResultado {
  respuesta: string
  handoff:   boolean
}

/**
 * Genera respuestas predefinidas para intenciones que no requieren el loop agéntico de citas.
 * Escala automáticamente cuando el bot no puede resolver solo (cancelar, OT, presupuesto, queja).
 */
export function generarRespuestaSimple(params: RespuestaSimpleParams): RespuestaSimpleResultado {
  const nombre = params.cliente_nombre?.split(' ')[0] ?? 'cliente'

  switch (params.intent) {
    case 'saludo':
      return {
        respuesta: `¡Hola ${nombre}! Bienvenido al servicio de atención de la agencia. ¿En qué puedo ayudarte hoy? Puedo ayudarte a agendar una cita de servicio vehicular.`,
        handoff: false,
      }

    case 'cancelar_cita':
      return {
        respuesta: `Entendido, ${nombre}. Para cancelar tu cita necesito que un asesor te atienda directamente. Te conecto en un momento.`,
        handoff: true,
      }

    case 'consulta_estado_ot':
      return {
        respuesta: `Hola ${nombre}, para consultar el estado de tu vehículo un asesor necesita verificar tu expediente. Te transfiero ahora para darte información precisa.`,
        handoff: true,
      }

    case 'consulta_presupuesto':
      return {
        respuesta: `Hola ${nombre}, para darte un presupuesto preciso necesito que un asesor especializado te atienda. Te contactarán en breve.`,
        handoff: true,
      }

    case 'queja':
      return {
        respuesta: `Lamentamos la situación, ${nombre}. Tu satisfacción es nuestra prioridad. Te comunico de inmediato con un asesor para resolver esto.`,
        handoff: true,
      }

    case 'confirmacion':
      return {
        respuesta: `Perfecto ${nombre}, hemos registrado tu confirmación. ¿Hay algo más en lo que pueda ayudarte?`,
        handoff: false,
      }

    case 'agendar_cita':
      // Fallback — normalmente este caso lo maneja generarRespuestaBot
      return {
        respuesta: `Hola ${nombre}, con gusto te ayudo a agendar tu cita. ¿Para qué fecha te gustaría?`,
        handoff: false,
      }

    case 'otro':
    default:
      if (params.sentiment === 'urgent' || params.sentiment === 'negative') {
        return {
          respuesta: `Hola ${nombre}, entiendo tu situación. Te comunico con un asesor de inmediato para atenderte personalmente.`,
          handoff: true,
        }
      }
      return {
        respuesta: `Hola ${nombre}, recibí tu mensaje. ¿Deseas agendar una cita de servicio o tienes alguna otra consulta?`,
        handoff: false,
      }
  }
}
