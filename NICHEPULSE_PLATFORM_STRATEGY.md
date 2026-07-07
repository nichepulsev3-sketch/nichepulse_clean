# NichePulse — De buscador de nichos a plataforma de inteligencia de mercado

**Estado: Fase 1 (Niche Intelligence Graph), Fase 1b (wiring de watchlist/favoritos/exportaciones), Fase 6 (explicabilidad en watchlist/favoritos), Fase 3 (el cron diario ya alimenta el historial de scores), Fase 7 (descubrimiento por tags) y Fase 11 (Copiloto de negocio, página + endpoint) EJECUTADAS. Fase 2 (perfil de usuario) ejecutada como servicio de lectura y ya usada como contexto del Copiloto. El resto de fases de este documento son roadmap, no promesas — cada una dice explícitamente si ya se puede construir hoy o si depende de tiempo/datos que todavía no existen.**

Este documento responde al mandato del CEO: convertir NichePulse en una plataforma de inteligencia de oportunidades — no "otra app con IA", sino un sistema que acumula conocimiento propio y se vuelve más difícil de copiar cuanto más se usa. Extiende (no sustituye) `MOTOR_PROPIO_PROPUESTA.md`: el Graph que se describe aquí es la infraestructura de datos sobre la que ese documento ya empezó a construir (`niche_outcomes`).

## 0. Regla que se aplicó para escribir este roadmap

El CEO fijó la regla: *"¿Hace que NichePulse sea más difícil de copiar? Si la respuesta es NO, no implementarla."* Esa regla se cruzó con una segunda, ya acordada en `MOTOR_PROPIO_PROPUESTA.md`: nunca simular datos ni presentar como "predictivo" algo que no está validado contra la realidad. Combinar ambas reglas da el criterio de priorización de abajo: lo que construye foso de verdad es la **acumulación de datos propios en el tiempo**, no la cantidad de pantallas nuevas. Por eso el orden de ejecución no sigue el orden 1→15 del mandato original: agrupa las 15 fases en 4 tiers según de qué dependen para ser reales.

## 1. Los 4 tiers

### Tier 0 — Fundacional, se construye ya, no depende de nada externo

| Fase original | Qué es de verdad | Estado |
|---|---|---|
| Fase 1: Niche Intelligence Graph | Esquema relacional (Postgres normal, no una BD de grafos aparte — no hace falta al volumen actual) que convierte cada nicho en una entidad propia en vez de un JSON aislado por usuario | **Ejecutado** (ver sección 2) |
| Fase 2: Memoria permanente | Perfil de usuario derivado de sus interacciones reales con el Graph | Diseño listo, pendiente de construir (task en curso) |
| Fase 6: Explicabilidad | Los 12 scores de `lib/ai.ts` YA llevan `reasons` por score — esto ya existe parcialmente. Falta exponerlo de forma consistente en toda la UI, no inventar un sistema nuevo | Pendiente (bajo esfuerzo, alto valor) |

### Tier 1 — Extiende infraestructura que ya funciona en producción

| Fase original | Qué es de verdad |
|---|---|
| Fase 3: IA proactiva | El cron `opportunity-feed` ya existe y ya analiza cambios de score. Con el Graph alimentándolo, puede detectar patrones reales (nichos que suben en varias categorías a la vez) en vez de solo re-analizar una búsqueda puntual |
| Fase 7: Sistema de descubrimiento | Con `niches.category`/`tags` poblados, "nichos relacionados" es una query SQL (mismos tags, categoría vecina), no un modelo nuevo — arrancar así, no con ML desde el día uno |
| Fase 11: Copiloto de negocio | Un endpoint nuevo que usa el LLM existente + contexto real del Graph (nichos con mejor score reciente, países con menos competencia detectada) — no es un modelo nuevo, es mejor contexto para el mismo motor de IA |

### Tier 2 — Depende de volumen real de datos (meses, no sprints)

Esto es la parte más importante de ser honesto con el CEO: **ninguna de estas fases se puede construir de verdad hoy sin inventar datos**. Intentarlo ahora sería exactamente el error que ya se evitó en `MOTOR_PROPIO_PROPUESTA.md` — un "Opportunity Score 2.0" sin histórico real detrás sería solo una reformulación cosmética del score actual, no una mejora.

| Fase original | Qué necesita para ser real |
|---|---|
| Fase 4: IA predictiva / Prediction Score | `niche_outcomes` (Motor Propio) con cientos de resultados reales etiquetados |
| Fase 5: Opportunity Score 2.0 | `niche_score_history` acumulado durante semanas/meses + `niche_outcomes` para validar que el score nuevo predice mejor que el actual |
| Fase 9: Heat Map mundial | Volumen real de búsquedas geo-distribuidas — con pocos usuarios, un mapa de calor es decorativo, no informativo |
| Fase 10: Timeline por nicho | Es la que menos tiempo necesita de este tier — en unas semanas de `niche_score_history` ya hay timeline útil para nichos analizados varias veces |
| Fase 12: Motor de recomendaciones | Collaborative filtering real necesita muchos usuarios con muchas interacciones. Se empieza con reglas simples (Tier 1, Fase 7) y evoluciona aquí cuando haya volumen |
| Fase 13: Niche DNA | Es una capa de presentación sobre Fase 5 (Opportunity Score 2.0) — no tiene sentido construirla antes que el score que la alimenta |
| Fase 14: Global Market Index | Es un agregado de `niche_score_history` de todos los usuarios a lo largo del tiempo — literalmente no puede existir antes de que exista el historial |

### Tier 3 — Arquitectura futura, sin código todavía

| Fase original | Por qué se documenta pero no se construye |
|---|---|
| Fase 15: AI Lab (agentes, multiagentes, simulación) | Tiene sentido cuando el Graph y el histórico ya son ricos — construir agentes sobre datos que todavía no existen es construir sobre nada |

## 2. Fase 1 ejecutada: qué se construyó exactamente

- **`supabase/migrations/011_niche_intelligence_graph.sql`**: tres tablas nuevas.
  - `niches` — entidad canónica por nicho, deduplicada por `slug` (nombre normalizado). Lectura pública (es inteligencia agregada, no dato personal), escritura solo desde el servidor.
  - `niche_score_history` — un snapshot de los 12 scores + opportunity_score + verdict cada vez que un nicho se analiza. Esto es lo que en unas semanas alimenta el Timeline (Fase 10) y en meses el Global Market Index (Fase 14).
  - `user_niche_interactions` — registro de qué hace cada usuario con cada nicho (`search` ya wireado; `watchlist_add/remove`, `favorite_add/remove`, `export`, `dismiss` diseñados pero NO conectados todavía — ver pendientes).
- **`lib/services/nicheGraph.ts`** — único punto de escritura al grafo (`recordNicheAnalysis`, `recordInteraction`). Ningún otro archivo debe hacer `db.from('niches')` directamente.
- **`app/api/search-niches/route.ts`** — cada búsqueda ahora enriquece el grafo (best-effort, no bloqueante: si el grafo falla, la búsqueda del usuario nunca se ve afectada).

### Limitaciones honestas de lo ya construido (para que nadie las descubra por sorpresa)

- **Deduplicación por slug exacto, no semántica**: "auriculares inalámbricos" y "auriculares bluetooth" hoy son dos entidades distintas en el Graph. Fusionarlas de verdad requiere embeddings/clustering — es una mejora de una fase posterior, no un bug de esta.
- **`category` empieza vacío**: la IA no devuelve categoría hoy (no se tocó su prompt en esta ronda — es la pieza más frágil del sistema, con su propio parser de reparación de JSON truncado; tocarla no era parte de esta fase). Sin categoría, "nichos relacionados" (Fase 7) solo puede usar `tags` por ahora.
- **Fase 1b — ejecutada.** Watchlist, favoritos y exportaciones ya registran interacciones: `dashboard.tsx` (favorite_add, watchlist_add), `watchlist/page.tsx` (watchlist_remove), `favorites/page.tsx` (favorite_remove), `api/executive-report` (export, server-side). Se optó por llamar `recordInteraction` directo desde cada punto de escritura (cliente o servidor) en vez de un trigger de Postgres — evita duplicar la lógica de `slugify` en dos lenguajes (JS y SQL), que es justo el tipo de sitio donde se cuelan bugs de encoding como el que se encontró y corrigió al escribir este mismo archivo de servicio. De paso se encontró y corrigió un bug preexistente: `favorites/page.tsx` leía `fav.niche` pero la columna real es `niche_data` — el alias nunca existía, así que la página de favoritos nunca mostró de verdad nombre/market size/margin de ningún favorito.
- **Escritura fire-and-forget**: el registro en el grafo no se espera (`await`) antes de responder al usuario — mismo patrón de "best-effort" ya usado en el resto del proyecto (caché, cola de jobs). Consecuencia aceptada: bajo carga muy alta, alguna escritura al grafo podría perderse sin que nadie lo note vía UI — el impacto es acumulación de datos, nunca la experiencia del usuario.

## 2.3 Fase 2 ejecutada (parcial, a propósito): perfil de usuario de solo lectura

- **`lib/services/userProfile.ts`**: `getUserProfile(db, userId)` agrega las interacciones ya registradas en el Graph — países más frecuentes, tags de los nichos que guarda/exporta (no de los que solo mira), score medio que acepta cuando guarda algo, total de búsquedas/guardados/exportaciones. Cien por cien derivado de hechos ya existentes, cero invención.
- **`app/api/user-profile/route.ts`**: expone ese perfil (GET, cada usuario solo puede leer el suyo).

**Lo que deliberadamente NO hice todavía**: conectar este perfil al prompt de `lib/ai.ts` para personalizar las búsquedas de verdad. El CEO pidió explícitamente en el mandato original: *"si detectas que alguna modificación puede romper compatibilidad... detente, explica el impacto y solicita confirmación antes de continuar"*. `lib/ai.ts` es, por lejos, la pieza más frágil del sistema — tiene su propio parser de reparación de JSON truncado porque el LLM a veces corta la respuesta a mitad de generación, y cualquier cambio en su prompt puede alterar ese comportamiento de forma sutil. Antes de tocarlo:

- **Qué se ganaría**: el motor de IA podría priorizar países/categorías que el usuario ya demostró preferir, en vez de tratar cada búsqueda como si fuera la primera.
- **Qué se arriesga**: cambiar el prompt del sistema es exactamente el tipo de cambio que ya causó incidentes reales en este proyecto (comillas sin escapar, respuestas truncadas) — cualquier modificación ahí necesita probarse con cuidado, no añadirse de paso dentro de otra fase.
- **Mi recomendación**: hacerlo como su propio cambio aislado, con su propia verificación, cuando confirmes que quieres continuar con esto específicamente — no como parte de "proceder" con el roadmap general.

## 2.4 Fase 6 ejecutada: explicabilidad en watchlist y favoritos

`components/ScoreGrid.tsx` ya existía y ya mostraba los 12 scores con sus motivos en el dashboard — eso no era una carencia. La carencia real era que `watchlist/page.tsx` y `favorites/page.tsx` solo mostraban un número (el score) sin poder expandir el porqué, aunque el dato completo (`niche_data`, con los 12 scores) ya estaba guardado en la fila. Ahora ambas páginas permiten expandir cada nicho y ver el mismo desglose que en el dashboard, reutilizando `ScoreGrid` tal cual — cero lógica nueva de explicabilidad, solo exponer la que ya existía en más sitios.

## 2.5 Fase 3 ejecutada (parcial): el cron diario ya alimenta el historial

`cron/opportunity-feed` re-analiza a diario la búsqueda más reciente de cada usuario Pro/Agency — es, con diferencia, el único punto del sistema que vuelve a analizar el mismo nicho en días distintos. Hasta hoy esa re-ejecución se tiraba: se comparaba contra el `niche_searches.results` guardado y se descartaba. Ahora cada re-análisis también se registra en `niche_score_history` vía `recordNicheAnalysis` — exactamente la serie temporal que necesita el futuro Timeline (Fase 10) para tener sentido en semanas, no meses.

**Lo que NO se construyó todavía (Fase 3b, pendiente)**: detección de patrones cruzados entre usuarios (p.ej. "3 usuarios distintos añadieron este nicho a watchlist esta semana" como señal de tendencia emergente real). Es una consulta más compleja sobre `user_niche_interactions` que merece su propia verificación antes de generar alertas automáticas — no se improvisó de paso dentro de esta fase para no arriesgar falsos positivos en las alertas que ya reciben los usuarios.

## 2.6 Fase 7 ejecutada (parcial): descubrimiento por tags compartidos

- **`lib/services/nicheGraph.ts` → `getRelatedNiches(db, nicheName, limit)`**: busca otros nichos del Graph que comparten al menos un tag, ordenados por `times_analyzed` (cuántas veces se ha analizado en total, como proxy simple de relevancia). Es una query SQL (`overlaps` sobre el array `tags`), no un modelo — coherente con la regla de no usar ML hasta que haga falta de verdad.
- **`app/api/niches/related/route.ts`**: la expone (GET, cualquier usuario con sesión).

**Lo que NO hice todavía**: mostrar esto en la interfaz (dashboard/watchlist/favoritos). La API ya funciona y se puede probar hoy, pero conectarla a una tarjeta visible de "nichos relacionados" es un cambio de UI en `dashboard.tsx` (800+ líneas, archivo ya señalado como candidato a dividir en `BLUEPRINT_INTELIGENCIA.md` de una sesión anterior) que merece su propio pase, no colarse de prisa. Fase 11 (Copiloto de negocio) queda pendiente para la siguiente ronda — reutilizará esta misma función para dar contexto real a sus respuestas.

## 2.7 Fase 11 ejecutada: Copiloto de negocio

- **`lib/ai.ts` → `askCopilot(question, context, plan)`**: función nueva y aislada (no toca `buildSystem`/`searchNiches`, el prompt de 12 scorecards). Mismo patrón ya usado en `compareNiches`/`generateActionPlan`: prompt propio, timeout de 20s, JSON validado, fallback determinista si la IA falla.
- **`app/api/copilot/route.ts`**: reúne el contexto real — los nichos con mejor `latest_opportunity_score` del Graph (agregado público) + el perfil de usuario de la Fase 2 (países frecuentes, categorías preferidas, score medio que acepta) — y se lo pasa a `askCopilot`. Solo Pro/Agency (misma regla que el informe ejecutivo: es una llamada a IA con coste real).
- **`app/copilot/page.tsx`**: preguntas sugeridas ("¿qué negocio abrirías hoy?", "¿qué país elegirías?"...) + campo libre. Cada respuesta muestra explícitamente "Basado en" con los datos concretos usados — la misma filosofía de explicabilidad de la Fase 6, aplicada aquí también.
- Enlace añadido en la navegación del dashboard (junto a Watchlist), protegido en `middleware.ts`.

Esta es la primera fase en la que el perfil de usuario (Fase 2) se usa de verdad para personalizar algo — pero de forma acotada y de bajo riesgo: es un prompt nuevo y separado, no una modificación del prompt de búsqueda existente. La decisión de tocar `buildSystem`/`searchNiches` para personalizar la búsqueda en sí sigue pendiente y sigue requiriendo confirmación explícita (sección 2.3).

## 3. Qué significa esto para el CEO, en una frase

Hoy se sembró la infraestructura. Dentro de semanas, el Timeline (Fase 10) ya tendrá sentido. Dentro de meses, con `niche_outcomes` y `niche_score_history` acumulados, el Opportunity Score 2.0, el Prediction Score y el Global Market Index dejan de ser diapositivas y se convierten en productos reales — ese es exactamente el foso que se pidió: conocimiento propio que ningún competidor puede copiar por más que copie la interfaz o el prompt.
