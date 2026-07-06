# Propuesta: Workspaces (multi-usuario/multi-proyecto)

**Estado: propuesta para revisión. Nada de este SQL se ha ejecutado contra tu base de datos real.**

El plan Agency ya promete "hasta 10 usuarios" sin que exista ningún mecanismo para invitar, gestionar o compartir datos entre miembros de un equipo. Esto cierra esa brecha. Es el cambio de mayor riesgo de todo el roadmap porque toca el modelo de datos central (todo lo que hoy cuelga de `user_id` pasaría a colgar también de `workspace_id`) — por eso es una propuesta a aprobar, no un cambio aplicado.

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

## 3. Por qué esto NO se ejecuta directo

1. **Toca datos reales de usuarios que ya existen.** Un error en una política RLS nueva sobre `niche_searches` no rompe una pantalla — puede dejar a usuarios actuales sin ver su propio historial, o peor, exponer datos de un workspace a quien no debería verlos. Sin poder correr esta migración contra una base de datos de prueba primero (el sandbox de esta sesión lleva caído toda la conversación), aplicarla a ciegas contra producción es la clase de cambio que se prueba antes de tocar, no que se revisa solo por lectura.
2. **Decisiones de producto pendientes que no me corresponden**: ¿el plan del workspace lo paga el owner y ya, o facturas por asiento? ¿Un mismo usuario puede pertenecer a varios workspaces a la vez? ¿Qué pasa con las búsquedas ya hechas por un usuario cuando se une a un workspace — se migran o se quedan personales? Estas respuestas cambian el esquema.
3. **Encaje con Stripe**: hoy la suscripción cuelga de `profiles.stripe_customer_id` (1 usuario = 1 suscripción). Con workspaces hay que decidir si la suscripción pasa a colgar del workspace en vez del usuario — eso sí afecta directamente a `lib/stripe.ts` y a los webhooks ya en producción.

## 4. Frontend que faltaría (una vez aprobado el esquema)

- Selector de workspace en el nav del dashboard (si perteneces a más de uno).
- Pantalla `/workspace/settings`: miembros, roles, invitar por email.
- Página de aceptar invitación (`/invite/[token]`).
- Toggle "guardar en mi workspace" vs "guardar personal" al buscar/favoritear/vigilar.

## 5. Recomendación de secuencia

1. Responde las 3 preguntas de producto de la sección 3.2.
2. Yo (o quien implemente) corre la migración en un proyecto de Supabase de prueba primero, no en el de producción.
3. Se implementa el frontend de invitación/gestión de miembros.
4. Solo entonces se migra producción.

No hay atajo seguro que salte estos pasos — es la pieza más cara y con más superficie de riesgo de todo el roadmap, tal y como ya señalé en `BLUEPRINT_INTELIGENCIA.md`.
