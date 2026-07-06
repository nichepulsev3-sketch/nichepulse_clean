-- ============================================================
-- NichepulseV.3 — Migración 010: Resultados reales (Motor propio, Fase 1)
-- Ejecuta en Supabase SQL Editor
--
-- Primer paso de MOTOR_PROPIO_PROPUESTA.md: empezar a capturar si un
-- nicho analizado por la IA funcionó de verdad en la vida real. Sin
-- este dato, ningún modelo propio futuro sería más "predictivo" que la
-- IA actual — solo más rápido y barato. Esta migración NO toca el
-- motor de IA en absoluto, solo añade la infraestructura de captura.
-- ============================================================

-- ── Watchlist: recordar qué recordatorios de feedback ya se enviaron ──
-- Evita reenviar el mismo email de seguimiento (30/60/90 días) dos veces
-- para el mismo nicho vigilado.
alter table public.watchlist add column if not exists feedback_sent_30 timestamptz;
alter table public.watchlist add column if not exists feedback_sent_60 timestamptz;
alter table public.watchlist add column if not exists feedback_sent_90 timestamptz;

-- ── Resultados reales reportados por el usuario ─────────────────
create table if not exists public.niche_outcomes (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid references public.profiles on delete cascade not null,
  watchlist_id  uuid references public.watchlist on delete cascade not null,
  niche_name    text not null,
  milestone_days int not null check (milestone_days in (30, 60, 90)),
  tried         boolean not null,
  outcome       text not null check (outcome in ('exito','fracaso','en_curso','no_probado')),
  revenue_range text,
  notes         text,
  reported_at   timestamptz not null default now(),
  -- Un usuario reporta como mucho una vez por nicho vigilado y por hito
  -- (30/60/90) — si quiere corregir su respuesta, se actualiza el mismo
  -- registro, no se duplica.
  unique(watchlist_id, milestone_days)
);
create index if not exists idx_niche_outcomes_user on public.niche_outcomes(user_id, reported_at desc);
alter table public.niche_outcomes enable row level security;

drop policy if exists "Ver/insertar/actualizar el propio resultado" on public.niche_outcomes;
create policy "Ver/insertar/actualizar el propio resultado" on public.niche_outcomes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

select 'Migración 010 completada ✅';
