-- ============================================================
-- NichePulse — Niche Intelligence Graph (Fase 1 de la plataforma
-- de inteligencia de mercado, ver NICHEPULSE_PLATFORM_STRATEGY.md)
--
-- Hasta ahora, cada búsqueda vivía como un JSON aislado dentro de
-- niche_searches.results, atado a un usuario y sin relación entre sí.
-- Ningún nicho existía como entidad propia: dos usuarios analizando
-- "auriculares inalámbricos" generaban dos blobs sin ninguna conexión.
--
-- Esta migración introduce ese grafo como un esquema relacional normal
-- de Postgres (nodos = filas, aristas = claves foráneas) — no hace
-- falta una base de datos de grafos dedicada al volumen actual; el
-- día que eso cambie, esta es la capa que se migraría, el resto de
-- la app seguiría llamando a lib/services/nicheGraph.ts igual.
-- ============================================================

-- ── Nodo central: el nicho como entidad canónica, no como texto libre ──
create table if not exists public.niches (
  id                    uuid primary key default uuid_generate_v4(),
  slug                  text unique not null,   -- nombre normalizado (dedup): minúsculas, sin acentos, guiones
  display_name          text not null,          -- nombre legible tal como lo devolvió la IA la primera vez
  category              text,                   -- null hasta clasificar de verdad (Fase 1b/2, no inventado ahora)
  tags                  text[] not null default '{}',
  times_analyzed        int  not null default 1,
  latest_opportunity_score int,
  latest_verdict        text,
  first_seen_at         timestamptz not null default now(),
  last_seen_at          timestamptz not null default now(),
  created_at            timestamptz not null default now()
);
create index if not exists idx_niches_category on public.niches(category);
create index if not exists idx_niches_last_seen on public.niches(last_seen_at desc);

-- Lectura pública para cualquier usuario autenticado (es inteligencia
-- de mercado agregada, no dato personal de nadie) — solo el service_role
-- (servidor) puede escribir, nunca el cliente directamente.
alter table public.niches enable row level security;
drop policy if exists "Lectura pública de nichos" on public.niches;
create policy "Lectura pública de nichos" on public.niches for select using (true);
drop policy if exists "Solo servidor escribe nichos" on public.niches;
create policy "Solo servidor escribe nichos" on public.niches for all using (auth.role() = 'service_role');

-- ── Historial: un snapshot de scores por cada vez que se analiza ──
-- (esto es lo que en Fase 10 se convierte en el Timeline de un nicho,
-- y en Fase 14 en el Global Market Index — sin esto acumulándose desde
-- ya, esas fases nunca tendrían con qué trabajar dentro de unos meses).
create table if not exists public.niche_score_history (
  id                 uuid primary key default uuid_generate_v4(),
  niche_id           uuid references public.niches on delete cascade not null,
  geo                text not null default 'US',
  opportunity_score  int,
  verdict            text,
  scores             jsonb not null default '{}',  -- los 12 sub-scores completos (con reasons)
  source_search_id   uuid references public.niche_searches on delete set null,
  recorded_at        timestamptz not null default now()
);
create index if not exists idx_score_history_niche on public.niche_score_history(niche_id, recorded_at desc);
create index if not exists idx_score_history_geo on public.niche_score_history(geo, recorded_at desc);

alter table public.niche_score_history enable row level security;
drop policy if exists "Lectura pública de historial" on public.niche_score_history;
create policy "Lectura pública de historial" on public.niche_score_history for select using (true);
drop policy if exists "Solo servidor escribe historial" on public.niche_score_history;
create policy "Solo servidor escribe historial" on public.niche_score_history for all using (auth.role() = 'service_role');

-- ── Memoria de comportamiento: qué hace cada usuario con cada nicho ──
-- (Fase 2: perfil inteligente de usuario. Fase 12: motor de
-- recomendaciones. Se registra el evento, no se interpreta todavía.)
create table if not exists public.user_niche_interactions (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid references public.profiles on delete cascade not null,
  niche_id          uuid references public.niches on delete cascade not null,
  interaction_type  text not null check (interaction_type in
                      ('search','view','watchlist_add','watchlist_remove',
                       'favorite_add','favorite_remove','export','dismiss')),
  geo               text,
  metadata          jsonb default '{}',
  created_at        timestamptz not null default now()
);
create index if not exists idx_interactions_user on public.user_niche_interactions(user_id, created_at desc);
create index if not exists idx_interactions_niche on public.user_niche_interactions(niche_id, created_at desc);

alter table public.user_niche_interactions enable row level security;
drop policy if exists "Ver/insertar las propias interacciones" on public.user_niche_interactions;
create policy "Ver/insertar las propias interacciones" on public.user_niche_interactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- El servidor (service_role) también necesita escribir estas filas en
-- nombre del usuario (p.ej. desde app/api/search-niches, que usa el
-- cliente admin) — la policy de arriba ya lo permite porque
-- service_role hace bypass de RLS por defecto en Supabase; se deja
-- explícita esta nota para que quede documentado y no parezca un
-- descuido si alguien audita esta tabla más adelante.
