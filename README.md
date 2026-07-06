# NichePulse 🎯

Buscador de nichos de dropshipping con IA · Google Trends · TikTok · Amazon · Stripe · Supabase · Vercel

---

## Cómo desplegar (sin conocimientos técnicos)

### 1. Cuentas que necesitas (todas gratuitas para empezar)
- **GitHub** → github.com/signup
- **Supabase** → supabase.com (base de datos)
- **Stripe** → stripe.com (pagos)
- **Anthropic** → console.anthropic.com (IA)
- **Vercel** → vercel.com (hosting)

### 2. Configurar Supabase
1. Crea un proyecto nuevo en supabase.com
2. Ve a **SQL Editor** y ejecuta los archivos de la carpeta `supabase/migrations/` en orden (001 a 009). La migración 004 es especialmente importante: cierra una vulnerabilidad que permitía a cualquier usuario auto-ascender su propio plan a Agency sin pagar. La 005 crea `watchlist`/`opportunity_alerts` (Feed de oportunidades). La 006 añade índices de performance. La 007 crea `stripe_webhook_events` (evita procesar dos veces un webhook reenviado por Stripe). La 008 crea `cron_logs` (historial y locking del cron, evita que dos ejecuciones se solapen). La 009 crea `feature_flags` (activar/desactivar funcionalidades sin desplegar).
3. Copia desde **Settings → API**: Project URL, anon key y service_role key

### 3. Configurar Stripe
1. Crea dos productos en **Product catalog**:
   - NichePulse Pro → $19/mes recurrente
   - NichePulse Agency → $79/mes recurrente
2. Copia las claves desde **Developers → API Keys**
3. Crea un webhook en **Developers → Webhooks** (la URL la tendrás al desplegar)

### 4. Obtener clave de Anthropic
1. Ve a console.anthropic.com → API Keys → Create Key
2. Añade crédito en Billing ($5-10 para empezar)

### 5. Subir a GitHub
1. Instala **GitHub Desktop** (desktop.github.com)
2. Añade esta carpeta como repositorio
3. Haz commit y publícalo

### 6. Desplegar en Vercel
1. Ve a vercel.com → New Project → importa tu repositorio de GitHub
2. Añade estas variables de entorno con tus valores:

| Variable | Dónde encontrarla |
|---|---|
| `NEXT_PUBLIC_APP_URL` | Tu URL de Vercel (ej: https://nichepulse.vercel.app) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe → Developers → API Keys → Publishable |
| `STRIPE_SECRET_KEY` | Stripe → Developers → API Keys → Secret |
| `STRIPE_WEBHOOK_SECRET` | Stripe → Developers → Webhooks → Signing secret |
| `STRIPE_PRICE_PRO_MONTHLY` | Stripe → Product catalog → Pro → Price ID |
| `STRIPE_PRICE_AGENCY_MONTHLY` | Stripe → Product catalog → Agency → Price ID |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys |
| `OPENAI_API_KEY` | platform.openai.com → API Keys (opcional, motor secundario Pro/Agency) |
| `CRON_SECRET` | Inventa una cadena larga aleatoria — protege el endpoint del Feed de oportunidades |
| `RESEND_API_KEY` | resend.com → API Keys (opcional — sin esto, las alertas de watchlist no envían email, pero el resto de la app funciona igual) |
| `RESEND_FROM` | Ej: `NichePulse <alerts@tudominio.com>` (opcional, requiere dominio verificado en Resend) |

3. Haz clic en **Deploy**

### 7. Último paso: configurar webhook de Stripe
Una vez tengas tu URL de Vercel, actualiza la URL del webhook en Stripe:
`https://tu-app.vercel.app/api/webhooks/stripe`

Eventos a escuchar (imprescindible añadir los 5, si falta alguno el plan del usuario puede quedar desincronizado):
- checkout.session.completed
- customer.subscription.updated
- customer.subscription.deleted
- invoice.payment_failed
- invoice.paid

### 8. Configurar URL en Supabase
En Supabase → **Authentication → URL Configuration**:
- Site URL: `https://tu-app.vercel.app`
- Redirect URLs: `https://tu-app.vercel.app/auth/callback`

### 9. Activar el Feed de oportunidades (IA proactiva)
El endpoint `/api/cron/opportunity-feed` revisa a diario las búsquedas recientes de usuarios Pro/Agency y genera alertas cuando un nicho cambia de veredicto o de score. No se ejecuta solo: necesitas que algo lo llame una vez al día.

Opción más simple (gratis, sin instalar nada): en **cron-job.org**, crea una tarea que haga un `POST` diario a `https://tu-app.vercel.app/api/cron/opportunity-feed` con la cabecera `Authorization: Bearer <tu CRON_SECRET>`.

Si despliegas en Railway, puedes usar en su lugar un **Cron Schedule** de Railway apuntando al mismo endpoint con la misma cabecera.

Sin `RESEND_API_KEY` configurada, las alertas se siguen generando y viendo en la campana 🔔 del dashboard — solo no se envía el email a los nichos en watchlist.

---

## Estructura del proyecto

```
nichepulse/
├── app/
│   ├── api/
│   │   ├── search-niches/    → Búsqueda con IA
│   │   ├── trends/           → Señales Google/TikTok/Amazon
│   │   ├── create-checkout/  → Pagos Stripe
│   │   ├── cron/opportunity-feed/ → IA proactiva (con locking + cron_logs)
│   │   └── webhooks/stripe/  → Eventos de suscripción (idempotentes)
│   ├── auth/login/           → Login / Registro
│   ├── dashboard/            → App principal
│   ├── pricing/              → Planes y precios
│   └── ref/[code]/           → Links de afiliados
├── components/
│   └── TrendsPanel.tsx       → Panel de señales en vivo
├── lib/
│   ├── ai.ts                 → Motor Multi-IA (Claude + OpenAI)
│   ├── trends.ts             → Google + TikTok + Amazon
│   ├── stripe.ts             → Pagos
│   ├── supabase.ts           → Base de datos
│   ├── env.ts                → Validación centralizada de variables de entorno
│   ├── logger.ts             → Logging estructurado (JSON, sin console.log sueltos)
│   └── services/
│       └── featureFlags.ts   → Activar/desactivar funcionalidades sin desplegar
├── tests/                    → Vitest — lógica pura (parser JSON, límites de plan)
├── .github/workflows/ci.yml  → Typecheck + lint + tests en cada PR
├── ARCHITECTURE.md           → Convenciones de capas y estrategia de migración
└── supabase/migrations/      → SQL para crear las tablas (001 a 009)
```

Ver `ARCHITECTURE.md` para el detalle de por qué la estructura de carpetas se mantiene mayormente sin tocar (los ~80 archivos existentes ya funcionan en producción) y cómo se introducen las convenciones nuevas de forma incremental.

## Calidad y CI

- `npm run test` — corre los tests de Vitest (lógica pura: parser JSON de la IA, límites de plan). No cubren el 80% del proyecto todavía; cubren las piezas que más incidentes reales causaron.
- `.github/workflows/ci.yml` corre typecheck + lint + tests en cada push/PR a `main`. No despliega nada — Railway sigue desplegando de forma independiente.
- Variables de entorno: centralizadas en `lib/env.ts`. Si falta una obligatoria, el error dice exactamente cuál falta en vez de un crash genérico.
- Logs: `lib/logger.ts` — todo log de servidor es JSON estructurado (`{time, level, scope, msg, ...}`), filtrable en Railway por campo en vez de por texto libre.

---

## Planes y precios

| Plan | Precio | Búsquedas/día |
|---|---|---|
| Free | $0 | 5 |
| Pro | $19/mes | Ilimitadas |
| Agency | $79/mes | Ilimitadas + multi-usuario |

## Programa de afiliados

- 20% comisión con 1–10 referidos activos
- 30% comisión con 11–50 referidos activos
- 40% comisión con 51+ referidos activos
- Pago el día 1 de cada mes vía PayPal, cripto o transferencia
