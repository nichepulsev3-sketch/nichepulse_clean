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
2. Ve a **SQL Editor** y ejecuta los archivos de la carpeta `supabase/migrations/` en orden (001, 002, 003, 004). La migración 004 es especialmente importante: cierra una vulnerabilidad que permitía a cualquier usuario auto-ascender su propio plan a Agency sin pagar.
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

---

## Estructura del proyecto

```
nichepulse/
├── app/
│   ├── api/
│   │   ├── search-niches/    → Búsqueda con IA
│   │   ├── trends/           → Señales Google/TikTok/Amazon
│   │   ├── create-checkout/  → Pagos Stripe
│   │   └── webhooks/stripe/  → Eventos de suscripción
│   ├── auth/login/           → Login / Registro
│   ├── dashboard/            → App principal
│   ├── pricing/              → Planes y precios
│   └── ref/[code]/           → Links de afiliados
├── components/
│   └── TrendsPanel.tsx       → Panel de señales en vivo
├── lib/
│   ├── ai.ts                 → Motor Claude AI
│   ├── trends.ts             → Google + TikTok + Amazon
│   ├── stripe.ts             → Pagos
│   └── supabase.ts           → Base de datos
└── supabase/migrations/      → SQL para crear las tablas
```

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
