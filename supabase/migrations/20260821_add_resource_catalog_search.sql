-- Read-only public resource catalog search.
-- Run after 20260821_create_library_foundation.sql.

create or replace function public.search_resource_catalog(
  p_q text default null,
  p_tag text default null,
  p_type text default null,
  p_limit integer default 20
)
returns table (
  id uuid,
  slug text,
  type text,
  title text,
  creators jsonb,
  summary text,
  cover_url text,
  availability text,
  tags jsonb,
  total_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with normalized as (
    select
      nullif(btrim(p_q), '') as q,
      p_tag as tag,
      p_type as resource_type,
      least(greatest(coalesce(p_limit, 20), 1), 50) as result_limit
  ),
  matched as (
    select r.*
    from public.resources r
    cross join normalized n
    where
      (
        n.q is null
        or strpos(lower(r.title), lower(n.q)) > 0
        or strpos(lower(r.summary), lower(n.q)) > 0
        or exists (
          select 1
          from jsonb_array_elements_text(r.creators) as creator(value)
          where strpos(lower(creator.value), lower(n.q)) > 0
        )
      )
      and (n.resource_type is null or r.type = n.resource_type)
      and (
        n.tag is null
        or exists (
          select 1
          from public.resource_tags rt
          join public.tags t on t.id = rt.tag_id
          where rt.resource_id = r.id and t.slug = n.tag
        )
      )
  ),
  counted as (
    select matched.*, count(*) over () as total_count
    from matched
  )
  select
    c.id,
    c.slug,
    c.type,
    c.title,
    c.creators,
    c.summary,
    c.cover_url,
    c.availability,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', t.id,
            'name', t.name,
            'slug', t.slug,
            'category', t.category
          )
          order by t.name asc, t.id asc
        )
        from public.resource_tags rt
        join public.tags t on t.id = rt.tag_id
        where rt.resource_id = c.id
      ),
      '[]'::jsonb
    ) as tags,
    c.total_count
  from counted c
  cross join normalized n
  order by c.is_featured desc, c.created_at desc, c.id desc
  limit (select result_limit from normalized);
$$;

revoke all on function public.search_resource_catalog(text, text, text, integer)
  from public;
grant execute on function public.search_resource_catalog(text, text, text, integer)
  to anon, authenticated, service_role;
