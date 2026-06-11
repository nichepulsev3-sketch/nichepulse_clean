-- ============================================================
-- NichePulse — Esquema principal
-- Ejecuta esto PRIMERO en el SQL Editor de Supabase
-- ============================================================

create extension if not exists "uuid-ossp";

-- ── Perfiles de usuario ──────────────────────────────────────
create table public.profiles (
  id                uuid references auth.users on delete cascade primary key,
  email             text unique not null,
  full_name         text,
  plan              text not null default 'free',
  searches_today    int  not null default 0,
  searches_reset_at timestamptz not null default now(),
  affiliate_code    text unique,
  referred_by       text,
  stripe_customer_id text unique,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "Perfil propio" on public.profiles for all using (auth.uid() = id);

-- Crear perfil automáticamente al registrarse
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, full_name, affiliate_code)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    lower(split_part(new.email,'@',1)) || substr(new.id::text,1,4)
  );
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── Suscripciones ────────────────────────────────────────────
create table public.subscriptions (
  id                   text primary key,
  user_id              uuid references public.profiles not null,
  status               text not null,
  plan                 text not null,
  stripe_price_id      text not null,
  current_period_start timestamptz,
  current_period_end   timestamptz,
  cancel_at_period_end boolean default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
create policy "Ver propia suscripción" on public.subscriptions for select using (auth.uid() = user_id);
create policy "Service escribe suscripciones" on public.subscriptions for all using (auth.role() = 'service_role');

-- ── Búsquedas guardadas ──────────────────────────────────────
create table public.niche_searches (
  id         uuid default uuid_generate_v4() primary key,
  user_id    uuid references public.profiles,
  query      text not null,
  filters    jsonb default '{}',
  results    jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.niche_searches enable row level security;
create policy "Ver propias búsquedas"    on public.niche_searches for select using (auth.uid() = user_id);
create policy "Insertar propias búsquedas" on public.niche_searches for insert with check (auth.uid() = user_id);

-- ── Referidos de afiliados ───────────────────────────────────
create table public.affiliate_referrals (
  id               uuid default uuid_generate_v4() primary key,
  affiliate_code   text not null,
  referred_user_id uuid references public.profiles not null unique,
  plan_purchased   text,
  commission_pct   int,
  commission_usd   numeric(10,2) default 0,
  paid_at          timestamptz,
  created_at       timestamptz not null default now()
);
alter table public.affiliate_referrals enable row level security;
create policy "Ver propios referidos" on public.affiliate_referrals for select
  using (affiliate_code = (select affiliate_code from public.profiles where id = auth.uid()));
create policy "Service escribe referidos" on public.affiliate_referrals for all using (auth.role() = 'service_role');

-- ── Trigger updated_at ───────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger profiles_updated_at      before update on public.profiles      for each row execute procedure public.set_updated_at();
create trigger subscriptions_updated_at before update on public.subscriptions for each row execute procedure public.set_updated_at();
