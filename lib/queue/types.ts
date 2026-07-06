/**
 * lib/queue/types.ts — Fase 7 del roadmap de arquitectura.
 * Tipos compartidos por toda la infraestructura de colas.
 */

// Un JobType por dominio, tal y como pidió el roadmap: cada uno se
// procesa de forma independiente, con su propio handler y su propia
// política de reintentos si hace falta.
export type JobType =
  | 'email'
  | 'opportunity-feed'
  | 'watchlist'
  | 'ai-search'
  | 'notification'
  | 'cron'

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'dead'

export interface Job<T = any> {
  id: string
  type: JobType
  payload: T
  attempts: number
  maxAttempts: number
  status: JobStatus
  createdAt: number
  scheduledAt: number
  lastError?: string
  /** Si se define, dos jobs con el mismo lockKey nunca corren en paralelo. */
  lockKey?: string
}

export type JobHandler<T = any> = (payload: T) => Promise<void>

export interface QueueOptions {
  /** Cuántos jobs se procesan en paralelo como máximo. */
  concurrency?: number
  /** Reintentos totales antes de mover el job a la Dead Letter Queue. */
  maxAttempts?: number
  /** Backoff base en ms — el intento N espera `retryBackoffMs * N`. */
  retryBackoffMs?: number
  /** Límite duro de tiempo por ejecución de un job (ms). */
  jobTimeoutMs?: number
}
