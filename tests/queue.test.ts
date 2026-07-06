/**
 * Tests de lib/queue/QueueService.ts (Fase 7) — verifica el
 * comportamiento real del scaffold: procesamiento, reintentos con
 * backoff y Dead Letter Queue. Usa una instancia propia (no el
 * singleton `queue` compartido) para no interferir con otros tests ni
 * con el registro de handlers de lib/queue/workers/emailWorker.ts.
 */
import { describe, it, expect, vi } from 'vitest'
import { QueueService } from '../lib/queue/QueueService'

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

describe('QueueService', () => {
  it('procesa un job con éxito usando el handler registrado', async () => {
    const q = new QueueService({ concurrency: 1, retryBackoffMs: 10 })
    const received: number[] = []
    q.registerHandler<number>('ai-search', async (payload) => { received.push(payload) })

    q.enqueue('ai-search', 42)
    await wait(50)

    expect(received).toEqual([42])
    expect(q.stats().pending).toBe(0)
  })

  it('reintenta con backoff cuando el handler falla, y termina en éxito si el reintento funciona', async () => {
    const q = new QueueService({ concurrency: 1, retryBackoffMs: 10, maxAttempts: 3 })
    let attempts = 0
    q.registerHandler<null>('notification', async () => {
      attempts++
      if (attempts < 2) throw new Error('fallo transitorio')
    })

    q.enqueue('notification', null)
    await wait(100)

    expect(attempts).toBe(2)
    expect(q.getDeadLetterQueue().length).toBe(0)
  })

  it('mueve el job a la Dead Letter Queue tras agotar maxAttempts', async () => {
    const q = new QueueService({ concurrency: 1, retryBackoffMs: 5, maxAttempts: 2 })
    q.registerHandler<null>('email', async () => { throw new Error('siempre falla') })

    q.enqueue('email', null)
    await wait(50)

    const dlq = q.getDeadLetterQueue()
    expect(dlq.length).toBe(1)
    expect(dlq[0].status).toBe('dead')
    expect(dlq[0].attempts).toBe(2)
  })

  it('un job sin handler registrado va directo a la Dead Letter Queue', async () => {
    const q = new QueueService()
    q.enqueue('cron', {})
    await wait(20)
    expect(q.getDeadLetterQueue().length).toBe(1)
  })
})
