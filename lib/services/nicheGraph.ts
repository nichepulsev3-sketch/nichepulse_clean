/**
 * lib/services/nicheGraph.ts -- Niche Intelligence Graph (Fase 1 de la
 * plataforma, ver NICHEPULSE_PLATFORM_STRATEGY.md).
 *
 * Punto unico donde la app escribe en el grafo (niches, historial de
 * scores, interacciones de usuario). El resto del codigo nunca debe
 * hacer db.from('niches')... directamente -- pasa siempre por aqui,
 * igual que el resto de servicios de lib/services/.
 *
 * Filosofia honesta: esto NO es un motor predictivo. Es la capa de
 * datos que, acumulada durante meses, hace posibles las fases
 * posteriores (timeline, indice, recomendaciones, score predictivo).
 * Hoy solo registra la realidad tal cual llega -- cero inferencia,
 * cero invencion de categoria/relacion que no venga de la IA o del
 * propio usuario.
 *
 * NOTA TECNICA IMPORTANTE: este archivo se escribe deliberadamente en
 * ASCII puro (sin acentos ni caracteres especiales, ni siquiera en los
 * comentarios). En sesiones anteriores, un caracter Unicode combinado
 * (usado para quitar acentos en slugify) se corrompio varias veces al
 * guardarse, rompiendo el build de produccion con "Parsing error:
 * Invalid character". La funcion slugify de abajo quita acentos con
 * charCodeAt() -- comparacion numerica pura, sin ningun caracter no-ASCII
 * en el codigo fuente -- precisamente para que este problema no pueda
 * volver a ocurrir en este archivo.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { createLogger } from '@/lib/logger'

const log = createLogger('services/nicheGraph')

export type InteractionType =
  | 'search' | 'view' | 'watchlist_add' | 'watchlist_remove'
  | 'favorite_add' | 'favorite_remove' | 'export' | 'dismiss'

// Rango Unicode de las marcas diacriticas combinadas (acentos) en
// notacion NFD: U+0300 a U+036F. Comparacion numerica con charCodeAt(),
// nunca un caracter o rango literal en el codigo fuente -- ver nota
// tecnica al principio del archivo.
const COMBINING_MARK_MIN = 0x0300
const COMBINING_MARK_MAX = 0x036f

/** Normaliza un nombre de nicho a un slug estable para deduplicar entidades.
 *  Deliberadamente simple (sin fuzzy matching/embeddings todavia): dos
 *  nombres casi identicos pero no exactos generaran dos nichos distintos.
 *  Es una limitacion honesta, no un bug -- la deduplicacion semantica de
 *  verdad es una mejora de una fase posterior, no de la Fase 1. */
export function slugify(name: string): string {
  const noAccents = Array.from(name.normalize('NFD'))
    .filter(ch => {
      const code = ch.charCodeAt(0)
      return code < COMBINING_MARK_MIN || code > COMBINING_MARK_MAX
    })
    .join('')

  return noAccents
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 120)
}

interface NicheCardLike {
  name: string
  opportunity_score?: number
  verdict?: string
  tags?: string[]
  scores?: Record<string, unknown>
}

/**
 * Registra el analisis de un nicho en el grafo: upsert de la entidad
 * niches, snapshot en niche_score_history, e interaccion search
 * del usuario. Best-effort explicito: cualquier fallo aqui se loguea
 * pero NUNCA debe romper la respuesta de busqueda al usuario -- el
 * grafo es infraestructura de fondo, no una dependencia dura todavia.
 */
export async function recordNicheAnalysis(
  db: SupabaseClient,
  params: {
    userId: string
    card: NicheCardLike
    geo: string
    sourceSearchId?: string
  }
): Promise<void> {
  const { userId, card, geo, sourceSearchId } = params
  if (!card?.name) return

  try {
    const slug = slugify(card.name)
    if (!slug) return

    // Upsert de la entidad canonica. No usamos upsert() de supabase-js
    // porque necesitamos logica condicional (solo subir times_analyzed,
    // fusionar tags sin duplicar) -- mas claro como select + insert/update.
    const { data: existing } = await db.from('niches').select('id, tags, times_analyzed').eq('slug', slug).maybeSingle()

    let nicheId: string
    if (existing) {
      nicheId = existing.id
      const mergedTags = Array.from(new Set([...(existing.tags ?? []), ...(card.tags ?? [])]))
      await db.from('niches').update({
        times_analyzed: (existing.times_analyzed ?? 0) + 1,
        latest_opportunity_score: card.opportunity_score ?? null,
        latest_verdict: card.verdict ?? null,
        tags: mergedTags,
        last_seen_at: new Date().toISOString(),
      }).eq('id', nicheId)
    } else {
      const { data: created, error: insertErr } = await db.from('niches').insert({
        slug,
        display_name: card.name,
        tags: card.tags ?? [],
        times_analyzed: 1,
        latest_opportunity_score: card.opportunity_score ?? null,
        latest_verdict: card.verdict ?? null,
      }).select('id').single()
      if (insertErr || !created) throw insertErr ?? new Error('No se pudo crear el nicho')
      nicheId = created.id
    }

    await db.from('niche_score_history').insert({
      niche_id: nicheId,
      geo,
      opportunity_score: card.opportunity_score ?? null,
      verdict: card.verdict ?? null,
      scores: card.scores ?? {},
      source_search_id: sourceSearchId ?? null,
    })

    await db.from('user_niche_interactions').insert({
      user_id: userId,
      niche_id: nicheId,
      interaction_type: 'search' as InteractionType,
      geo,
    })
  } catch (err: any) {
    // No relanzar: el grafo es best-effort, nunca debe tumbar una busqueda.
    log.error('No se pudo registrar el analisis en el grafo', { niche: card?.name, error: err?.message ?? String(err) })
  }
}

/** Registra una interaccion de usuario que no viene de una busqueda
 *  (watchlist, favoritos, exportacion...). Igual de best-effort. */
export async function recordInteraction(
  db: SupabaseClient,
  params: { userId: string; nicheName: string; type: InteractionType; geo?: string; metadata?: Record<string, unknown> }
): Promise<void> {
  const { userId, nicheName, type, geo, metadata } = params
  try {
    const slug = slugify(nicheName)
    if (!slug) return
    const { data: niche } = await db.from('niches').select('id').eq('slug', slug).maybeSingle()
    if (!niche) return // si el nicho no existe todavia en el grafo, no lo inventamos aqui
    await db.from('user_niche_interactions').insert({
      user_id: userId, niche_id: niche.id, interaction_type: type, geo: geo ?? null, metadata: metadata ?? {},
    })
  } catch (err: any) {
    log.error('No se pudo registrar la interaccion en el grafo', { nicheName, type, error: err?.message ?? String(err) })
  }
}

export interface KnownNicheRecord {
  slug: string
  name: string
  timesAnalyzed: number
  latestOpportunityScore: number | null
  latestVerdict: string | null
  tags: string[]
}

/**
 * Lee la entidad canonica de un nicho si ya existe en el grafo (Modulo 1,
 * Knowledge Engine, ver AI_INTELLIGENCE_ENGINE_ARCHITECTURE.md). Devuelve
 * null si el nicho todavia no se ha analizado nunca -- no se crea nada
 * aqui, esta funcion es de solo lectura.
 */
export async function getKnownNiche(db: SupabaseClient, nicheName: string): Promise<KnownNicheRecord | null> {
  try {
    const slug = slugify(nicheName)
    if (!slug) return null

    const { data, error } = await db
      .from('niches')
      .select('slug, display_name, times_analyzed, latest_opportunity_score, latest_verdict, tags')
      .eq('slug', slug)
      .maybeSingle()

    if (error) throw error
    if (!data) return null

    return {
      slug: data.slug,
      name: data.display_name,
      timesAnalyzed: data.times_analyzed,
      latestOpportunityScore: data.latest_opportunity_score,
      latestVerdict: data.latest_verdict,
      tags: data.tags ?? [],
    }
  } catch (err: any) {
    log.error('No se pudo leer el nicho conocido del grafo', { nicheName, error: err?.message ?? String(err) })
    return null
  }
}

export interface TopNiche {
  display_name: string
  latest_opportunity_score: number | null
  latest_verdict: string | null
}

/**
 * Nichos con mejor opportunity_score reciente en todo el grafo (dato
 * agregado publico, no depende de que usuario los analizo). Usado por
 * el Copiloto de negocio (Fase 11) y por la Reasoning Layer -- antes
 * vivia como una consulta suelta dentro de app/api/copilot/route.ts,
 * se centraliza aqui para que cualquier consumidor pase por el grafo
 * de la misma forma, nunca con un db.from('niches') propio.
 *
 * Los nombres de campo se mantienen igual que la columna de Supabase
 * (snake_case) a proposito: lib/ai.ts (askCopilot) ya los consume asi
 * desde que se construyo la Fase 11 -- cambiar el shape aqui habria
 * significado tocar ese archivo sin necesidad real.
 */
export async function getTopNiches(db: SupabaseClient, limit = 8): Promise<TopNiche[]> {
  try {
    const { data, error } = await db
      .from('niches')
      .select('display_name, latest_opportunity_score, latest_verdict')
      .not('latest_opportunity_score', 'is', null)
      .order('latest_opportunity_score', { ascending: false })
      .limit(limit)

    if (error) throw error
    return (data ?? []) as TopNiche[]
  } catch (err: any) {
    log.error('No se pudieron obtener los nichos con mejor score', { error: err?.message ?? String(err) })
    return []
  }
}

export interface RelatedNiche {
  name: string
  slug: string
  sharedTags: string[]
  timesAnalyzed: number
  latestOpportunityScore: number | null
  latestVerdict: string | null
}

/**
 * Fase 7 (Sistema de descubrimiento) -- ver NICHEPULSE_PLATFORM_STRATEGY.md.
 * Nichos relacionados = otros nichos del Graph que comparten al menos un
 * tag. Deliberadamente sin ML/embeddings: es una query SQL sobre datos
 * que ya existen (niches.tags), no un modelo nuevo. Si niches.category
 * se puebla en el futuro, esta misma funcion es el sitio donde anadir esa
 * senal adicional sin cambiar quien la llama.
 */
export async function getRelatedNiches(
  db: SupabaseClient,
  nicheName: string,
  limit = 5
): Promise<RelatedNiche[]> {
  try {
    const slug = slugify(nicheName)
    if (!slug) return []

    const { data: source } = await db.from('niches').select('id, tags').eq('slug', slug).maybeSingle()
    if (!source?.tags?.length) return []

    const { data: related, error } = await db
      .from('niches')
      .select('slug, display_name, tags, times_analyzed, latest_opportunity_score, latest_verdict')
      .neq('id', source.id)
      .overlaps('tags', source.tags)
      .order('times_analyzed', { ascending: false })
      .limit(limit)

    if (error) throw error

    return (related ?? []).map((n: any) => ({
      name: n.display_name,
      slug: n.slug,
      sharedTags: (n.tags ?? []).filter((t: string) => source.tags.includes(t)),
      timesAnalyzed: n.times_analyzed,
      latestOpportunityScore: n.latest_opportunity_score,
      latestVerdict: n.latest_verdict,
    }))
  } catch (err: any) {
    log.error('No se pudieron obtener nichos relacionados', { nicheName, error: err?.message ?? String(err) })
    return []
  }
}
