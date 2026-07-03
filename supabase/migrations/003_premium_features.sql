-- ============================================================
-- NichepulseV.3 — Migración 003: Funciones Premium
-- Ejecuta en Supabase SQL Editor
-- ============================================================

-- ── Añadir campos premium al perfil ──────────────────────────
alter table public.profiles
  add column if not exists avatar_url         text,
  add column if not exists onboarding_done    boolean not null default false,
  add column if not exists onboarding_data    jsonb,
  add column if not exists streak_days        int not null default 0,
  add column if not exists streak_reset_at    timestamptz,
  add column if not exists total_searches     int not null default 0,
  add column if not exists last_active_at     timestamptz,
  add column if not exists preferences        jsonb;

-- Actualizar racha automáticamente
create or replace function public.update_streak()
returns trigger language plpgsql security definer as $$
declare
  last_date date;
begin
  last_date := (new.last_active_at at time zone 'UTC')::date;
  if old.last_active_at is null
     or (new.last_active_at at time zone 'UTC')::date = (old.last_active_at at time zone 'UTC')::date + 1
  then
    new.streak_days := coalesce(old.streak_days, 0) + 1;
  elsif (new.last_active_at at time zone 'UTC')::date > (old.last_active_at at time zone 'UTC')::date + 1 then
    new.streak_days := 1;
  end if;
  return new;
end;
$$;

drop trigger if exists on_profile_active on public.profiles;
create trigger on_profile_active
  before update of last_active_at on public.profiles
  for each row execute procedure public.update_streak();

-- ── Favoritos ─────────────────────────────────────────────────
create table if not exists public.favorites (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid references public.profiles on delete cascade not null,
  niche_data   jsonb not null,
  note         text,
  tags         text[] default '{}',
  collection   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_favorites_user on public.favorites(user_id, created_at desc);
create index if not exists idx_favorites_collection on public.favorites(user_id, collection);
alter table public.favorites enable row level security;
create policy if not exists "Favoritos propios" on public.favorites for all using (auth.uid() = user_id);

-- ── Alertas inteligentes ──────────────────────────────────────
create table if not exists public.smart_alerts (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid references public.profiles on delete cascade not null,
  name            text not null,
  type            text not null check (type in ('score_above','growth_above','tiktok_trend','competition_drops','new_niche')),
  threshold       numeric,
  geo             text default 'US',
  keywords        text[] default '{}',
  active          boolean not null default true,
  last_triggered  timestamptz,
  trigger_count   int default 0,
  created_at      timestamptz not null default now()
);
create index if not exists idx_alerts_user on public.smart_alerts(user_id, active);
alter table public.smart_alerts enable row level security;
create policy if not exists "Alertas propias" on public.smart_alerts for all using (auth.uid() = user_id);

-- ── Onboarding completado ────────────────────────────────────
create table if not exists public.onboarding (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid references public.profiles on delete cascade unique not null,
  goal         text,
  budget       text,
  experience   text,
  geo          text,
  market       text,
  business_type text,
  completed_at  timestamptz not null default now()
);
alter table public.onboarding enable row level security;
create policy if not exists "Onboarding propio" on public.onboarding for all using (auth.uid() = user_id);

-- ── Logros / Achievements ─────────────────────────────────────
create table if not exists public.achievements (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid references public.profiles on delete cascade not null,
  type         text not null,
  unlocked_at  timestamptz not null default now()
);
create unique index if not exists idx_achievements_unique on public.achievements(user_id, type);
alter table public.achievements enable row level security;
create policy if not exists "Logros propios" on public.achievements for select using (auth.uid() = user_id);
create policy if not exists "Service escribe logros" on public.achievements for insert with check (true);

-- ── Índices de optimización en búsquedas existentes ──────────
create index if not exists idx_searches_user_date on public.niche_searches(user_id, created_at desc);
create index if not exists idx_searches_query on public.niche_searches using gin(to_tsvector('spanish', query));

-- ── Función: obtener estadísticas del usuario ────────────────
create or replace function public.get_user_stats(p_user_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  stats jsonb;
begin
  select jsonb_build_object(
    'total_searches',    count(*),
    'searches_today',    count(*) filter (where created_at::date = now()::date),
    'avg_score',         round(avg((results->0->>'opportunity_score')::numeric)),
    'unique_geos',       count(distinct (results->0->>'geo')),
    'last_search_at',    max(created_at)
  ) into stats
  from public.niche_searches
  where user_id = p_user_id;
  return coalesce(stats, '{}'::jsonb);
end;
$$;

select 'Migración 003 completada ✅';
