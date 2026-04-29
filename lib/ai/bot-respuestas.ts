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
 * Respuestas predefinidas para intenciones que no requieren el loop agéntico de citas.
 * Escala automáticamente cuando el bot no puede resolver solo.
 */
export function generarRespuestaSimple(params: RespuestaSimpleParams): RespuestaSimpleResultado {
  const nombre = params.cliente_nombre?.split(' ')[0] ?? 'cliente'

  switch (params.intent) {
    case 'saludo':
      return {
        respuesta: `¡Hola ${nombre}! Soy Ara, el asistente de la agencia.\nPuedo ayudarte con citas, taller, refacciones, ventas y atención general.\n¿Qué necesitas hoy?`,
        handoff: false,
      }

    case 'consulta_horario':
      return {
        respuesta: `¡Claro, ${nombre}! 🕐\n\n*Horarios de atención:*\n• Lunes a viernes: 8:00 AM – 6:00 PM\n• Sábados: 9:00 AM – 2:00 PM\n\n¿Te gustaría agendar una cita?`,
        handoff: false,
      }

    case 'reagendar_cita':
      return {
        respuesta: `Entendido, ${nombre}. Para cambiar la fecha de tu cita necesito que un asesor verifique tu expediente. Te conecto ahora mismo. 📅`,
        handoff: true,
      }

    case 'cancelar_cita':
      return {
        respuesta: `Entendido, ${nombre}. Para cancelar tu cita un asesor necesita confirmarlo en el sistema. Te transfiero en un momento.`,
        handoff: true,
      }

    case 'consulta_estado_ot':
      return {
        respuesta: `Hola ${nombre}, para darte información precisa sobre tu vehículo un asesor necesita revisar tu expediente. Te comunico ahora.`,
        handoff: true,
      }

    case 'consulta_presupuesto':
      return {
        respuesta: `Hola ${nombre}, los presupuestos los prepara un asesor especializado según el diagnóstico de tu vehículo. Te contactarán en breve con toda la información.`,
        handoff: true,
      }

    case 'solicitud_refacciones':
      return {
        respuesta: `Claro, ${nombre}. Te ayudo a canalizar tu solicitud con Refacciones.\n¿Qué pieza necesitas y para qué vehículo?`,
        handoff: false,
      }

    case 'solicitud_taller':
      return {
        respuesta: `Hola ${nombre}, te ayudo con Taller.\nCuéntame qué necesitas revisar de tu vehículo para canalizarlo correctamente.`,
        handoff: false,
      }

    case 'solicitud_ventas':
      return {
        respuesta: `Hola ${nombre}, te ayudo a canalizar tu solicitud con Ventas.\n¿Qué vehículo o cotización te interesa?`,
        handoff: false,
      }

    case 'solicitud_csi':
      return {
        respuesta: `Gracias, ${nombre}. Te ayudo con tu seguimiento de satisfacción.\nCuéntame tu comentario para canalizarlo con el área correcta.`,
        handoff: false,
      }

    case 'solicitud_seguros':
      return {
        respuesta: `Hola ${nombre}, te ayudo a canalizarlo con Seguros.\n¿Me compartes qué pasó y para qué vehículo es?`,
        handoff: false,
      }

    case 'solicitud_atencion_clientes':
      return {
        respuesta: `Entiendo, ${nombre}. Voy a canalizar tu caso con Atención a Clientes para revisarlo contigo.`,
        handoff: true,
      }

    case 'solicitud_recordatorio':
      return {
        respuesta: `Si la automatización está activa, recibirás recordatorio por WhatsApp un día antes de tu cita.\nSi necesitas llamada de un asesor, debo dejar una actividad para seguimiento.`,
        handoff: false,
      }

    case 'solicitud_confirmacion_humana':
      return {
        respuesta: `Entendido, ${nombre}. Lo dejo pendiente para que un asesor te contacte y confirme contigo.`,
        handoff: true,
      }

    case 'queja':
      return {
        respuesta: `Lamentamos la situación, ${nombre}. Tu satisfacción es nuestra prioridad. Te comunico de inmediato con un asesor para resolver esto personalmente.`,
        handoff: true,
      }

    case 'confirmacion':
      return {
        respuesta: `Perfecto, ${nombre}, hemos registrado tu confirmación. ¿Hay algo más en lo que pueda ayudarte?`,
        handoff: false,
      }

    case 'agendar_cita':
      // Fallback — normalmente este caso lo maneja generarRespuestaBot
      return {
        respuesta: `Con gusto te ayudo a agendar tu cita, ${nombre}. ¿Para qué fecha tienes disponibilidad?`,
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
        respuesta: `Hola ${nombre}, recibí tu mensaje. ¿Deseas agendar una cita de servicio o tienes alguna consulta sobre la agencia?`,
        handoff: false,
      }
  }
}
