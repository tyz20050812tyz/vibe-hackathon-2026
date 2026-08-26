create table if not exists public.reader_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  exploration_level text not null check (exploration_level in ('gentle', 'balanced', 'bold')),
  onboarding_completed_at timestamptz not null,
  consent_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reader_profile_tags (
  user_id uuid not null references auth.users(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete restrict,
  weight numeric not null default 1 check (weight = 1),
  source text not null default 'selected' check (source = 'selected'),
  primary key (user_id, tag_id)
);

create table if not exists public.reader_profile_favorite_books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  author text check (author is null or char_length(author) between 1 and 80),
  created_at timestamptz not null default now()
);

create index if not exists reader_profile_tags_user_id_idx
  on public.reader_profile_tags (user_id);
create index if not exists reader_profile_favorite_books_user_id_idx
  on public.reader_profile_favorite_books (user_id, created_at);

drop trigger if exists reader_profiles_set_updated_at on public.reader_profiles;
create trigger reader_profiles_set_updated_at
before update on public.reader_profiles
for each row execute function public.set_updated_at();

alter table public.reader_profiles enable row level security;
alter table public.reader_profile_tags enable row level security;
alter table public.reader_profile_favorite_books enable row level security;

drop policy if exists "Users can read their own reading preferences" on public.reader_profiles;
create policy "Users can read their own reading preferences"
on public.reader_profiles for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can read their own reading preference tags" on public.reader_profile_tags;
create policy "Users can read their own reading preference tags"
on public.reader_profile_tags for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can read their own reading preference books" on public.reader_profile_favorite_books;
create policy "Users can read their own reading preference books"
on public.reader_profile_favorite_books for select to authenticated
using ((select auth.uid()) = user_id);

revoke all on public.reader_profiles, public.reader_profile_tags,
  public.reader_profile_favorite_books from anon, authenticated;
grant select on public.reader_profiles, public.reader_profile_tags,
  public.reader_profile_favorite_books to authenticated;
grant all privileges on public.reader_profiles, public.reader_profile_tags,
  public.reader_profile_favorite_books to service_role;

-- This is the single database definition of an eligible personalization profile.
-- All callers run it as the authenticated user, so it never accepts a user id.
create or replace function public.reader_profile_is_complete()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select
    auth.uid() is not null
    and exists (
      select 1
      from public.reader_profiles profile
      where profile.user_id = auth.uid()
        and profile.onboarding_completed_at is not null
    )
    and (
      select count(*)
      from public.reader_profile_tags profile_tag
      where profile_tag.user_id = auth.uid()
    ) between 3 and 8;
$$;

create or replace function public.replace_reader_profile(
  p_interest_tag_ids uuid[],
  p_exploration_level text,
  p_favorite_books jsonb,
  p_consent boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
  distinct_tag_count integer;
  valid_tag_count integer;
  favorite_count integer;
begin
  if current_user_id is null then
    raise exception 'UNAUTHORIZED';
  end if;
  if p_consent is not true then
    raise exception 'CONSENT_REQUIRED';
  end if;
  if p_exploration_level not in ('gentle', 'balanced', 'bold') then
    raise exception 'INVALID_EXPLORATION_LEVEL';
  end if;
  if p_interest_tag_ids is null then
    raise exception 'INVALID_TAG_COUNT';
  end if;

  select cardinality(p_interest_tag_ids), count(distinct tag.id)
  into distinct_tag_count, valid_tag_count
  from unnest(p_interest_tag_ids) as requested(tag_id)
  left join public.tags tag on tag.id = requested.tag_id;

  if distinct_tag_count < 3 or distinct_tag_count > 8
    or valid_tag_count <> distinct_tag_count then
    raise exception 'INVALID_INTEREST_TAGS';
  end if;
  if cardinality(array(select distinct unnest(p_interest_tag_ids))) <> distinct_tag_count then
    raise exception 'DUPLICATE_INTEREST_TAGS';
  end if;
  if p_favorite_books is null then
    p_favorite_books := '[]'::jsonb;
  end if;
  if jsonb_typeof(p_favorite_books) <> 'array' then
    raise exception 'INVALID_FAVORITE_BOOKS';
  end if;
  select jsonb_array_length(p_favorite_books) into favorite_count;
  if favorite_count > 3 then
    raise exception 'TOO_MANY_FAVORITE_BOOKS';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(p_favorite_books) as book(title text, author text)
    where nullif(btrim(book.title), '') is null
      or char_length(btrim(book.title)) > 120
      or char_length(coalesce(btrim(book.author), '')) > 80
  ) then
    raise exception 'INVALID_FAVORITE_BOOKS';
  end if;

  insert into public.reader_profiles (
    user_id, exploration_level, onboarding_completed_at, consent_at
  ) values (
    current_user_id, p_exploration_level, now(), now()
  ) on conflict (user_id) do update set
    exploration_level = excluded.exploration_level,
    onboarding_completed_at = excluded.onboarding_completed_at,
    consent_at = excluded.consent_at;

  delete from public.reader_profile_tags where user_id = current_user_id;
  insert into public.reader_profile_tags (user_id, tag_id)
  select current_user_id, requested.tag_id
  from unnest(p_interest_tag_ids) as requested(tag_id);

  delete from public.reader_profile_favorite_books where user_id = current_user_id;
  insert into public.reader_profile_favorite_books (user_id, title, author)
  select current_user_id, btrim(book.title), nullif(btrim(book.author), '')
  from jsonb_to_recordset(p_favorite_books) as book(title text, author text);
end;
$$;

create or replace function public.clear_reader_profile()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'UNAUTHORIZED';
  end if;
  delete from public.reader_profiles where user_id = current_user_id;
  delete from public.reader_profile_tags where user_id = current_user_id;
  delete from public.reader_profile_favorite_books where user_id = current_user_id;
end;
$$;

revoke all on function public.replace_reader_profile(uuid[], text, jsonb, boolean) from public;
revoke all on function public.clear_reader_profile() from public;
revoke all on function public.reader_profile_is_complete() from public;
grant execute on function public.replace_reader_profile(uuid[], text, jsonb, boolean) to authenticated;
grant execute on function public.clear_reader_profile() to authenticated;
grant execute on function public.reader_profile_is_complete() to authenticated;
