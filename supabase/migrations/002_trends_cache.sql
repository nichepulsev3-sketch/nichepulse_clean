-- ============================================================
-- NichePulse — Caché de tendencias
-- Ejecuta esto DESPUÉS del script 001
-- ============================================================

create table public.trends_cache (
  id         uuid default uuid_generate_v4() primary key,
  cache_key  text unique not null,
  source     text not null,
  geo        text not null default 'US',
  category   text not null default 'all',
  signals    jsonb not null,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '6 hours')
);

create index trends_cache_key_idx     on public.trends_cache(cache_key);
create index trends_cache_expires_idx on public.trends_cache(expires_at);

alter table public.trends_cache enable row level security;
create policy "Lectura pública de tendencias" on public.trends_cache for select using (true);
create policy "Service escribe tendencias"    on public.trends_cache for all    using (auth.role() = 'service_role');

-- Limpiar entradas expiradas (llamar desde un cron job)
create or replace function public.purge_expired_trends()
returns void language plpgsql security definer as $$
begin
  delete from public.trends_cache where expires_at < now();
end;
$$;
