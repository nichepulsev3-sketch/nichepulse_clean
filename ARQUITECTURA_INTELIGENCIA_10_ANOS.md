# NichePulse — Arquitectura de Inteligencia a 10 años

Documento solicitado como CAIO/CTO/Principal Software Architect/Principal AI Researcher. Continúa directamente sobre `AUDITORIA_INTELLIGENCE_ENGINE.md` (15 fases, ya entregado e implementado en su P0) — no repite lo que ya se resolvió ahí, lo referencia y construye encima. Cada fase de este documento termina con un veredicto explícito: **implementar ahora (P0)**, **diseñar y esperar señal (P1/P2)**, o **descartar** — nunca "sería bonito tener".

Regla que gobierna cada línea de este documento, aplicada literalmente: *¿esto hace que NichePulse sea objetivamente más inteligente y más difícil de copiar dentro de cinco años?* Si la respuesta es no, o es "sí pero no todavía", se dice así, sin maquillaje.

---

## Resumen ejecutivo

El pedido de fondo de este prompt es correcto y es el que de verdad separa un producto con IA de una inteligencia propia: **que el LLM deje de pensar y pase a interpretar**. Hoy NichePulse ya tiene la mitad de esa arquitectura construida sin llamarla así — Knowledge Graph, Market Memory, User Memory, Reasoning Layer, Confidence Engine — porque las fases 1-15 del documento anterior ya la fueron construyendo pieza a pieza. Lo que faltaba, y es el hallazgo central de esta auditoría, es un **único punto de decisión** que tome todo lo que esos módulos ya saben y decida — hoy esa lógica vive repartida (parte en `reasoningLayer.ts`, parte inline en `lib/ai.ts`). Eso es exactamente la Fase 3 de este prompt (Decision Engine), y es la pieza que se implementa en P0.

El resto de fases nuevas de este prompt (Self Learning, Knowledge Graph 2.0, Prediction Engine 2.0, Multiagent Council, Simulation Engine) comparten un mismo patrón: **piden capacidades que requieren volumen de datos que hoy no existe**. Implementarlas ahora sería construir "motores de mentira" — el mismo error que ya se evitó deliberadamente en `predictionEngine.ts` (contrato listo, `isReady()` honesto, cero número inventado). Este documento aplica esa misma disciplina a las 12 fases restantes: para cada una, se deja el contrato/diseño listo, y se define la condición objetiva de datos que activa su implementación real — nunca una fecha de calendario.

La pieza que sí es enteramente nueva y se implementa completa en P0 es la que el propio prompt señala como "no es una funcionalidad, es una disciplina de ingeniería": el **harness de evaluación continua**. Es, con diferencia, la decisión de mayor apalancamiento de todo el documento — sin él, cada cambio futuro al motor es una apuesta a ciegas sobre si lo mejora o lo empeora.

---

## FASE 1 — Auditoría del cerebro actual (delta desde la auditoría anterior)

La auditoría de 15 fases ya cubrió esto en profundidad. Delta desde entonces (los 3 P0 de esa ronda ya están en código, verificados vía Read tool):

- `lib/services/engine/confidence.ts` ya separa volumen (`dataPoints`) de calidad (`dataQuality`) y cobertura (`coverage`) — Fase 5 de este prompt ya está a medio camino.
- `lib/services/engine/reasoningLayer.ts` ya expone `EngineExplanation` (usedSources/missingSources/contradictions) — Fase 4 de este prompt (Evidence Engine) ya está a medio camino.
- `lib/ai.ts::withEngineMeta` (líneas 542-556) es la única lógica de "decisión" que existe hoy, y vive **inline dentro del módulo de llamadas al LLM**, no como módulo propio. Esto es exactamente la "responsabilidad mezclada" que la Fase 1 anterior pidió vigilar. Es el hallazgo más importante de esta ronda.

Ningún módulo nuevo se detecta como redundante o duplicado desde la última auditoría — el código añadido en la ronda anterior (P0.1/P0.2/P0.3) es 100% aditivo y ya está integrado, no hay limpieza pendiente de esa ronda.

---

## FASE 2 — Un verdadero Reasoning Engine

**Diagnóstico honesto**: hoy, técnicamente, el LLM sigue siendo quien "piensa" el veredicto y los 12 scores — `buildSystem()`/`searchNiches()` en `lib/ai.ts` le pide directamente que calcule `opportunity`, `verdict`, `demand`, etc. Lo que NichePulse aporta ANTES de esa llamada (`reasoningLayer.buildContext()`) es contexto, no una hipótesis propia — el LLM puede ignorarlo.

Eliminar esa dependencia por completo (que el motor calcule los 12 scores sin LLM) no es realista hoy: esos scores requieren juicio cualitativo (¿es buena esta descripción de audiencia objetivo?, ¿es creíble este ángulo de venta?) que un sistema de reglas no puede replicar sin muchísimos más datos de entrenamiento de los que existen. Fingir que sí sería el error que este mismo prompt prohíbe explícitamente en su regla absoluta.

Lo que **sí** es realista y es exactamente lo que separa "usar IA" de "tener inteligencia propia": que el LLM deje de ser la única fuente de verdad sobre si su propia respuesta es correcta. Eso ya existe parcialmente vía `detectContradictions()` — el sistema no le pide al LLM que se autoevalúe, contrasta su output contra datos que NichePulse ya tenía antes de preguntarle. Ese es el patrón correcto a escalar, no reemplazar el LLM por reglas.

**Veredicto**: NO reemplazar el LLM por un motor de reglas (produciría peor calidad, no mejor). SÍ formalizar el patrón "el LLM interpreta, NichePulse decide si confiar" como el único punto de decisión — ver Fase 3. **P0** (vía Fase 3, no como módulo separado).

---

## FASE 3 — Decision Engine

Este es el hallazgo central del documento. Hoy la "decisión" (¿qué nivel de confianza final tiene esta respuesta? ¿hay contradicciones? ¿qué evidencia la respalda?) se calcula en tres sitios distintos:

1. `computeConfidence()` en `confidence.ts` — calcula el nivel base.
2. `detectContradictions()` en `reasoningLayer.ts` — detecta contradicciones (pero `reasoningLayer` debería solo *reunir* contexto, no *decidir* nada — está mal ubicado conceptualmente).
3. `withEngineMeta()` en `lib/ai.ts` (líneas 542-556) — combina los dos anteriores, aplica el downgrade de nivel por contradicciones, y arma el objeto final. Esta es la decisión de verdad, y vive mezclada con el módulo de llamadas a Claude/OpenAI.

**Implementación P0**: nuevo módulo `lib/services/engine/decisionEngine.ts`, único punto de decisión del motor. Recibe un nicho ya generado por el LLM + el `ReasoningContext` ya reunido, y devuelve un veredicto de confianza + explicación completos. `detectContradictions()` se traslada aquí desde `reasoningLayer.ts` (que pasa a ser puramente "reúne hechos", nunca "decide" — separación de responsabilidades real, no solo de nombre). `lib/ai.ts::withEngineMeta` pasa a ser una llamada de una línea a `decisionEngine.decide()`.

Cero riesgo de romper nada: es mover lógica ya existente y verificada a su sitio correcto, no cambiar su comportamiento.

---

## FASE 4 — Evidence Engine

Ya existe una versión honesta de esto: `EngineExplanation` (usedSources/missingSources/contradictions). Lo que falta, y es lo que pide explícitamente esta fase, es el lado positivo — no solo "qué contradice al LLM" sino "qué evidencia lo respalda". Hoy, si no hay contradicción, el usuario no sabe si es porque todo encaja o porque no había nada con qué contrastar.

**Implementación P0**: `computeSupportingEvidence()` en `decisionEngine.ts` — misma naturaleza determinista que `detectContradictions()` (sin IA, mismo dato: `niche_score_history`), pero en la dirección contraria: si la tendencia de score se mueve en la MISMA dirección que el veredicto, o si el veredicto de este análisis coincide con `latestVerdict` del Graph, se registra como evidencia de respaldo explícita, no como ausencia de problema. Se añade `supportingEvidence: string[]` a `EngineExplanation`.

Esto es exactamente lo que pide la fase: "qué evidencias la apoyan, qué evidencias la contradicen, qué datos históricos se utilizaron" — las tres ya están cubiertas (usedSources cubre "qué datos históricos"), solo faltaba la primera.

---

## FASE 5 — Confidence Engine (matemático, sin porcentajes inventados)

Ya implementado: Confidence Score (`level`), Coverage Score (`coverage`), Evidence Score (aproximado por `dataPoints` + `usedSources.length`). Faltan, de los que pide esta fase, dos que son calculables HOY sin datos nuevos:

- **Data Freshness**: cuántos días han pasado desde el snapshot más reciente de `niche_score_history` para este nicho. Cálculo: `Math.floor((now - lastRecordedAt) / 86400000)`. `null` si no hay ningún snapshot (nicho nunca analizado).
- **Uncertainty Score**: no es una señal nueva, es la combinación inversa de las que ya existen — `100 - round(coverage*0.4 + (dataQuality ?? 50)*0.4 + min(dataPoints,10)*10*0.2)`. Cuanto menos cobertura, peor calidad y menos puntos, mayor incertidumbre. Pura aritmética sobre datos ya calculados, cero I/O adicional.

Los otros dos que pide la fase — **Prediction Reliability** y **Historical Reliability** — dependen de `niche_outcomes` (resultados reales reportados por usuarios), y esa tabla hoy tiene muy por debajo de las 300 filas necesarias (`predictionEngine.MIN_LABELED_OUTCOMES`). Calcularlos ahora sería inventar un número sobre una muestra estadísticamente inútil — exactamente lo que la fase pide no hacer ("no quiero porcentajes inventados"). Se diseñan aquí, se implementan cuando `niche_outcomes` cruce el umbral (mismo gate que ya usa el Prediction Engine, no uno nuevo):

- *Historical Reliability* = % de predicciones de `verdict='invertir'` de este nicho/categoría cuyo `niche_outcomes.outcome` reportado fue `'exito'`.
- *Prediction Reliability* = error medio entre `opportunity_score` predicho y el resultado real, una vez el Prediction Engine deje de ser un stub.

**Implementación P0**: Data Freshness + Uncertainty Score, añadidos a `AIConfidence` (`confidence.ts`, `types.ts`) — cero I/O nuevo, cero coste, cero riesgo. **P2** (gate: `niche_outcomes` ≥ 300 filas): Prediction Reliability + Historical Reliability.

---

## FASE 6 — Self Learning Engine

Pide recalibración automática sin reentrenar modelos, usando predicciones acertadas/fallidas, feedback, resultados históricos. Diseño (no implementación — el propio dato que necesita, `niche_outcomes` con volumen real, no existe todavía):

El punto correcto para que esto entre no es un modelo nuevo, es un **recalculo periódico de los pesos de `calculateOpportunityFromScores()`** (`lib/ai.ts` líneas 82-100). Hoy esos pesos (`demand: 0.20, growth: 0.15...`) son fijos, elegidos por criterio experto. El día que haya suficientes filas en `niche_outcomes`, un cron mensual puede correr una regresión simple (mínimos cuadrados, no una red neuronal) sobre "score que se le dio a cada sub-factor" vs. "outcome real", y ajustar esos pesos unos puntos porcentuales — nunca reescribirlos del todo de golpe, para que un mes de datos ruidosos no descalibre el sistema entero. El resultado se guarda versionado (tabla `scoring_weights_history`, no se sobreescribe en caliente) para poder revertir si empeora.

**Veredicto**: diseño listo, cero código todavía. **Trigger objetivo de implementación**: `niche_outcomes` ≥ 300 filas (mismo umbral que Prediction Engine — es la misma escasez de datos la que bloquea ambas fases, no dos problemas distintos). **P2**.

---

## FASE 7 — Knowledge Graph 2.0

El grafo actual (`niches`, `niche_score_history`, `user_niche_interactions`, migración 011) ya conecta: usuario↔nicho (interacciones), nicho↔nicho (tags compartidos vía `getRelatedNiches`), nicho↔tiempo (historial de scores), nicho↔país (campo `geo`). Lo que pide esta fase que NO existe: categorías reales (`niches.category` existe en el schema desde el día 1 pero nunca se puebla — ya señalado en la auditoría anterior como el gap #1 del Graph), competidores, alertas y watchlists como nodos conectados al grafo en vez de tablas independientes.

Conectar watchlist/alertas al grafo (añadir `niche_id` como FK en vez de guardar el nombre en texto libre) es la mejora de mayor impacto real aquí — hoy, si un usuario vigila "auriculares inalámbricos" en su watchlist, esa fila no sabe que es el mismo nicho que ya tiene 40 análisis acumulados en `niches`. Eso SÍ es una migración de schema con impacto real y bajo riesgo (añadir una columna nullable, no romper nada existente), pero toca tablas de producción con datos reales de usuarios — no se ejecuta sin tu confirmación explícita, como ya se acordó como norma en esta sesión.

**Veredicto**: poblar `niches.category` con una taxonomía fija (20-30 categorías, asignada por la propia IA en `buildSystem()` como un campo más del JSON ya obligatorio — cero llamadas nuevas, cero coste) es la mejora de mayor apalancamiento y menor riesgo. **P1**, requiere tu confirmación antes de tocar el contrato JSON de `buildSystem`. Conectar watchlist/alertas al grafo vía FK: **P1**, requiere confirmación antes de migración de schema.

---

## FASE 8 — Market Memory

Ya implementado y ya es exactamente lo que pide esta fase: `niche_score_history` es la línea temporal completa de cada nicho (no solo estado actual), `marketMemory.ts` ya expone tendencias por categoría/mercado (`getRisingNiches`/`getFallingNiches` por `geo`). No hay nada que construir — la auditoría anterior ya confirmó que esto NO duplica ninguna otra estructura. **Sin cambios.**

---

## FASE 9 — User Memory

Ya implementado (`userProfile.ts`): recuerda mercados, categorías (tags), score medio aceptado, búsquedas totales — exactamente los campos que pide esta fase, ya usado para personalizar tanto `searchNiches()` como `askCopilot()`. Lo único que pide esta fase y no existe: "errores" y "objetivos" explícitos del usuario. "Errores" ya está cubierto implícitamente (un nicho con `verdict='evitar'` que el usuario ignoró y luego marcó `favorite_add` es una señal de error de criterio, extraíble de los datos ya guardados sin tabla nueva). "Objetivos" (p.ej. "quiero $5k/mes en 90 días") es un dato que hoy nadie captura porque no hay ningún formulario que lo pida — añadirlo sería un campo de UI nuevo, que este prompt pide explícitamente no añadir. **Se descarta por ahora, contradice la restricción del propio prompt.**

---

## FASE 10 — Prediction Engine 2.0

`predictionEngine.ts` es hoy un stub deliberadamente honesto: `isReady()` requiere 300 resultados reales en `niche_outcomes` (hoy muy lejos de ese número), y aunque lo alcanzara, `predict()` todavía no tiene implementación real detrás — es un contrato preparado, no una función que funcione.

El contrato de tipos (`Prediction` en `types.ts`) ya cubre 4 de los 6 campos que pide esta fase: `growthProbability`, `saturationProbability`, `riskLevel`, `estimatedTimeToResults`. Faltan 2: **probabilidad de éxito** y **nivel de competencia esperado**.

**Implementación P0**: extender la interfaz `Prediction` con `successProbability: number | null` y `competitionLevel: number | null`. Esto es cero riesgo — `predict()` sigue devolviendo `null` hasta que `isReady()` sea `true`, así que no cambia ningún comportamiento en producción hoy. Es preparar el contrato completo (igual que ya se hizo con `agents.contracts.ts`), no implementar un modelo. El "explicar siempre el porqué" que pide la fase ya está cubierto por el campo `Explained<Prediction>` (envuelve el valor con `reasons`/`sources`), que ya existe.

**Implementación real de la predicción**: **P2**, gate = `niche_outcomes` ≥ 300 filas.

---

## FASE 11 — Inteligencia colectiva (privacy-safe)

Ya existe y ya se explota, sin llamarlo así: `niches.times_analyzed` y `niches.latest_opportunity_score` son datos agregados de TODOS los usuarios (nunca de uno identificable — la tabla `niches` no tiene `user_id`), y ya alimentan `getTopNiches()`, usado hoy en el Copiloto de negocio. Es, literalmente, "detectar mercados emergentes/nichos populares a partir de datos agregados y anonimizados" — la fase ya está construida, solo no estaba documentada con este nombre.

Lo que falta es extender esa misma señal a nivel de categoría/geo agregados (`getRisingNiches(geo)` ya existe en `marketMemory.ts`) — lo que ya cubre "cambios globales" y "categorías crecientes" que pide la fase. **Sin cambios de código — solo se documenta lo que ya existía disperso.**

---

## FASE 12 — Multiagent Council

Ya evaluado en la auditoría anterior con la misma conclusión que aplica aquí: `agents.contracts.ts` (Módulo 15) son interfaces puras — `ResearchAgent`, `MarketAgent`, `CompetitionAgent`, `TrendAgent`, `PredictionAgent`, `ValidationAgent` — cero implementación, por instrucción explícita tuya en la ronda anterior. Este prompt pide una lista casi idéntica (Research/Trend/Competition/Validation/Risk/Market/Prediction/Chief Intelligence).

Implementarlo hoy sería un consejo de "especialistas" que todos leen exactamente la misma fuente de datos (el mismo Graph, la misma Market Memory) — no aportarían perspectivas independientes, solo el mismo LLM disfrazado de 8 roles distintos, con 8x el coste y latencia. Un consejo de verdad requiere fuentes de evidencia genuinamente independientes entre agentes (p.ej. un Trend Agent que lea señales externas reales de tendencia, un Competition Agent que analice competidores de verdad vía scraping/API) — eso no existe todavía en NichePulse en ninguna forma.

**Veredicto**: sin cambios. **Trigger objetivo, sin cambios respecto a la ronda anterior**: solo vale la pena el día que existan 2+ fuentes de evidencia realmente independientes (hoy hay 1: el LLM + el Graph, que no son independientes entre sí). **P3.**

---

## FASE 13 — Niche Dossier

Los datos de un expediente permanente por nicho ya existen, repartidos: histórico (`niche_score_history`), predicciones (`predictionEngine`, hoy null), riesgos/oportunidades (`risks`/`opportunities` del propio análisis IA), competidores (`competition_description`), nichos relacionados (`getRelatedNiches`), evidencias (`EngineExplanation`), confianza (`AIConfidence`), línea temporal (mismo histórico), recomendaciones (`final_recommendation`). Lo único que falta es una función que los reúna todos en un único objeto — no una consulta nueva a la base de datos, una composición de lo que ya se consulta.

No se implementa ahora porque construir esa función sin un consumidor real (una página o endpoint que la muestre) sería exactamente el "módulo sin uso" que la Fase 1 original pidió evitar — y este prompt prohíbe explícitamente añadir páginas nuevas. El día que se apruebe una vista de "expediente del nicho" (fuera del alcance de "no añadir páginas" de hoy), la función de agregación es trivial de escribir porque cada pieza ya existe por separado.

**Veredicto**: diseño documentado, cero código. **P1**, condicionado a aprobación explícita de una superficie de UI que lo consuma (violaría la restricción de este prompt si se construye sin eso).

---

## FASE 14 — AI Quality Metrics + evaluación continua

Esta es la fase de mayor prioridad real de todo el documento — es la única que el propio prompt marca como "no es una funcionalidad, es una disciplina de ingeniería", y tiene razón: sin esto, cada cambio futuro al motor (incluidos los P0 de este mismo documento) se despliega sin saber si mejora o empeora el sistema.

**Lo que ya existe y sirve de base**: `/admin/motor-propio` + `/api/admin/motor-propio-stats` — panel interno no visible a usuarios, ya mide adopción de `niche_outcomes`. CI (`.github/workflows/ci.yml`) ya corre `npm run test` (Vitest) en cada push/PR a `main` — es decir, **ya existe la tubería de "evaluar automáticamente tras cada cambio"**, solo falta el conjunto de casos que la alimente.

**Implementación P0**: `tests/engine.decision.eval.test.ts` — un conjunto fijo de escenarios deterministas (no requieren llamar a Claude/OpenAI, no cuestan dinero, corren en CI en cada commit) que fijan el comportamiento esperado del Decision Engine y el Confidence Engine ante inputs conocidos: contradicciones que deben detectarse, contradicciones que NO deben dispararse en falso, niveles de confianza esperados para combinaciones concretas de `dataPoints`/`dataQuality`/`coverage`, cálculo correcto de `dataFreshnessDays`/`uncertainty`. Esto es literalmente "evaluar el motor tras cada cambio" — si una futura modificación a `decisionEngine.ts` rompe la calibración, el CI falla en el PR, antes de llegar a producción. Es la versión honesta y ejecutable hoy mismo de lo que pide el prompt con "100 nichos con resultados conocidos": el motor determinista (Decision/Confidence Engine) SÍ se puede evaluar con 100% de certeza hoy porque es aritmética pura, no un LLM.

**Lo que el prompt pide y NO es honesto implementar todavía**: evaluar la CALIDAD del veredicto del LLM (¿el opportunity_score de 82 que dio Claude para "auriculares inalámbricos" es correcto de verdad?) contra 100 nichos con resultado conocido, requiere 100 nichos con `niche_outcomes.outcome` reportado — hoy hay muchos menos. Se deja diseñado (`scripts/eval-calibration.ts`, consulta `niche_outcomes` join `niche_score_history`, calcula precisión real vs. score dado) para correrlo el día que el volumen lo permita — correrlo hoy con 10-20 filas daría una cifra de "precisión" estadísticamente vacía, y quiero evitar publicar un número que parezca riguroso sin serlo.

**Veredicto**: harness determinista del Decision/Confidence Engine — **P0, se implementa ahora**. Harness de calibración de veredictos LLM contra resultados reales — **P1**, gate: `niche_outcomes` ≥ 50 filas (umbral menor que Prediction Engine porque aquí solo se necesita medir, no entrenar nada).

---

## FASE 15 — AI Governance

Pide: toda decisión auditable, toda predicción reproducible, toda recomendación explicable, toda modificación registrada, toda mejora medible, nunca una caja negra.

- *Explicable*: ya cubierto — `EngineExplanation` + `AIConfidence.reasoning`.
- *Medible*: cubierto por Fase 14 (el harness de evaluación es, literalmente, la medición).
- *Reproducible*: parcialmente — `detectContradictions()`/`computeConfidence()` son funciones puras (mismo input, mismo output, siempre), pero el veredicto del LLM en sí no es reproducible por naturaleza (temperatura, no determinista) — eso es una propiedad del proveedor de IA, no algo que NichePulse pueda o deba forzar.
- *Auditable / registrado*: aquí es donde falta trabajo real. Hoy el logger (`createLogger`) registra errores y eventos informativos, pero no hay un registro estructurado y consultable de "qué decisión se tomó, con qué confianza, por qué" por cada búsqueda.

**Implementación P0**: `decisionEngine.decide()` (el mismo módulo nuevo de la Fase 3) emite un log estructurado por cada decisión — nivel de confianza final, número de contradicciones, número de evidencias de respaldo, cobertura — vía el logger ya existente (cero infraestructura nueva, Railway ya captura estos logs). Esto da trazabilidad real hoy mismo sin ninguna tabla nueva.

**Lo que NO se implementa ahora**: una tabla persistente `engine_decisions_log` consultable desde SQL/un panel — eso sí sería una tabla nueva y una superficie de auditoría real, con valor genuino (permitiría, por ejemplo, reconstruir por qué el motor confió en un nicho concreto hace 3 meses), pero es infraestructura nueva no trivial y no se ejecuta sin tu confirmación explícita, siguiendo la misma norma que en Fase 7.

**Veredicto**: logging estructurado por decisión — **P0**. Tabla de auditoría persistente y consultable — **P1**, requiere tu confirmación antes de migración.

---

## FASE 16 — Simulation Engine (solo arquitectura, no implementar)

Instrucción explícita del propio prompt: preparar solo la arquitectura, no implementar. Se respeta literalmente.

Diseño: las preguntas de "qué ocurriría si..." (competencia sube, demanda baja, cambia el CPC, aparece un competidor, cambia el mercado) son, en esencia, perturbaciones controladas sobre los inputs que ya usa `calculateOpportunityFromScores()` — no se necesita un motor de simulación separado, se necesita una función pura `simulateScoreChange(currentScores: IntelligenceScores, perturbation: Partial<Record<ScoreKey, number>>): number` que reciba el score actual y un delta hipotético en uno o más sub-scores, y devuelva el `opportunity_score` resultante recalculado con los mismos pesos de siempre. Es trivial de construir el día que se apruebe porque `calculateOpportunityFromScores` ya hace exactamente ese cálculo — la "simulación" es solo llamarlo con números hipotéticos en vez de los que dio la IA.

**Veredicto**: arquitectura documentada arriba, **cero código**, tal como se pidió explícitamente. **P3**, sin trigger de datos (es una decisión de producto, no de volumen — se activa el día que se decida ofrecerlo, no antes).

---

## FASE 17 — Roadmap (P0-P3)

| # | Ítem | Problema | Solución | Complejidad | Riesgo | Impacto en inteligencia | Impacto en ventaja competitiva |
|---|---|---|---|---|---|---|---|
| **P0.1** | Decision Engine (`decisionEngine.ts`) | Lógica de decisión repartida en 3 sitios, mezclada con las llamadas al LLM | Único módulo que decide, `reasoningLayer` pasa a solo reunir hechos | Baja (mover código ya probado) | Muy bajo | Alto — es la pieza que faltaba para separar "el LLM piensa" de "NichePulse decide" | Alto — es la base de todo lo demás en este documento |
| **P0.2** | Evidence Engine: `supportingEvidence` | Solo se mostraba lo que contradice al LLM, nunca lo que lo respalda | `computeSupportingEvidence()`, determinista, mismo dato que ya se usa | Baja | Muy bajo | Medio — cierra la explicabilidad que quedó a medias | Medio |
| **P0.3** | Confidence Engine: Data Freshness + Uncertainty Score | Faltaban 2 de 7 indicadores pedidos, ambos calculables sin datos nuevos | Aritmética pura sobre datos ya presentes en el contexto | Baja | Muy bajo | Medio | Medio |
| **P0.4** | Prediction Engine 2.0: contrato completo | Faltaban 2 de 6 campos en el tipo `Prediction` | Extender la interfaz, cero cambio de comportamiento (`predict()` sigue null) | Muy baja | Nulo | Bajo hoy, alto el día que se active | Bajo hoy, alto más adelante |
| **P0.5** | Harness de evaluación determinista del motor | Ningún cambio futuro al motor se mide objetivamente antes de desplegar | `tests/engine.decision.eval.test.ts`, ya corre en CI existente | Media | Muy bajo | **Muy alto** — es la disciplina que protege todo lo demás | Muy alto — la única forma de mejorar el motor de forma medible en vez de por intuición |
| **P0.6** | AI Governance: logging estructurado de decisiones | Cero trazabilidad de por qué el motor confió/desconfió de una respuesta concreta | `decisionEngine.decide()` loguea cada decisión vía logger ya existente | Muy baja | Nulo | Medio | Medio |
| P1.1 | Poblar `niches.category` con taxonomía fija | El Graph nunca clasificó por categoría, solo por tags libres | Campo nuevo en el JSON ya obligatorio de `buildSystem` | Media | Bajo si se hace con cuidado | Alto | Alto (activa relaciones de categoría reales, no solo overlap de tags) |
| P1.2 | Conectar watchlist/alertas al Graph vía FK | Watchlist guarda texto libre, no referencia al nicho canónico | Migración: columna `niche_id` nullable en `watchlist` | Media | Medio (toca tabla en producción) | Medio | Medio |
| P1.3 | Niche Dossier (agregación) | Datos del expediente existen dispersos, sin función que los una | Función pura de composición | Baja | Nulo | Medio | Medio — condicionado a que exista una UI que lo consuma |
| P1.4 | Harness de calibración LLM vs. resultados reales | Precisión real del veredicto del LLM no se mide contra outcomes | `scripts/eval-calibration.ts` | Media | Nulo | Alto | Alto |
| P1.5 | Tabla de auditoría persistente (`engine_decisions_log`) | Logging actual no es consultable desde SQL/un panel | Migración + escritura desde `decisionEngine` | Media | Bajo | Medio | Medio |
| P2.1 | Self Learning: recalibración de pesos de `calculateOpportunityFromScores` | Pesos fijos, nunca se ajustan con resultados reales | Regresión simple mensual, versionada | Alta | Medio (puede descalibrar si se hace mal) | Alto | Muy alto — esto es lo que hace que el sistema mejore solo |
| P2.2 | Prediction Reliability / Historical Reliability | Requieren volumen de `niche_outcomes` que no existe | Cálculo directo una vez el umbral se cruce | Baja (una vez hay datos) | Bajo | Alto | Alto |
| P2.3 | Prediction Engine: implementación real | `predict()` sigue siendo un stub | Modelo simple (no ML pesado) sobre `niche_outcomes` | Alta | Medio | Muy alto | Muy alto |
| P3.1 | Multiagent Council | Los "agentes" leerían la misma fuente única, sin aportar nada distinto | Solo si aparecen 2+ fuentes de evidencia independientes | Alta | Alto si se hace antes de tiempo | Bajo hoy | Bajo hoy |
| P3.2 | Simulation Engine | Requiere decisión de producto, no de datos | `simulateScoreChange()`, trivial una vez aprobado | Baja | Bajo | Medio | Medio |
| P3.3 | User Memory: "objetivos" explícitos | Requeriría un formulario/campo de UI nuevo | Contradice la restricción de este mismo prompt | — | — | — | — (descartado, no P3 real) |

---

## Addendum: por qué el orden de implementación P0 es ese y no otro

Los 6 ítems P0 se implementan en este orden porque cada uno depende del anterior: primero el Decision Engine (P0.1) porque es donde vive todo lo demás; Evidence/Confidence (P0.2/P0.3) porque extienden su output; el contrato de Prediction (P0.4) es independiente y sin riesgo, se hace en paralelo; el harness (P0.5) se escribe último porque necesita que el comportamiento final del Decision Engine ya esté fijado para poder fijar sus casos de prueba contra él; el logging de gobernanza (P0.6) se añade dentro del propio Decision Engine en el mismo cambio que P0.1.

Ninguno de los 6 añade una página, un botón, ni una funcionalidad visible para el usuario final más allá de las dos líneas nuevas de texto (`supportingEvidence`, freshness) en el bloque de explicabilidad que ya existe en el modal de detalle del nicho — exactamente el límite que pediste.
