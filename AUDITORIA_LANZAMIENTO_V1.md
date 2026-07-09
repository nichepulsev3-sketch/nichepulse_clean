# NichePulse — Auditoría de lanzamiento v1.0

Comité fundador (CEO, CTO, CAIO, Principal Software Architect, Principal Product Manager, Principal UX Designer, Principal DevOps Engineer, Principal Security Engineer, Principal QA Engineer, Principal AI Architect). Auditoría completa basada en lectura directa del código, migraciones y configuración — no en supuestos. Cuatro subagentes de investigación cubrieron seguridad, rendimiento/DB, observabilidad/QA y documentación con evidencia citada por archivo y línea; el resto se apoya en el trabajo de arquitectura ya hecho en esta misma sesión (Decision Engine, Metrics Layer, blueprint de 12 capas) y en el rediseño mobile ya auditado y corregido previamente.

Regla aplicada a cada recomendación: ¿mejora estabilidad, calidad, reduce riesgo, mejora experiencia, reduce deuda técnica, o hace el producto más mantenible? Si no, no aparece aquí.

---

## Resumen ejecutivo

NichePulse no tiene ningún fallo estructural que impida lanzar. La arquitectura es coherente, sin módulos duplicados, con un Intelligence Engine que ya falla de forma honesta (nunca inventa un dato cuando no lo tiene) en vez de fallar de forma silenciosa. La seguridad tiene una base sólida — RLS en todas las tablas, autenticación consistente, cron protegido, webhook de Stripe verificado — con un único bug real (no crítico) y varios huecos menores, todos baratos de cerrar. El principal riesgo del lanzamiento no es técnico: es que faltan tres piezas no-técnicas que un lanzamiento público de verdad necesita — páginas legales, un canal de visibilidad de errores activo (Sentry sin DSN) y una forma de aprender del uso real (cero analytics hoy). Coincidimos con la valoración del CEO: el riesgo mayor ahora es seguir retrasando, no la tecnología. La decisión de este comité es **GO WITH FIXES** — con una lista P0 deliberadamente corta.

---

## FASE 1 — Auditoría de arquitectura

Sin duplicidad de módulos. `lib/services/` tiene una responsabilidad por archivo (grafo, memoria de mercado, perfil de usuario, motor de scoring rápido) y `lib/services/engine/` separa limpiamente Confidence/Decision/Reasoning/Prediction/Metrics — la consolidación hecha en esta misma sesión (Decision Engine único punto de decisión) ya resolvió la responsabilidad mezclada que existía antes.

Único hallazgo de complejidad innecesaria: `lib/queue/QueueService.ts` es una cola en memoria funcional pero **no conectada a ningún flujo real** (`emailWorker.ts` registrado sin ningún punto de llamada, confirmado por grep — el único consumidor es el propio `/api/health` mostrando sus estadísticas). Es código muerto con apariencia de funcionalidad. Candidato directo a eliminar o, como mínimo, documentar explícitamente como "no usado todavía" para que nadie lo dé por hecho.

Prioridad: **P2** (no bloquea el lanzamiento, pero es la limpieza de mayor apalancamiento del código base).

---

## FASE 2 — Auditoría del Intelligence Engine

| Componente | ¿Listo para producción? | Riesgo | Veredicto |
|---|---|---|---|
| Knowledge Graph | Sí | `category` sin poblar (conocido, no bloquea) | Mantener |
| Decision Engine | Sí | Ninguno — determinista, 31 casos en CI | Mantener |
| Evidence Engine | Sí | Ninguno | Mantener |
| Confidence Engine | Sí | Ninguno — nunca inventa un número | Mantener |
| Reasoning Layer | Parcial | El LLM sigue generando hipótesis+veredicto en el mismo paso (gap ya documentado en el blueprint anterior) | No bloquea: el output sigue siendo honesto y explicado, solo no está en el diseño ideal todavía |
| Prediction Engine | Honestamente no activo | Ninguno — devuelve `null`, nunca simula | Correcto para lanzar así |
| Memory (Market/User) | Sí | Ninguno | Mantener |
| Learning Engine | No existe | Ninguno — gateado por volumen de `niche_outcomes` | Correcto no construirlo todavía |
| Metrics Layer | Parcial (2/9 métricas reales) | Ninguno — el resto está documentado, no fabricado | Correcto, mejora orgánicamente con datos |
| Governance | Parcial (logging, sin tabla persistente) | Bajo | Suficiente para v1.0, tabla persistente es P1 |

**Qué eliminaríamos**: nada. Cada pieza que existe hace exactamente lo que dice, y lo que falta falta por una condición de datos explícita, no por pereza de diseño — es precisamente el criterio de "no construir un motor de mentira" que ya rige el proyecto desde antes de esta sesión.

---

## FASE 3 — Auditoría de IA

Explicabilidad: cada resultado con contexto de usuario expone `engine_confidence` + `engine_explanation` (fuentes usadas, faltantes, contradicciones, evidencia de respaldo) en el modal de detalle — ya construido y verificado esta sesión. Confianza: matemática, no inventada (nivel derivado de volumen+calidad+cobertura+frescura). Consistencia: `detectContradictions()` contrasta cada veredicto del LLM contra el histórico propio antes de mostrarlo. Predicciones: honestamente inactivas. Calidad/calibración: no medibles todavía por falta de volumen de resultados reales — es lo esperable el día 1, no un defecto. Aprendizaje: diseñado, no construido, correctamente gateado.

No se propone ningún motor nuevo. La única mejora de esta fase sería, cuando el CEO lo autorice, separar de verdad "generar hipótesis" de "decidir" en el prompt de `buildSystem` (Reasoning Layer del blueprint) — pero eso toca la pieza más frágil del sistema y no es necesario para lanzar con un producto honesto y explicado.

---

## FASE 4 — Experiencia de usuario

El rediseño mobile (bottom nav real, fix de overflow horizontal, modal de comparación) ya se auditó y corrigió en una ronda anterior de esta misma sesión — no se repite aquí. Desde el código de la landing (`app/page.tsx`): propuesta de valor clara en el hero ("el radar de nichos dropshipping más preciso del mundo"), CTA directo, "5 búsquedas gratis, sin tarjeta" elimina la fricción de entrada — un embudo de entrada razonable.

El hueco real de esta fase no es de diseño, es de visibilidad: **sin analytics de producto (ver Fase 9/11), nadie puede ver dónde abandona el usuario** entre landing → registro → primera búsqueda → primer nicho guardado. Es el mismo hueco que aparece en seguridad/observabilidad — se cuenta una sola vez en el roadmap.

Recomendación de bajo coste antes de lanzar: un pase manual de un evaluador siguiendo el flujo completo (registro → búsqueda → ver detalle → guardar) buscando fricción real, en vez de asumir que el código implica una buena experiencia — esto no se puede verificar leyendo código, hace falta usarlo.

---

## FASE 5 — Seguridad

**RLS**: activado en todas las tablas de negocio (`profiles`, `niche_searches`, `favorites`, `watchlist`, `niche_outcomes`, `niches`, `niche_score_history`, `user_niche_interactions`, etc.), verificado migración por migración. Único bug real: `003_premium_features.sql:104`, la política de inserción de `achievements` es `with check (true)` — cualquier usuario autenticado puede escribir un logro para el `user_id` de **otro** usuario (no valida `auth.uid() = user_id`). Bajo impacto de negocio (gamificación, no dinero ni datos sensibles) pero es un bug de RLS real y trivial de arreglar.

**Secrets**: sin claves hardcodeadas, `service_role` confirmado solo server-side (`getSupabaseAdmin()`, sin uso en `components/` ni archivos cliente).

**Cron**: protegido con `CRON_SECRET`, fail-closed si falta la variable.

**Auth**: patrón Bearer token consistente en todas las rutas API con datos de usuario; rutas públicas (`radar`, `trends`) solo exponen datos agregados, correcto.

**Rate limiting**: en memoria (no sobrevive a reinicio ni se comparte entre instancias — aceptable a la escala de lanzamiento), 20/min en `search-niches`, 60/min genérico. Hueco: `copilot`, `compare-niches` y `executive-report` (también rutas que gastan IA) caen en el límite genérico de 60/min, no en el más estricto — un vector de abuso de coste barato de cerrar.

**Cabeceras de seguridad**: solo se aplican en páginas autenticadas (`middleware.ts:129-133`, dentro del branch `needsAuth`) — la landing, `/pricing` y **toda respuesta de `/api/*`** salen sin `X-Frame-Options`/`X-Content-Type-Options`/etc. Confirmado también que el `matcher` del middleware ni siquiera incluye `/` o `/pricing`.

**CSRF/XSS**: sin token CSRF explícito, pero la autenticación por Bearer (no cookies) en las mutaciones mitiga el vector clásico de CSRF razonablemente.

**Errores**: `search-niches`, `compare-niches`, `niche-outcomes` y `opportunity-alerts` devuelven `error.message` crudo de Supabase/excepción al cliente en sus catch genéricos — no expone secretos, pero sí detalle interno innecesario.

**Webhook Stripe**: firma verificada, idempotente vía `stripe_webhook_events`. Sin hallazgos.

---

## FASE 6 — Rendimiento

Índices bien alineados con los patrones de consulta reales en las tablas de alto tráfico (`niche_searches`, `niche_score_history`, `user_niche_interactions`). Dos huecos concretos sobre `niches`, la tabla que es literalmente el activo principal del producto: sin índice en `latest_opportunity_score` (usado por `ORDER BY` en `getTopNiches`) y sin índice GIN en `tags` (usado por `.overlaps()` en `getRelatedNiches`) — invisible hoy con pocos nichos, se nota en cuanto el grafo crezca en serio.

Sin N+1 en los caminos críticos; el cron de opportunity-feed evita N+1 explícitamente con batching. Caché en memoria de proceso (no sobrevive a un deploy de Railway, no se comparte entre instancias) — aceptable a esta escala. Llamadas a IA con timeout adaptativo, reintentos y fallback honesto si el proveedor cae. Cola en memoria sin usar (ver Fase 1). Todas las páginas principales son client-side, sin SSR — patrón normal para una app detrás de login, pero también aplica a la landing pública (`app/page.tsx:1`), lo que penaliza el primer render/SEO.

Paginación: el historial de búsquedas sí pagina. `favorites` y `watchlist` **no tienen `.limit()`** — traen todas las filas del usuario sin cota. Con pocos favoritos por usuario hoy no duele; es una bomba de tiempo barata de desactivar ahora.

---

## FASE 7 — Observabilidad

Sentry está integrado en código (cliente, servidor y edge) pero **el DSN no está configurado** — hoy Sentry no reporta nada en producción. Es la única pieza de esta fase que no se puede resolver escribiendo código: requiere que el equipo cree el proyecto en Sentry y añada `NEXT_PUBLIC_SENTRY_DSN` en Railway.

Health check (`/api/health`) es real: comprueba conexión a Supabase, staleness del cron (>30h sin ejecutar = degraded) y presencia de env vars críticas — no es un simple 200 OK. Logging estructurado en JSON con envío a Sentry por cada `.error()` (una vez el DSN exista). `cron_logs` registra cada ejecución con estado/duración, consultado por el propio health check.

CI (`ci.yml`) corre typecheck + lint + test en cada push/PR, pero **no bloquea el deploy** — Railway despliega de forma independiente del resultado del CI, y no hay protección de rama verificable que lo impida. Sin `npm audit` ni Dependabot. Ningún mecanismo de alerta activa (todo pasa por consultar Sentry/health manualmente o por polling externo).

---

## FASE 8 — Calidad

6 archivos de test: parser JSON de IA (la pieza que más incidentes reales causó históricamente — bien cubierta), caché, cola, límites de plan/scoring puro, el harness de 31 casos deterministas del Decision/Confidence Engine (añadido esta sesión), y un smoke test e2e con Playwright (landing, login, redirección de dashboard sin sesión, health check). Ningún test toca handlers de `/api/**` directamente. `reasoningLayer.ts`, `predictionEngine.ts` y `metrics.ts` no tienen test — riesgo bajo porque `predictionEngine` es un stub y `metrics.ts` son cálculos triviales, riesgo algo mayor en `reasoningLayer.ts` por ser el ensamblador de contexto central.

**Plan mínimo para lanzar con confianza** (deliberadamente corto, no "cobertura total antes de salir"): mantener el CI tal cual (ya cubre la pieza históricamente más frágil), añadir el pase manual de la Fase 4 sobre el flujo completo antes de dar el switch, y no perseguir cobertura de rutas API antes del lanzamiento — el Bearer token + RLS ya dan defensa en profundidad, y perseguir cobertura total ahora es exactamente el tipo de retraso que el propio CEO señaló como el riesgo real.

---

## FASE 9 — Producto

**¿Está claro el valor?** Sí — "el radar de nichos dropshipping más preciso del mundo" es una promesa concreta, y el bloque de explicabilidad (confianza + evidencia + contradicciones) la respalda con algo verificable, no solo marketing.

**¿Es diferenciadora?** Sí, de forma real y defendible: ningún competidor directo muestra "por qué confiar en este score" con evidencia estructurada — es la ventaja competitiva que el blueprint de esta sesión identificó como el activo verdadero.

**¿El usuario entiende el Opportunity Score?** Mejor que antes de esta sesión — el bloque de confianza/explicación lo desglosa, aunque solo aparece para usuarios con sesión y contexto (búsquedas anónimas no lo tienen, lo cual es honesto: no hay contexto que explicar).

**¿La IA transmite confianza?** Sí, precisamente porque a veces dice explícitamente que confía poco — eso es más creíble que un sistema que siempre suena seguro.

**Qué eliminaríamos/simplificaríamos**: la cola de email sin usar (Fase 1); y una promesa de marketing sin respaldo real — el plan Agency anuncia "Soporte prioritario 24/7" y "SLA garantizado" (`app/pricing/page.tsx`) sin que exista ningún sistema de soporte real detrás (solo un `mailto:` en la página de login). Vender una garantía que no se puede cumplir es un riesgo de confianza con el cliente, no solo un detalle de copy.

---

## FASE 10 — Escalabilidad

**1.000 usuarios**: sin problema — Postgres, caché en memoria y cola en memoria aguantan esto sin notarlo.

**10.000 usuarios**: sigue aguantando en una sola instancia de Railway. Empiezan a notarse (sin doler todavía) los índices que faltan en `niches` y el volumen creciente de watchlist/favorites sin paginar.

**100.000 usuarios**: aquí es donde las simplificaciones deliberadas de hoy empiezan a costar de verdad. Si Railway necesita más de una instancia, el rate limiting y la caché en memoria dejan de ser globales (cada instancia cuenta por separado) — no rompe nada, pero deja de proteger como se espera. Los índices que faltan en `niches` (el activo que más crece) sí empiezan a doler en consultas reales.

**1.000.000 de usuarios**: exige cambios de infraestructura reales — caché/rate-limit/cola compartidos (Redis), posiblemente réplicas de lectura en Postgres, y una revisión seria de coste de IA (ver Fase 11). Nada de esto se construye ahora — construirlo hoy sería exactamente la complejidad prematura que este comité tiene instrucción de evitar. Se nombra aquí para que quede escrito con claridad dónde está el techo actual, no como trabajo pendiente para v1.0.

---

## FASE 11 — Costes

El hallazgo más importante de esta fase, y el que más vale que el CEO conozca de forma consciente: en planes Pro/Agency, `searchNiches()` lanza Claude **y** OpenAI **en paralelo** (`raceAI`) y se queda con el que responda antes — pero ambas llamadas se facturan igual, gane quien gane. Es un diseño deliberado de fiabilidad (si un proveedor falla o tarda, el usuario no lo nota), pero significa que **cada búsqueda Pro/Agency cuesta el doble de tokens de lo que un vistazo rápido al código sugeriría**. No se recomienda cambiarlo antes de lanzar (la fiabilidad que compra es real y ya validada), pero debe quedar como una decisión consciente de negocio, no un descubrimiento sorpresa en la primera factura.

El control de coste real ya existe y está bien puesto: los límites diarios de búsqueda por plan (`PLAN_LIMITS`, ya testeados) son el freno principal, no el rate limiting de IP. Cron acotado (máx. 40 re-análisis de IA y 100 emails por ejecución). Caché de 3h en resultados de IA reduce coste en consultas repetidas. Ningún hallazgo de coste sin control.

---

## FASE 12 — Documentación

12 documentos `.md` en la raíz, todos con contenido real (no relleno), pero sin un punto de entrada único que diga "empieza por aquí" — un desarrollador nuevo tiene que adivinar cuál leer primero. `README.md` documenta bien el despliegue (Supabase, Stripe, variables de entorno, cron) pero no explica cómo levantar el proyecto en local, y no existe `.env.example`. Algunas variables que el código sí usa (`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, las tres de Sentry build) no están en la tabla del README ni centralizadas en `lib/env.ts` — la única fuente de verdad real hoy es leer `lib/env.ts` directamente.

---

## FASE 13 — Checklist de preparación para producción

| Ítem | Estado |
|---|---|
| Configuración Railway (build, start, healthcheck) | ✅ Correcto (`railway.json`, `nixpacks.toml`) |
| Variables de entorno obligatorias documentadas en código | ✅ (`lib/env.ts`), ⚠️ README desincronizado |
| `.env.example` | ❌ No existe |
| Backups de base de datos | ⚠️ No confirmado en el repo — depende del plan de Supabase contratado, verificar directamente en el panel de Supabase |
| Monitoring / Sentry | ⚠️ Código listo, **falta el DSN** |
| Logs estructurados | ✅ |
| Dominio propio + SSL | ⚠️ No confirmado desde el repo — verificar si ya hay dominio propio apuntando a Railway o se lanza sobre el subdominio de Railway |
| Robots.txt / Sitemap | ✅ Existen y son correctos |
| SEO técnico (metadata, OG) | ✅ Completo; Twitter card sin `description`/`image` (menor) |
| Analytics de producto | ❌ No existe ningún proveedor |
| Consentimiento de cookies | ❌ No existe (Supabase Auth usa cookies) |
| Política de privacidad | ❌ No existe |
| Términos de servicio | ❌ No existe |
| Sistema de soporte | ⚠️ Solo un `mailto:`, sin proceso real detrás del "SLA 24/7" anunciado en Agency |
| Página de estado (status page) | ❌ No existe — aceptable omitir en v1.0 |

---

## FASE 14 — GO / NO GO

# GO WITH FIXES

Justificación: no existe ningún hallazgo de esta auditoría que indique que el producto está roto, es inseguro de forma crítica, o que el motor de inteligencia miente o improvisa. El flujo principal (buscar, analizar, guardar, entender por qué confiar) funciona de principio a fin y lo hace con una honestidad de diseño (nunca fabrica confianza ni predicciones) que es infrecuente en este tipo de producto. Los hallazgos reales son, en su mayoría, baratos de cerrar en horas, no en semanas — y los tres que no dependen solo de código (Sentry DSN, dominio/backups a confirmar, páginas legales) son exactamente las piezas que hacen que "GO" pase a ser "GO WITH FIXES" en vez de un "GO" sin condiciones.

No es NO GO porque ningún hallazgo compromete datos de usuario, dinero, o la integridad del veredicto que el producto vende. No es GO sin condiciones porque lanzar sin política de privacidad ni forma de ver errores en producción no es una startup ágil, es un riesgo legal y operativo innecesario que cuesta menos arreglar que ignorar.

---

## FASE 15 — Roadmap final

| # | Tarea | Problema | Beneficio | Impacto | Riesgo | Complejidad | Tiempo |
|---|---|---|---|---|---|---|---|
| **P0.1** | Fix RLS `achievements` (insert) | Cualquier usuario puede escribir logros de otro | Cierra un bug de RLS real | Bajo-medio | Muy bajo | Trivial | <1h |
| **P0.2** | Índices en `niches` (`latest_opportunity_score`, GIN `tags`) | El activo principal no está indexado para sus propias consultas | Protege rendimiento del Knowledge Graph al crecer | Medio (a futuro) | Muy bajo | Trivial | <1h |
| **P0.3** | Sanear mensajes de error expuestos (4 rutas) | Se filtra detalle interno de Supabase/excepciones al cliente | Reduce superficie de información expuesta | Bajo | Muy bajo | Trivial | 1-2h |
| **P0.4** | Cabeceras de seguridad en TODAS las rutas (incl. públicas y `/api/*`) | Landing, pricing y toda la API salen sin protección básica | Cierra el hueco más visible de seguridad | Medio | Muy bajo | Baja | 1-2h |
| **P0.5** | Paginación de seguridad en `favorites`/`watchlist` | Consultas sin límite, bomba de tiempo | Previene degradación futura | Bajo hoy, medio a futuro | Muy bajo | Trivial | <1h |
| **P0.6** | Rate limit de IA para `copilot`/`compare-niches`/`executive-report` | Vector de abuso de coste barato | Protege coste real de IA | Medio | Muy bajo | Trivial | <1h |
| **P0.7** | Página de Política de Privacidad + Términos de Servicio | No existen; requisito legal para captar usuarios/pagos reales | Cierra el mayor riesgo no técnico del lanzamiento | **Alto** | Bajo (con aviso de revisión legal) | Baja | 2-3h |
| **P0.8** | **Acción del usuario**: crear proyecto Sentry y añadir `NEXT_PUBLIC_SENTRY_DSN` en Railway | Sin esto, cero visibilidad automática de errores en producción | Cumple el propio criterio de "listo para producción" del CEO | **Alto** | — | Trivial (5 min) | 5 min |
| **P0.9** | Analytics de producto mínimo (script gateado por env var, sin cuenta todavía) | Sin ningún dato de uso real, no hay forma de aprender tras el lanzamiento | Cumple el criterio "hay métricas para aprender del uso real" | **Alto** | Bajo | Baja | 2-3h (+ que el usuario elija proveedor y dé el ID) |
| P1.1 | Eliminar o documentar como "no usado" `lib/queue/emailWorker.ts` | Código muerto con apariencia de funcionalidad | Reduce deuda técnica | Bajo | Muy bajo | Trivial | <1h |
| P1.2 | `.env.example` + sincronizar tabla de env vars del README | Onboarding de un nuevo desarrollador más lento de lo necesario | Mantenibilidad | Bajo | Nulo | Trivial | 1h |
| P1.3 | Tabla de auditoría persistente del Decision Engine | Governance solo tiene logs transitorios | Trazabilidad real a largo plazo | Medio | Bajo | Media | 1 semana |
| P1.4 | Branch protection: CI obligatorio antes de merge a `main` | Un CI en rojo no impide desplegar hoy | Reduce riesgo de desplegar código roto | Medio | Nulo | Trivial (config de GitHub, no código) | 15 min |
| P1.5 | Dependabot | Sin alertas de dependencias vulnerables | Reduce riesgo de seguridad de la cadena de suministro | Bajo-medio | Nulo | Trivial | <1h |
| P1.6 | Confirmar backups de Supabase y dominio propio | No verificable desde el repo | Cierra dos incógnitas operativas reales | Alto si faltan | — | — (verificación, no código) | 30 min |
| P1.7 | Cumplir o suavizar la promesa de "soporte 24/7 / SLA" del plan Agency | Se vende algo sin proceso real detrás | Integridad de marca con clientes de pago | Medio | Bajo | Baja | Decisión de producto |
| P2.1 | Tests para `reasoningLayer.ts` (partes puras) | Único módulo central del motor sin cobertura | Reduce riesgo de regresión silenciosa | Bajo | Nulo | Media | 2-3h |
| P2.2 | Poblar `niches.category` con taxonomía fija | Gap ya documentado en auditorías anteriores | Activa relaciones de categoría reales en el Graph | Medio | Bajo | Media | Ya diseñado, pendiente de confirmación |
| P2.3 | SSR/mejora de first paint en la landing pública | Landing 100% client-side penaliza SEO/carga inicial | Mejor descubribilidad orgánica | Medio | Bajo | Media | 1 semana |
| P3.1 | Redis para caché/rate-limit/cola compartidos | Necesario solo a partir de múltiples instancias | Preparación para escala 100k+ | Alto a esa escala | Medio | Alta | Cuando la escala lo exija |
| P3.2 | Página de estado pública | Nice-to-have, no crítico en v1.0 | Confianza del usuario en incidencias | Bajo | Nulo | Baja | Futuro |

**Los 9 ítems P0 son deliberadamente pequeños.** Ocho de ellos son implementables en código en menos de un día combinado; el noveno (Sentry) es una acción de 5 minutos del propio usuario. Ninguno retrasa el lanzamiento semanas — es exactamente el tipo de lista corta que el CEO pidió en vez de una excusa para seguir puliendo indefinidamente.
