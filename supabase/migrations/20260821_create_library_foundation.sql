-- Library foundation for the "Beyond the Shelf" first phase.
-- Run after 20260820_create_demo_records.sql.

create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  type text not null check (type in ('book', 'paper', 'talk', 'collection')),
  title text not null check (char_length(title) between 1 and 160),
  subtitle text,
  creators jsonb not null default '[]'::jsonb check (jsonb_typeof(creators) = 'array'),
  published_year integer check (published_year between 1000 and 2100),
  summary text not null check (char_length(summary) between 20 and 1000),
  cover_url text,
  location text,
  availability text not null default 'check_library'
    check (availability in ('available', 'online', 'reference_only', 'check_library')),
  external_url text,
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 50),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  category text not null check (category in ('discipline', 'theme', 'format')),
  created_at timestamptz not null default now()
);

create table if not exists public.resource_tags (
  resource_id uuid not null references public.resources(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (resource_id, tag_id)
);

create table if not exists public.resource_relations (
  id uuid primary key default gen_random_uuid(),
  source_resource_id uuid not null references public.resources(id) on delete cascade,
  target_resource_id uuid not null references public.resources(id) on delete cascade,
  relation_type text not null
    check (relation_type in ('same_theme', 'contrasting_view', 'historical_context', 'unexpected_bridge')),
  explanation text not null check (char_length(explanation) between 20 and 500),
  strength smallint not null default 3 check (strength between 1 and 5),
  created_at timestamptz not null default now(),
  unique (source_resource_id, target_resource_id, relation_type),
  check (source_resource_id <> target_resource_id)
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) between 1 and 50),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.saved_resources (
  user_id uuid not null references auth.users(id) on delete cascade,
  resource_id uuid not null references public.resources(id) on delete cascade,
  note text check (char_length(note) <= 500),
  saved_at timestamptz not null default now(),
  primary key (user_id, resource_id)
);

create index if not exists resources_featured_idx on public.resources (is_featured)
  where is_featured = true;
create index if not exists resources_type_idx on public.resources (type);
create index if not exists resource_tags_tag_id_idx on public.resource_tags (tag_id);
create index if not exists resource_relations_source_idx
  on public.resource_relations (source_resource_id, strength desc);
create index if not exists saved_resources_user_id_idx
  on public.saved_resources (user_id, saved_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists resources_set_updated_at on public.resources;
create trigger resources_set_updated_at
before update on public.resources
for each row execute function public.set_updated_at();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

alter table public.resources enable row level security;
alter table public.tags enable row level security;
alter table public.resource_tags enable row level security;
alter table public.resource_relations enable row level security;
alter table public.profiles enable row level security;
alter table public.saved_resources enable row level security;

drop policy if exists "Public resources are readable" on public.resources;
create policy "Public resources are readable"
on public.resources for select to anon, authenticated using (true);

drop policy if exists "Public tags are readable" on public.tags;
create policy "Public tags are readable"
on public.tags for select to anon, authenticated using (true);

drop policy if exists "Public resource tags are readable" on public.resource_tags;
create policy "Public resource tags are readable"
on public.resource_tags for select to anon, authenticated using (true);

drop policy if exists "Public resource relations are readable" on public.resource_relations;
create policy "Public resource relations are readable"
on public.resource_relations for select to anon, authenticated using (true);

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
on public.profiles for select to authenticated using ((select auth.uid()) = id);

drop policy if exists "Users can create their own profile" on public.profiles;
create policy "Users can create their own profile"
on public.profiles for insert to authenticated with check ((select auth.uid()) = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
on public.profiles for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "Users can read their own saved resources" on public.saved_resources;
create policy "Users can read their own saved resources"
on public.saved_resources for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Users can save their own resources" on public.saved_resources;
create policy "Users can save their own resources"
on public.saved_resources for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own saved resources" on public.saved_resources;
create policy "Users can delete their own saved resources"
on public.saved_resources for delete to authenticated using ((select auth.uid()) = user_id);

grant select on public.resources, public.tags, public.resource_tags, public.resource_relations
  to anon, authenticated;
grant select, insert, update, delete on public.profiles, public.saved_resources to authenticated;
grant all privileges on public.resources, public.tags, public.resource_tags,
  public.resource_relations, public.profiles, public.saved_resources to service_role;
