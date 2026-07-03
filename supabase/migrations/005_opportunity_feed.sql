-- ============================================================
-- NichepulseV.3 — Migración 005: Feed de oportunidades + Watchlist
-- Ejecuta en Supabase SQL Editor
--
-- Base de datos para dos piezas del roadmap P1:
--  · opportunity_alerts: notificaciones cuando el cron
--    (app/api/cron/opportunity-feed) detecta que un nicho ya buscado
--    subió/bajó de veredicto o de score de forma relevante.
--  · watchlist: nichos que el usuario marca para vigilancia activa
--    (similar a favoritos, pero el cron los revisa a diario y puede
--    disparar un email cuando cambian).
-- ============================================================

-- ── niche_searches: falta la columna geo ────────────────────────
-- El cron del feed de oportunidades necesita reproducir la misma
-- búsqueda (mismo país/mercado) que el usuario hizo originalmente.
alter table public.niche_searches add column if not exists geo text not null default 'US';

-- ── Watchlist ─────────────────────────────────────────────────
create table if not exists public.watchlist (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid references public.profiles on delete cascade not null,
  niche_name   text not null,
  query        text not null,
  geo          text not null default 'US',
  last_score   int,
  last_verdict text,
  niche_data   jsonb,
  created_at   timestamptz not null default now(),
  unique(user_id, niche_name)
);
create index if not exists idx_watchlist_user on public.watchlist(user_id, created_at desc);
alter table public.watchlist enable row level security;

-- Postgres no soporta "create policy if not exists" (a diferencia de
-- create table/index) — el patrón idempotente correcto es drop + create.
drop policy if exists "Watchlist propia (lectura/borrado)" on public.watchlist;
create policy "Watchlist propia (lectura/borrado)" on public.watchlist
  for select using (auth.uid() = user_id);
drop policy if exists "Watchlist propia (insertar)" on public.watchlist;
create policy "Watchlist propia (insertar)" on public.watchlist
  for insert with check (auth.uid() = user_id);
drop policy if exists "Watchlist propia (borrar)" on public.watchlist;
create policy "Watchlist propia (borrar)" on public.watchlist
  for delete using (auth.uid() = user_id);
-- Las actualizaciones (last_score/last_verdict) las hace el cron con
-- la service_role key, no el usuario desde el cliente.
drop policy if exists "Watchlist: solo service_role actualiza" on public.watchlist;
create policy "Watchlist: solo service_role actualiza" on public.watchlist
  for update using (auth.role() = 'service_role');

-- ── Feed de oportunidades (alertas) ─────────────────────────────
create table if not exists public.opportunity_alerts (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid references public.profiles on delete cascade not null,
  niche_name   text not null,
  query        text,
  old_score    int,
  new_score    int,
  old_verdict  text,
  new_verdict  text,
  message      text not null,
  source       text not null default 'feed' check (source in ('feed','watchlist')),
  email_sent   boolean not null default false,
  read         boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists idx_alerts_user_unread on public.opportunity_alerts(user_id, read, created_at desc);
alter table public.opportunity_alerts enable row level security;

drop policy if exists "Alertas propias (lectura)" on public.opportunity_alerts;
create policy "Alertas propias (lectura)" on public.opportunity_alerts
  for select using (auth.uid() = user_id);
drop policy if exists "Alertas propias (marcar leída)" on public.opportunity_alerts;
create policy "Alertas propias (marcar leída)" on public.opportunity_alerts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- Solo el cron (service_role) puede crear alertas — nunca el cliente.
drop policy if exists "Alertas: solo service_role inserta" on public.opportunity_alerts;
create policy "Alertas: solo service_role inserta" on public.opportunity_alerts
  for insert with check (auth.role() = 'service_role');

select 'Migración 005 completada ✅';
