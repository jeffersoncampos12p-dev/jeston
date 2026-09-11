create extension if not exists pgcrypto;

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  slug text not null unique,
  title text not null,
  description text not null default '',
  content text not null default '',
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text not null default 'inactive',
  updated_at timestamptz not null default now()
);

create index if not exists documents_owner_updated_idx on public.documents(owner_id, updated_at desc);
create index if not exists documents_public_slug_idx on public.documents(slug) where is_public = true;

alter table public.documents enable row level security;
alter table public.subscriptions enable row level security;

drop policy if exists "public can read published documents" on public.documents;
create policy "public can read published documents" on public.documents for select using (is_public = true);

drop policy if exists "owners can manage documents" on public.documents;
create policy "owners can manage documents" on public.documents for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "owners can read subscriptions" on public.subscriptions;
create policy "owners can read subscriptions" on public.subscriptions for select using (auth.uid() = user_id);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists documents_touch_updated_at on public.documents;
create trigger documents_touch_updated_at before update on public.documents for each row execute function public.touch_updated_at();

