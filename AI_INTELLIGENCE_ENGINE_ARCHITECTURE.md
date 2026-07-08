# NichePulse AI Intelligence Engine — Arquitectura técnica

**Estado: Fase A y Fase B EJECUTADAS en el mismo ciclo (confirmado explícitamente por el CEO — ver §8 histórico abajo).** El esqueleto completo del motor (`lib/services/engine/`) está construido y en uso real: el Copiloto de negocio y el buscador principal (`searchNiches`) ya pasan por la Reasoning Layer (Módulo 7). Los módulos Tier 2 (Prediction, Learning, Niche DNA, Global Market Index, Self-Improvement) tienen su contrato listo pero devuelven honestamente "sin datos suficientes" hasta que se cumplan los umbrales de §6. Módulo 15 (Multi-Agent) sigue siendo solo contratos, sin implementación, tal como se pidió. Ver `NICHEPULSE_PLATFORM_STRATEGY.md` sección "AI Intelligence Engine ejecutado" para el detalle archivo por archivo. Este documento se apoya en, sin sustituir, `NICHEPULSE_PLATFORM_STRATEGY.md` (el mapa de 15 fases en 4 tiers) y `MOTOR_PROPIO_PROPUESTA.md` (Camino A/B). Los tres documentos deben leerse como una sola fuente de verdad: este añade la pieza que faltaba — cómo se ORGANIZAN los módulos entre sí, no solo qué hace cada uno por separado.

## 0. La idea central, en una frase

Hoy el LLM (Claude/OpenAI) recibe una consulta y unas señales de mercado, y decide todo él solo. El objetivo de este rediseño es que, antes de que el LLM vea nada, **NichePulse ya haya reunido, cruzado y evaluado su propio conocimiento** — y que el LLM reciba ese conocimiento ya preparado para poder limitarse a razonar y redactar sobre él, no a inventarlo desde cero. El LLM pasa de ser "el cerebro" a ser "el intérprete". El cerebro es el conjunto de módulos descrito abajo, y vive enteramente dentro de la infraestructura de NichePulse (Supabase + servicios propios), no dentro del proveedor de IA.

Esto no es una metáfora vacía: es la diferencia entre un producto que desaparece el día que OpenAI o Anthropic lancen algo mejor, y un producto cuyo valor sigue existiendo aunque se cambie de proveedor de LLM mañana mismo — porque el conocimiento no vive en el prompt, vive en la base de datos.

## 1. Principio de diseño que gobierna todas las decisiones de abajo

Ya existe una regla fijada por el CEO en `NICHEPULSE_PLATFORM_STRATEGY.md`: *"¿Hace que NichePulse sea más difícil de copiar? Si la respuesta es NO, no implementarla."* A eso se suma la regla de honestidad de `MOTOR_PROPIO_PROPUESTA.md`: nunca simular datos ni presentar como "predictivo" algo sin validar. Este documento añade una tercera, específica de arquitectura:

**No construir un módulo "de mentira" solo para poder decir que existe.** Si un módulo (Prediction Engine, Learning Engine, Niche DNA...) todavía no tiene datos suficientes para ser real, su versión inicial debe devolver honestamente "todavía no tengo suficientes datos para esto" — igual que ya hace `scoringEngine.ts` con `confidence:'sin_datos'` — en vez de fabricar un número con apariencia de precisión. Esto significa que **todos los 16 módulos se diseñan y se dejan preparados ahora**, pero varios de ellos arrancan en un estado honesto de "esperando datos", no desactivados ni ausentes. Es la diferencia entre "no existe" y "existe, sabe que no sabe todavía, y se activará solo cuando tenga con qué".

## 2. Mapa de los 16 módulos: qué ya existe, qué es nuevo, qué espera datos

| # | Módulo | Estado real hoy | Dónde vive / vivirá |
|---|---|---|---|
| 1 | Knowledge Engine | **Ya existe**, disperso en 3 tablas | `niche_searches`, `niches`, `niche_score_history` + `lib/services/nicheGraph.ts` |
| 2 | Niche Intelligence Graph | **Ya existe**, ejecutado (Fase 1) | `supabase/migrations/011_niche_intelligence_graph.sql`, `nicheGraph.ts` |
| 3 | AI Memory (perfil de usuario) | **Ya existe**, solo lectura | `lib/services/userProfile.ts` |
| 4 | Market Memory | **Parcial** — se escribe (`niche_score_history`), no se lee/agrega todavía | Nuevo: `lib/services/marketMemory.ts` |
| 5 | Learning Engine | **No existe** — espera datos | Nuevo, Tier 2: `lib/services/engine/learningEngine.ts` |
| 6 | Prediction Engine | **No existe** — espera datos | Nuevo, contrato ya + stub honesto: `lib/services/engine/predictionEngine.ts` |
| 7 | AI Reasoning Layer | **No existe** — es la pieza nueva central | Nuevo: `lib/services/engine/reasoningLayer.ts` |
| 8 | Proactive AI | **Ya existe**, parcial | `app/api/cron/opportunity-feed`, `app/api/cron/outcome-feedback` |
| 9 | Recommendation Engine | **Parcial** — versión por tags (Fase 7) | `getRelatedNiches()` en `nicheGraph.ts`, evoluciona en `engine/` |
| 10 | Niche DNA | **No existe** — espera Opportunity Score 2.0 | Nuevo, Tier 2 |
| 11 | Global Market Index | **No existe** — espera volumen agregado | Nuevo, Tier 2 (con "versión semilla" antes, ver §6) |
| 12 | AI Confidence | **Parcial** — existe en Camino A (`scoringEngine.ts`), no en el resto | Nuevo contrato compartido: `engine/confidence.ts` |
| 13 | Explainable AI | **Ya existe**, disperso (reasons por score, "Basado en" del Copiloto) | Se formaliza como contrato, no se reconstruye |
| 14 | Self-Improvement | **No existe** — depende de 5 y 6 | Nuevo, Tier 2 |
| 15 | Multi-Agent AI | **No existe** — solo preparación pedida explícitamente | Solo contratos TS, cero código funcional |
| 16 | AI Operating System | **No existe** — es el propio patrón de organización | `lib/services/engine/registry.ts` |

Diez de los dieciséis módulos parten de algo real que ya funciona en producción. Eso es importante: este no es un proyecto desde cero, es formalizar y conectar piezas que ya existen dispersas, más rellenar los huecos reales.

## 3. Diagrama de componentes y flujo de datos

Ver el diagrama adjunto en la conversación. Resumen textual del flujo:

```
┌─────────────────────────────────────────────────────────────────────┐
│  CLIENTES (dashboard, copiloto, watchlist, admin)                    │
└───────────────────────────────┬───────────────────────────────────────┘
                                 │ HTTP
┌───────────────────────────────▼───────────────────────────────────────┐
│  API ROUTES (app/api/*)  — finas, sin lógica de negocio               │
└───────────────────────────────┬───────────────────────────────────────┘
                                 │
┌───────────────────────────────▼───────────────────────────────────────┐
│  MÓDULO 7 · AI REASONING LAYER  (orquestador, nuevo)                  │
│  buildContext(query, userId, geo) ANTES de llamar al LLM:             │
│    ├─ M1 Knowledge Engine   → qué se sabe ya de esta consulta          │
│    ├─ M2 Niche Graph        → nichos relacionados, tags, categoría     │
│    ├─ M3 AI Memory          → perfil: qué prefiere este usuario        │
│    ├─ M4 Market Memory      → cómo evolucionó el score en el tiempo    │
│    ├─ M6 Prediction Engine  → predicción si hay datos, si no: honesto  │
│    ├─ M9 Recommendation     → qué más le podría interesar              │
│    └─ M12 AI Confidence     → cuánta confianza merece este contexto    │
└───────────────────────────────┬───────────────────────────────────────┘
                                 │ contexto enriquecido (JSON estructurado)
┌───────────────────────────────▼───────────────────────────────────────┐
│  LLM (Claude / OpenAI) — INTÉRPRETE, no decisor                       │
│  Razona y redacta usando el contexto que ya le da NichePulse           │
└───────────────────────────────┬───────────────────────────────────────┘
                                 │ respuesta cruda del LLM
┌───────────────────────────────▼───────────────────────────────────────┐
│  M13 EXPLAINABLE AI + M12 CONFIDENCE (post-proceso, nuevo contrato)    │
│  Normaliza: cada afirmación lleva sus motivos y su nivel de confianza  │
└───────────────────────────────┬───────────────────────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    ▼                         ▼
        RESPUESTA AL USUARIO        M1/M2/M4 ESCRIBEN de vuelta
                                    (la búsqueda de hoy es el dato
                                     de mañana — nunca se pierde)

┌─────────────────────────────────────────────────────────────────────┐
│  MÓDULO 8 · PROACTIVE AI (crons, ya existe, se extiende)              │
│  opportunity-feed / outcome-feedback llaman a M7 igual que un usuario  │
│  → detecta cambios → M5 Learning Engine recalibra cuando hay datos     │
│  → M14 Self-Improvement compara predicciones pasadas vs realidad       │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  MÓDULO 16 · AI OPERATING SYSTEM                                      │
│  No es una capa más: es el registro (`registry.ts`) que expone cada    │
│  módulo (1-15) con un contrato TS uniforme, para que M7 pueda          │
│  llamarlos sin saber cómo están implementados por dentro — así se       │
│  puede sustituir/mejorar un módulo sin tocar los demás.                │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  MÓDULO 15 · MULTI-AGENT AI (solo contratos, Tier 3, sin código)       │
│  Research / Market / Competition / Trend / Prediction / Validation /   │
│  Watchlist / Notification Agent — cada uno sería, en el futuro, un      │
│  consumidor más del registro de M16, no una arquitectura paralela.     │
└─────────────────────────────────────────────────────────────────────┘
```

## 4. Contratos TypeScript por módulo

Todos los módulos se exponen con esta forma para que M16 (registry) pueda tratarlos de manera uniforme:

```ts
// lib/services/engine/types.ts

export interface AIConfidence {
  level: 'sin_datos' | 'baja' | 'media' | 'alta'
  dataPoints: number        // cuántos hechos reales sustentan esta respuesta
  reasoning: string         // por qué ese nivel, en una frase
}

export interface Explained<T> {
  value: T
  reasons: string[]         // 1-4 motivos concretos, nunca vacío si confidence > 'sin_datos'
  sources: ('graph' | 'market_history' | 'user_profile' | 'llm' | 'trends_live')[]
}

export interface ReasoningContext {
  query: string
  userId: string
  geo: string
  knownNiche: KnowledgeEntry | null      // M1: si ya existe en el Graph
  related: RelatedNiche[]                // M9
  userProfile: UserProfile | null        // M3 (ya existe, lib/services/userProfile.ts)
  marketTrend: ScoreTrendPoint[] | null  // M4, nuevo
  prediction: Explained<Prediction> | null  // M6 — null honesto si no hay datos
  confidence: AIConfidence               // M12
}

// Contrato que implementa cada módulo — permite sustituir la
// implementación (p.ej. Prediction Engine v1 réglas → v2 modelo
// entrenado) sin que M7 ni M16 tengan que cambiar.
export interface EngineModule<TInput, TOutput> {
  name: string
  tier: 0 | 1 | 2 | 3
  isReady(): Promise<boolean>            // false = honestamente sin datos suficientes
  run(input: TInput): Promise<TOutput>
}
```

```ts
// lib/services/engine/reasoningLayer.ts (nuevo, Módulo 7)
export async function buildContext(input: {
  query: string; userId: string; geo: string
}): Promise<ReasoningContext> { /* orquesta M1-M4, M6, M9, M12 */ }
```

```ts
// lib/services/marketMemory.ts (nuevo, Módulo 4)
export async function getScoreTrend(db, nicheId: string, days = 90): Promise<ScoreTrendPoint[]>
export async function getRisingNiches(db, geo: string, limit = 10): Promise<TrendingNiche[]>
export async function getFallingNiches(db, geo: string, limit = 10): Promise<TrendingNiche[]>
// Las tres son SQL puro sobre niche_score_history, ya poblada desde
// hace semanas por search-niches y el cron opportunity-feed — no
// requieren ninguna migración nueva.
```

```ts
// lib/services/engine/predictionEngine.ts (nuevo, Módulo 6, contrato + stub)
export async function isReady(db): Promise<boolean> {
  const { count } = await db.from('niche_outcomes').select('*',{count:'exact',head:true}).neq('outcome','no_probado')
  return (count ?? 0) >= MIN_LABELED_OUTCOMES   // ver §6, umbral honesto
}
export async function predict(db, nicheId: string): Promise<Explained<Prediction> | null> {
  if (!(await isReady(db))) return null   // honesto: "no", no un número inventado
  // implementación real cuando isReady() sea true
}
```

```ts
// lib/services/engine/registry.ts (nuevo, Módulo 16 — el "sistema operativo")
export const engine = {
  knowledge:    knowledgeEngine,     // M1 — envuelve nicheGraph.ts existente
  graph:        nicheGraphModule,    // M2 — ya existe
  aiMemory:     aiMemoryModule,      // M3 — envuelve userProfile.ts existente
  marketMemory: marketMemoryModule,  // M4 — nuevo
  learning:     learningEngineModule,// M5 — Tier 2
  prediction:   predictionEngineModule, // M6 — Tier 2, stub honesto ya
  reasoning:    reasoningLayerModule,   // M7 — orquestador
  proactive:    proactiveAIModule,      // M8 — envuelve crons existentes
  recommend:    recommendationModule,   // M9 — envuelve getRelatedNiches
  dna:          nicheDNAModule,         // M10 — Tier 2
  marketIndex:  globalMarketIndexModule,// M11 — Tier 2
  confidence:   confidenceModule,       // M12 — nuevo
  explain:      explainableAIModule,    // M13 — formaliza lo existente
  selfImprove:  selfImprovementModule,  // M14 — Tier 2
} as const
// M15 (Multi-Agent) NO se añade al registry todavía — es solo el
// documento de contratos de §7, a propósito, tal como pidió el CEO.
```

## 5. Plan de implementación por fases

**Fase A — Fundacional, riesgo cero, no toca `lib/ai.ts` (se puede empezar ya)**
- Crear `lib/services/engine/` con `types.ts` (contratos) y `registry.ts` (M16).
- Construir `lib/services/marketMemory.ts` (M4) — lectura pura sobre datos que ya existen.
- Construir `reasoningLayer.ts` (M7) con `buildContext()`.
- Construir `predictionEngine.ts` (M6) como **stub honesto**: `isReady()` siempre falso hoy (no hay 300 outcomes todavía), `predict()` siempre devuelve `null` — el contrato existe, la inteligencia real llega en Fase D.
- Formalizar `confidence.ts` (M12) y `explain.ts` (M13) como funciones puras reutilizables (no se inventa: se extraen las reglas de confianza que ya usa `scoringEngine.ts` y se generalizan).
- **Piloto de integración**: conectar `buildContext()` en dos sitios que YA son aislados y de bajo riesgo — `askCopilot` (que hoy arma su contexto a mano dentro de `app/api/copilot/route.ts`, esto solo lo formaliza) y el cron `opportunity-feed` (no está en el camino síncrono de ningún usuario). **Cero cambios en `buildSystem`/`searchNiches`.**

**Fase B — Requiere tu confirmación explícita (toca el núcleo frágil)**
- Conectar `buildContext()` al prompt principal de búsqueda (`searchNiches` en `lib/ai.ts`), igual que ya se hizo de forma acotada con el historial de las últimas 5 búsquedas (`historyContext`). Esto es exactamente la decisión que quedó pendiente en la sección 2.3 de `NICHEPULSE_PLATFORM_STRATEGY.md` — la traigo aquí formalizada porque es la pieza que de verdad convierte "el LLM interpreta datos propios" en realidad para el flujo principal, no solo para el Copiloto.
- Añadir `confidence`/`explain` como campos opcionales en `NicheResult` (aditivo, no rompe búsquedas guardadas antiguas que no los tengan).

**Fase C — Extiende Tier 1, riesgo bajo**
- Recommendation Engine (M9): de "mismos tags" a "usuarios que guardaron X también guardaron Y" (SQL sobre `user_niche_interactions`, sigue sin ser ML).
- Global Market Index (M11) — "versión semilla": un agregado diario simple, oculto detrás de un feature flag que solo se activa solo cuando `marketMemory` confirma volumen suficiente (ver umbral en §6). Se autoactiva, no hay que acordarse de encenderlo a mano.

**Fase D — Tier 2, bloqueada por datos reales, contratos ya listos desde la Fase A**
- Prediction Engine (M6) real, Learning Engine (M5), Self-Improvement (M14), Niche DNA (M10), Opportunity Score 2.0. `isReady()` de cada módulo pasa a `true` solo, sin desplegar nada nuevo, en cuanto los umbrales de §6 se cumplan.

**Fase E — Tier 3, solo documentación**
- Contratos TS de los 8 agentes (M15) en `lib/services/engine/agents.contracts.ts` — interfaces sin implementación, comentario explícito de que es preparación futura, exactamente como se pidió.

## 6. Umbrales honestos para que un módulo Tier 2 se "encienda" solo

Propuesta (ajustable, es la que voy a usar por defecto si no me dices otra cosa):

| Módulo | Se activa cuando |
|---|---|
| Prediction Engine / Learning Engine | ≥ 300 filas en `niche_outcomes` con `outcome != 'no_probado'` |
| Niche DNA / Opportunity Score 2.0 | ≥ 90 días de histórico y ≥ 3 snapshots promedio por nicho en `niche_score_history` |
| Global Market Index (versión real) | ≥ 90 días de histórico agregado de todos los usuarios |
| Self-Improvement | Depende de que Prediction Engine ya lleve ≥ 30 días emitiendo predicciones reales que comparar contra outcomes |

Estos números se calculan automáticamente (`isReady()` en cada módulo, §4) y se muestran como progreso en `/admin/motor-propio` (ya existe el panel; se le añade una sección "Tier 2 readiness" — cuánto falta para cada módulo, no solo si está activo o no).

## 7. Módulo 15 — Multi-Agent AI: solo los contratos pedidos

```ts
// lib/services/engine/agents.contracts.ts — SOLO INTERFACES, SIN IMPLEMENTACIÓN
export interface ResearchAgent    { research(topic: string): Promise<Finding[]> }
export interface MarketAgent      { assessMarket(geo: string, category: string): Promise<MarketAssessment> }
export interface CompetitionAgent { assessCompetition(nicheId: string): Promise<CompetitionReport> }
export interface TrendAgent       { detectTrend(signals: TrendSignal[]): Promise<TrendCall> }
export interface PredictionAgent  { predict(nicheId: string): Promise<Explained<Prediction>> }
export interface ValidationAgent  { validate(claim: string, evidence: Explained<unknown>[]): Promise<boolean> }
export interface WatchlistAgent   { evaluate(watchlistId: string): Promise<AlertCandidate | null> }
export interface NotificationAgent{ notify(userId: string, event: AgentEvent): Promise<void> }
```
Cuando el Graph y el histórico sean ricos (Tier 2/3 cumplidos), cada uno de estos se implementa como un consumidor más de `registry.ts` (M16) — no como una arquitectura paralela nueva.

## 8. Decisiones — histórico de lo preguntado y confirmado

1. **La grande**: ¿Fase B ya, o espera a que Fase A esté validada primero? **Respondida: "Fase A y B juntas ya."** Por eso `searchNiches` en `lib/ai.ts` ya recibe contexto de la Reasoning Layer en este mismo ciclo, no en uno separado.
2. Umbrales de datos del §6 (300 outcomes, 90 días) — **Respondida: usar los propuestos.** Así quedaron implementados en `predictionEngine.ts` (`MIN_LABELED_OUTCOMES = 300`).
3. Ubicación `lib/services/engine/` como carpeta nueva — sin objeción, construida tal cual.
4. Orden de la Fase A — se siguió el propuesto: `marketMemory.ts` → `reasoningLayer.ts` → piloto en Copiloto → Fase B en `searchNiches`.

## 9. Qué se construyó de verdad (post-ejecución)

- `lib/services/engine/types.ts` — contratos (`AIConfidence`, `Explained<T>`, `ReasoningContext`, `EngineModule`).
- `lib/services/engine/confidence.ts` — Módulo 12, `computeConfidence(dataPoints, context?)`.
- `lib/services/engine/predictionEngine.ts` — Módulo 6, `isReady()`/`predict()`/`outcomesUntilReady()`, `MIN_LABELED_OUTCOMES = 300`. Siempre honesto: predict() devuelve `null` hasta que haya datos reales.
- `lib/services/engine/agents.contracts.ts` — Módulo 15, solo interfaces (`ResearchAgent`, `MarketAgent`, `CompetitionAgent`, `TrendAgent`, `PredictionAgent`, `ValidationAgent`, `WatchlistAgent`, `NotificationAgent`). Cero implementación.
- `lib/services/engine/reasoningLayer.ts` — Módulo 7, `buildContext()` (orquesta M1/M2/M3/M4/M6/M9/M12 con `Promise.allSettled`, ningún fallo parcial bloquea el resto) y `contextToPromptBlock()` (convierte el contexto en texto para el prompt del LLM).
- `lib/services/engine/registry.ts` — Módulo 16, objeto `engine` que expone cada módulo de forma uniforme + `getTier2Readiness()` para el panel de admin.
- `lib/services/marketMemory.ts` — Módulo 4, `getScoreTrend`/`getRisingNiches`/`getFallingNiches` sobre `niche_score_history` ya poblada.
- `lib/services/nicheGraph.ts` — añadidas `getKnownNiche()` (lectura del Knowledge Engine) y `getTopNiches()` (centraliza una consulta que antes vivía suelta en el Copiloto). Sigue en ASCII puro, verificado byte a byte tras el cambio.
- `app/api/copilot/route.ts` — refactorizado para pasar por `engine.knowledge.getTop()` y `engine.aiMemory.getUserProfile()` en vez de consultas propias — mismo resultado, ahora formalizado a través del registro (Módulo 16).
- `lib/ai.ts` (`searchNiches`) — **Fase B ejecutada**: nuevo parámetro `opts.userId`/`opts.db`; construye el contexto del motor con timeout propio de 2s (mismo patrón que `trendContext`), lo añade al prompt como bloque adicional (nunca toca el JSON obligatorio de `buildSystem`), y adjunta `engine_confidence` a cada `NicheResult` devuelto — campo aditivo, opcional, no rompe compatibilidad con búsquedas guardadas antes de este cambio. La caché de resultados (Fase 6) se desactiva automáticamente cuando el contexto del motor personaliza algo, igual que ya hacía con el historial de búsquedas.
- `app/api/search-niches/route.ts` — pasa `userId`/`db` a `searchNiches()`.
- `lib/types.ts` — `NicheResult.engine_confidence?` (campo opcional nuevo).

### Limitaciones honestas de esta ejecución

- `buildContext()` busca el nicho conocido (`getKnownNiche`) usando la consulta tal cual la escribe el cliente — funciona perfecto cuando coincide con un nicho ya analizado antes (nombre exacto), pero una consulta amplia tipo "mascotas premium" rara vez coincide con un nombre de nicho ya guardado (esos son más específicos, p.ej. "correas GPS para perros"). El contexto de perfil de usuario (M3) no tiene esta limitación — funciona siempre que el usuario tenga historial, independientemente de si la consulta coincide con algo exacto.
- El piloto en el cron `opportunity-feed` (Módulo 8) mencionado en la Fase A original **no se ejecutó todavía** — se priorizó Copiloto + Fase B (searchNiches) por ser el pedido explícito del CEO. Queda como siguiente paso natural, de bajo riesgo (no está en el camino síncrono de ningún usuario).
- Recommendation Engine (M9) sigue en su versión Tier 1 (solapamiento de tags) — la evolución a "usuarios que guardaron X también guardaron Y" (Fase C) no se construyó en este ciclo.
