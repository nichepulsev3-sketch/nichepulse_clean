-- ============================================================
-- NichepulseV.3 — Migración 006: Índices de rendimiento
-- Ejecuta en Supabase SQL Editor
--
-- Motivado por la auditoría de escalabilidad: el cron del Feed de
-- oportunidades (app/api/cron/opportunity-feed) escanea niche_searches
-- por rango de fecha SIN filtrar por un user_id concreto (necesita
-- revisar la búsqueda más reciente de TODOS los usuarios Pro/Agency).
-- El índice existente idx_searches_user_date(user_id, created_at) no
-- ayuda a esa consulta porque lidera con user_id — con miles de
-- usuarios esto degrada a table scan. Este índice cubre ese patrón.
-- ============================================================

create index if not exists idx_searches_created_at on public.niche_searches(created_at desc);

-- profiles.plan tiene baja cardinalidad (free/pro/agency) pero con
-- decenas de miles de filas ya compensa como filtro de arranque para
-- el join del cron y para cualquier informe de negocio por plan.
create index if not exists idx_profiles_plan on public.profiles(plan);

select 'Migración 006 completada ✅';
