# NichePulse — Verificación del checklist de lanzamiento

Este informe aplica el checklist del CEO (pruebas E2E, rendimiento, backups, monitoreo, legal) contra el estado real del código después de los cambios P0 de `AUDITORIA_LANZAMIENTO_V1.md`.

**Aviso de alcance, léelo antes que el resto**: este entorno de trabajo no tiene acceso a las credenciales reales de Supabase/Stripe/Sentry ni capacidad para instalar el proyecto completo (`npm install` de Next.js son cientos de MB; cada comando de este sandbox tiene un límite de 45 segundos sin persistencia entre llamadas — se intentó dos veces y no completó). Por eso, lo de abajo distingue con precisión **qué se verificó leyendo y trazando el código real** (fiable) de **qué solo se puede verificar ejecutando la app de verdad, algo que tienes que hacer tú o un entorno de CI con las claves reales**.

---

## 1. Pruebas end-to-end de los flujos principales

**No se pudieron ejecutar pruebas E2E reales en este entorno** (sin claves de Supabase/Stripe de test, sin capacidad de instalar/levantar el servidor). Esto ya estaba documentado como hueco conocido en `AUDITORIA_LANZAMIENTO_V1.md` (Fase 8) y en el propio `playwright.config.ts`, que dice explícitamente que los flujos con login real "necesitarían un usuario de prueba y un proyecto de Supabase de test, que no existen en este repositorio".

Lo que sí se hizo: trazar cada flujo línea a línea contra el código real, con foco especial en las 8 rutas tocadas por los fixes P0 de la ronda anterior (posible fuente de regresión más probable):

- **Registro/login**: `middleware.ts` protege `/dashboard`, `/watchlist`, `/favorites`, `/feedback`, `/admin`, `/copilot`; redirige a `/auth/login` si no hay sesión y de vuelta a `/dashboard` si ya hay sesión. Lógica intacta, sin tocar en esta ronda.
- **Búsqueda** (`/api/search-niches`): el catch genérico ahora devuelve un mensaje sanitizado en vez de `error.message` crudo — el camino especial `ai_unavailable` (que dispara el fallback a Vista rápida en el dashboard) se dejó explícitamente intacto, confirmado leyendo el archivo completo tras el fix.
- **Watchlist/Favoritos**: reconstruidos y verificados esta sesión con `esbuild` limpio (0 errores) tras el fix de paginación (`.limit(500)`). La query, el alias `niche:niche_data` y el resto de la lógica de UI quedaron exactamente igual que antes del cambio.
- **Alertas** (`/api/opportunity-alerts`): GET y PATCH devuelven ahora mensajes de error sanitizados; el resto de la lógica (marcar como leída/actuada) no se tocó.
- **Pagos**: se releyó completo `create-checkout/route.ts` y `webhooks/stripe/route.ts` (no tocados en esta ronda, pero es la parte más sensible del checklist). Checkout crea/reutiliza cliente de Stripe correctamente; el webhook tiene idempotencia real vía `stripe_webhook_events`, y resuelve el usuario de 3 formas distintas (metadata → customer_id → email) antes de darse por vencido, cubre `checkout.session.completed`, `customer.subscription.deleted`, `customer.subscription.updated` e `invoice.payment_failed`/`invoice.paid`. No se encontró ningún problema estructural.

**Lo que tienes que hacer tú**: un pase manual real (registro → buscar un nicho → guardarlo en favoritos → añadirlo a watchlist → simular un pago en modo test de Stripe) antes de anunciar el lanzamiento. Es la única forma honesta de confirmar que estos flujos funcionan de extremo a extremo — ninguna lectura de código sustituye probarlo de verdad.

---

## 2. Rendimiento con datos reales y carga moderada

**Tampoco ejecutable aquí** (sin base de datos real con volumen, sin servidor levantado). Verificación posible por código:

- Los dos índices que faltaban en `niches` (la tabla que más va a crecer) ya están en `supabase/migrations/012_launch_hardening.sql` — falta que **ejecutes esa migración en tu proyecto de Supabase real**, algo que yo no puedo hacer desde aquí (no tengo tus credenciales).
- El rate limiting en memoria (`middleware.ts`) es correcto a nivel de lógica: confirmado que ahora agrupa `compare-niches`, `copilot` y `executive-report` bajo el límite estricto de 20/min junto con `search-niches`.
- Caché de resultados de IA (3h) y límites diarios por plan siguen intactos, no se tocaron.

**Lo que tienes que hacer tú**: aplicar la migración 012 en Supabase, y si quieres un número real de rendimiento, un test de carga ligero (`k6` o `autocannon`) contra el entorno de Railway ya desplegado — eso sí simula usuarios reales, algo que este sandbox no puede.

---

## 3. Backups y procedimientos de recuperación

**No verificable desde el código ni desde este sandbox** — es configuración del panel de Supabase, no algo que viva en el repositorio. Esto ya estaba marcado como pendiente en la Fase 13 de la auditoría (⚠️ "No confirmado en el repo").

**Lo que tienes que hacer tú**: entra a tu proyecto de Supabase → Settings → Database → Backups, y confirma: (a) qué plan tienes contratado y si incluye backups automáticos diarios, (b) si tienes point-in-time recovery activado, (c) si alguna vez has probado restaurar un backup (no solo que existan). Si tu plan no incluye backups automáticos, es la única pieza de este checklist que consideraría bloqueante de verdad antes de captar usuarios de pago.

---

## 4. Monitoreo — Sentry, health checks y logs

Esto sí se pudo verificar con evidencia directa de código (sin necesitar servidor corriendo):

- **`/api/health`** (releído completo): hace ping real a Supabase con timeout de 3s, comprueba antigüedad del último cron (>30h = degradado), valida las 3 env vars críticas, y devuelve `200` si todo está bien, `503` si algo crítico falla. Es un health check real, no un `return 200` fijo — esto ya lo confirma también el test de Playwright `smoke.spec.ts` (aunque ese test tampoco se pudo ejecutar aquí).
- **Sentry** (`sentry.server.config.ts` releído): `enabled: !!dsn` — confirmado que hoy, sin `NEXT_PUBLIC_SENTRY_DSN`, Sentry literalmente no se activa (no es solo que "no reporte", es que `Sentry.init` se llama con `enabled: false`). En cuanto añadas el DSN en Railway, empieza a funcionar sin ningún otro cambio.
- **Logs**: `createLogger` sigue centralizando todos los `.error()`/`.warn()`/`.info()` en JSON estructurado, sin cambios en esta ronda.

**Lo que tienes que hacer tú**: sigue siendo el único punto pendiente real — crear el proyecto en Sentry.io y pegar el DSN en las variables de entorno de Railway (5 minutos, como ya se dijo). Sin eso, todo lo demás de esta sección está listo pero "a oscuras".

---

## 5. Legal y privacidad

Revisión completa, línea a línea, de `app/legal/privacidad/page.tsx` y `app/legal/terminos/page.tsx` contra los proveedores reales usados por el código (verificado por grep de imports/SDKs: Supabase, Stripe, Anthropic, OpenAI, Resend, Railway, y ahora Plausible).

**Un hallazgo real, corregido en esta misma revisión**: la Política de Privacidad (sección 5, "Con quién compartimos tus datos") no mencionaba Plausible, el proveedor de analítica añadido en la ronda P0 anterior. Aunque Plausible es sin cookies y no identifica usuarios individualmente, omitirlo de la lista de proveedores era una inconsistencia real entre lo que el código hace y lo que la política declara. **Ya corregido**: ahora la sección 5 lo incluye, aclarando que es agregado y sin cookies.

Resto de la revisión: contenido internamente consistente, sin contradicciones entre ambas páginas, términos de pago/cancelación alineados con la lógica real de Stripe del código, cláusula de "no es asesoramiento financiero" presente (importante dado que el producto da veredictos de "invertir/esperar/evitar").

**Lo que tienes que hacer tú** (ya estaba dicho, se repite porque este checklist lo pide explícitamente): que un abogado revise ambas páginas antes o poco después del lanzamiento, sobre todo si vas a tener usuarios en la UE — el aviso de que esto es un borrador razonable, no asesoría legal real, sigue explícito en el propio código como comentario.

---

## Resumen: qué queda genuinamente verificado vs qué depende de ti

| Punto del checklist | Verificado aquí (código) | Requiere que tú lo hagas |
|---|---|---|
| E2E flujos principales | Trazado completo de cada ruta, sin regresiones encontradas | Pase manual real + Stripe en modo test |
| Rendimiento con carga | Índices y rate-limit correctos en código | Aplicar migración 012 en Supabase real + test de carga contra Railway |
| Backups/recuperación | No verificable desde repo | Confirmar en el panel de Supabase |
| Monitoreo (Sentry/health/logs) | Lógica de health check y gating de Sentry confirmados correctos | Crear proyecto Sentry + DSN en Railway (P0.8) |
| Legal/privacidad | Revisado, 1 inconsistencia real encontrada y corregida (Plausible) | Revisión por un abogado real |

Ningún hallazgo de esta pasada indica que algo esté roto. El fix del hueco de Plausible en la política de privacidad ya está commiteado junto con el resto. El resto de la lista son, honestamente, cosas que ni yo ni ningún análisis de código pueden confirmar por ti — necesitan que tú (o un pipeline de CI con las claves reales) ejecutes la app de verdad.
