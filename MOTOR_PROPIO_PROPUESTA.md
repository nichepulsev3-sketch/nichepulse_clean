# Propuesta: Motor de scoring propio (sin tokens, rápido, predictivo de verdad)

> Este documento quedó integrado como parte del roadmap más amplio de plataforma. Ver `NICHEPULSE_PLATFORM_STRATEGY.md` para el mapa completo — `niche_outcomes` (definido aquí) es la pieza de datos que alimenta el Tier 2 de ese documento (Predictive Score, Opportunity Score 2.0, Global Market Index).

**Estado: decisiones confirmadas por el CEO (ver sección 6) — Fase 1 (captura de resultados reales) YA EJECUTADA. El motor de IA sigue funcionando exactamente igual mientras tanto; esta fase no lo toca en absoluto, solo empieza a acumular el dato sin el cual ningún motor propio sería de verdad predictivo.**

## Fase 1 — Ejecutada

- Migración `010_niche_outcomes.sql`: tabla `niche_outcomes` + columnas `feedback_sent_30/60/90` en `watchlist`.
- `app/api/cron/outcome-feedback/route.ts`: cron diario e independiente (mismo patrón de locking/`cron_logs` que `cron/opportunity-feed`), solo Pro/Agency, envía el email de seguimiento a los 30/60/90 días.
- `lib/email.ts` → `outcomeFeedbackEmail()`.
- `app/feedback/[watchlistId]/page.tsx` + `app/api/niche-outcomes/route.ts`: el usuario reporta si probó el nicho y qué tal le fue.
- `middleware.ts`: `/feedback` protegido igual que el resto de páginas con datos personales.
- `/admin/motor-propio` (+ `/api/admin/motor-propio-stats`): panel de solo lectura para vigilar el volumen de datos sin entrar a Supabase a mano — totales, desglose éxito/fracaso/en curso/no probado, tasa de respuesta por hito 30/60/90 y últimas respuestas. Protegido en tres capas: sesión requerida (middleware), email en `ADMIN_EMAILS` (middleware, redirige a `/dashboard` si no coincide) y de nuevo en la propia API (403 si no coincide). Por defecto `ADMIN_EMAILS` es `solsona17@gmail.com` — no requiere configuración extra en Railway para funcionar ya.

Pendiente de ti: ejecutar la migración 010 en Supabase y configurar el nuevo cron (mismo `CRON_SECRET`, ver README punto 10). El panel ya funciona en cuanto despliegues, aunque hasta que no haya respuestas reales se verá todo en cero.

## Camino A — Ejecutado

Confirmado por el CEO ("sí, constrúyelo ya"). Construido tal como se describía en la sección 2 original de este documento:

- **`lib/services/scoringEngine.ts`** — `computeFastScore(query, trends)`: calcula un "momentum score" (0-100) buscando coincidencias literales entre la búsqueda del usuario y las señales en vivo de `lib/trends.ts` (Google Trends, TikTok, Amazon Movers). Cero llamadas a IA, respuesta instantánea. Si no hay ninguna señal que coincida, lo dice explícitamente (`confidence: 'sin_datos'`) en vez de inventar un número — misma honestidad que el resto del proyecto.
- **`app/api/search-preview/route.ts`** — lo expone. Gateado por el feature flag `fast_mode` (activado por defecto, se puede apagar sin redeploy).
- **`app/dashboard/page.tsx`** — botón "⚡ Vista rápida" junto al buscador principal: llama a la vista previa sin tocar en absoluto el flujo de búsqueda con IA (estado completamente separado, `fastPreview`/`fastPreviewLoading`).

**Limitación honesta:** la coincidencia es literal por palabra, no semántica. Las señales de trends.ts vienen mayormente en inglés; una búsqueda en español rara vez coincidirá con ellas literalmente. Cuando eso pasa, la vista previa dice "no hay datos" en vez de simular un score — es preferible a fingir precisión. Mejorar esto (fuzzy matching o traducir señales) es una mejora futura, no bloqueante para lo que se pidió.

## 0. El problema real, dicho sin rodeos

Hoy, cuando `lib/ai.ts` marca un nicho como `"invertir"` con opportunity_score 85, **nadie ha comprobado nunca si eso se corresponde con algo real**. La IA razona a partir de señales de mercado (Google Trends, TikTok, Amazon Movers — `lib/trends.ts`) y devuelve una opinión bien argumentada, pero una opinión al fin y al cabo, no una predicción validada contra resultados reales de dropshippers.

Esto importa porque cambia completamente qué tipo de "motor propio" merece la pena construir:

- Si el objetivo es solo "más rápido y sin coste de tokens", la solución es **destilar** el comportamiento actual de la IA en un modelo propio más barato — factible en semanas, pero seguiría siendo, en el fondo, una copia comprimida de lo que ya opina Claude hoy. No sería más acertado, solo más barato y rápido.
- Si el objetivo es "de verdad predictivo, y una ventaja competitiva real frente a cualquiera que envuelva un prompt de ChatGPT", hace falta entrenar contra **resultados reales** (¿este nicho funcionó de verdad para quien lo probó?) — eso no se puede acelerar con más ingeniería, necesita tiempo acumulando datos que hoy no existen.

No son excluyentes. Lo razonable es construir ambos en paralelo, con expectativas distintas sobre cuándo cada uno da fruto.

## 1. Qué tenemos ya hoy (auditado, no asumido)

- `lib/trends.ts` — recoge y cachea (6h) señales de Google Trends, TikTok Creative Center y Amazon Movers & Shakers, por país. Es la única fuente de datos de mercado "objetiva" que existe hoy; todo lo demás lo interpreta la IA.
- `niche_searches` (migración 001) — guarda `query`, `filters`, `results` (el JSON completo de scores/veredicto que generó la IA) por usuario y fecha. Es el histórico de "qué opinó la IA", no de "qué pasó después".
- `lib/ai.ts` → `calculateOpportunityFromScores()` — ya existe una fórmula determinista de fallback (media ponderada de los 12 scores, sin IA) que se usa solo cuando la IA no da un valor de "opportunity" fiable. Es el embrión exacto del "Camino A" de la fórmula rápida — no partimos de cero.
- `watchlist` y `favorites` — el usuario puede marcar un nicho para seguimiento o guardarlo, pero ninguna de las dos tablas captura si el nicho **funcionó**. Es la pieza que falta y que hay que añadir para el Camino B.
- `feature_flags` (migración 009, ya creada) — mecanismo listo para activar un "modo rápido sin IA" solo para un grupo de usuarios primero, sin desplegar código nuevo cada vez.

## 2. Camino A — Motor rápido determinista (sin IA, sin entrenar nada)

Una versión evolucionada de `calculateOpportunityFromScores`, pero calculando los 12 scores directamente desde las señales de `lib/trends.ts` (crecimiento en Google Trends, velocidad de TikTok, movimiento en Amazon Movers) con una fórmula de pesos explícita — sin generar texto, sin llamar a ningún proveedor, respuesta en milisegundos.

Lo que se gana: velocidad total, coste cero, disponible ya (no hace falta esperar a acumular datos).
Lo que se pierde: nada de texto explicativo (reasons, executive summary, SWOT, proveedores, keywords) — esos campos seguirían necesitando al motor de IA. Este camino sirve para un "modo preview" instantáneo o para el plan Free, no sustituye al informe completo de Pro/Agency.
Honestidad técnica: esta fórmula, igual que la IA, **tampoco está validada contra resultados reales** — es una mejora de velocidad/coste, no de acierto. No hay que venderla como "más precisa que la IA", solo como "más rápida y gratis".

## 3. Camino B — Modelo entrenado con resultados reales (la ventaja competitiva de verdad)

### 3.1 Qué falta capturar

Una tabla nueva que hoy no existe en ningún esquema:

```
niche_outcomes
├── id             uuid PK
├── user_id        uuid → profiles.id
├── niche_search_id uuid → niche_searches.id (a qué análisis corresponde)
├── niche_name     text
├── tried          boolean            -- ¿llegó a probar este nicho?
├── outcome        text check (outcome in ('exito','fracaso','en_curso','no_probado'))
├── revenue_range  text null          -- opcional: "$0-500", "$500-2000", etc. (nunca exigir cifra exacta)
├── notes          text null
├── reported_at    timestamptz
```

### 3.2 Cómo se recoge sin ser intrusivo

Un recordatorio suave (no un formulario obligatorio) 30/60/90 días después de que un usuario marque un nicho en watchlist o lo compare: "¿probaste este nicho? Cuéntanos qué tal" — reutilizando la infraestructura de email ya existente (`lib/email.ts`) y el patrón del cron de opportunity-feed. Cuantas más respuestas, mejor dataset — pero realistamente, la tasa de respuesta de este tipo de encuestas suele ser baja (rango típico 5-15%), así que el volumen tardará meses en ser estadísticamente útil, no semanas. Esto no es pesimismo, es planificación honesta.

### 3.3 Cuándo tiene sentido entrenar algo

No antes de tener unos cuantos cientos de resultados reales etiquetados (`tried=true` con `outcome` definido). Antes de eso, cualquier modelo "entrenado" estaría sobreajustado a un puñado de casos y sería peor que la fórmula determinista del Camino A. Este es un proyecto de meses, no de un sprint.

## 4. Arquitectura técnica (dónde viviría esto, siguiendo las convenciones ya establecidas)

- `lib/services/scoringEngine.ts` — el motor determinista del Camino A, mismo patrón que `lib/services/cache.ts`/`featureFlags.ts`.
- `lib/services/outcomeTracking.ts` — captura y consulta de `niche_outcomes`.
- El feature flag `fast_mode` (nuevo, junto a `workspaces`/`competitor_intel` que ya existen en la tabla) decide si `searchNiches()` usa el motor rápido o la IA — permite lanzarlo primero a un grupo pequeño de usuarios y comparar.
- El modelo entrenado del Camino B (si algún día hay datos suficientes) sería un servicio aparte, no necesariamente en este mismo runtime de Node — pero esa es una decisión de dentro de varios meses, no de ahora.

## 5. Roadmap recomendado (secuencia, no todo a la vez)

1. Migración con `niche_outcomes` + email de seguimiento 30/60/90 días — barato, no rompe nada, empieza a acumular el dato que hoy no existe.
2. `lib/services/scoringEngine.ts` (Camino A) como modo alternativo detrás de un feature flag, ofrecido primero como "vista previa instantánea" antes de pedir el análisis completo con IA — mejora percibida de velocidad sin quitar nada.
3. Esperar y monitorizar el volumen de `niche_outcomes` (semanal, vía `/api/health` o un panel simple).
4. Solo cuando haya masa crítica de datos: evaluar entrenar un modelo real y decidir si sustituye, complementa o solo informa ajustes a la fórmula del Camino A.

## 6. Decisiones que necesito de ti antes de tocar código

| Pregunta | Por qué importa |
|---|---|
| ¿Empezamos ya con el Camino A (fórmula rápida, sin IA, disponible en días) aunque sepamos que no es "más precisa", solo más rápida y gratis? | Define si escribo `scoringEngine.ts` ahora o esperamos. |
| ¿Autorizas añadir el email de seguimiento 30/60/90 días para capturar `niche_outcomes`, sabiendo que tardará meses en dar volumen útil? | Es la única forma de que el Camino B sea real algún día — cuanto antes se active, antes hay datos. |
| ~~¿El Camino A se ofrece a todos los planes (incluido Free, como diferenciador de velocidad) o solo como preview antes del análisis completo de pago?~~ | **Resuelto.** El CEO confirmó explícitamente: todos los planes, incluido Free — cuantos más usuarios (empezando por Free) prueben la vista rápida, más señal real entra al Niche Intelligence Graph antes de que decidan pagar, y eso hace que la IA se vuelva más precisa a medida que la gente sube de plan. |

No hay atajo honesto que salte estos pasos — la parte "rápida y sin tokens" se puede tener pronto; la parte "predictiva de verdad" depende de tiempo acumulando datos reales, no de más ingeniería esta semana.

**Actualización:** el CEO confirmó "sí, constrúyelo ya" — Camino A ejecutado (ver sección "Camino A — Ejecutado" arriba), disponible para todos los planes sin restricción.

## 7. Cierre del hueco: el uso de Free también alimenta el aprendizaje

Hasta esta actualización, la Vista rápida (Camino A) no dejaba ningún rastro en el Niche Intelligence Graph — cualquier usuario podía usarla, pero ese uso no se traducía en dato acumulado. Se cerró así:

- **`app/api/search-preview/route.ts`** ahora llama a `recordInteraction(db, { userId, nicheName: query, type: 'view', geo })` después de calcular el score rápido.
- Deliberadamente **no crea nichos nuevos** desde aquí: `recordInteraction` solo registra la interacción si el nicho ya existe en el Graph (creado antes por un análisis completo con IA). El momentum score de Camino A no está validado y es de naturaleza distinta al `opportunity_score` de la IA — mezclarlos degradaría la calidad del contexto que usa el Copiloto (Fase 11) y el resto del Graph.
- Efecto práctico: cuando un usuario Free (o cualquier plan) usa Vista rápida sobre un nicho que ya conoce el sistema, queda registrado como señal de interés real (`user_niche_interactions`), sumando a `times_analyzed` y al perfil de comportamiento (`getUserProfile()`) sin coste de tokens ni afectar el análisis completo de pago.
- Verificado: 0 bytes no-ASCII en el archivo (mismo chequeo aplicado tras los incidentes de `nicheGraph.ts`).
