/**
 * Email con Resend.
 * Requiere variable de entorno: RESEND_API_KEY
 * Remitente por defecto: citas@servicetrack.app
 * (en desarrollo usa onboarding@resend.dev automáticamente)
 */

import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM = process.env.EMAIL_FROM ?? 'ServiceTrack <onboarding@resend.dev>'

export type EmailTipo =
  | 'confirmacion_cita'
  | 'recordatorio_cita'
  | 'cita_cancelada'

interface EnviarEmailParams {
  to: string
  tipo: EmailTipo
  datos: {
    nombre: string
    fecha: string
    hora: string
    agencia: string
    direccion?: string
    servicio?: string
  }
}

export async function enviarEmail(params: EnviarEmailParams): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) return false

  const { subject, html } = buildEmail(params.tipo, params.datos)

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: params.to,
      subject,
      html,
    })
    return !error
  } catch {
    return false
  }
}

// ── Templates ──────────────────────────────────────────────────────────────

function buildEmail(tipo: EmailTipo, d: EnviarEmailParams['datos']): { subject: string; html: string } {
  const base = (titulo: string, cuerpo: string) => `
    <!DOCTYPE html>
    <html lang="es">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px">
        <tr><td align="center">
          <table width="100%" style="max-width:520px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">

            <!-- Header -->
            <tr><td style="background:#2563eb;padding:24px 32px">
              <p style="margin:0;color:#fff;font-size:18px;font-weight:600">${d.agencia}</p>
              <p style="margin:4px 0 0;color:#bfdbfe;font-size:13px">ServiceTrack</p>
            </td></tr>

            <!-- Body -->
            <tr><td style="padding:32px">
              <h1 style="margin:0 0 8px;font-size:22px;color:#111827">${titulo}</h1>
              ${cuerpo}
            </td></tr>

            <!-- Footer -->
            <tr><td style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb">
              <p style="margin:0;font-size:12px;color:#9ca3af">
                Este mensaje fue generado automáticamente por ServiceTrack.<br>
                Si tienes dudas, responde directamente a este correo.
              </p>
            </td></tr>

          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `

  const datosBox = `
    <table style="width:100%;background:#f8fafc;border-radius:8px;padding:16px;margin:20px 0;border-left:3px solid #2563eb">
      <tr>
        <td style="padding:4px 0;color:#6b7280;font-size:13px;width:90px">📅 Fecha</td>
        <td style="padding:4px 0;color:#111827;font-size:13px;font-weight:500">${d.fecha}</td>
      </tr>
      <tr>
        <td style="padding:4px 0;color:#6b7280;font-size:13px">🕐 Hora</td>
        <td style="padding:4px 0;color:#111827;font-size:13px;font-weight:500">${d.hora} hrs</td>
      </tr>
      ${d.servicio ? `<tr>
        <td style="padding:4px 0;color:#6b7280;font-size:13px">🔧 Servicio</td>
        <td style="padding:4px 0;color:#111827;font-size:13px;font-weight:500">${d.servicio}</td>
      </tr>` : ''}
      ${d.direccion ? `<tr>
        <td style="padding:4px 0;color:#6b7280;font-size:13px">📍 Dirección</td>
        <td style="padding:4px 0;color:#111827;font-size:13px">${d.direccion}</td>
      </tr>` : ''}
    </table>
  `

  if (tipo === 'confirmacion_cita') {
    return {
      subject: `✅ Cita confirmada — ${d.fecha} ${d.hora} hrs`,
      html: base(
        `¡Tu cita está confirmada, ${d.nombre}!`,
        `<p style="color:#374151;font-size:15px;line-height:1.6">
          Nos da gusto confirmarte tu cita de servicio en <strong>${d.agencia}</strong>.
        </p>
        ${datosBox}
        <p style="color:#6b7280;font-size:13px;line-height:1.6">
          Si necesitas reagendar o tienes alguna pregunta, responde este correo o contáctanos directamente.
        </p>`
      ),
    }
  }

  if (tipo === 'recordatorio_cita') {
    return {
      subject: `⏰ Recordatorio — tu cita es mañana ${d.hora} hrs`,
      html: base(
        `Recordatorio de cita, ${d.nombre}`,
        `<p style="color:#374151;font-size:15px;line-height:1.6">
          Te recordamos que <strong>mañana</strong> tienes cita de servicio en <strong>${d.agencia}</strong>.
        </p>
        ${datosBox}
        <p style="color:#6b7280;font-size:13px;line-height:1.6">
          Si necesitas cambiar tu cita, responde este correo a la brevedad.
        </p>`
      ),
    }
  }

  // cita_cancelada
  return {
    subject: `Cita cancelada — ${d.fecha}`,
    html: base(
      `Tu cita ha sido cancelada`,
      `<p style="color:#374151;font-size:15px;line-height:1.6">
        Hola <strong>${d.nombre}</strong>, tu cita del <strong>${d.fecha}</strong> en <strong>${d.agencia}</strong> ha sido cancelada.
      </p>
      <p style="color:#374151;font-size:15px;line-height:1.6">
        Para reagendar, responde este correo o contáctanos directamente.
      </p>`
    ),
  }
}
