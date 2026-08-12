create extension if not exists pgcrypto;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  categoria text not null,
  descripcion text not null default '',
  image_url text not null default '',
  activo boolean not null default true,
  variants jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.settings (
  id text primary key,
  rates jsonb not null default '{"usd":{"automatic_rate":0,"manual_rate":0,"manual_override":false},"eur":{"automatic_rate":0,"manual_rate":0,"manual_override":false}}'::jsonb,
  pricing jsonb not null default '{"usd_markup_percent":18,"eur_markup_percent":5}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.settings (id) values ('roniforms') on conflict (id) do nothing;

create table if not exists public.rate_history (
  id uuid primary key default gen_random_uuid(),
  currency text not null check (currency in ('usd','eur')),
  rate numeric(14,4) not null,
  source text not null default 'BCV',
  observed_at timestamptz not null default now()
);

alter table public.products enable row level security;
alter table public.settings enable row level security;
alter table public.rate_history enable row level security;

create policy "Public read active products" on public.products for select to anon using (activo = true);
create policy "Public read settings" on public.settings for select to anon using (true);

-- El backend usa SUPABASE_SERVICE_ROLE_KEY para escribir.
-- Crear un bucket público llamado product-images.
