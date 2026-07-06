# Arquitectura de NichepulseV.3

## Por qué este documento y no un movimiento de carpetas en bloque

Una reestructuración física de los ~80 archivos existentes en un único cambio (moverlos todos a `components/hooks/services/repositories/providers/contexts/utils/config/constants/types/validators/features/shared` y reescribir cada import) es el cambio de mayor superficie posible en este proyecto, y no hay forma de compilarlo ni testearlo antes de desplegar (el sandbox de esta sesión no puede correr `npm run build`). Un solo import mal reescrito rompe el build entero, y con ese volumen de cambios el error se descubre en Railway, no antes.

En vez de arriesgar eso, la arquitectura objetivo se define aquí y se aplica de forma incremental: **todo código nuevo sigue estas convenciones desde ya** (el logger, el rediseño del cron, feature flags, etc. de este mismo roadmap ya las siguen); **el código existente se migra cuando se toca por otra razón**, no de golpe. Es el patrón estándar para introducir arquitectura en una base de código que ya está en producción con usuarios reales.

## Capas

- **`app/`** — rutas de Next.js App Router (páginas + API routes). Deben ser finas: reciben la petición, llaman a un service, devuelven la respuesta. Hoy varias rutas (`cron/opportunity-feed`, `webhooks/stripe`) tienen lógica de negocio inline — candidatas a migrar a `lib/services/` cuando se toquen de nuevo.
- **`components/`** — componentes React de presentación. Ya existe y ya sigue el patrón (`SubPageNav`, `EmptyState`, `ListItem`, etc. extraídos en un turno anterior).
- **`lib/services/`** (nueva) — lógica de negocio pura, sin acceso directo a Supabase/Stripe. Ej.: `logger.ts`, `featureFlags.ts`.
- **`lib/repositories/`** (nueva, uso incremental) — acceso a datos encapsulado (queries Supabase) detrás de funciones con nombre de dominio, para que un service no sepa que la base de datos es Postgres. Se introduce para dominios nuevos o cuando se refactoriza uno existente; no se ha migrado `search-niches`/`favorites`/`watchlist` todavía porque ya funcionan y migrarlos no aporta valor inmediato al usuario, solo riesgo.
- **`lib/validators/`** (nueva, uso incremental) — validación de payloads de entrada (hoy dispersa e implícita en cada API route).
- **`lib/config/`** — ya cubierto por `lib/env.ts` (Fase 1/16, ya implementado): validación centralizada de variables de entorno con getters lazy.
- **`lib/types.ts`** — ya es la fuente única de tipos (`Plan`, `Profile`, `NicheResult`, etc.) — confirmado sin duplicados en la auditoría Fase 1.
- **`hooks/`, `providers/`, `contexts/`** (nueva, uso incremental) — hoy el estado se maneja con `useState`/`useEffect` directamente en cada página; no hay Context API en uso porque no hay estado verdaderamente global compartido entre páginas no relacionadas todavía. Se introducirá cuando Workspaces (selector de workspace activo) lo necesite de verdad — crearlo antes sería especular.
- **`shared/`** — utilidades sin dependencias de dominio (formateo, fechas). Hoy viven como funciones sueltas en `lib/trends.ts`/`lib/types.ts`; se extraerán si se duplican en un tercer sitio (regla de las 3 repeticiones antes de abstraer).

## Migraciones ejecutadas siguiendo ya esta convención

- `lib/env.ts` → capa de config.
- `lib/logger.ts` → capa de services (ver Fase 7).
- Rediseño del cron (Fase 8) → separa el "log de ejecución" (`cron_logs`, acceso a datos) del handler HTTP.
- Feature flags (Fase 15) → `lib/services/featureFlags.ts` + tabla propia.

## Lo que NO se hizo y por qué

No se movieron `app/api/search-niches`, `app/dashboard/page.tsx` ni el resto del árbol existente a la nueva estructura. Son los archivos con más tráfico real y menos margen de error; migrarlos exige poder compilar y probar cada cambio, algo que esta sesión no puede garantizar. Quedan como el primer candidato a refactor la próxima vez que se toquen por una razón funcional (no solo estética).
