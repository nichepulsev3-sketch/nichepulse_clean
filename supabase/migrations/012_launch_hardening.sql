-- ============================================================
-- NichePulse — Migración 012: Endurecimiento para lanzamiento v1.0
-- Ejecuta en Supabase SQL Editor.
--
-- Dos fixes P0 de AUDITORIA_LANZAMIENTO_V1.md (Fase 15):
--
-- 1. RLS de `achievements`: la policy de INSERT era `with check (true)`,
--    es decir, cualquier usuario autenticado podía escribir un logro
--    para el user_id de OTRO usuario (nunca validaba auth.uid()).
--    Bajo impacto de negocio (gamificación, no dinero ni datos
--    sensibles) pero es un bug de RLS real -- se corrige aquí.
--
-- 2. Índices en `niches`: es la tabla que sostiene el activo principal
--    del producto (el Knowledge Graph) y le faltaban índices sobre
--    las dos columnas que sus propias consultas ya usan hoy --
--    getTopNiches() ordena por latest_opportunity_score
--    (lib/services/nicheGraph.ts) y getRelatedNiches() filtra con
--    .overlaps('tags', ...) sin índice GIN. Invisible con pocos
--    nichos, empieza a doler en cuanto el grafo crece de verdad.
-- ============================================================

-- ── Fix RLS: achievements solo se puede escribir para uno mismo ──
drop policy if exists "Service escribe logros" on public.achievements;
create policy "Logros propios (escritura)" on public.achievements
  for insert with check (auth.uid() = user_id);

-- ── Índices que faltaban en niches ──
create index if not exists idx_niches_opportunity_score on public.niches(latest_opportunity_score desc);
create index if not exists idx_niches_tags on public.niches using gin(tags);

select 'Migración 012 completada ✅';
