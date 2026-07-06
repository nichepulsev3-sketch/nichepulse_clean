-- ============================================================
-- NichepulseV.3 — Migración 009: Feature flags
-- Ejecuta en Supabase SQL Editor
--
-- Fase 15 del roadmap de arquitectura. No depende de ningún servicio de
-- pago externo (LaunchDarkly, Flagsmith...) — es una tabla simple para
-- poder activar/desactivar una funcionalidad en producción sin
-- desplegar, útil sobre todo para el rollout futuro de Workspaces
-- (activarlo solo para un grupo de usuarios antes de abrirlo a todos).
-- ============================================================

create table if not exists public.feature_flags (
  key         text primary key,
  enabled     boolean not null default false,
  description text,
  updated_at  timestamptz not null default now()
);

alter table public.feature_flags enable row level security;

-- Lectura pública (el cliente puede necesitar saber si una feature está
-- activa), escritura solo desde el backend con service_role.
drop policy if exists "Cualquiera puede leer los flags" on public.feature_flags;
create policy "Cualquiera puede leer los flags" on public.feature_flags
  for select using (true);
drop policy if exists "Solo service_role modifica flags" on public.feature_flags;
create policy "Solo service_role modifica flags" on public.feature_flags
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- Flags iniciales — todos apagados por defecto (opt-in explícito).
insert into public.feature_flags (key, enabled, description) values
  ('workspaces',        false, 'Multi-usuario/multi-proyecto (ver WORKSPACES_PROPUESTA.md) — aún no implementado, reservado para cuando se active.'),
  ('competitor_intel',  false, 'Competitor Intelligence — sin fuente de datos todavía, reservado.')
on conflict (key) do nothing;

select 'Migración 009 completada ✅';
