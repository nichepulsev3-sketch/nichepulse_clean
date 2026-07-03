# NichepulseV.3 → Sistema Inteligente de Decisión Empresarial
### Blueprint estratégico y roadmap P0–P3

Este documento recoge las ~15 iniciativas que planteaste (motor de inteligencia, IA proactiva, timeline, modo CEO, feed de oportunidades, comparador, competitor intelligence, watchlist, alertas, memoria, personalización, workspaces, automatizaciones, informes ejecutivos, monetización, arquitectura, UX/UI, mobile-first). Una de ellas — el **Motor de Inteligencia (12 scores explicados + veredicto)** — ya está implementada en el código en esta misma sesión; el resto se prioriza aquí en P0–P3 con impacto, valor y esfuerzo, para ejecutarlas en las próximas semanas/meses sin intentar improvisarlas todas de golpe.

**Principio de secuenciación:** cada iniciativa de aquí abajo depende de que el Motor de Inteligencia exista primero (ya es así), y muchas dependen entre sí (el Modo CEO reutiliza el veredicto; el Comparador reutiliza los scores; los Workspaces son la base sobre la que se cuelgan Watchlist/Alertas/Competitor Intelligence). El orden P0→P3 respeta esas dependencias, no solo el "qué impresiona más".

---

## ✅ Ya implementado en esta sesión: Motor de Inteligencia v1

- 12 scores por nicho (Oportunidad, Demanda, Crecimiento, Competencia, Saturación, Margen, Publicidad, SEO, Social, Tendencia, Estabilidad, Riesgo), cada uno con 2-4 motivos concretos que lo justifican — nunca un número solo.
- Veredicto accionable por nicho: **Invertir / Esperar / Evitar**, con una frase que explica por qué, visible antes que ningún otro dato (en la tarjeta, en el modal y en el PDF).
- Todo calculado de forma defensiva: si la IA no da un score o lo da mal formado, se normaliza a un valor seguro en vez de romper la pantalla.
- **Honestidad de datos:** no fingimos "calcular" un score de SEO o de riesgo con una fórmula matemática que no tenemos datos para sustentar — es la propia IA la que debe justificar cada número con motivos verificables contra las señales de mercado disponibles (Google/TikTok/Amazon). Esto es deliberado: es preferible un sistema honesto sobre lo que sabe que uno que aparenta precisión que no tiene.

Archivos tocados: `lib/types.ts`, `lib/ai.ts`, `lib/supabase.ts`, `components/ScoreGrid.tsx` (nuevo), `components/VerdictBadge.tsx` (nuevo), `app/dashboard/page.tsx`, `lib/pdf.ts`.

**Importante — antes de dar esto por cerrado:** el nuevo esquema de IA es notablemente más pesado (12 scorecards con motivos en vez de un objeto plano), así que subí los presupuestos de tokens y los timeouts de las llamadas a Claude/GPT. Dado que en tu último log de producción Claude ya estaba dando timeout con el esquema *anterior*, más ligero, **hay una posibilidad real de que necesites subir aún más el timeout o revisar la cuenta de Anthropic** tras desplegar esto. Vigila los logs de Railway las primeras búsquedas tras el deploy.

---

## P0 — Las siguientes piezas fundacionales (siguen sin ellas, nada más tiene sentido)

**P0.1 — Modo CEO**
Vista simplificada que colapsa toda la búsqueda a una lista de veredictos: Invertir / Esperar / Evitar, sin scores ni SWOT, un botón por nicho. Reutiliza el 100% de los datos que ya genera el Motor de Inteligencia — no requiere nueva IA ni nuevas tablas.
Impacto: alto. Valor usuario: alto (decide en segundos). Valor negocio: alto (feature de marketing muy vendible: "modo ejecutivo"). Complejidad: baja. Tiempo: 1-2 días. Riesgo: bajo.

**P0.2 — Comparador de nichos (Producto vs Producto)**
Seleccionar 2-3 resultados de una búsqueda y verlos lado a lado con sus 12 scores superpuestos + un veredicto de la IA sobre cuál elegiría y por qué (una llamada adicional, corta, a Claude con los dos JSON de nichos como contexto). Ya tienes el botón "Comparador" prometido en `pricing/page.tsx` sin implementar — cierra esa promesa.
Impacto: alto. Valor usuario: alto. Valor negocio: medio-alto (ya se vende como feature Pro). Complejidad: media. Tiempo: 3-4 días. Riesgo: bajo — es aditivo, no toca el flujo de búsqueda existente.

**P0.3 — Completar la componentización del dashboard**
Ya señalado en la auditoría anterior: `dashboard/page.tsx` sigue siendo un archivo único de 800+ líneas. Cada iniciativa nueva (Modo CEO, Comparador, Workspaces...) que se añada sin dividir este archivo antes aumenta el riesgo de romper algo cada vez más. Es el momento de pagar esta deuda, antes de seguir apilando features encima.
Impacto: invisible para el usuario, crítico para poder ejecutar el resto del roadmap con seguridad. Complejidad: alta. Tiempo: 3-5 días. Riesgo: medio (requiere verificación visual manual pantalla a pantalla).

---

## P1 — Muy importantes (siguiente mes)

**P1.1 — Feed de oportunidades (IA proactiva) v1**
Un job programado (cron) que, para los mercados/categorías más buscados por cada usuario, vuelva a ejecutar el motor de IA una vez al día y compare el resultado con el histórico guardado (`niche_searches`). Si detecta una subida relevante de `opportunity_score` o un cambio de `verdict` en un nicho que el usuario ya analizó, genera una notificación tipo "Este nicho que analizaste hace 3 días acaba de subir de Esperar a Invertir". Esto SÍ requiere infraestructura nueva: un cron job (Railway Cron / Vercel Cron / Supabase Edge Function programada) y una tabla `opportunity_alerts`.
Impacto: muy alto — es el corazón de "la IA no espera preguntas". Valor usuario: muy alto. Valor negocio: muy alto (razón de ser para no cancelar la suscripción). Complejidad: alta (nueva infraestructura de jobs). Tiempo: 1-2 semanas. Riesgo: medio (coste de IA recurrente por usuario activo — necesita límites por plan desde el día uno).

**P1.2 — Watchlist + alertas por email**
Guardar nichos/keywords a vigilar (tabla nueva `watchlist`, similar a `favorites` pero con seguimiento activo) y que el feed de P1.1 también revise la watchlist, enviando un email (Resend/Postmark, no hay proveedor de email configurado hoy) cuando cambie algo importante.
Impacto: alto. Valor usuario: alto. Valor negocio: alto (retención). Complejidad: media-alta (depende de P1.1). Tiempo: 1 semana tras P1.1. Riesgo: bajo.

**P1.3 — Informes ejecutivos v2**
El PDF actual ya es bueno; conviértelo en un "documento ejecutivo" real añadiendo: resumen ejecutivo de la sesión completa de búsqueda (no solo un nicho), ranking comparativo de los nichos analizados, y un plan de acción a 30/60/90 días generado por IA a partir de los nichos con verdict="invertir". Reutiliza `lib/pdf.ts`, que ya tiene toda la infraestructura de renderizado.
Impacto: medio-alto. Valor usuario: medio-alto (ahorra tiempo real de armar el informe a mano). Valor negocio: medio (diferenciador Agency). Complejidad: media. Tiempo: 3-4 días. Riesgo: bajo.

**P1.4 — Memoria de sesión básica**
Antes de construir "personalización" completa, lo más barato y con más impacto es: al iniciar una búsqueda, pasarle al prompt de IA un resumen de las últimas 5 búsquedas del usuario (ya están en `niche_searches`) para que pueda decir cosas como "la semana pasada buscaste cafeteras — este nicho es una alternativa con mejor margen". No requiere tablas nuevas, solo una consulta adicional antes de construir el prompt.
Impacto: alto (sensación de "me conoce"). Valor usuario: alto. Valor negocio: medio. Complejidad: baja. Tiempo: 2-3 días. Riesgo: bajo (cuidado con el coste extra de tokens del contexto añadido).

---

## P2 — Recomendables (una vez lo anterior esté estable, 2-3 meses)

**P2.1 — Personalización automática de resultados**
Tras varias sesiones, ajustar automáticamente `geo` por defecto, filtros preseleccionados y tono del `executive_summary` según el histórico real del usuario (ticket medio que suele buscar, países, tipo de producto). Depende de tener suficiente volumen de datos por usuario — no tiene sentido antes de tener retención real.
Impacto: medio-alto. Complejidad: media. Tiempo: 1 semana. Riesgo: bajo.

**P2.2 — Workspaces (multi-proyecto)**
Nueva tabla `workspaces` + `workspace_members`, y todo lo que hoy cuelga de `user_id` (búsquedas, favoritos, alertas) pasa a colgar también de `workspace_id`. Es un cambio de esquema no trivial — tócalo cuando tengas claro que hay demanda real de equipos (el plan Agency ya promete "hasta 10 usuarios" sin que exista ningún mecanismo de invitar/gestionar miembros).
Impacto: alto para el segmento Agency/equipos. Complejidad: alta (migración de datos, RLS nueva por workspace). Tiempo: 2-3 semanas. Riesgo: medio-alto (toca el modelo de datos central).

**P2.3 — Competitor Intelligence**
Detectar automáticamente entradas/salidas de competidores, cambios de precio, aumento de publicidad. Esto requiere una fuente de datos que hoy no tienes (scraping de tiendas competidoras, o una API de terceros tipo SimilarWeb/SEMrush). No es una feature de código, es una decisión de negocio: ¿compras acceso a una API de datos de competencia, o inviertes en scraping propio (con el riesgo legal/técnico que conlleva)? Recomiendo validar con clientes Agency reales si pagarían por esto antes de construirlo.
Impacto: potencialmente muy alto pero especulativo. Complejidad: muy alta + depende de terceros. Tiempo: no estimable sin decidir la fuente de datos. Riesgo: alto.

**P2.4 — Automatizaciones tipo Zapier**
"Si Opportunity Score > 90 → guardar en watchlist → enviar Telegram → generar PDF". Constrúyelo sobre P1.1/P1.2 una vez existan como piezas sueltas — un motor de reglas simple (tabla `automation_rules` + un runner que las evalúa dentro del mismo cron de P1.1) es suficiente, no hace falta un motor de workflows genérico.
Impacto: medio (feature muy "power user", no todo el mundo la usará). Complejidad: media-alta. Tiempo: 1-2 semanas. Riesgo: medio.

**P2.5 — Rediseño UI/UX completo (Linear/Stripe/Vercel/Notion como referencia de filosofía, no de diseño)**
Espacio en blanco generoso, tipografía cuidada, microanimaciones, sistema de componentes consistente (`Button`, `Card`, `Modal`, `Badge` reutilizables en vez de estilos inline repetidos). Esto es grande y visual — no lo hagas sin poder verificar el resultado renderizado (necesitas un entorno donde puedas ver capturas de pantalla del resultado, cosa que este sandbox no tenía disponible en la sesión actual).
Impacto: alto en percepción de marca/conversión. Complejidad: alta. Tiempo: 2-4 semanas. Riesgo: medio-alto si se hace sin revisión visual iterativa.

**P2.6 — Mobile-first real (no responsive)**
Bottom sheets en vez de modales centrados, gestos de swipe entre nichos, PWA con notificaciones push. Depende del rediseño UI (P2.5) para no duplicar trabajo — hazlo como parte del mismo esfuerzo, no antes.
Impacto: alto (gran parte del tráfico de un SaaS de este tipo es móvil). Complejidad: alta. Tiempo: incluido en P2.5. Riesgo: medio.

---

## P3 — Futuras (una vez el negocio esté escalando de verdad)

**P3.1 — Sistema predictivo con probabilidades**
Probabilidad de viralización, de saturación, vida útil estimada. Para que esto sea algo más que la IA inventando un número con apariencia de precisión estadística, necesitas datos históricos reales de evolución de nichos a lo largo del tiempo — cosa que hoy no registras (cada búsqueda es un snapshot aislado). Antes de esto: empieza a guardar snapshots periódicos de los mismos nichos/keywords (eso es en parte lo que ya hace P1.1) para tener con qué entrenar o al menos fundamentar predicciones reales dentro de 6-12 meses.
Impacto: potencialmente muy alto, es un diferenciador fuerte frente a Semrush/Exploding Topics. Complejidad: muy alta. Tiempo: meses, y requiere datos que aún no existen. Riesgo: alto si se lanza sin datos reales detrás (mismo riesgo de credibilidad que ya señalé sobre los datos de mercado "verificados").

**P3.2 — Timeline inteligente (historia, no gráfica)**
"Hace 12 meses → hoy → predicción" con narrativa generada por IA en cada punto. Depende de tener el histórico de snapshots de P3.1/P1.1 — no se puede construir una historia de 12 meses sin 12 meses de datos guardados. Empieza a acumular datos ahora aunque la feature visual llegue después.
Impacto: alto una vez haya datos. Complejidad: alta. Tiempo: depende de P1.1 llevando meses corriendo. Riesgo: medio.

**P3.3 — Marketplace (nichos, informes, prompts, estrategias) + API pública + White-label + Enterprise**
Cada uno de estos es en sí mismo un producto secundario con su propio modelo de negocio, superficie legal (términos de marketplace, facturación a terceros) y carga de soporte. No los actives hasta tener una base de usuarios Pro/Agency que los esté pidiendo activamente — construir un marketplace sin oferta ni demanda previa es el error clásico de sobre-ingeniería de producto.
Impacto: alto a largo plazo, especulativo ahora. Complejidad: muy alta (cada uno). Tiempo: trimestres. Riesgo: alto si se prioriza antes de validar demanda.

**P3.4 — Alertas multi-canal (Telegram, Discord, Push)**
Amplía P1.2 (que ya cubre email) a más canales. Cada canal es una integración nueva (bot de Telegram, webhook de Discord, Web Push API) — bajo esfuerzo individual, pero solo tiene sentido una vez el email de P1.2 ya esté demostrando que las alertas generan re-engagement real.
Impacto: medio. Complejidad: media (por canal). Tiempo: 2-3 días por canal. Riesgo: bajo.

---

## Una recomendación final, sin rodeos

De las 15 iniciativas que pediste, la mitad dependen de infraestructura que hoy no existe (cron jobs, proveedor de email, tabla de eventos históricos, decisión sobre fuente de datos de competencia) y una parte de ellas (predicciones, timeline con 12 meses de historia) literalmente no se pueden construir de forma honesta hasta que lleves meses acumulando datos reales — construirlas antes sería simular con IA algo que debería ser medido, exactamente el mismo problema de credibilidad que ya señalé sobre los "datos verificados" del motor actual.

Mi recomendación de secuencia real: **P0 completo (2-3 semanas) → P1.1 y P1.2 juntos (feed + watchlist + alertas, 2-3 semanas más, es el verdadero salto a "IA proactiva") → medir retención/uso real antes de invertir en Workspaces, Competitor Intelligence o Marketplace**, que son las piezas más caras y más especulativas de toda la lista.
