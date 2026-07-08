# Auditoría de Arquitectura — AI Intelligence Engine de NichePulse

**Autor (rol solicitado):** Principal AI Architect / CTO
**Fecha:** 2026-07-08
**Alcance:** auditoría de diseño, no de código. Basada en lectura completa de `lib/ai.ts`, `lib/services/nicheGraph.ts`, `lib/services/marketMemory.ts`, `lib/services/userProfile.ts`, `lib/services/scoringEngine.ts`, todo `lib/services/engine/*`, las rutas API que los consumen (`search-niches`, `copilot`, `cron/opportunity-feed`) y las migraciones 010/011 de Supabase. No es una repetición del documento de diseño original (`AI_INTELLIGENCE_ENGINE_ARCHITECTURE.md`) ni del documento conceptual (`NICHEPULSE_INTELLIGENCE_BRAIN.md`) — es una revisión crítica de lo que ese diseño se convirtió una vez construido.

**Regla que ha gobernado cada recomendación de este documento:** *¿hace esto que NichePulse sea objetivamente más inteligente y más difícil de copiar dentro de cinco años?* Si la respuesta era no, la recomendación no aparece aquí, por interesante que pareciera.

---

## Resumen ejecutivo (léelo si solo tienes 2 minutos)

El motor tal como está construido hoy es honesto y está bien acotado — esa es su mayor virtud, y es infrecuente. No hay ningún número inventado en ningún sitio: cuando falta un dato, el sistema dice `null` o "sin datos", nunca simula una precisión que no tiene. Esa disciplina es difícil de mantener y ya está pagando dividendos en confianza técnica.

Pero tiene un problema de fondo que ningún módulo nuevo va a arreglar: **el "cerebro" no razona todavía, delega todo el razonamiento en una sola llamada al LLM.** El Reasoning Layer no razona — reúne datos y se los pasa al LLM en un párrafo de texto. Quien realmente decide el veredicto, los 12 scores y las razones sigue siendo Claude/GPT en una sola pasada, sin que NichePulse verifique después si lo que dijo el LLM es coherente con lo que el propio Knowledge Graph sabe. Ese es el hueco más caro de cerrar, y es el único cambio de esta auditoría que toca el corazón del sistema.

El resto de huecos son honestos y ya están documentados como tales en el propio código (`predict()` devuelve `null` a propósito, Multi-Agent es solo interfaces). No hace falta más arquitectura ahí — hace falta paciencia y datos, exactamente como ya se decidió.

---

## FASE 1 — Análisis del cerebro

**¿Está bien dividido?** Sí, en su mayoría. La división en Knowledge (nicheGraph) / Memory (userProfile, marketMemory) / Reasoning (reasoningLayer) / Confidence / Prediction está limpia y cada módulo tiene una sola responsabilidad clara. Esto no es habitual en proyectos que crecen rápido — normalmente todo esto termina en un archivo `ai-helpers.ts` de 2000 líneas. Aquí no ha pasado.

**¿Hay módulos redundantes?** Uno: `registry.ts` (el "AI Operating System") hoy es una fachada que re-exporta funciones de otros cuatro archivos sin añadir ninguna lógica propia. Eso no es necesariamente malo — es el patrón correcto *si* algún día un módulo se sustituye por una v2 sin que quien lo consume lo note — pero hoy, con una sola implementación de cada módulo, es una capa de indirección que no compra nada todavía. No es una redundancia grave, es una capa prematura. Se mantiene (ver Fase 13) porque el coste de quitarla y tener que volver a añadirla en 6 meses es mayor que el coste de dejarla vacía ahora.

**¿Hay responsabilidades mezcladas?** Sí, y es el hallazgo más importante de esta fase: **`lib/ai.ts` (727 líneas) mezcla cinco responsabilidades que no tienen por qué vivir juntas**: (1) orquestación de proveedores LLM (Claude + OpenAI, reintentos, carrera entre ambos), (2) parsing y reparación de JSON malformado devuelto por el LLM, (3) disparo del Reasoning Layer y construcción del bloque de contexto, (4) construcción de los distintos prompts (búsqueda, comparación, plan de acción, copiloto), y (5) cuatro casos de uso distintos (`searchNiches`, `compareNiches`, `generateActionPlan`, `askCopilot`) que comparten infraestructura pero no lógica de negocio. Hoy funciona porque una sola persona (o un asistente) tiene todo el contexto en la cabeza. En un año, con más gente tocando este archivo, cada cambio en el parser de JSON arriesgará romper el copiloto sin que nadie lo relacione. Esto no es un problema de arquitectura del motor de inteligencia en sí — es deuda en la capa de integración LLM que hoy limita cuánto se puede razonar sobre el motor sin razonar también sobre reintentos de proveedor y reparación de JSON al mismo tiempo.

**¿Hay servicios demasiado grandes?** Solo `lib/ai.ts`, por lo de arriba. El resto de `lib/services/engine/*` está en el rango correcto (47–255 líneas), ninguno hace más de una cosa.

**¿Existen dependencias innecesarias?** No. El grafo de imports es un DAG limpio: `reasoningLayer` depende de `nicheGraph`, `userProfile`, `marketMemory`, `predictionEngine`, `confidence` — todos hacia abajo, nunca hacia arriba. `registry.ts` depende de todo lo demás pero nada depende de `registry.ts` salvo dos consumidores (`copilot/route.ts`). No hay imports circulares.

**¿Existen ciclos?** No, cero. Es una de las cosas mejor hechas del sistema.

**¿Existe demasiada complejidad?** No en el motor. Al contrario: hay menos complejidad de la que el nombre "AI Intelligence Engine — 16 módulos" sugiere, y eso es bueno. La complejidad real está concentrada en `lib/ai.ts`, no en el motor.

**¿Qué simplificarías?**
1. Separar de `lib/ai.ts` la reparación de JSON (`parse()`) y la orquestación de proveedores (llamadas Claude/OpenAI, `raceAI`, reintentos) en un módulo de infraestructura propio (p. ej. `lib/services/llmProvider.ts`), dejando en `lib/ai.ts` solo la lógica de negocio (qué prompt construir para cada caso de uso). Esto no es "añadir un módulo" — es partir uno que ya hace demasiado, sin cambiar ningún comportamiento observable.
2. No tocar `registry.ts` todavía. Está bien como está para el volumen de módulos actual.

---

## FASE 2 — Knowledge Graph

**¿Es realmente el corazón del sistema?** A medias. Es el corazón del *dato*, pero no del *razonamiento* — el LLM sigue sin ver ese conocimiento como estructura, lo ve como un párrafo de texto libre (`contextToPromptBlock`). Eso significa que el Graph informa al LLM, pero no *restringe* ni *verifica* lo que el LLM responde. Un Knowledge Graph que de verdad fuera el corazón del sistema condicionaría la salida, no solo la entrada.

**¿Todos los motores utilizan el mismo conocimiento?** Sí, y esto está bien hecho: `userProfile.ts` y `marketMemory.ts` no mantienen su propia copia de datos — leen directamente de las mismas tablas que escribe `nicheGraph.ts` (`user_niche_interactions`, `niche_score_history`). No hay una segunda fuente de verdad en ningún sitio. `getTopNiches` (usado por el Copiloto y por la Reasoning Layer) también lee de la misma tabla `niches`. Esto es exactamente el diseño correcto: un grafo, muchos lectores.

**¿Existen duplicidades?** No a nivel de almacenamiento. La única "duplicidad" es conceptual: `engine.knowledge.getTop` y `engine.recommend.getRelated` en `registry.ts` son ambos alias del mismo `nicheGraph.getRelatedNiches`/`getTopNiches` — nombrados distinto según quién los use. Es un problema cosmético, no funcional.

**¿Falta alguna relación?** Sí, una que importa de verdad: `niches.category` existe en el esquema (migración 011) pero nunca se rellena — es `null` siempre, tal como el propio comentario del SQL admite ("null hasta clasificar de verdad"). Hoy la única relación entre nichos es solapamiento de `tags` (un array de texto libre que la IA genera cada vez, sin vocabulario controlado). Dos nichos casi idénticos con tags escritos de forma distinta ("alto margen" vs "high_margin") no se relacionan entre sí. Esto limita mucho el techo de `getRelatedNiches` y, por extensión, del futuro motor de recomendaciones.

**¿La estructura permitirá crecer durante años?** El esquema relacional (Postgres, no un grafo dedicado) es la decisión correcta al volumen actual y seguirá siéndolo durante mucho tiempo — no hace falta Neo4j para esto. El límite no es de motor de base de datos, es de vocabulario: sin una taxonomía de categorías controlada, el grafo no puede densificarse más allá de "comparten una palabra en un array de texto".

**¿Cómo lo simplificarías?** No lo simplificaría — ya es simple. El riesgo aquí no es exceso de complejidad, es *carencia* de una pieza concreta (taxonomía).

**¿Cómo lo reforzarías?** Con una única adición de bajo riesgo: un vocabulario cerrado de categorías (10-20 categorías de nicho de dropshipping, definidas a mano una vez) y pedirle al LLM que clasifique cada nicho contra ese vocabulario cerrado en la misma llamada que ya genera los 12 scores (un campo más en el JSON, no una llamada nueva). Esto convierte `category` de `null` permanente en un dato real sin coste adicional de latencia ni de llamadas a IA, y es lo que de verdad multiplicaría la calidad de `getRelatedNiches` sin tocar su lógica.

---

## FASE 3 — Memoria

**Inventario real de lo que existe hoy** (no lo que el documento de 16 módulos nombra, sino lo que hay construido):

| Memoria nombrada | ¿Existe como almacén propio? | Qué es en realidad |
|---|---|---|
| Market Memory | No | Vista de lectura sobre `niche_score_history` (agregación en JS, sin tabla propia) |
| User Memory | No | Vista de lectura sobre `user_niche_interactions` + `niches` (agregación en JS) |
| Prediction Memory | No existe | No hay ninguna tabla ni caché de predicciones — coherente, porque `predict()` nunca devuelve nada todavía |
| Learning Memory | No existe | No hay ningún almacén de "lo que el sistema aprendió" — no hay bucle de aprendizaje implementado |
| Watchlist Memory | Sí, parcialmente | La tabla `watchlist` es memoria funcional real (qué vigila cada usuario), pero vive fuera del Graph, en su propio esquema del producto |
| Trend Memory | Sí | `niche_score_history`, la misma tabla que usa Market Memory — no es una memoria distinta |

**¿Hay memoria duplicada?** No. Este es el segundo hallazgo positivo importante: lo que en el documento de 16 módulos se presentaba como "6 tipos de memoria" en la práctica son **dos tablas** (`niche_score_history`, `user_niche_interactions`) leídas con distintas agregaciones según quién pregunta. Eso es exactamente como debería ser — la duplicidad que uno esperaría encontrar en un sistema con ese nombrario ("6 memorias") simplemente no existe en el código real. El diseño evitó la trampa de crear una tabla por cada nombre de módulo.

**¿Qué debería vivir únicamente en el Knowledge Graph?** Ya vive ahí: todo lo agregado (scores históricos, interacciones). No hay nada que mover.

**¿Qué memoria debería desaparecer?** Ninguna de las que existen — no hay nada superfluo que borrar aquí. Lo que sobra no es memoria física, es **nombrario**: seguir llamando "Prediction Memory" y "Learning Memory" a cosas que no existen en el informe de progreso genera la ilusión de que hay 6 sistemas de memoria construidos cuando hay 2 tablas y 2 funciones de lectura. Esto se corrige en la Fase 13 (Eliminación) — no de código, de vocabulario en la documentación.

**¿Qué memoria debería reforzarse?** Watchlist: hoy vive como tabla de producto (para la UI de "vigilar nichos") y no está conectada al Graph salvo indirectamente (el cron re-analiza y escribe en `niche_score_history`). Sería valioso que cada entrada de `watchlist` referenciara `niches.id` directamente en vez de solo `niche_name` (texto libre) — hoy el cron busca coincidencia por nombre exacto entre `watchlist.niche_name` y `freshNiche.name`, lo cual es frágil si la IA devuelve el nombre del nicho con una redacción ligeramente distinta la segunda vez.

---

## FASE 4 — Prediction Engine

**¿Realmente razona?** No, y no debería fingir que lo hace. Hoy `predict()` es, literalmente, dos líneas: comprobar si hay 300 resultados etiquetados (`niche_outcomes` con `outcome != 'no_probado'`) y, si los hay, devolver `null` de todos modos con un `log.warn` diciendo que no hay implementación real. Esto es honesto — mejor un `null` documentado que un número inventado — pero hay que ser preciso sobre lo que significa: **hoy no hay ningún sistema de predicción, hay un contrato a la espera de una implementación que ni siquiera está bosquejada para el día en que lleguen los datos.**

**¿Puede justificar sus respuestas?** No aplica todavía — no hay respuestas que justificar.

**¿Qué datos utiliza?** Ahora mismo, ninguno de verdad (la comprobación de `isReady()` es el único dato que toca: un `count` sobre `niche_outcomes`).

**¿Qué datos le faltan?** El problema no es solo volumen (300 resultados) — es la naturaleza del dato. `niche_outcomes` depende de que un usuario, 30/60/90 días después de vigilar un nicho, vuelva voluntariamente a rellenar un formulario diciendo si le funcionó. Esa es la fuente de dato con más fricción de todo el sistema. Es razonable esperar que, incluso con miles de usuarios activos, la tasa de respuesta a ese formulario sea baja (los productos de feedback post-hoc suelen convertir entre 2-8% sin incentivo). Alcanzar 300 resultados *etiquetados con intención real de negocio* podría tardar mucho más de lo que el umbral sugiere, y eso hoy no se está midiendo ni comunicando en ningún sitio del producto.

**¿Cómo aumentaría su precisión (cuando llegue el momento de implementarlo)?** No con un modelo entrenado — con una **señal proxy más barata y disponible ya**: en vez de esperar solo al feedback explícito de `niche_outcomes`, la primera versión de `predict()` podría razonar sobre la trayectoria observable en `niche_score_history` (¿el score de este nicho ha subido de forma sostenida en las últimas N veces que se re-analizó?) combinada con el feedback explícito cuando exista. Eso convierte el umbral de "300 resultados reportados por usuarios" en algo alcanzable con datos que el sistema *ya* genera solo (cada búsqueda repetida, cada ejecución del cron), sin depender exclusivamente de que un humano rellene un formulario.

**¿Cómo medirías esa precisión?** Con una métrica de calibración, no de acierto binario: de las predicciones marcadas "alta confianza de crecimiento", ¿qué porcentaje efectivamente subió de score o fue reportado como éxito en los siguientes 90 días? Esto se detalla con más rigor en la Fase 12.

---

## FASE 5 — Confidence Engine

Esta es, tal como intuyes, la pieza con más potencial de ventaja competitiva real del sistema — y hoy está sub-explotada porque mide la variable equivocada.

**Lo que hay hoy:** `computeConfidence(dataPoints)` — cuatro umbrales fijos sobre un solo número (cuántos "hechos" hay: veces que se analizó el nicho + búsquedas del usuario + puntos de histórico). Es una medida de **volumen de evidencia**, no de **calidad ni de precisión demostrada**. Un nicho analizado 15 veces con datos contradictorios entre sí tiene "confianza alta" exactamente igual que un nicho analizado 15 veces con datos consistentes. Eso es una confusión conceptual que hay que corregir antes de construir nada más encima.

**Diseño profesional propuesto — cuatro indicadores independientes, no uno solo:**

1. **Nivel de confianza global** (`sin_datos` / `baja` / `media` / `alta`): se mantiene como resumen para la UI, pero se calcula como función de los otros tres, no como sustituto de ellos.

2. **Calidad de datos** (`dataQuality`, 0-100): no es cuántos datos hay, es cuán *consistentes* son entre sí. Cálculo: si `niche_score_history` tiene ≥2 puntos para el nicho, compara la varianza del `opportunity_score` entre snapshots — baja varianza (el LLM converge en resultados parecidos cada vez que analiza el mismo nicho) = alta calidad; varianza alta = calidad baja, aunque haya "muchos" datos. Esto es calculable hoy mismo, sin datos nuevos, solo con lo que ya hay en `niche_score_history`.

3. **Cobertura** (`coverage`, 0-100): de las piezas de contexto que la Reasoning Layer *podría* aportar (nicho conocido, nichos relacionados, perfil de usuario, tendencia de mercado, predicción), ¿cuántas estuvieron realmente disponibles para esta respuesta concreta? Un nicho nuevo sin histórico tiene cobertura baja aunque el LLM responda con aparente seguridad — esto es exactamente lo que hoy se pierde: el usuario no sabe si la IA "sabe mucho" o "sabe poco" sobre ese nicho en particular.

4. **Incertidumbre** (`uncertainty`, texto explícito, no número): la única pieza que debe seguir siendo cualitativa. Ejemplo: "Este nicho nunca se analizó antes en NichePulse — esta respuesta se basa solo en el conocimiento general del modelo de IA, no en datos propios verificados." Este mensaje ya se puede generar hoy con lo que hay en `ReasoningContext.knownNiche === null`, y actualmente no se muestra en ningún sitio.

**Por qué esto es el moat de verdad:** cualquiera puede replicar un "score de confianza" cosmético en una tarde. Lo que no se puede replicar sin los mismos años de datos acumulados es una confianza *calibrada* — es decir, que cuando NichePulse dice "alta confianza", eso históricamente se cumplió más a menudo que cuando dijo "baja confianza". Eso solo se puede demostrar con el tiempo y con `niche_outcomes` real. Por eso Confidence Engine y Prediction Engine (Fase 4) están intrínsecamente unidos: uno no se puede calibrar de verdad sin el otro.

---

## FASE 6 — Explainable AI

**Lo que hay hoy:** cada uno de los 12 scores ya viene con un array `reasons` generado por el LLM (visible en `ScoreGrid.tsx`), y cada veredicto tiene un `verdict_reason`. Esto es explicabilidad de primera capa — el LLM dice por qué llegó a un número — pero tiene un límite estructural: **es la propia IA explicándose a sí misma, sin verificación externa.** Si el LLM alucina un motivo plausible pero falso, hoy nada en el sistema lo detecta.

**Diseño de un sistema de explicabilidad de segunda capa** (esto es lo nuevo, y es barato porque reutiliza datos que el Graph ya tiene):

Para cada respuesta, además de los `reasons` que ya genera el LLM, el sistema debería adjuntar automáticamente (sin IA, con SQL simple sobre `ReasoningContext`) tres bloques:

- **Qué datos propios se usaron:** lista explícita y honesta — "Se usó: histórico de 3 análisis previos de este nicho, perfil de 47 búsquedas del usuario. No se usó: predicción (sin datos suficientes), tendencia de mercado en vivo (nicho nuevo)." Esto ya es literalmente el contenido de `ReasoningContext` — hoy se construye pero solo se convierte en un párrafo de prompt para el LLM (`contextToPromptBlock`); nunca se le devuelve al usuario. Ese es el hueco: el propio input transparente del motor no llega hasta la persona que lo necesita ver.

- **Qué contradice al veredicto de la IA:** comparación determinística (no IA) entre lo que dice el LLM ahora y lo que dice `niche_score_history` de ese mismo nicho. Si el LLM dice "tendencia al alza" pero el último `opportunity_score` guardado bajó respecto al anterior, eso es una contradicción objetiva y detectable con una resta, no con otra llamada a IA.

- **Qué información falta:** honesto y ya disponible — "no hay predicción disponible (faltan datos reales de resultado)", "primera vez que se analiza este nicho", etc.

Este diseño no añade ningún módulo nuevo — usa exactamente el `ReasoningContext` que la Reasoning Layer ya construye hoy y que hoy se descarta después de convertirse en texto de prompt. Es, con diferencia, la recomendación de mayor beneficio por menor coste de todo este documento (ver Fase 15, P0).

---

## FASE 7 — Self Learning

Aceptando la restricción explícita ("no Machine Learning complejo, inteligencia incremental"): el diseño correcto no es un modelo, es un **bucle de ajuste de pesos simples basado en resultados reales**, exactamente como pides.

**Qué debe alimentar el aprendizaje** (todo ya existe como dato, cero infraestructura nueva):
- Predicciones acertadas/falladas → cuando `predict()` exista de verdad (Fase 4), comparar contra `niche_outcomes.outcome`.
- Feedback de usuarios → `niche_outcomes` ya lo captura.
- Cambios históricos → `niche_score_history`.
- Watchlists → tabla `watchlist`.
- Alertas → tabla `opportunity_alerts`.

**Cómo debe aprender (mecanismo concreto, sin ML):** un job periódico (mismo patrón que el cron `opportunity-feed`, que ya existe y ya tiene locking/reintentos resueltos) que recalcule, cada vez que hay nuevos `niche_outcomes`, un pequeño conjunto de **coeficientes de ajuste** guardados en una tabla (no en código): por ejemplo, "de los nichos con `tag='high_margin'` marcados como éxito, ¿cuál fue el `opportunity_score` medio con el que la IA los analizó la primera vez?" Si ese promedio es consistentemente distinto de los nichos marcados como fracaso, ese es un coeficiente real y medible que puede inyectarse de vuelta al `contextToPromptBlock` como una frase más de contexto ("nichos con estas características tuvieron éxito real en el X% de los casos reportados") — sin entrenar nada, sin modelo, solo SQL agregando resultados reales y una tabla de coeficientes que se recalcula sola.

**Por qué esto es "inteligencia incremental" de verdad:** el sistema de hoy (Día 1) y el de dentro de seis meses (con 50 resultados reportados) generarían prompts distintos automáticamente, sin ningún despliegue de código nuevo — el propio contenido del contexto mejora con el uso. Esto es exactamente el tipo de mejora que el KPI que propones al final de tu mensaje ("¿es hoy más inteligente que hace 30 días?") puede medir de forma objetiva.

---

## FASE 8 — Inteligencia colectiva

**¿Merece la pena?** Sí, con un límite claro de qué se agrega y qué nunca se toca.

**Lo que se puede agregar sin riesgo de privacidad, porque ya es agregado por diseño:** `niches.times_analyzed`, `niches.latest_opportunity_score` — estos campos, por construcción, ya combinan la actividad de *todos* los usuarios sobre un mismo nicho (el `upsert` en `recordNicheAnalysis` no distingue quién preguntó). Es decir: **la inteligencia colectiva agregada más valiosa ya se está acumulando hoy, en la tabla `niches`, sin que nadie la esté explotando todavía.** No hace falta construir nada nuevo para tener "categorías en crecimiento" o "nichos más analizados" — hace falta una consulta sobre datos que ya existen (parcialmente esto ya lo hace `getTopNiches`, usado en el Copiloto).

**Lo que nunca debe tocarse:** `user_niche_interactions` está protegido por RLS a nivel de usuario (`auth.uid() = user_id`) — eso debe seguir así sin excepción. Cualquier agregación cruzando usuarios debe pasar exclusivamente por vistas ya agregadas a nivel de `niches`, nunca por una consulta que agrupe `user_niche_interactions` por usuario y la exponga fuera del propio usuario.

**Ventajas:** cuantos más usuarios use NichePulse, más rico es `niches` para *todos* — un efecto de red real sobre datos de mercado, no sobre datos personales. Esto es exactamente lo que hace que el producto mejore con la escala sin comprometer nada.

**Riesgos:** el único riesgo real es de re-identificación indirecta si se expusiera alguna vez un dato agregado con muestra demasiado pequeña (p. ej. "el único usuario que analizó este nicho de nicho fue de España" podría, en teoría, identificar a alguien indirectamente si el nicho es suficientemente raro). Mitigación simple: cualquier agregado que se muestre públicamente debe tener un mínimo de N observaciones antes de mostrarse (p. ej. `times_analyzed >= 5`), igual que ya hace `getTopNiches` implícitamente al ordenar por score.

---

## FASE 9 — Multiagentes

**¿Merece la pena hoy?** No. Y hay que decirlo con la misma franqueza con la que se pide en el prompt: con el volumen de datos actual (un Knowledge Graph con `category` sin poblar, sin predicciones reales, sin bucle de aprendizaje cerrado todavía), siete agentes especializados coordinándose producirían siete llamadas a LLM analizando esencialmente el mismo contexto pobre desde ángulos distintos — más coste, más latencia, más superficie de fallo, sin más inteligencia real detrás. Los contratos (`agents.contracts.ts`) ya están correctamente dejados como interfaces puras sin implementación, y esa sigue siendo la decisión correcta.

**Cuándo sí merecería la pena (condición objetiva, no de calendario):** cuando existan al menos dos fuentes de razonamiento genuinamente distintas que aporten información diferente sobre la misma pregunta — no antes. Hoy el sistema tiene una: el LLM analiza texto. El día que exista una segunda fuente de razonamiento real y distinta (por ejemplo: el resultado calibrado del Prediction Engine de la Fase 4, una vez que deje de ser un stub) es el momento en que un "Chief Intelligence Agent" que pondere el LLM contra el Prediction Engine deja de ser teatro arquitectónico y empieza a aportar algo que un solo agente no podría: sintetizar dos fuentes de verdad independientes. Con una sola fuente, no hay nada que sintetizar.

**Si algún día se activa:** los contratos ya definidos en `agents.contracts.ts` son razonables, pero el `ChiefIntelligenceAgent` que el prompt original menciona no debería ser un octavo agente más — debería ser, literalmente, la Reasoning Layer actual evolucionada (Módulo 7), no una pieza nueva. Evita la trampa de construir un "director de orquesta" como concepto separado cuando ya existe un orquestador (la Reasoning Layer) que solo necesita más fuentes que dirigir.

---

## FASE 10 — Motor de decisiones

Aquí está el rediseño más importante de todo el documento porque es el único que exige un cambio real de flujo, no solo de calidad de datos.

**Flujo de hoy (real, verificado en `lib/ai.ts`):**
```
Query del usuario
  → Reasoning Layer reúne contexto (Graph + Memory + Confidence) — timeout 2s
  → Contexto se convierte en un párrafo de texto
  → UNA llamada al LLM que recibe ese párrafo + el prompt del sistema
  → El LLM genera veredicto + 12 scores + razones, todo en la misma respuesta
  → Se devuelve tal cual, con la confianza del CONTEXTO adjunta (no del resultado)
```

El problema de este flujo no es que sea corto — es que **no hay ningún punto de verificación entre lo que el LLM afirma y lo que el propio Knowledge Graph sabe.** El LLM podría decir que un nicho está "en fuerte crecimiento" mientras `niche_score_history` muestra que su score lleva tres análisis seguidos bajando, y el sistema se lo creería igual.

**Pipeline propuesto — el cambio real es añadir un paso de contraste DESPUÉS del LLM, no antes:**

```
1. Recibir consulta
2. Reunir contexto propio (esto YA EXISTE — Reasoning Layer sin cambios)
3. Generar hipótesis (esto YA EXISTE — es la llamada actual al LLM,
   sin cambios en su prompt ni su JSON de salida)
4. CONTRASTAR la hipótesis contra el contexto propio (PASO NUEVO,
   determinístico, sin IA, sin coste, sin latencia relevante):
   - ¿El verdict del LLM es coherente con la trayectoria de
     niche_score_history si existe? (resta simple)
   - ¿Los scores nuevos están dentro de un rango razonable respecto
     al último snapshot guardado, o hay un salto brusco sin
     explicación en 'reasons'?
5. Calcular confianza FINAL combinando:
   - confianza de contexto (lo que ya calcula computeConfidence)
   - resultado del contraste del paso 4 (si hay contradicción,
     la confianza baja explícitamente y se dice por qué)
6. Adjuntar explicación de segunda capa (Fase 6): qué se usó,
   qué contradice, qué falta
7. Responder
```

**Por qué este diseño y no el que proponías en el prompt (el de "consultar competencia → validar hipótesis → generar respuesta" en varios pasos secuenciales de IA):** cada paso adicional que llama a un LLM multiplica coste y latencia sin garantía de multiplicar inteligencia — es el mismo modelo respondiéndose preguntas a sí mismo varias veces, lo cual da la *sensación* de razonamiento sin producir necesariamente una mejora medible. El paso 4 de arriba consigue el efecto que se busca (que el sistema no repita ciegamente lo que dice el LLM) con una comparación aritmética sobre datos que NichePulse ya posee, sin ninguna llamada adicional a IA. Es más barato, más rápido, más auditable y — precisamente por no depender de más IA — más difícil de replicar por un competidor que solo tenga acceso a los mismos modelos de lenguaje que tú.

---

## FASE 11 — Arquitectura futura (solo arquitectura, sin funcionalidades)

**Horizonte 0-12 meses:** cerrar el paso 4 de la Fase 10 (contraste determinístico) y la explicabilidad de segunda capa (Fase 6). Ambos son extensiones de la Reasoning Layer existente, no módulos nuevos. El Knowledge Graph gana un vocabulario de categorías cerrado (Fase 2). Nada de esto cambia el esquema de módulos ya diseñado — lo completa.

**Horizonte 12-24 meses:** si el volumen de `niche_outcomes` lo permite, `predict()` deja de ser un stub. En cuanto eso ocurre, el Confidence Engine (Fase 5) puede calibrarse de verdad contra resultados reales en vez de solo contar volumen de evidencia. Esto es una condición de datos, no de calendario — puede pasar antes o después de los 12 meses según la velocidad real de adopción del feedback de usuarios.

**Horizonte 24-36 meses:** con `predict()` real y calibrado, y con el bucle de Self Learning (Fase 7) ajustando coeficientes desde hace tiempo, es el momento arquitectónicamente correcto para evaluar Multi-Agent (Fase 9) — porque solo entonces habrá una segunda fuente de razonamiento genuina (el Prediction Engine) que sintetizar contra el LLM.

**Horizonte 36-60 meses:** si el volumen de nichos y relaciones crece varios órdenes de magnitud, es cuando tendría sentido evaluar migrar el almacenamiento relacional del Graph (hoy Postgres) a un motor de grafos dedicado — no antes, y no porque "toca", sino porque las consultas de `getRelatedNiches` empezarían a degradarse con joins profundos que Postgres no está optimizado para resolver a esa escala. Esta es una decisión de infraestructura, no de inteligencia — se documenta aquí para que quede escrita, no porque haya ninguna urgencia.

**Principio que gobierna los cuatro horizontes:** cada fase depende de que la anterior tenga datos reales, no de que haya pasado tiempo en el calendario. Forzar un horizonte antes de que sus datos existan es exactamente el error que este documento pide evitar.

---

## FASE 12 — Medición

| Métrica | Qué mide | Cómo calcularla con lo que existe hoy |
|---|---|---|
| Precisión de predicciones | Si `predict()` acierta cuando existe | % de predicciones "alta probabilidad de crecimiento" cuyo `niche_outcomes.outcome = 'exito'` en los siguientes 90 días |
| Cobertura de datos | Cuánto contexto propio tiene cada respuesta, en promedio | Media de `coverage` (Fase 5) sobre todas las búsquedas de una semana |
| Calidad de conocimiento | Cuán consistente es el Graph consigo mismo | Media de `dataQuality` (Fase 5) — varianza de `opportunity_score` entre snapshots del mismo nicho |
| Tiempo de descubrimiento | Cuánto tarda un nicho nuevo en tener histórico útil | Días entre `first_seen_at` y el segundo registro en `niche_score_history` del mismo nicho |
| Alertas útiles | Si el Feed de Oportunidades genera ruido o señal | % de `opportunity_alerts` que el usuario abrió o actuó sobre ellas (hoy no se registra — requiere un `read_at`/`clicked_at` en `opportunity_alerts`, cambio mínimo) |
| Recomendaciones aceptadas | Si `getRelatedNiches` de verdad ayuda | % de nichos sugeridos por "relacionados" que terminan en `favorite_add`/`watchlist_add` — ya rastreable cruzando `user_niche_interactions` |
| Errores | Fallos silenciosos del motor | Ya se loguean con `createLogger` en cada módulo — falta centralizar en un dashboard, no falta instrumentación |
| Confianza media | Si el sistema, en agregado, dice saber más con el tiempo | Media de `dataPoints` de `computeConfidence` por semana — debería subir mes a mes si el Graph crece |

**El KPI que propones al final** ("¿es hoy el motor más inteligente que hace 30 días?") se descompone exactamente en las ocho filas de arriba, medidas semana a semana. Ninguna de las ocho requiere infraestructura nueva de analítica — todas son consultas SQL sobre tablas que ya existen, salvo el `read_at` de alertas, que es un campo, no un sistema.

---

## FASE 13 — Eliminación

Lo que sobra hoy no es código — es **nombrario que promete más de lo que hay construido**, y una capa de indirección prematura:

1. **`registry.ts` como "AI Operating System"**: el nombre es más grande que la función actual (una fachada de re-exports). No se elimina el archivo — se simplifica la expectativa: es un índice de módulos, no un sistema operativo. Coste de arreglarlo: cero código, solo el comentario de cabecera.
2. **Nombrario de "6 memorias"** en la documentación de progreso: como se detalla en la Fase 3, en el código real hay 2 tablas. Mantener el nombre de 6 módulos en los documentos de arquitectura (para el diseño futuro) está bien; presentarlo como "6 sistemas ya construidos" en cualquier resumen de estado no lo está.
3. **`engine.recommend.getRelated` como alias de `engine.graph.getRelated`** en `registry.ts`: son literalmente la misma función expuesta dos veces bajo nombres de módulo distintos. Se puede colapsar a una sola entrada sin romper nada — hoy nada externo depende de que existan las dos rutas.
4. **Nada del código de `lib/services/engine/` debe eliminarse.** Cada archivo hace exactamente una cosa y la hace bien. La tentación en una auditoría como esta es "quitar módulos para simplificar" — aquí no hay nada que quitar a ese nivel, el problema nunca fue exceso de módulos.

---

## FASE 14 — Ventaja competitiva

Respuesta directa, sin suavizarla: **si mañana OpenAI, Google o Anthropic copiaran toda la interfaz de NichePulse, hoy seguiría siendo imposible de copiar exactamente una cosa: los datos acumulados en `niches` y `niche_score_history` a lo largo del tiempo, generados por uso real.** Un competidor que empiece hoy, aunque tenga acceso a modelos de IA idénticos o mejores, empieza con `times_analyzed = 0` en todo. Eso no se compra ni se replica con más ingeniería — solo con tiempo y usuarios reales, que es exactamente lo que un laboratorio de IA grande no puede fabricar de la noche a la mañana por mucho presupuesto que tenga.

**Con la misma honestidad: hoy ese moat es real pero todavía débil**, por tres razones concretas identificadas en este documento:
- El Graph no tiene taxonomía (`category` vacío) — el dato acumulado es menos denso de lo que podría ser.
- El Confidence Engine mide volumen, no precisión calibrada — así que hoy NichePulse no puede demostrar con datos que su "alta confianza" signifique algo mejor que un LLM genérico diciendo lo mismo.
- El Prediction Engine, la pieza que convertiría datos históricos en ventaja predictiva demostrable, es un stub sin implementación bosquejada.

**Cómo fortalecerlo, en orden de impacto real:**
1. Cerrar el paso de contraste determinístico (Fase 10) — es lo que hace que las respuestas de NichePulse dejen de ser "lo mismo que preguntarle a Claude directamente con más contexto" y empiecen a ser verificablemente distintas de usar el LLM en crudo.
2. Calibrar el Confidence Engine contra resultados reales en cuanto haya suficiente `niche_outcomes` (Fase 5) — el día que NichePulse pueda decir "cuando decimos alta confianza, acertamos el X% de las veces, medido sobre Y casos reales", eso es un dato que ningún competidor puede enunciar sin los mismos años de histórico.
3. Poblar la taxonomía del Graph (Fase 2) — multiplica la densidad de relaciones sin coste adicional de IA.

El moat de NichePulse no es el modelo de IA que usa — nunca lo fue, y nunca debería intentar serlo, porque esa carrera la gana quien tiene más GPUs. El moat es lo que NichePulse sabe sobre nichos de dropshipping que ningún proveedor de modelos de lenguaje genérico sabe, acumulado análisis a análisis. Hoy ese conocimiento existe pero está infrautilizado — se usa para *informar* al LLM, no para *verificarlo* ni para *demostrar* precisión frente al usuario. Ese es el trabajo pendiente, y es exactamente lo que las Fases 5, 6 y 10 de este documento proponen cerrar.

---

## FASE 15 — Informe final: recomendaciones clasificadas

Cada recomendación de esta tabla ha pasado la pregunta obligatoria: *¿hace que NichePulse sea objetivamente más inteligente y más difícil de copiar dentro de cinco años?* Las que no la pasaban no están aquí — en particular, no hay ninguna recomendación de "añadir Multi-Agent ahora" ni de "más módulos", porque ninguna de las dos lo habría hecho.

### P0 — Imprescindible

**P0.1 — Paso de contraste determinístico entre el LLM y el Knowledge Graph (Fase 10)**
- *Problema:* el sistema nunca verifica si lo que dice el LLM es coherente con lo que el propio Graph ya sabe sobre ese nicho.
- *Riesgo de no hacerlo:* el "Intelligence Engine" sigue siendo, en la práctica, un LLM con más contexto de entrada — no una inteligencia verificable.
- *Beneficio esperado:* primera diferencia funcional real y medible entre NichePulse y "preguntarle directamente a Claude".
- *Complejidad:* baja — comparación aritmética sobre datos que ya existen en `ReasoningContext`, sin llamadas a IA adicionales.
- *Impacto en inteligencia del sistema:* alto.
- *Impacto en escalabilidad:* neutro (no añade coste por request).
- *Impacto en ventaja competitiva:* alto — es la pieza que Fase 14 identifica como la más urgente.

**P0.2 — Explicabilidad de segunda capa: exponer `ReasoningContext` al usuario (Fase 6)**
- *Problema:* el sistema ya calcula qué datos propios usó y con qué confianza, pero ese razonamiento se descarta después de convertirse en texto de prompt — nunca llega al usuario.
- *Riesgo de no hacerlo:* se sigue pidiendo confianza sin mostrar por qué merece esa confianza.
- *Beneficio esperado:* transparencia verificable, la base de cualquier "Explainable AI" real.
- *Complejidad:* baja — es serializar un objeto que ya se construye, no calcular nada nuevo.
- *Impacto en inteligencia del sistema:* medio (no hace al sistema más listo, lo hace demostrablemente confiable).
- *Impacto en escalabilidad:* nulo.
- *Impacto en ventaja competitiva:* alto — nadie puede copiar una explicación basada en datos que no tiene.

**P0.3 — Confidence Engine: separar volumen de calidad (Fase 5)**
- *Problema:* hoy "confianza alta" solo significa "hay muchos datos", no "los datos son consistentes ni han demostrado ser precisos".
- *Riesgo de no hacerlo:* la confianza mostrada al usuario es engañosa por diseño, aunque bienintencionada.
- *Beneficio esperado:* una métrica de confianza que de verdad puede calibrarse con el tiempo (precondición de Fase 4/12).
- *Complejidad:* media — requiere calcular varianza sobre `niche_score_history`, no solo contar filas.
- *Impacto en inteligencia del sistema:* alto.
- *Impacto en escalabilidad:* neutro.
- *Impacto en ventaja competitiva:* alto — es la base de todo lo demás en Fase 5/14.

### P1 — Muy importante

**P1.1 — Vocabulario cerrado de categorías para el Knowledge Graph (Fase 2)**
- *Problema:* `niches.category` está vacío desde que existe el esquema; las relaciones dependen solo de tags de texto libre.
- *Riesgo:* el Graph se estanca en densidad de relaciones para siempre si no se corrige.
- *Beneficio esperado:* multiplica la calidad de `getRelatedNiches` y de cualquier agregación futura por categoría, sin llamadas nuevas a IA (un campo más en el JSON que el LLM ya genera).
- *Complejidad:* baja — definir la taxonomía es trabajo de producto, no de ingeniería; engancharla es un campo más.
- *Impacto en inteligencia:* medio-alto.
- *Impacto en escalabilidad:* positivo (categorías indexables, agregaciones más baratas que scans de arrays de tags).
- *Impacto en ventaja competitiva:* medio-alto, según Fase 14.

**P1.2 — Separar orquestación de proveedores LLM y reparación de JSON fuera de `lib/ai.ts` (Fase 1)**
- *Problema:* 727 líneas con cinco responsabilidades mezcladas.
- *Riesgo:* cualquier cambio en el motor de razonamiento arriesga romper reintentos/parsing sin relación aparente, y viceversa.
- *Beneficio esperado:* poder razonar sobre el motor de inteligencia sin razonar al mismo tiempo sobre infraestructura de proveedor.
- *Complejidad:* media — es refactor puro, sin cambio de comportamiento, pero toca el archivo más sensible del sistema (se hace con la misma cautela ya aplicada en cambios previos a este archivo).
- *Impacto en inteligencia:* nulo directo, alto indirecto (mantenibilidad futura de todo lo demás).
- *Impacto en escalabilidad:* positivo a nivel de equipo, no de infraestructura.
- *Impacto en ventaja competitiva:* bajo directo, pero condiciona la velocidad a la que P0/P1 se pueden seguir construyendo con seguridad.

**P1.3 — Instrumentar las ocho métricas de la Fase 12**
- *Problema:* hoy no hay ningún sitio donde ver si el motor mejora con el tiempo.
- *Riesgo:* sin esto, el KPI que propones al final del prompt no se puede aplicar de verdad, por bueno que sea el KPI.
- *Beneficio esperado:* convierte "¿es más inteligente que hace 30 días?" en una pregunta con respuesta numérica, no una opinión.
- *Complejidad:* baja-media — la mayoría son queries SQL sobre datos existentes; solo `read_at` en `opportunity_alerts` requiere una columna nueva.
- *Impacto en inteligencia:* indirecto pero fundamental — no se puede mejorar lo que no se mide.
- *Impacto en escalabilidad:* neutro.
- *Impacto en ventaja competitiva:* medio — permite demostrar mejora con datos, no con relato.

### P2 — Recomendable

**P2.1 — Enlazar `watchlist` a `niches.id` en vez de solo `niche_name` (Fase 3)**
- *Problema:* el cron empareja por coincidencia exacta de texto, frágil ante redacciones distintas del mismo nicho.
- *Beneficio esperado:* menos falsos negativos en el Feed de Oportunidades.
- *Complejidad:* baja-media (migración + cambio en dos rutas).
- *Impacto en inteligencia:* bajo. *Escalabilidad:* neutro. *Ventaja competitiva:* bajo.

**P2.2 — Colapsar el alias duplicado `engine.recommend` / `engine.graph` en `registry.ts` (Fase 13)**
- *Problema:* cosmético, dos nombres para la misma función.
- *Beneficio esperado:* claridad, cero ambigüedad sobre cuál es la fuente de verdad.
- *Complejidad:* trivial.
- *Impacto en inteligencia/escalabilidad/ventaja competitiva:* ninguno directo — higiene de código.

### P3 — Futuras mejoras (no antes de que su precondición de datos exista)

**P3.1 — Implementación real de `predict()` (Fase 4)** — bloqueado por volumen de `niche_outcomes`, no por diseño. El contrato ya está listo.

**P3.2 — Bucle de Self Learning con coeficientes recalculados (Fase 7)** — depende de que P3.1 y P0.3 lleven tiempo funcionando con datos reales que agregar.

**P3.3 — Evaluar Multi-Agent (Fase 9)** — condicionado a que exista una segunda fuente de razonamiento real (Prediction Engine calibrado), no al calendario.

**P3.4 — Migrar el Graph a un motor de grafos dedicado (Fase 11)** — solo si el volumen de nichos/relaciones degrada consultas de forma medible en Postgres. Sin señal de que eso vaya a pasar pronto.

---

## Addendum — sobre tu recomendación final

Estás en lo cierto, y merece quedar escrito explícitamente en este documento de arquitectura, no solo como comentario: el riesgo real de este proyecto nunca fue técnico, es de qué se mide. Un motor de inteligencia que se gestiona por número de búsquedas es indistinguible, en sus incentivos, de cualquier app sin IA — optimiza por uso, no por acierto. Las ocho métricas de la Fase 12 son la respuesta operativa a tu propuesta de KPI, y no son aspiracionales: las ocho se pueden calcular hoy mismo con los datos que ya existen, salvo un único campo nuevo (`read_at` en alertas). Adoptar ese KPI no requiere esperar a ninguna de las fases P1-P3 de este documento — se puede empezar a medir la semana que viene, con el motor tal como está hoy, y usar esas mismas ocho métricas para decidir en qué orden real se atacan P0/P1.
