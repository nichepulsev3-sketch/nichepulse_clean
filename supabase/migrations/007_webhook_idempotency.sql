-- ============================================================
-- NichepulseV.3 — Migración 007: Idempotencia de webhooks de Stripe
-- Ejecuta en Supabase SQL Editor
--
-- Stripe puede reenviar el mismo evento más de una vez (reintentos,
-- at-least-once delivery). Hasta ahora el handler no dejaba constancia
-- de qué eventos ya procesó, así que un reenvío se procesaba de nuevo
-- desde cero. Hoy es inofensivo porque los handlers son idempotentes
-- (poner plan='pro' dos veces no rompe nada), pero es un riesgo latente
-- en cuanto cualquier handler futuro tenga un efecto no-idempotente
-- (enviar un email, incrementar un contador, etc.).
-- ============================================================

create table if not exists public.stripe_webhook_events (
  event_id     text primary key,
  event_type   text not null,
  processed_at timestamptz not null default now()
);

alter table public.stripe_webhook_events enable row level security;

-- Solo el propio backend (service_role, vía app/api/webhooks/stripe) lee
-- y escribe esta tabla. Ningún usuario ni cliente debe tocarla nunca.
drop policy if exists "Solo service_role gestiona eventos de webhook" on public.stripe_webhook_events;
create policy "Solo service_role gestiona eventos de webhook" on public.stripe_webhook_events
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

select 'Migración 007 completada ✅';
