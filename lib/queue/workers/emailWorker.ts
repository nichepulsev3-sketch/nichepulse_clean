/**
 * lib/queue/workers/emailWorker.ts — Fase 7 del roadmap de arquitectura.
 *
 * Ejemplo de worker real registrado en la cola. NO se ha cableado
 * todavía en ningún punto de llamada existente (p.ej. el cron de
 * opportunity-feed sigue enviando emails directamente con
 * `Promise.all(emailJobs)`, tal y como ya funciona hoy) — cambiar esa
 * ruta para pasar por la cola es una decisión aparte, porque cambia el
 * comportamiento (fire-and-forget con reintentos en vez de esperar el
 * resultado en la misma request) y no correspondía imponerla sin
 * confirmación explícita. Este archivo deja lista la pieza para cuando
 * se decida adoptarla.
 */
import { queue } from '../QueueService'
import { sendEmail } from '../../email'

export interface EmailJobPayload {
  to: string
  subject: string
  html: string
}

queue.registerHandler<EmailJobPayload>('email', async (payload) => {
  const sent = await sendEmail(payload)
  if (!sent) throw new Error(`Envío de email falló para ${payload.to}`)
})

/** Encola un email en vez de enviarlo síncronamente — reintenta con backoff y cae a la Dead Letter Queue si falla 3 veces. */
export function enqueueEmail(payload: EmailJobPayload) {
  return queue.enqueue<EmailJobPayload>('email', payload)
}
