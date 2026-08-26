revoke all on function public.search_resource_catalog(text, text, text, integer)
  from public, anon, authenticated, service_role;
drop function public.search_resource_catalog(text, text, text, integer);

create or replace function public.search_resource_catalog_v2(
  p_q text default null,
  p_tag text default null,
  p_year_from integer default null,
  p_year_to integer default null,
  p_languages text[] default null,
  p_types text[] default null,
  p_availabilities text[] default null,
  p_limit integer default 20
)
returns table (
  id uuid, slug text, type text, title text, creators jsonb,
  published_year integer, languages text[], summary text, cover_url text,
  availability text, tags jsonb, total_count bigint
)
language sql stable security invoker set search_path = public as $$
  with normalized as (
    select nullif(btrim(p_q), '') as q, p_tag as tag, p_year_from as year_from,
      p_year_to as year_to, p_languages as languages, p_types as types,
      p_availabilities as availabilities,
      least(greatest(coalesce(p_limit, 20), 1), 50) as result_limit
  ), matched as (
    select r.* from public.resources r cross join normalized n
    where (n.q is null or strpos(lower(r.title), lower(n.q)) > 0
      or strpos(lower(r.summary), lower(n.q)) > 0
      or exists (select 1 from jsonb_array_elements_text(r.creators) creator(value)
        where strpos(lower(creator.value), lower(n.q)) > 0))
      and (n.tag is null or exists (select 1 from public.resource_tags rt join public.tags t on t.id = rt.tag_id where rt.resource_id = r.id and t.slug = n.tag))
      and (n.year_from is null or r.published_year >= n.year_from)
      and (n.year_to is null or r.published_year <= n.year_to)
      and (n.languages is null or cardinality(n.languages) = 0 or r.languages && n.languages)
      and (n.types is null or cardinality(n.types) = 0 or r.type = any(n.types))
      and (n.availabilities is null or cardinality(n.availabilities) = 0 or r.availability = any(n.availabilities))
  ), counted as (select matched.*, count(*) over () as total_count from matched)
  select c.id, c.slug, c.type, c.title, c.creators, c.published_year, c.languages,
    c.summary, c.cover_url, c.availability,
    coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'slug', t.slug, 'category', t.category) order by t.name, t.id)
      from public.resource_tags rt join public.tags t on t.id = rt.tag_id where rt.resource_id = c.id), '[]'::jsonb),
    c.total_count
  from counted c cross join normalized n
  order by c.is_featured desc, c.created_at desc, c.id desc
  limit (select result_limit from normalized);
$$;

create or replace function public.search_resource_catalog_personalized_v2(
  p_q text default null,
  p_tag text default null,
  p_year_from integer default null,
  p_year_to integer default null,
  p_languages text[] default null,
  p_types text[] default null,
  p_availabilities text[] default null,
  p_limit integer default 20
)
returns table (
  id uuid, slug text, type text, title text, creators jsonb,
  published_year integer, languages text[], summary text, cover_url text,
  availability text, tags jsonb, total_count bigint
)
language sql stable security invoker set search_path = public as $$
  with normalized as (
    select nullif(btrim(p_q), '') as q, p_tag as tag, p_year_from as year_from,
      p_year_to as year_to, p_languages as languages, p_types as types,
      p_availabilities as availabilities,
      least(greatest(coalesce(p_limit, 20), 1), 50) as result_limit
  ), interest_tags as (
    select tag_id from public.reader_profile_tags where user_id = auth.uid()
  ), matched as (
    select r.* from public.resources r cross join normalized n
    where public.reader_profile_is_complete()
      and (n.q is null or strpos(lower(r.title), lower(n.q)) > 0
        or strpos(lower(r.summary), lower(n.q)) > 0
        or exists (select 1 from jsonb_array_elements_text(r.creators) creator(value)
          where strpos(lower(creator.value), lower(n.q)) > 0))
      and (n.tag is null or exists (select 1 from public.resource_tags rt join public.tags t on t.id = rt.tag_id where rt.resource_id = r.id and t.slug = n.tag))
      and (n.year_from is null or r.published_year >= n.year_from)
      and (n.year_to is null or r.published_year <= n.year_to)
      and (n.languages is null or cardinality(n.languages) = 0 or r.languages && n.languages)
      and (n.types is null or cardinality(n.types) = 0 or r.type = any(n.types))
      and (n.availabilities is null or cardinality(n.availabilities) = 0 or r.availability = any(n.availabilities))
  ), scored as (
    select r.*, count(*) over () as total_count,
      coalesce((select count(*) from public.resource_tags rt join interest_tags it on it.tag_id = rt.tag_id where rt.resource_id = r.id), 0)::numeric as overlap,
      coalesce((select count(*) from public.resource_tags rt where rt.resource_id = r.id), 0)::numeric as resource_tag_count,
      (select count(*) from interest_tags)::numeric as interest_tag_count
    from matched r
  )
  select c.id, c.slug, c.type, c.title, c.creators, c.published_year, c.languages,
    c.summary, c.cover_url, c.availability,
    coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'slug', t.slug, 'category', t.category) order by t.name, t.id)
      from public.resource_tags rt join public.tags t on t.id = rt.tag_id where rt.resource_id = c.id), '[]'::jsonb),
    c.total_count
  from scored c cross join normalized n
  order by case when c.resource_tag_count + c.interest_tag_count = 0 then 0
    else (2 * c.overlap) / (c.resource_tag_count + c.interest_tag_count) end desc,
    c.is_featured desc, c.created_at desc, c.id desc
  limit (select result_limit from normalized);
$$;

revoke all on function public.search_resource_catalog_v2(text, text, integer, integer, text[], text[], text[], integer) from public;
revoke all on function public.search_resource_catalog_personalized_v2(text, text, integer, integer, text[], text[], text[], integer) from public;
grant execute on function public.search_resource_catalog_v2(text, text, integer, integer, text[], text[], text[], integer) to anon, authenticated, service_role;
grant execute on function public.search_resource_catalog_personalized_v2(text, text, integer, integer, text[], text[], text[], integer) to authenticated;
