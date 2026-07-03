-- ============================================================
-- NichepulseV.3 — Migración 004: Endurecimiento de seguridad
-- Ejecuta en Supabase SQL Editor DESPUÉS de 001, 002 y 003.
--
-- Corrige un hallazgo crítico: la política RLS "Perfil propio"
-- (for all using auth.uid() = id) permite a cualquier usuario
-- autenticado hacer UPDATE sobre CUALQUIER columna de su propia
-- fila en `profiles`, incluidas `plan`, `searches_today`,
-- `stripe_customer_id` y `affiliate_code`. Desde la consola del
-- navegador, con el cliente anon ya expuesto públicamente:
--
--   await supabase.from('profiles')
--     .update({ plan: 'agency', searches_today: 0 })
--     .eq('id', user.id)
--
-- ...basta para auto-ascender de plan gratis, sin pagar, y
-- resetear el contador de búsquedas. Esta migración no quita la
-- capacidad de RLS existente (sigue haciendo falta para que el
-- usuario pueda actualizar su nombre/preferencias), pero añade
-- un trigger que revierte cualquier intento de modificar columnas
-- protegidas salvo que la operación la haga el service_role
-- (backend), que es el único que debe poder cambiar plan/cuotas.
-- ============================================================

-- ── Proteger columnas sensibles de `profiles` ─────────────────
create or replace function public.protect_profile_columns()
returns trigger language plpgsql security definer as $$
begin
  -- auth.role() = 'service_role' identifica llamadas hechas con la
  -- service role key (backend/admin), que sí puede modificar estas
  -- columnas libremente (webhooks de Stripe, rutas de API, etc).
  if auth.role() = 'service_role' then
    return new;
  end if;

  -- Cualquier otro rol (usuario autenticado vía anon key) no puede
  -- tocar estas columnas: se revierten silenciosamente a su valor
  -- anterior en vez de fallar con error, para no romper updates
  -- legítimos que también incluyan campos seguros en el mismo payload.
  new.plan                := old.plan;
  new.searches_today      := old.searches_today;
  new.searches_reset_at   := old.searches_reset_at;
  new.stripe_customer_id  := old.stripe_customer_id;
  new.affiliate_code      := old.affiliate_code;
  new.total_searches      := old.total_searches;
  new.streak_days         := old.streak_days;
  new.streak_reset_at     := old.streak_reset_at;

  return new;
end;
$$;

drop trigger if exists protect_profile_columns_trigger on public.profiles;
create trigger protect_profile_columns_trigger
  before update on public.profiles
  for each row execute procedure public.protect_profile_columns();

-- ── Cuota de búsquedas: incremento atómico ────────────────────
-- Sustituye el patrón "leer plan+usados, comprobar límite en la
-- app, luego escribir" (no atómico: dos requests simultáneas del
-- mismo usuario pueden colarse ambas antes de que se actualice el
-- contador) por una única operación SQL atómica que resetea el
-- contador si han pasado 24h, comprueba el límite del plan, y
-- solo incrementa si hay cuota disponible — todo en una fila
-- bloqueada (FOR UPDATE) para que sea seguro ante concurrencia.
create or replace function public.increment_search_usage(p_user_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  v_profile   public.profiles%rowtype;
  v_limit     int;
  v_now       timestamptz := now();
begin
  select * into v_profile from public.profiles where id = p_user_id for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'profile_not_found');
  end if;

  -- Reset del contador diario si han pasado 24h
  if extract(epoch from (v_now - v_profile.searches_reset_at)) >= 86400 then
    v_profile.searches_today    := 0;
    v_profile.searches_reset_at := v_now;
  end if;

  v_limit := case v_profile.plan
    when 'pro'    then 999
    when 'agency' then 999
    else 5
  end;

  if v_profile.searches_today >= v_limit then
    -- Persistir el reset aunque no haya cuota, para no perderlo
    update public.profiles
      set searches_today = v_profile.searches_today,
          searches_reset_at = v_profile.searches_reset_at
      where id = p_user_id;
    return jsonb_build_object('ok', false, 'error', 'quota_exceeded', 'plan', v_profile.plan, 'used', v_profile.searches_today);
  end if;

  update public.profiles
    set searches_today    = v_profile.searches_today + 1,
        searches_reset_at = v_profile.searches_reset_at,
        total_searches    = coalesce(total_searches, 0) + 1,
        last_active_at     = v_now
    where id = p_user_id;

  return jsonb_build_object('ok', true, 'plan', v_profile.plan, 'used', v_profile.searches_today + 1);
end;
$$;

-- ── Devolver una búsqueda si la llamada a la IA falla ─────────
-- search-niches/route.ts reserva cuota ANTES de llamar a la IA (para que
-- la comprobación+reserva sea atómica). Si la IA falla después, esta
-- función devuelve esa unidad de cuota para no penalizar al usuario por
-- un intento que no obtuvo resultado.
create or replace function public.refund_search_usage(p_user_id uuid)
returns void language plpgsql security definer as $$
begin
  update public.profiles
    set searches_today = greatest(0, searches_today - 1),
        total_searches  = greatest(0, coalesce(total_searches, 0) - 1)
    where id = p_user_id;
end;
$$;

select 'Migración 004 completada ✅ — RLS de profiles endurecida y cuota de búsquedas hecha atómica' as status;
