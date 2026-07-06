/**
 * Envío de email vía Resend (API HTTP directa — sin SDK, para no añadir
 * una dependencia nueva al proyecto). Requiere RESEND_API_KEY y
 * RESEND_FROM (p.ej. "NichePulse <alerts@tudominio.com>") en las
 * variables de entorno. Si no están configuradas, no falla el resto del
 * flujo: registra un warning y sigue (best-effort, nunca bloqueante).
 */
import { env } from './env'
import { createLogger } from './logger'

const log = createLogger('email')

export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }): Promise<boolean> {
  const apiKey = env.RESEND_API_KEY
  const from   = env.RESEND_FROM
  if (!apiKey) {
    log.warn('RESEND_API_KEY no configurada — email no enviado', { to })
    return false
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ from, to, subject, html }),
    })
    if (!res.ok) {
      log.error('Envío de email falló', { status: res.status, body: await res.text().catch(() => '') })
      return false
    }
    return true
  } catch (err: any) {
    log.error('Error de red enviando email', { error: err?.message ?? String(err) })
    return false
  }
}

export function opportunityAlertEmail(nicheName: string, message: string, appUrl: string): string {
  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#0d0d18;color:#e8e8f5;border-radius:16px;">
    <div style="font-size:13px;font-weight:700;letter-spacing:1px;color:#7c6fff;text-transform:uppercase;margin-bottom:12px;">NichePulse · Feed de oportunidades</div>
    <div style="font-size:18px;font-weight:800;margin-bottom:10px;">${nicheName}</div>
    <p style="font-size:14px;line-height:1.6;color:#c7c7de;">${message}</p>
    <a href="${appUrl}/dashboard" style="display:inline-block;margin-top:16px;padding:10px 20px;background:linear-gradient(135deg,#7c6fff,#ff6b9d);color:#fff;text-decoration:none;border-radius:10px;font-size:14px;font-weight:600;">Ver en NichePulse →</a>
  </div>`
}

// Motor propio (Fase 1, ver MOTOR_PROPIO_PROPUESTA.md): pide al usuario
// el resultado real de un nicho que vigiló hace 30/60/90 días. Es la
// única forma de que algún día exista un modelo propio entrenado con
// datos reales en vez de solo con la opinión de la IA.
export function outcomeFeedbackEmail(nicheName: string, milestoneDays: 30 | 60 | 90, feedbackUrl: string): string {
  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#0d0d18;color:#e8e8f5;border-radius:16px;">
    <div style="font-size:13px;font-weight:700;letter-spacing:1px;color:#7c6fff;text-transform:uppercase;margin-bottom:12px;">NichePulse · Ayúdanos a mejorar</div>
    <div style="font-size:18px;font-weight:800;margin-bottom:10px;">Hace ${milestoneDays} días vigilabas "${nicheName}"</div>
    <p style="font-size:14px;line-height:1.6;color:#c7c7de;">¿Llegaste a probarlo? Tu respuesta (30 segundos, opcional y anónima si quieres) nos ayuda a que el análisis de nichos sea cada vez más preciso, no solo para ti — para todos.</p>
    <a href="${feedbackUrl}" style="display:inline-block;margin-top:16px;padding:10px 20px;background:linear-gradient(135deg,#7c6fff,#ff6b9d);color:#fff;text-decoration:none;border-radius:10px;font-size:14px;font-weight:600;">Contarnos qué tal →</a>
  </div>`
}
