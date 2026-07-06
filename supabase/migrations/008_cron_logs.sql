-- ============================================================
-- NichepulseV.3 — Migración 008: Observabilidad y locking del cron
-- Ejecuta en Supabase SQL Editor
--
-- Fase 8 del roadmap de arquitectura. El cron de opportunity-feed
-- (app/api/cron/opportunity-feed) hoy no deja ningún rastro de sus
-- ejecuciones aparte de los logs de Railway (texto libre, se pierden
-- con el tiempo) y no tiene ninguna protección si dos triggers externos
-- coinciden (p.ej. si alguna vez se configura Railway Cron Y
-- cron-job.org apuntando al mismo endpoint sin darse cuenta — el mismo
-- tipo de ambigüedad de configuración que causó el 404 que se
-- diagnosticó al principio de este roadmap).
-- ============================================================

create table if not exists public.cron_logs (
  id            uuid primary key default uuid_generate_v4(),
  job_name      text not null default 'opportunity-feed',
  status        text not null default 'running' check (status in ('running','success','error')),
  processed     int,
  alerts_created int,
  emails_sent   int,
  error_message text,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  duration_ms   int
);

create index if not exists idx_cron_logs_job_started on public.cron_logs(job_name, started_at desc);

alter table public.cron_logs enable row level security;

-- Solo el propio backend (service_role, desde la ruta del cron) toca esta
-- tabla. No es un dato de usuario, es un log operativo interno.
drop policy if exists "Solo service_role gestiona cron_logs" on public.cron_logs;
create policy "Solo service_role gestiona cron_logs" on public.cron_logs
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

select 'Migración 008 completada ✅';
