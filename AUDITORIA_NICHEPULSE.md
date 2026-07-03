# Auditoría técnica y de producto — NichepulseV.3

Rol adoptado: CTO + Product Designer Senior + Staff Engineer.
Alcance: código completo del repositorio `nichepulse_clean` — 3 migraciones SQL, 8 rutas API, 11 páginas, 5 componentes, `lib/*`, config de build/deploy. Leído archivo por archivo, no por muestreo.

**Nota de transparencia:** el sandbox de ejecución de esta sesión no pudo arrancar (fallo de virtualización), así que no pude correr `npm run build` / `tsc` / tests para verificar mecánicamente los cambios. Los apliqué con lectura completa y revisión manual línea a línea, pero **te recomiendo correr `npm run build` antes de desplegar** los cambios que hice (ver sección final).

---

## Hallazgo crítico — léelo antes que nada

**Cualquier usuario logueado puede auto-ascenderse a plan Agency gratis, sin pagar, desde la consola del navegador.**

En `supabase/migrations/001_initial_schema.sql`:

```sql
create policy "Perfil propio" on public.profiles for all using (auth.uid() = id);
```

`for all` + una sola condición `using` significa que un usuario autenticado puede hacer `UPDATE` sobre **cualquier columna** de su propia fila, incluida `plan`, `searches_today`, `stripe_customer_id` o `affiliate_code`. No hay restricción a nivel de columna. Con el cliente anon (que ya está expuesto en el navegador porque es `NEXT_PUBLIC_SUPABASE_ANON_KEY`), basta con:

```js
await supabase.from('profiles').update({ plan: 'agency', searches_today: 0 }).eq('id', user.id)
```

Esto no es teórico: la política ya existía cuando escribiste el resto del sistema de límites (`canSearch`, `PLAN_LIMITS`, Stripe) asumiendo que `plan` solo lo toca el backend. Es la vulnerabilidad más grave del proyecto porque rompe el modelo de negocio entero (monetización, cuotas, afiliados) con tres líneas de JavaScript. La he corregido directamente — está en la sección de implementación al final.

---

## 1. Arquitectura

**Bien:** Next.js 14 App Router es la elección correcta para este producto (SSR selectivo, API routes co-localizadas, despliegue simple). Separación `lib/` (dominio) vs `app/` (presentación) vs `components/` (UI compartida) es coherente para el tamaño actual. `lib/types.ts` como fuente única de tipos es una buena decisión que evita duplicación.

**Mal:** no hay capa de servicio entre las API routes y Supabase/Stripe — cada route reimplementa auth, manejo de errores y acceso a datos a mano. Hay **dos configuraciones de despliegue activas simultáneamente** (`vercel.json` y `railway.json`), lo que sugiere que no está claro cuál es la plataforma de producción real; el log de build que compartiste es de Railway (Nixpacks/buildkit), así que `vercel.json` probablemente esté muerto y confundiendo a cualquiera que toque el repo. No existe capa de caché de aplicación (solo caché de tendencias en Supabase), no hay cola de trabajos para operaciones lentas (generación IA, PDFs), y no hay ningún tipo de observabilidad (no hay Sentry, no hay logging estructurado, solo `console.log`).

**Eliminaría:** `vercel.json` si Railway es la plataforma real (o al revés — pero decide una y borra la otra ya). El array `API_ROUTES` en `middleware.ts` está declarado y nunca usado — código muerto.

**Reescribiría:** la capa de acceso a datos como un módulo `lib/db/*.ts` con funciones tipadas (`getProfile`, `incrementSearchUsage`, `updatePlan`) para que las 5 API routes dejen de tener SQL/Supabase calls dispersas y repetidas.

**Simplificaría:** unificar en una sola plataforma de despliegue con un único `next.config.js` como fuente de verdad.

**Automatizaría:** CI en GitHub Actions que corra `next build`, `tsc --noEmit` y lint en cada PR — hoy un error de sintaxis como el que me pediste arreglar (el bug de `pdf.ts`) solo se descubre en el build de producción, nunca antes.

**Modularizaría:** extraer un cliente HTTP interno (`lib/api-client.ts`) para las llamadas fetch del frontend, hoy repetidas con `fetch` + `Authorization: Bearer` a mano en cada página.

**Optimizaría:** mover el cálculo de IA a un patrón asíncrono con estado persistido (job + polling o streaming) en lugar de una request HTTP síncrona de hasta 28s.

**Para nivel internacional:** arquitectura hexagonal ligera (dominio puro sin dependencias de Next.js), feature flags (LaunchDarkly/GrowthBook) para lanzar cambios de pricing/IA sin deploy, y un entorno de staging real con su propio Supabase/Stripe test-mode — hoy todo apunta a un único proyecto de Supabase y no hay señal de entorno de pruebas separado.

## 2. Código

**Bien:** TypeScript con tipos de dominio ricos y bien documentados (`lib/types.ts` es genuinamente bueno). Uso de `zod` para validar el input de `search-niches`. Nomenclatura en español consistente y comentarios que explican el "por qué", no solo el "qué".

**Mal:** `app/dashboard/page.tsx` tiene **763 líneas en un solo componente** con estilos inline en cada elemento — es inmantenible a partir de aquí; cualquier cambio visual obliga a tocar ese archivo monolítico. Estilos inline mezclados con clases CSS (`className="card card-hover"` junto a `style={{...}}` gigantes) — dos sistemas de estilado compitiendo. El bug de build que corregiste hoy (ASI: llamada a función sin `;` seguida de una línea que empieza por `(`) es exactamente el tipo de error que ESLint con la regla `no-unexpected-multiline` habría detectado antes del build — no está activada. `create-checkout/route.ts` no valida `plan`/`affiliateCode` con zod (solo confía en el chequeo `PLANS[plan]`), inconsistente con `search-niches` que sí usa zod.

**Eliminaría:** las dos convenciones de variables CSS coexistiendo (`--c1/--t1/--g1` como alias de `--bg-base/--txt-1/--g-brand` en `globals.css`). Es deuda técnica de una migración de design system a medio terminar — o se completa la migración o se revierte, pero no se mantienen los dos nombres para siempre.

**Reescribiría:** `dashboard/page.tsx` dividido en al menos 8 componentes (`SearchBar`, `ResultsGrid`, `NicheCard`, `NicheModal`, `HistoryTab`, `AffiliateTab`, `PlansTab`, `Nav`) con estilos en Tailwind (que ya está instalado y configurado, pero apenas se usa — el proyecto paga el coste de Tailwind sin cobrar el beneficio).

**Simplificaría:** centralizar el patrón `fetch + Bearer token` de auth en un hook `useAuthFetch()`.

**Automatizaría:** Prettier + ESLint con `eslint-config-next` reforzado (`no-unexpected-multiline`, `no-floating-promises`) como pre-commit hook (Husky) y en CI.

**Modularizaría:** extraer el parser JSON multi-intento de `lib/ai.ts` (función `parse`, con 6 estrategias distintas de recuperación) a su propio módulo con tests unitarios — es la pieza más frágil y crítica del producto (todo el valor del negocio depende de parsear bien la respuesta del LLM) y hoy no tiene ni un test.

**Optimizaría:** memoización de los objetos `GEO_REGIONS`/`GEO_MAP` (ya están fuera del componente, bien) pero los estilos inline se recrean en cada render — con 6+ resultados y un modal, esto genera miles de objetos de estilo por interacción.

**Para nivel internacional:** cobertura de tests (Vitest + Testing Library) empezando por `lib/ai.ts` (parser) y `lib/types.ts` (helpers de scoring), Storybook para los componentes una vez modularizados, y un linter de accesibilidad (`eslint-plugin-jsx-a11y`) — ahora mismo no está.

## 3. Escalabilidad

**Bien:** uso de `Promise.allSettled`/`Promise.race` para paralelizar llamadas a IA y fuentes de tendencias — patrón correcto para reducir latencia percibida.

**Mal:** el rate limiter de `middleware.ts` vive en un `Map` en memoria del proceso. En cualquier entorno con más de una instancia (autoscaling de Railway/Vercel, o simplemente un redeploy) **el límite deja de ser real** — cada instancia tiene su propio contador, así que un atacante (o un usuario agresivo) puede multiplicar su cuota efectiva por el número de instancias activas. El propio comentario en el código ya lo admite ("para producción usar Upstash Redis") pero nunca se migró. El caché de tendencias es a nivel global por geo (`trends_cache`), lo cual está bien, pero no hay ningún caché para resultados de búsqueda de nichos — cada query de usuario cuesta una llamada a Claude (y a veces también a OpenAI en paralelo) aunque diez usuarios pregunten lo mismo el mismo día.

**Eliminaría:** el rate limiter en memoria tal cual está — da una falsa sensación de seguridad.

**Reescribiría:** rate limiting con Upstash Redis (o Vercel KV) usando un algoritmo de sliding window, compartido entre instancias.

**Simplificaría:** un único punto de "cuota" (ahora mismo hay dos sistemas de límite corriendo en paralelo sin relación entre sí: el rate limit del middleware por IP, y el `searches_today` por usuario en Postgres — deberían fusionarse en un solo servicio de cuotas).

**Automatizaría:** invalidación y recalentamiento de caché de tendencias vía cron (la función `purge_expired_trends()` ya existe en SQL pero nada la llama — no hay cron job configurado en Railway/Vercel ni Supabase Edge Function programada).

**Modularizaría:** un servicio de caché semántico para resultados de IA (ej. embeddings de la query + búsqueda por similitud) para no recalcular nichos casi idénticos.

**Optimizaría:** cancelar la promesa "perdedora" en `raceAI()` — hoy ambas llamadas (Claude y OpenAI) se ejecutan y se pagan igual aunque solo se use el resultado que llega primero. Es dinero literal tirado en cada búsqueda Pro/Agency.

**Para nivel internacional:** arquitectura multi-región para latencia (hoy todo es un único deployment), colas (SQS/Inngest/Trigger.dev) para desacoplar generación de IA de la request HTTP, y auto-scaling con límites de coste (alertas de gasto en Anthropic/OpenAI antes de que sea una sorpresa en la factura).

## 4. Seguridad

**Bien:** los secretos del servidor (`STRIPE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`) están correctamente fuera del bundle cliente (sin prefijo `NEXT_PUBLIC_`), el webhook de Stripe valida la firma (`stripe.webhooks.constructEvent`), y `.env*` está en `.gitignore`. Headers de seguridad básicos (`X-Frame-Options`, `X-Content-Type-Options`, etc.) existen en el middleware.

**Mal:** el hallazgo crítico de arriba (RLS de `profiles` permite auto-escalar plan). Además: las políticas RLS `for all using (...)` sin `with check` explícito en `favorites`, `smart_alerts` y `onboarding` tienen el mismo patrón de riesgo — funcionan hoy porque Postgres reutiliza `using` como `with check` por defecto, pero es un patrón frágil que un futuro cambio de esquema puede romper silenciosamente. La comprobación de cuota en `search-niches/route.ts` era "leer, luego escribir" (no atómica): dos requests simultáneas del mismo usuario gratuito podían pasar ambas el chequeo `canSearch()` antes de que el contador se actualizara, superando el límite diario. Los headers de seguridad del middleware solo se aplican a rutas que coinciden con el matcher (`/dashboard`, `/auth`, `/api`, etc.) — la home page `/` y `/pricing`, que son las páginas públicas más visitadas, no los reciben.

**Eliminaría:** la confianza implícita en `using` como `with check` — hacerlo explícito en todas las políticas.

**Reescribiría:** la política de `profiles` para que el cliente solo pueda tocar columnas de perfil "seguras" (nombre, avatar, preferencias, onboarding), nunca `plan`, `searches_today`, `stripe_customer_id` ni `affiliate_code`. (Implementado — ver más abajo.)

**Simplificaría:** un único middleware de autorización reutilizado en todas las API routes en vez de repetir 6 veces el mismo bloque `getUser(token)` + manejo de error 401.

**Automatizaría:** escaneo de dependencias (`npm audit`/Dependabot) — no hay evidencia de que se revise; `stripe@16` y `@anthropic-ai/sdk@0.36` son razonablemente recientes pero sin proceso, esto se pudre solo.

**Modularizaría:** un helper `requireUser(req)` centralizado que se usa en las 5 rutas que hoy repiten el mismo patrón de extraer el Bearer token y validar.

**Optimizaría:** mover el incremento de `searches_today` a una función SQL atómica (`UPDATE ... WHERE searches_today < limit RETURNING`) para cerrar la condición de carrera. (Implementado.)

**Para nivel internacional:** CSP real (hoy no existe Content-Security-Policy — es difícil de aplicar con tanto estilo inline, otra razón más para migrar a Tailwind/CSS modules), 2FA opcional para cuentas, logs de auditoría de cambios de plan/facturación, y un programa de disclosure de vulnerabilidades aunque sea informal (un `security.txt`).

## 5. Rendimiento

**Bien:** `Cache-Control` correcto en `/api/trends` (`s-maxage=21600, stale-while-revalidate`), timeouts explícitos en las llamadas a IA (28s Claude, 24s OpenAI) para no colgar la request indefinidamente, y carga diferida del panel de tendencias en móvil (colapsado por defecto).

**Mal:** cero uso de `next/image` — no hay optimización de imágenes en absoluto (aunque el proyecto usa pocas imágenes hoy, cuando las añada pagará el coste completo). Sin `React.memo`/`useMemo` en las listas de resultados, que se re-renderizan enteras con cada cambio de estado del componente padre de 763 líneas. Las fuentes de Google Fonts se cargan con `<link>` clásico en el `<head>` en vez de `next/font`, perdiendo el auto-hosting/preload optimizado que Next.js ofrece de fábrica. El spinner genérico de "Multi-IA analizando..." puede durar hasta 28 segundos sin ningún feedback de progreso — percepción de lentitud/fallo aunque el sistema esté funcionando bien.

**Eliminaría:** la carga de Google Fonts vía `<link>` — es estrictamente peor que `next/font/google` en este stack.

**Reescribiría:** el flujo de búsqueda para mostrar resultados incrementales (streaming de la respuesta del LLM con Server-Sent Events, o al menos un progreso "1/6 nichos analizados") en vez de un spinner ciego.

**Simplificaría:** consolidar los estilos inline en clases utilitarias para reducir el tamaño del bundle de JS de cada página (hoy cada objeto de estilo es JS ejecutándose en cada render).

**Automatizaría:** Lighthouse CI en el pipeline para detectar regresiones de rendimiento antes de producción.

**Modularizaría:** separar el bundle de `jspdf` (pesado) para que solo se cargue cuando el usuario Pro/Agency pulsa "Descargar PDF" — hoy se importa dinámicamente dentro de `lib/pdf.ts` (`getJsPDF()`), lo cual está bien hecho, pero confírmalo con un análisis de bundle porque el resto del dashboard no usa `dynamic()` de Next.js para nada más.

**Optimizaría:** memoizar `NicheCard` y usar `key` estables (hoy se usa el índice `i` como key en `results.map((n,i)=>...)`, lo que rompe el reconciling de React si el orden cambia).

**Para nivel internacional:** Core Web Vitals monitorizados en producción (Vercel Analytics o similar), presupuesto de rendimiento por página, y CDN de imágenes/assets.

## 6. UX

**Bien:** el flujo de onboarding (4 pasos, progreso visual, opción de "omitir") es de buena calidad y sigue buenas prácticas de producto. El countdown de recarga de búsquedas gratuitas (`useCountdown`) es un detalle de UX que reduce fricción real. Los estados de carga (skeleton, spinner) están presentes en la mayoría de vistas.

**Mal — esto era serio:** había funcionalidades pagadas que **no eran alcanzables desde la navegación principal**. El nav del dashboard (`TABS`) solo tenía Buscar / Historial / Afiliados / Planes, sin enlace a `/favorites` ni a `/radar` — solo se llegaba escribiendo la URL a mano o usando el Command Palette (⌘K), que la mayoría de usuarios no descubre nunca. Peor: **`/radar` estaba anunciado en pricing como "acceso al Radar en Pro/Agency" pero mostraba datos 100% hardcodeados (`SAMPLE`) idénticos para todos los usuarios**, con un `setTimeout` fingiendo una carga y el texto fijo "Actualizado hace 2h" — un usuario Pro pagando $19/mes y un usuario Free veían exactamente los mismos tres nichos falsos. El Command Palette además enlazaba a `/alerts` y `/compare`, páginas que no existen en el repo — 404 garantizados. La página de favoritos existía y funcionaba con Supabase real, pero no había ningún botón "guardar como favorito" en el dashboard.

**Eliminaría:** los enlaces a `/alerts` y `/compare` del Command Palette hasta que existan. (Implementado.)

**Reescribiría:** `/radar` para que consuma datos reales (ya tenías la infraestructura en `lib/trends.ts` y `/api/trends` — era cuestión de conectar, no de construir desde cero). (Implementado.)

**Simplificaría:** un único punto de navegación (sidebar o nav superior) que liste **todas** las secciones reales del producto según el plan del usuario, en vez de repartir el descubrimiento entre tabs, Command Palette y URLs directas.

**Automatizaría:** tests end-to-end (Playwright) que recorran cada enlace del Command Palette y fallen el build si alguno da 404.

**Modularizaría:** un componente `<UpgradeGate feature="radar">` reutilizable en vez de repetir la lógica de "si no es Pro, muestra este banner" en cada página.

**Optimizaría:** el modal de detalle de nicho mezcla información gratuita y de pago de forma poco predecible (candados 🔒 dispersos) — un patrón de paywall más consistente (blur + CTA único) convierte mejor.

**Para nivel internacional:** research de usuario real (ni un solo comentario en el código sugiere tests con usuarios), un sistema de feedback in-app, y funnels de analítica de producto (Mixpanel/PostHog) — hoy no hay ningún tracking de eventos de producto, así que no se puede saber qué se usa y qué no.

## 7. UI

**Bien:** paleta de color coherente y con buen gusto (violeta/rosa/teal sobre fondo oscuro), tipografía Inter + JetBrains Mono para un tono "tech premium" adecuado al público de dropshipping/ecommerce. `globals.css` define un design system con tokens serios (superficies, sombras, radios) — el problema no es el sistema, es su aplicación inconsistente.

**Mal:** **dos sistemas de nombres de variables CSS conviviendo** (`--c1/--t1/--g1` vs `--bg-base/--txt-1/--g-brand`) — páginas nuevas (`favorites`, `onboarding`, `radar`, `login`) usan los tokens nuevos; páginas antiguas (`page.tsx` home, `dashboard`, `pricing`, `TrendsPanel`) usan los alias legacy. Funciona porque están enlazados, pero es evidencia de una migración de diseño a medias. Estilos 100% inline en TSX en las páginas antiguas — nada de Tailwind pese a estar instalado y configurado (`tailwind.config.js` existe con extensiones custom, pero `dashboard/page.tsx` no usa una sola clase de Tailwind).

**Eliminaría:** una de las dos convenciones de nombres — declara ganadora la de `globals.css` (`--bg-*`, `--txt-*`, `--brand`) porque es la más reciente y descriptiva, y elimina los alias legacy reescribiendo los archivos que aún los usan.

**Reescribiría:** `dashboard/page.tsx` y `page.tsx` (home) a Tailwind, coherente con el resto.

**Simplificaría:** un componente `<Card>`, `<Badge>`, `<Button>` reutilizables — hoy cada botón define su propio `borderRadius`/`padding`/`boxShadow` a mano en cada archivo, con pequeñas inconsistencias entre ellos (compara el radio de los botones en `pricing/page.tsx` vs `dashboard/page.tsx`).

**Automatizaría:** un linter de estilos (Stylelint) o al menos una convención documentada para forzar uso de tokens en vez de valores hardcodeados (`rgba(124,111,255,0.35)` aparece repetido decenas de veces en vez de usar `var(--brand-glow)`, que ya existe para exactamente ese propósito).

**Modularizaría:** extraer el patrón de "métricas en grid 2x2" (Mercado/Margen/Competencia/Tendencia) que se repite casi idéntico en `dashboard` y `pdf.ts`.

**Optimizaría:** contraste de textos terciarios (`--txt-3: #54547a` sobre `--bg-base: #07070e`) — ratio aproximado ~3.2:1, por debajo del mínimo AA de 4.5:1 para texto normal. Se usa profusamente para metadatos (fechas, labels).

**Para nivel internacional:** un archivo de tokens de diseño exportado (Figma Tokens o Style Dictionary) compartido entre diseño y código, y modo claro real (`colorScheme: 'dark'` está forzado en el `viewport`, sin opción de usuario pese a que `UserPreferences.theme` en `lib/types.ts` ya contempla `'dark'|'system'` — el tipo promete algo que la UI no entrega).

## 8. Conversión

**Bien:** la barra de "X búsquedas restantes hoy" con countdown es un disparador de conversión legítimo y bien ejecutado. El pricing muestra claramente lo que se pierde en Free (❌ explícitos) — buena práctica de framing de pérdida. CTA de upgrade contextual al agotar búsquedas.

**Mal:** el precio de Agency ($79) no comunica con claridad el salto de valor respecto a Pro ($19) más allá de "análisis expert" — para un salto de precio 4x, el copy es débil. El feature "Radar" (uno de los ganchos de upgrade citados en `pricing/page.tsx`) no funcionaba con datos reales, así que el usuario que pagaba por eso se sentía engañado en cuanto lo probaba. No hay prueba social (testimonios, número de usuarios reales, logos de empresas) en ninguna página pública — el "12K+ nichos" y "50+ regiones" del dashboard son las únicas cifras, y aparecen después del login, no antes, donde ayudarían a decidir suscribirse.

**Eliminaría:** cualquier promesa de features en `pricing/page.tsx` que no esté conectada a datos reales, hasta que lo esté — es el camino más corto a una mala reseña o un chargeback de Stripe.

**Reescribiría:** la página de pricing pública con prueba social y una demo/vídeo del producto real (hoy es solo texto + tabla de features).

**Simplificaría:** un único CTA principal por pantalla — hoy en el dashboard conviven simultáneamente banner de upgrade, badge flotante de Agency, y botones en el tab de Planes, compitiendo entre sí.

**Automatizaría:** A/B testing de precios/copy con una herramienta como GrowthBook (mencionada como capacidad disponible en tu entorno) antes de asumir que $19/$79 es el punto óptimo.

**Modularizaría:** el componente de tarjeta de plan está duplicado casi al carácter entre `pricing/page.tsx` y el `PlansTab` dentro de `dashboard/page.tsx` — un único `<PricingCard>` compartido evitaría que diverjan (hoy ya han divergido: pricing público ofrece "Top 10 nichos" en Pro, el dashboard dice "Top 8").

**Optimizaría:** el checkout va directo a Stripe Checkout sin capturar intención (no hay carrito, no hay opción de plan anual con descuento pese a que muchos SaaS convierten mejor con anual — no se ofrece en ningún sitio del código).

**Para nivel internacional:** exit-intent y páginas de recuperación de checkout abandonado (Stripe permite esto con `after_expiration` en Checkout Sessions), y un plan anual con descuento (típicamente 15-20%) que no existe hoy en `lib/stripe.ts` (`PLANS` solo define mensual).

## 9. Monetización

**Bien:** modelo freemium con límites claros por plan (`PLAN_LIMITS`), afiliados con comisión escalonada (20/30/40%) bien pensada para incentivar volumen, y Stripe Checkout + webhooks para el ciclo de vida básico de suscripción.

**Mal:** la vulnerabilidad RLS del inicio es, ante todo, un problema de monetización. Además: **no existía portal de auto-gestión de facturación** — un usuario que quisiera cambiar de tarjeta, descargar una factura o cancelar tenía que escribir a soporte (`soporte@nichepulse.com`) para todo. El webhook solo manejaba `checkout.session.completed`, `customer.subscription.deleted` e `invoice.payment_failed` — no `customer.subscription.updated` ni recuperación tras un pago fallido. El sistema de afiliados calcula comisiones (`commissionPct`) pero no encontré ningún lugar en el código que efectivamente registre o pague comisiones — la tabla `affiliate_referrals` existe en SQL pero ninguna ruta escribe en ella cuando ocurre una conversión referida.

**Eliminaría:** la promesa de "Pago el día 1 de cada mes vía PayPal, cripto o transferencia" del README/afiliados hasta que exista el proceso — hoy es 100% manual y no auditable.

**Reescribiría:** el webhook de Stripe para cubrir el ciclo de vida completo de la suscripción. (Implementado.)

**Simplificaría:** un solo lugar donde viven los precios (hoy `lib/stripe.ts`, `app/pricing/page.tsx` y el `PlansTab` de `dashboard/page.tsx` repiten los mismos números `$19`/`$79` de forma independiente — cambiar el precio requiere tocar 3 archivos y ya han divergido en el detalle de features).

**Automatizaría:** el registro de comisiones de afiliados como parte del webhook `checkout.session.completed` (si `affiliate_code` viene en metadata, insertar en `affiliate_referrals` automáticamente) — hoy ese dato se captura pero se pierde.

**Modularizaría:** un servicio `lib/billing.ts` con `createPortalSession`, `getSubscriptionStatus`, `recordAffiliateConversion`.

**Optimizaría:** ofrecer anual con descuento (mejora LTV y reduce churn mensual de cobro).

**Para nivel internacional:** facturación multi-moneda real vía Stripe (hoy el precio siempre se cobra en USD aunque la búsqueda soporte 50+ regiones y monedas de visualización — es solo cosmético), impuestos automáticos (Stripe Tax) para VAT/IVA en la UE y LATAM, y dunning management (reintentos inteligentes de cobro) en vez de solo loguear el fallo.

## 10. SEO

**Bien:** metadata básica correcta en el layout raíz (OG, Twitter Card, keywords, iconos), uso de `viewport`/`themeColor` moderno de Next.js 14.

**Mal:** no hay `robots.txt` ni `sitemap.xml` en `public/` ni generados dinámicamente (`app/sitemap.ts` no existe). Las páginas internas (`pricing`, home) son componentes `'use client'` sin `generateMetadata` propio — heredan el título/descripción genérico del layout raíz. No hay datos estructurados (JSON-LD) para `SoftwareApplication`, `Product` o `FAQPage`. El copy multi-idioma de la home se decide en el cliente vía `navigator.language` — los motores de búsqueda verán siempre el HTML servido por defecto (español), así que no hay verdadero SEO multi-idioma pese a soportar 5 idiomas en el código.

**Eliminaría:** nada que quitar aquí — es más lo que falta que lo que sobra.

**Reescribiría:** la internacionalización de la home usando rutas (`/en`, `/es`, `/pt`...) con `next-intl`, para que cada idioma sea indexable y enlazable independientemente, con `hreflang`.

**Simplificaría:** metadata centralizada por página con `generateMetadata()` en vez de depender solo del layout raíz.

**Automatizaría:** generación de `sitemap.xml` con `app/sitemap.ts` (soporte nativo en Next 14) y `robots.txt` con `app/robots.ts`.

**Modularizaría:** un helper `buildMetadata(page)` para no repetir OG/Twitter tags manualmente en cada página.

**Optimizaría:** contenido indexable real en la home más allá del hero — FAQ, casos de uso o comparativa para posicionar por keywords long-tail.

**Para nivel internacional:** blog/contenido programático (páginas por nicho/categoría generadas desde tus propios datos de tendencias — tienes el dataset perfecto en `trends_cache`) y Core Web Vitals monitorizados.

## 11. IA

**Bien:** el patrón de carrera Claude vs GPT-4o-mini con fallback a reintento es una buena estrategia de resiliencia. El parser JSON con 6 estrategias de recuperación (`lib/ai.ts`, función `parse`) es pragmático ante la inconsistencia real de los LLMs devolviendo JSON. El prompt está bien estructurado con un esquema JSON explícito y ejemplos.

**Mal — esto es un riesgo de producto, no solo técnico:** el prompt le pide al modelo "Datos REALES y VERIFICADOS, nunca genéricos" para cifras como `market_size: "$2.4B"` — pero un LLM sin acceso a herramientas de búsqueda/verificación **no puede verificar nada**; genera cifras plausibles, no reales. El producto se vende explícitamente sobre la precisión de estos datos ("el radar de nichos más preciso del mundo", literal en la home) y los usuarios toman decisiones de inversión de $500-$10.000 basándose en ellos. Es el riesgo número uno del negocio a medio plazo. Adicionalmente: `raceAI()` no cancela al proveedor que pierde la carrera — pagas por Claude y por GPT-4o-mini en cada búsqueda Pro/Agency aunque solo uses una respuesta. No hay ningún test que valide que el JSON de salida cumple el schema de `NicheResult` antes de mostrarlo al usuario.

**Eliminaría:** el lenguaje "datos reales y verificados" del prompt y del marketing — sustituir por lenguaje honesto ("estimaciones generadas por IA basadas en señales de mercado") que además te protege legalmente.

**Reescribiría:** el pipeline para que las cifras "duras" se apoyen en las señales reales que sí tienes (`trends_cache` de Google/TikTok/Amazon) en vez de dejar que el LLM las invente libremente.

**Simplificaría:** un único proveedor de IA por defecto (Claude) con OpenAI como fallback solo si Claude falla, en vez de carrera simultánea — reduce coste ~50% en el caso feliz.

**Automatizaría:** evals automáticos del prompt (un set de 20-30 queries de referencia) que corran en CI cuando cambies el prompt.

**Modularizaría:** separar `buildSystem()`, `parse()` y `enrichResult()` en archivos independientes con tests.

**Optimizaría:** cancelar con `AbortController` la llamada perdedora en `raceAI()`.

**Para nivel internacional:** un pipeline de verificación con búsqueda real (herramientas de búsqueda web o integración con una API de datos de mercado real) para al menos las cifras clave, y versionado de prompts con capacidad de rollback.

## 12. APIs

**Bien:** rutas REST limpias y con responsabilidad única, manejo de errores consistente, y uso de zod donde está presente.

**Mal:** falta de consistencia en validación (zod en `search-niches`, no en `create-checkout`), no hay versionado de API (`/api/v1/...`) pese a venderse "Acceso API REST" como feature del plan Agency. No hay documentación de API. No hay paginación consistente (favoritos no pagina en absoluto — si un usuario Agency llega a 999 favoritos, como permite `PLAN_LIMITS`, esa página cargará todo de golpe).

**Eliminaría:** nada, el diseño base es razonable.

**Reescribiría:** `create-checkout/route.ts` con validación zod idéntica al patrón de `search-niches`.

**Simplificaría:** un wrapper `withAuth(handler)` para las rutas que repiten el mismo boilerplate de extraer y validar el Bearer token.

**Automatizaría:** documentación OpenAPI generada desde los schemas zod antes de vender "Acceso API REST" como feature.

**Modularizaría:** separar validación/autenticación/lógica de negocio en capas dentro de cada route handler.

**Optimizaría:** paginar `favorites` igual que ya se pagina el historial.

**Para nivel internacional:** rate limiting por plan (hoy solo por IP), API keys reales para clientes Agency (hoy es una promesa sin implementación), y webhooks salientes para clientes Agency.

## 13. Base de datos

**Bien:** uso correcto de RLS como primera línea de defensa (con la excepción crítica ya comentada), índices añadidos donde hacen falta, y triggers para `updated_at` y rachas de actividad bien planteados.

**Mal:** la vulnerabilidad de RLS en `profiles` (ya cubierta). El campo `results jsonb` en `niche_searches` crece sin límite y sin ningún mecanismo de archivado/purga. La función `purge_expired_trends()` existe pero no está programada en ningún sitio. `smart_alerts` tiene tabla y tipo TypeScript sin que ninguna ruta de API la use — feature modelada en base de datos sin lógica de aplicación detrás.

**Eliminaría:** nada del esquema en sí — está razonablemente bien normalizado.

**Reescribiría:** las políticas RLS de escritura de `profiles` para restringir columnas. (Implementado.)

**Simplificaría:** decidir si `smart_alerts`/`achievements` se construyen pronto o se quitan del esquema.

**Automatizaría:** cron que llame a `purge_expired_trends()` diariamente, y un job de archivado de `niche_searches` antiguas.

**Modularizaría:** mover `get_user_stats` a una vista materializada si el volumen crece.

**Optimizaría:** verificar planes de consulta de las queries más frecuentes con `EXPLAIN ANALYZE` cuando haya volumen real.

**Para nivel internacional:** particionado de `niche_searches` por fecha si el volumen crece mucho, backups verificados con ensayo real de restore, y staging con datos anonimizados.

## 14. Supabase

**Bien:** uso correcto de `@supabase/ssr`, separación clara entre cliente browser (anon key) y cliente admin (service role) con comentarios explícitos de cuándo usar cada uno.

**Mal:** `getSupabaseAdmin()` (bypassa RLS por completo) se usa dentro de `search-niches/route.ts` — funcionalmente necesario porque la ruta ya valida el token manualmente, pero significa que un bug en esa ruta tiene acceso total a la base de datos sin ninguna red de seguridad de RLS por debajo.

**Eliminaría:** nada — el patrón admin es necesario para operaciones cross-user (webhooks), pero acótalo.

**Reescribiría:** en rutas donde el usuario ya está autenticado con su propio JWT, usar un cliente Supabase con ese JWT en vez de la service role, para que RLS siga aplicando como segunda capa de defensa.

**Simplificaría:** un único punto que documente explícitamente las operaciones que legítimamente necesitan bypassear RLS.

**Automatizaría:** tests de las policies de RLS (pgTAP) — el descubrimiento de la vulnerabilidad crítica fue manual; con un test se habría detectado en el primer PR.

**Modularizaría:** las migraciones están bien numeradas; sigue esa disciplina — la migración de seguridad que añado hoy es la `004`.

**Optimizaría:** revisar planes de consulta según crezca el volumen real.

**Para nivel internacional:** Supabase Point-in-Time Recovery activado, y separación de proyecto Supabase entre staging/producción real.

## 15. Stripe

**Bien:** Checkout Sessions con `subscription_data.metadata` duplicando el `user_id`, `allow_promotion_codes: true` habilitado, y una estrategia de fallback de 3 niveles en el webhook para encontrar al usuario.

**Mal:** sin Customer Portal (ya cubierto en Monetización) — era la carencia más grave del lado Stripe. El webhook no manejaba `customer.subscription.updated`. `verify-subscription/route.ts` es, en la práctica, un parche para la fragilidad del webhook — se llama manualmente desde el frontend cuando el usuario vuelve del checkout, duplicando lógica que el webhook ya debería garantizar.

**Eliminaría:** nada de lo existente — más bien completar lo que falta.

**Reescribiría:** el webhook para manejar el ciclo completo. (Implementado.)

**Simplificaría:** una vez el webhook sea robusto, `verify-subscription` puede quedar solo como fallback de emergencia.

**Automatizaría:** registro de eventos de Stripe en una tabla propia (`stripe_events`) con el `event.id` como clave única, para reprocesar eventos fallidos y detectar duplicados.

**Modularizaría:** `lib/billing.ts` con toda la lógica de Stripe hoy repartida entre varios archivos.

**Optimizaría:** usar `stripe.customers.list({email})` solo como último recurso — ya lo haces bien en `verify-subscription`.

**Para nivel internacional:** Stripe Tax, Stripe Radar para fraude, facturas con tu marca, y soporte de métodos de pago locales reales vía Stripe (hoy `pricing/page.tsx` anuncia visualmente PIX/OXXO/crypto/wire, pero `payment_method_types: ['card']` solo habilita tarjeta).

## 16. Gestión de estados

**Bien:** uso correcto de hooks nativos de React sin sobre-ingeniería innecesaria para el tamaño actual del equipo.

**Mal:** `dashboard/page.tsx` tiene **~20 variables de estado independientes** en un solo componente sin ningún reducer que las agrupe. No hay gestión de estado de servidor (no hay React Query/SWR) — cada `useEffect` hace su propio fetch manual con su propio manejo de loading/error. El perfil del usuario se recarga manualmente después de cada acción en al menos 4 sitios distintos en vez de invalidarse de forma centralizada.

**Eliminaría:** las recargas manuales dispersas de `profile`.

**Reescribiría:** el estado del dashboard con `useReducer` para las variables relacionadas de búsqueda, y React Query para todo lo que sea datos de servidor.

**Simplificaría:** con React Query, gran parte de los `useEffect` de carga desaparecen directamente.

**Automatizaría:** invalidación de caché automática tras mutaciones.

**Modularizaría:** un contexto `AuthProvider`/`ProfileProvider` a nivel de layout para que `profile` no se cargue de forma independiente en cada página.

**Optimizaría:** planifica el estado compartido con Context o React Query antes de dividir `dashboard/page.tsx` en componentes, no después.

**Para nivel internacional:** persistencia de estado de UI no crítico en URL. (Parcialmente implementado: `?tab=` y `?q=` ya se leen ahora.)

## 17. Componentes

**Bien:** los componentes que sí existen como tales (`TrendsPanel`, `SkeletonCard`, `CommandPalette`, `PWABanner`) están razonablemente bien encapsulados, con props tipadas y responsabilidad única.

**Mal:** el 90% de la superficie visual real del producto (`dashboard`, `page.tsx` home, `pricing`) no está componetizada en absoluto. No hay una librería de componentes base (`Button`, `Card`, `Input`, `Modal`, `Badge`).

**Eliminaría:** nada — construir, no quitar, es lo que toca aquí.

**Reescribiría:** extraer de `dashboard/page.tsx` al menos `NicheCard`, `NicheModal`, `SearchBar`, `PlanCard`, `Nav`.

**Simplificaría:** un `Modal` genérico reutilizable — el modal de detalle de nicho tiene su propio overlay/backdrop hardcodeado.

**Automatizaría:** Storybook con visual regression testing (Chromatic) una vez exista la librería base de componentes.

**Modularizaría:** ver arriba — es la acción #1 de este informe en deuda técnica de UI.

**Optimizaría:** una vez modularizado, aplicar `React.memo` donde tenga sentido.

**Para nivel internacional:** un sistema de componentes documentado (Storybook + Radix UI o shadcn/ui como base accesible).

## 18. Accesibilidad

**Bien:** hay algún uso de `title` como tooltip descriptivo en botones, y el contraste del texto principal es alto.

**Mal — es débil en general:** múltiples elementos interactivos son `<div onClick>` en vez de `<button>` — no alcanzables por teclado ni anunciados por lectores de pantalla. El modal de detalle de nicho no gestiona el foco (sin focus trap, sin cierre con `Escape`). Los emojis usados como iconos funcionales no tienen texto alternativo. Contraste de `--txt-3` insuficiente (AA). Inputs sin `<label>` asociado formalmente en varios sitios.

**Eliminaría:** los `<div onClick>` en elementos que son claramente controles interactivos.

**Reescribiría:** el modal con un patrón accesible real (focus trap, `role="dialog"`, `aria-modal`, `Escape`) — o usar Radix Dialog.

**Simplificaría:** con `eslint-plugin-jsx-a11y` activo, la mayoría de estos problemas se detectan automáticamente.

**Automatizaría:** axe-core en los tests E2E.

**Modularizaría:** una librería de componentes accesibles de base evita reinventar accesibilidad en cada pantalla nueva.

**Optimizaría:** subir el contraste de `--txt-3` a un valor que cumpla AA.

**Para nivel internacional:** auditoría WCAG 2.1 AA formal antes de vender el producto a agencias/empresas, y soporte de `prefers-reduced-motion`.

## 19. Responsive

**Bien:** hay lógica explícita de detección de móvil e iOS para adaptar tanto el layout como el flujo de descarga de PDF — el manejo cross-platform en `lib/pdf.ts` está genuinamente bien pensado. Uso de `clamp()` en tipografía.

**Mal:** la detección de móvil por `window.innerWidth` en `useEffect` causa un salto de layout perceptible en la primera carga (CLS). Duplicada de forma independiente sin extraerse a un hook compartido.

**Eliminaría:** la detección de móvil basada en JS puro donde un enfoque CSS-first (Tailwind responsive) resolvería lo mismo sin layout shift.

**Reescribiría:** un hook `useIsMobile()`/`useIsIOS()` compartido en `lib/hooks/`.

**Simplificaría:** usar CSS/Tailwind responsive en vez de ramificar JSX completo con `isMobile ? A : B` (más de 30 veces en `dashboard/page.tsx`).

**Automatizaría:** testing visual en distintos viewports (Playwright) en CI.

**Modularizaría:** el hook de detección de dispositivo, una vez extraído, se usa en todas las páginas.

**Optimizaría:** usar `matchMedia` con listener en vez de `resize` puro.

**Para nivel internacional:** testing real en dispositivos (BrowserStack) como parte del proceso de release.

## 20. Roadmap

Ver la lista priorizada P0–P3 más abajo para el detalle accionable. A nivel de visión: los próximos 2-3 meses deberían enfocarse, en este orden, en (1) cerrar los agujeros de seguridad/integridad de negocio, (2) eliminar las features "de mentira" convirtiéndolas en reales o retirándolas del marketing, y (3) pagar la deuda de arquitectura de frontend (dashboard monolítico) antes de que el equipo crezca y el coste de esa deuda se multiplique por cada nueva persona que toque ese archivo.

---

## Lista priorizada de mejoras

### P0 — Críticas (bloquean confianza, ingresos o seguridad)

**P0.1 — Cerrar el agujero de RLS que permite auto-ascender de plan gratis**
Beneficio esperado: cierra la fuga de ingresos más grave del producto. Impacto en usuario: ninguno negativo (invisible para usuarios legítimos). Impacto en negocio: crítico — protege el 100% del modelo de monetización. Dificultad: baja (una migración SQL). Tiempo estimado: 1-2h incluyendo pruebas. Riesgo: bajo si se prueba en staging antes de aplicar en producción. Orden recomendado: primero, antes que cualquier otra cosa. **Implementado en esta sesión.**

**P0.2 — Cerrar la condición de carrera en el contador de búsquedas gratuitas**
Beneficio esperado: cuota diaria realmente respetada. Impacto en usuario: ninguno perceptible. Impacto en negocio: medio-alto. Dificultad: baja-media. Tiempo estimado: 2-3h. Riesgo: bajo. Orden recomendado: justo después de P0.1. **Implementado en esta sesión.**

**P0.3 — Retirar o arreglar la promesa de "Radar en tiempo real" de pago**
Beneficio esperado: elimina riesgo de chargebacks/reputación por feature de pago inexistente. Impacto en usuario: alto y directo. Impacto en negocio: alto. Dificultad: media. Tiempo estimado: 1 día para una versión real básica. Riesgo: bajo. Orden recomendado: primera semana. **Parcialmente implementado en esta sesión** (conectado a datos reales para las categorías que sí tienen señal; el resto queda marcado explícitamente como muestra).

**P0.4 — Migrar el rate limiting a un store compartido (Redis/Upstash)**
Beneficio esperado: rate limiting real en producción con múltiples instancias. Impacto en usuario: ninguno negativo. Impacto en negocio: medio-alto. Dificultad: media (requiere cuenta de Upstash). Tiempo estimado: 3-4h. Riesgo: bajo. Orden recomendado: primera semana. No implementado en esta sesión (requiere una cuenta/credencial externa nueva que no puedo crear por ti).

### P1 — Muy importantes (impacto directo en negocio/producto en 2-4 semanas)

**P1.1 — Stripe Customer Portal (autogestión de facturación)**
Beneficio esperado: elimina soporte manual, reduce fricción de cancelación mal gestionada. Impacto en usuario: alto. Impacto en negocio: alto. Dificultad: baja. Tiempo estimado: medio día. Riesgo: bajo. Orden recomendado: semana 1-2. **Implementado en esta sesión** (endpoint backend + botón en el dashboard).

**P1.2 — Completar el webhook de Stripe (`subscription.updated`, recuperación de pago)**
Beneficio esperado: los cambios de plan y recuperaciones de pago se reflejan siempre en Supabase. Impacto en usuario: medio. Impacto en negocio: alto. Dificultad: baja. Tiempo estimado: 2-3h. Riesgo: bajo. Orden recomendado: semana 1-2. **Implementado en esta sesión** (recuerda añadir `customer.subscription.updated` e `invoice.paid` a los eventos suscritos en el dashboard de Stripe).

**P1.3 — Registrar conversiones de afiliados automáticamente**
Beneficio esperado: el programa de afiliados pasa a ser real y auditable. Impacto en usuario: alto para afiliados. Impacto en negocio: medio-alto. Dificultad: media. Tiempo estimado: 1 día. Riesgo: bajo. Orden recomendado: semana 2-3. No implementado (requiere que definas la política de atribución/pago).

**P1.4 — Conectar Favoritos a la UI real (botón guardar)**
Beneficio esperado: activa una feature ya construida en base de datos y backend. Impacto en usuario: medio-alto. Impacto en negocio: medio. Dificultad: baja. Tiempo estimado: 2-3h. Riesgo: bajo. Orden recomendado: semana 2. **Implementado en esta sesión.**

**P1.5 — Dividir `dashboard/page.tsx` en componentes**
Beneficio esperado: velocidad de desarrollo futura, menos bugs por cambios accidentales. Dificultad: alta. Tiempo estimado: 3-5 días con pruebas visuales cuidadosas. Riesgo: medio. Orden recomendado: semana 3-4, con tiempo dedicado. No implementado — requiere revisión visual humana pantalla a pantalla que no puedo verificar sin renderizar la app.

### P2 — Recomendables (mejoran calidad y eficiencia, 1-2 meses)

**P2.1 — Migrar a Tailwind/design tokens consistentes, eliminar CSS legacy.** Dificultad media-alta, 1-2 semanas, riesgo medio (visual).

**P2.2 — React Query (o SWR) para todo el data-fetching.** Dificultad media, 3-5 días, riesgo bajo-medio.

**P2.3 — Tests automatizados empezando por `lib/ai.ts` (parser) y RLS.** Dificultad media, 1 semana inicial.

**P2.4 — CSP real + auditoría de accesibilidad.** Dificultad media, 1 semana.

**P2.5 — SEO técnico: sitemap, robots.txt, metadata por página, i18n con rutas.** Dificultad media, 1 semana.

**P2.6 — Cancelar la llamada de IA perdedora en `raceAI()`.** Dificultad baja, 1 día. Ahorro de coste directo en OPEX de IA.

### P3 — Futuras (una vez el negocio esté estabilizado)

**P3.1 — Plan anual con descuento y Stripe Tax.**
**P3.2 — Contenido programático SEO desde `trends_cache`.**
**P3.3 — Multi-región, colas para IA/PDF, streaming de resultados.**
**P3.4 — Sistema de alertas inteligentes real (la tabla y el tipo ya existen).**
**P3.5 — API pública versionada con API keys para clientes Agency.**

---

## Qué he implementado directamente en el código en esta sesión

No implementé "todas" las mejoras — habría sido irresponsable aplicar cambios grandes de UI (dividir el dashboard, migrar a Tailwind) sin poder renderizar la app ni correr el build en este entorno (el sandbox de ejecución falló al arrancar). Prioricé lo que es seguro de aplicar por lectura/escritura de código con alta confianza y alto impacto.

**Aplicado:**

1. **`supabase/migrations/004_security_hardening.sql`** (nuevo) — cierra el agujero de RLS (P0.1) con un trigger que protege `plan`, `searches_today`, `searches_reset_at`, `stripe_customer_id`, `total_searches`, `streak_days`, `affiliate_code` de modificación por el propio usuario; añade la función atómica `increment_search_usage()` (P0.2) y `refund_search_usage()` (devuelve la cuota si la IA falla tras reservarla). **Tienes que ejecutar esta migración manualmente en el SQL Editor de Supabase** — no tengo credenciales para aplicarla yo.
2. **`app/api/search-niches/route.ts`** — usa `increment_search_usage()` en vez de leer-luego-escribir; devuelve la cuota con `refund_search_usage()` si la búsqueda de IA falla.
3. **`app/api/create-portal-session/route.ts`** (nuevo) — endpoint del Stripe Customer Portal (P1.1).
4. **`app/api/webhooks/stripe/route.ts`** — añadido manejo de `customer.subscription.updated` e `invoice.paid` (P1.2).
5. **`app/api/radar/route.ts`** (nuevo) + **`app/radar/page.tsx`** — conectado a datos reales de `lib/trends.ts` para las categorías TikTok/Amazon/Google/Emergentes/Virales; las categorías sin señal real equivalente (baja competencia, alto margen, recomendados IA) quedan explícitamente marcadas como "muestra" en la interfaz. Al pulsar un nicho del radar, ahora navega al dashboard y lanza el análisis Multi-IA automáticamente.
6. **`app/dashboard/page.tsx`** — enlaces de navegación a Favoritos y Radar (antes invisibles); botón "☆ Favorito" en cada resultado y en el modal de detalle, conectado a la tabla `favorites` ya existente (P1.4); botón "⚙️ Gestionar facturación" en la pestaña de Planes, conectado al nuevo portal de Stripe (P1.1); soporte para `?q=` (búsqueda automática al llegar desde el Radar) y `?tab=` (deep-link de pestañas, que el Command Palette ya intentaba usar sin que el dashboard lo leyera).
7. **`components/CommandPalette.tsx`** — quitados los enlaces a `/alerts` y `/compare`, que no existen y daban 404 garantizado.
8. **`README.md`** — actualizado el listado de eventos de webhook de Stripe a suscribir (añadidos `customer.subscription.updated` e `invoice.paid`) y la referencia a ejecutar la migración 004.

**Verificación:** no pude ejecutar `npm run build` / `tsc` por el fallo del sandbox de esta sesión. Revisé cada archivo manualmente tras editarlo, incluyendo una relectura completa de las zonas modificadas de `dashboard/page.tsx` para confirmar que las llaves/JSX cuadran. **Antes de desplegar, corre `npm run build` localmente** — si algo falla, pégame el error tal como hiciste al principio de esta conversación y lo arreglo igual de rápido.

**No toqué** (a propósito, por ser cambios de alto riesgo visual que no puedo verificar sin renderizar la app, o por requerir decisiones tuyas): la migración a Tailwind, la división del dashboard en componentes, el rate limiting con Redis (necesita una cuenta externa tuya), el registro automático de comisiones de afiliados (necesita que definas la política de atribución/pago), y cualquier cambio de copy/precio en páginas públicas.
