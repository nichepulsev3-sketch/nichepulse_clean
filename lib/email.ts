/**
 * Envío de email vía Resend (API HTTP directa — sin SDK, para no añadir
 * una dependencia nueva al proyecto). Requiere RESEND_API_KEY y
 * RESEND_FROM (p.ej. "NichePulse <alerts@tudominio.com>") en las
 * variables de entorno. Si no están configuradas, no falla el resto del
 * flujo: registra un warning y sigue (best-effort, nunca bloqueante).
 */
export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  const from   = process.env.RESEND_FROM?.trim() || 'NichePulse <onboarding@resend.dev>'
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY no configurada — email no enviado a', to)
    return false
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ from, to, subject, html }),
    })
    if (!res.ok) {
      console.error('[email] ❌', res.status, await res.text().catch(() => ''))
      return false
    }
    return true
  } catch (err: any) {
    console.error('[email] ❌ error de red', err?.message ?? err)
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
