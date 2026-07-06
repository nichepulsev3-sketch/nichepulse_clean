/**
 * lib/queue/QueueService.ts — Fase 7 del roadmap de arquitectura.
 *
 * Cola de trabajo en memoria de proceso único. Es un scaffold, pero
 * funciona de verdad hoy: Railway ejecuta `next start` como un proceso
 * Node persistente (no serverless), así que este bucle de procesamiento
 * corre de forma continua igual que un worker real.
 *
 * Limitación honesta (no oculta): los jobs viven solo en memoria. Si el
 * proceso se reinicia (nuevo deploy, crash, restart de Railway), los
 * jobs pendientes se pierden — no hay persistencia en disco/Redis
 * todavía. Válido hoy para trabajo tolerante a perder una ejecución
 * ocasional (email, notificaciones); el día que haga falta una garantía
 * más fuerte, este archivo es el único sitio a cambiar (sustituir el
 * array interno por una tabla de Supabase o una cola Redis/Upstash) —
 * el resto de la app solo conoce `queue.enqueue()`.
 */
import { createLogger } from '../logger'
import type { Job, JobType, JobHandler, QueueOptions, JobStatus } from './types'

const log = createLogger('queue')

export class QueueService {
  private jobs: Job[] = []
  private handlers = new Map<JobType, JobHandler>()
  private running = 0
  private activeLocks = new Set<string>()
  private deadLetter: Job[] = []
  private opts: Required<QueueOptions>

  constructor(opts: QueueOptions = {}) {
    this.opts = {
      concurrency: opts.concurrency ?? 3,
      maxAttempts: opts.maxAttempts ?? 3,
      retryBackoffMs: opts.retryBackoffMs ?? 5000,
      jobTimeoutMs: opts.jobTimeoutMs ?? 30_000,
    }
  }

  registerHandler<T>(type: JobType, handler: JobHandler<T>) {
    this.handlers.set(type, handler as JobHandler)
  }

  enqueue<T>(type: JobType, payload: T, opts?: { lockKey?: string; maxAttempts?: number }): string {
    const id = crypto.randomUUID()
    this.jobs.push({
      id, type, payload,
      attempts: 0,
      maxAttempts: opts?.maxAttempts ?? this.opts.maxAttempts,
      status: 'pending',
      createdAt: Date.now(),
      scheduledAt: Date.now(),
      lockKey: opts?.lockKey,
    })
    log.info('Job encolado', { id, type, lockKey: opts?.lockKey })
    // Dispara el procesamiento sin bloquear al llamador (fire-and-forget
    // intencional: encolar debe ser instantáneo).
    void this.drain()
    return id
  }

  private async drain() {
    while (this.running < this.opts.concurrency) {
      const next = this.jobs.find(j =>
        j.status === 'pending' &&
        j.scheduledAt <= Date.now() &&
        (!j.lockKey || !this.activeLocks.has(j.lockKey))
      )
      if (!next) return
      this.processOne(next) // no await — se procesan en paralelo hasta `concurrency`
    }
  }

  private async processOne(job: Job) {
    const handler = this.handlers.get(job.type)
    if (!handler) {
      log.warn('Sin handler registrado para el tipo de job — se descarta', { type: job.type })
      job.status = 'dead'
      this.deadLetter.push(job)
      return
    }

    this.running++
    if (job.lockKey) this.activeLocks.add(job.lockKey)
    job.status = 'processing'
    job.attempts++

    try {
      await Promise.race([
        handler(job.payload),
        new Promise((_, reject) => setTimeout(() => reject(new Error('job timeout')), this.opts.jobTimeoutMs)),
      ])
      job.status = 'completed'
      log.info('Job completado', { id: job.id, type: job.type, attempts: job.attempts })
    } catch (err: any) {
      job.lastError = err?.message ?? String(err)
      if (job.attempts >= job.maxAttempts) {
        job.status = 'dead'
        this.deadLetter.push(job)
        log.error('Job movido a Dead Letter Queue tras agotar reintentos', {
          id: job.id, type: job.type, attempts: job.attempts, error: job.lastError,
        })
      } else {
        job.status = 'pending'
        job.scheduledAt = Date.now() + this.opts.retryBackoffMs * job.attempts
        log.warn('Job falló, reintentando con backoff', {
          id: job.id, type: job.type, attempt: job.attempts, nextTryInMs: this.opts.retryBackoffMs * job.attempts, error: job.lastError,
        })
      }
    } finally {
      this.running--
      if (job.lockKey) this.activeLocks.delete(job.lockKey)
      // Purga jobs ya terminados para no acumular memoria sin límite.
      this.jobs = this.jobs.filter(j => j.status === 'pending' || j.status === 'processing')
      void this.drain()
    }
  }

  stats() {
    const byStatus = (s: JobStatus) => this.jobs.filter(j => j.status === s).length
    return {
      pending: byStatus('pending'),
      processing: byStatus('processing'),
      deadLetter: this.deadLetter.length,
      registeredHandlers: Array.from(this.handlers.keys()),
    }
  }

  getDeadLetterQueue(): Job[] {
    return [...this.deadLetter]
  }
}

// Instancia única compartida por toda la app — igual que `cache` en
// lib/services/cache.ts.
export const queue = new QueueService({ concurrency: 3, maxAttempts: 3, retryBackoffMs: 5000 })
