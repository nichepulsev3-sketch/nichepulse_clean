# Propuesta: Workspaces (multi-usuario/multi-proyecto)

**Estado: decisiones de producto confirmadas por el CEO. SQL en borrador — sigue sin ejecutarse contra tu base de datos real.**

El plan Agency ya promete "hasta 10 usuarios" sin que exista ningún mecanismo para invitar, gestionar o compartir datos entre miembros de un equipo. Esto cierra esa brecha. Es el cambio de mayor riesgo de todo el roadmap porque toca el modelo de datos central (todo lo que hoy cuelga de `user_id` pasaría a colgar también de `workspace_id`) — por eso el esquema de abajo ya está cerrado, pero la ejecución sigue condicionada a poder probarla antes de tocar producción (ver sección 3).

## 0. Decisiones confirmadas

| Pregunta | Decisión |
|---|---|
| Facturación | **Una suscripción por workspace** — el owner paga el plan Agency y cubre a todo el equipo (hasta 10 usuarios, como ya se vende hoy). No hay facturación por asiento. |
| Multi-workspace | **Sí** — un usuario puede pertenecer a varios workspaces a la vez (su espacio personal + N de equipo), con un selector para cambiar de contexto. |
| Datos existentes | **Se quedan personales** — el historial previo de un usuario nunca se migra automáticamente a un workspace al unirse; `workspace_id` empieza en `null` y solo se rellena para lo nuevo que decida guardar ahí. |

Estas tres decisiones ya están reflejadas en el esquema y la migración de abajo — no quedan preguntas abiertas de producto, solo la validación técnica antes de tocar producción.

---

## 1. Modelo de datos propuesto

```
workspaces
├── id            uuid PK
├── name          text
├── owner_id      uuid → profiles.id
├── plan          text (hereda de owner, o propio si facturas por workspace)
├── created_at    timestamptz

workspace_members
├── id            uuid PK
├── workspace_id  uuid → workspaces.id
├── user_id       uuid → profiles.id
├── role          text  check (role in ('owner','admin','member'))
├── invited_by    uuid → profiles.id
├── joined_at     timestamptz
├── unique(workspace_id, user_id)

workspace_invites
├── id            uuid PK
├── workspace_id  uuid → workspaces.id
├── email         text
├── role          text
├── token         uuid (para el link de invitación)
├── expires_at    timestamptz
├── accepted_at   timestamptz (null = pendiente)
```

Tablas existentes que ganarían una columna `workspace_id uuid null references public.workspaces(id)`:
`niche_searches`, `favorites`, `watchlist`, `smart_alerts`, `opportunity_alerts`.

**Nullable a propósito**: un usuario Free/Pro sin equipo sigue funcionando exactamente igual que hoy, con `workspace_id = null` y los datos ligados solo a `user_id` como ahora. `workspace_id` solo se rellena cuando el usuario opera dentro de un workspace. Esto es lo que permite migrar sin tocar ni un solo registro existente.

## 2. Migración SQL en borrador (NO ejecutar todavía)

```sql
-- 007_workspaces.sql — BORRADOR, pendiente de aprobación

create table public.workspaces (
  id         uuid primary key default uuid_generate_v4(),
  name       text not null,
  owner_id   uuid references public.profiles on delete cascade not null,
  plan       text not null default 'agency',
  created_at timestamptz not null default now()
);

create table public.workspace_members (
  id           uuid primary key default uuid_generate_v4(),
  workspace_id uuid references public.workspaces on delete cascade not null,
  user_id      uuid references public.profiles on delete cascade not null,
  role         text not null default 'member' check (role in ('owner','admin','member')),
  invited_by   uuid references public.profiles,
  joined_at    timestamptz not null default now(),
  unique(workspace_id, user_id)
);

create table public.workspace_invites (
  id           uuid primary key default uuid_generate_v4(),
  workspace_id uuid references public.workspaces on delete cascade not null,
  email        text not null,
  role         text not null default 'member',
  token        uuid not null default uuid_generate_v4() unique,
  expires_at   timestamptz not null default (now() + interval '7 days'),
  accepted_at  timestamptz
);

alter table public.niche_searches      add column if not exists workspace_id uuid references public.workspaces;
alter table public.favorites           add column if not exists workspace_id uuid references public.workspaces;
alter table public.watchlist           add column if not exists workspace_id uuid references public.workspaces;
alter table public.smart_alerts        add column if not exists workspace_id uuid references public.workspaces;
alter table public.opportunity_alerts  add column if not exists workspace_id uuid references public.workspaces;

alter table public.workspaces         enable row level security;
alter table public.workspace_members  enable row level security;
alter table public.workspace_invites  enable row level security;

-- Ver/gestionar un workspace solo si eres miembro.
create policy "Miembros ven su workspace" on public.workspaces
  for select using (exists (select 1 from public.workspace_members m where m.workspace_id = id and m.user_id = auth.uid()));
create policy "Solo el owner actualiza/borra" on public.workspaces
  for all using (owner_id = auth.uid());

create policy "Ver miembros de tu workspace" on public.workspace_members
  for select using (exists (select 1 from public.workspace_members m2 where m2.workspace_id = workspace_id and m2.user_id = auth.uid()));
create policy "Owner/admin gestiona miembros" on public.workspace_members
  for all using (exists (select 1 from public.workspace_members m2 where m2.workspace_id = workspace_id and m2.user_id = auth.uid() and m2.role in ('owner','admin')));

-- Búsquedas/favoritos/watchlist/alertas: visibles si son tuyas O si
-- perteneces al workspace al que están ligadas.
create policy "Ver propias o de mi workspace" on public.niche_searches
  for select using (
    auth.uid() = user_id
    or (workspace_id is not null and exists (select 1 from public.workspace_members m where m.workspace_id = niche_searches.workspace_id and m.user_id = auth.uid()))
  );
-- (misma política, adaptada, para favorites/watchlist/smart_alerts/opportunity_alerts)
```

## 3. Implicaciones técnicas de las decisiones ya tomadas

**Una suscripción por workspace** → hoy `lib/stripe.ts` y los webhooks resuelven el plan mirando `profiles.plan`/`profiles.stripe_customer_id` de un único usuario. Con esta decisión, un miembro que NO es el owner debe heredar el plan del workspace al que pertenece, no el suyo propio. Esto requiere una función `getEffectivePlan(userId, workspaceId?)` que:
1. Si no hay workspace activo → usa `profiles.plan` (comportamiento actual, sin cambios).
2. Si hay workspace activo → usa `workspaces.plan` (que a su vez se actualiza vía el webhook de Stripe cuando el OWNER paga, igual que hoy pero apuntando a la fila de `workspaces` en vez de a `profiles`).
Esto toca `app/api/search-niches/route.ts`, `app/api/webhooks/stripe/route.ts` y cualquier sitio que hoy lea `profile.plan` directamente para decidir límites — es el cambio de código con más superficie de todo el roadmap, no solo el esquema SQL.

**Multi-workspace (sí)** → como un usuario puede estar en varios a la vez, hace falta un "workspace activo" en sesión (client-side, ej. localStorage + query param) y todo lo que hoy hace `insert({user_id, ...})` pasa a hacer `insert({user_id, workspace_id: activeWorkspaceId ?? null, ...})`. La tabla `workspace_members` ya soporta esto sin cambios (no tiene `unique(user_id)`, solo `unique(workspace_id, user_id)`).

**Datos existentes personales (ya reflejado)** → el `workspace_id` nullable en el esquema de la sección 1 y la migración de la sección 2 ya implementan exactamente esto sin cambios adicionales.

## 4. Por qué esto NO se ejecuta directo todavía

1. **Toca datos reales de usuarios que ya existen.** Un error en una política RLS nueva sobre `niche_searches` no rompe una pantalla — puede dejar a usuarios actuales sin ver su propio historial, o peor, exponer datos de un workspace a quien no debería verlos. Sin poder correr esta migración contra una base de datos de prueba primero (el sandbox de esta sesión lleva caído toda la conversación), aplicarla a ciegas contra producción es la clase de cambio que se prueba antes de tocar, no que se revisa solo por lectura.
2. **El cambio de facturación por workspace toca Stripe en producción.** Cambiar de dónde lee el plan un usuario (`profiles` vs `workspaces`) sin poder probar el flujo completo de checkout/webhook en un entorno de prueba es el tipo de bug que se descubre cuando un cliente real deja de poder buscar a mitad de mes.

## 5. Frontend que falta construir

- Selector de workspace activo en el nav del dashboard (necesario ya que un usuario puede estar en varios).
- Pantalla `/workspace/settings`: miembros, roles, invitar por email.
- Página de aceptar invitación (`/invite/[token]`).
- Toggle "guardar en mi workspace activo" vs "guardar personal" al buscar/favoritear/vigilar.
- Ajustar el flujo de checkout de Stripe para que se pueda pagar "para un workspace" en vez de solo para el usuario individual.

## 6. Recomendación de secuencia

1. ~~Responder las 3 preguntas de producto~~ — hecho, ver sección 0.
2. Implementar `getEffectivePlan()` y migrar los puntos de lectura de `profile.plan` — esto se puede escribir y revisar por código sin tocar el esquema todavía.
3. Correr la migración de la sección 2 en un proyecto de Supabase de prueba (no en el de producción).
4. Implementar el frontend de invitación/gestión de miembros + selector de workspace.
5. Adaptar el checkout de Stripe para cobrar al workspace.
6. Solo entonces se migra producción.

No hay atajo seguro que salte estos pasos — sigue siendo la pieza más cara y con más superficie de riesgo de todo el roadmap, tal y como ya señalé en `BLUEPRINT_INTELIGENCIA.md`. Lo que cambió es que ya no hay preguntas de producto pendientes — el siguiente paso es técnico, no una decisión que deba tomar yo.
