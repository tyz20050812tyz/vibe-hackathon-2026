alter table public.resources
  add column if not exists languages text[] not null default array['other']::text[];

alter table public.resources
  drop constraint if exists resources_languages_valid;

alter table public.resources
  add constraint resources_languages_valid check (
    cardinality(languages) >= 1
    and languages <@ array['zh', 'en', 'other']::text[]
  );

create index if not exists resources_published_year_idx
  on public.resources (published_year);
create index if not exists resources_languages_idx
  on public.resources using gin (languages);
