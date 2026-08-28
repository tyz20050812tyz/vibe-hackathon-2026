-- Distributed fixed-window abuse protection for POST /api/discoveries.
-- Only salted requester hashes and aggregate window counters are stored.
create table if not exists public.discovery_request_rate_buckets (
  bucket_key text primary key,
  window_started_at timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  request_bytes bigint not null default 0 check (request_bytes >= 0),
  updated_at timestamptz not null default now()
);

alter table public.discovery_request_rate_buckets enable row level security;

revoke all on public.discovery_request_rate_buckets
  from public, anon, authenticated;
grant all privileges on public.discovery_request_rate_buckets
  to service_role;

create or replace function public.claim_discovery_request(
  p_identity_hash text,
  p_request_bytes integer,
  p_request_limit integer,
  p_byte_limit bigint,
  p_window_seconds integer default 60
)
returns table (permitted boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_time timestamptz := clock_timestamp();
  window_start timestamptz;
  window_end timestamptz;
  current_count integer;
  current_bytes bigint;
  current_bucket_key text;
begin
  if length(p_identity_hash) <> 64
    or p_request_bytes < 0
    or p_request_limit < 1
    or p_byte_limit < 1
    or p_window_seconds < 1 then
    raise exception 'INVALID_DISCOVERY_REQUEST_LIMITS';
  end if;

  window_start := date_bin(
    make_interval(secs => p_window_seconds),
    current_time,
    timestamptz '1970-01-01 00:00:00+00'
  );
  window_end := window_start + make_interval(secs => p_window_seconds);
  current_bucket_key := p_identity_hash || ':' || extract(epoch from window_start)::bigint::text;

  insert into public.discovery_request_rate_buckets (
    bucket_key,
    window_started_at,
    request_count,
    request_bytes
  ) values (
    current_bucket_key,
    window_start,
    0,
    0
  ) on conflict (bucket_key) do nothing;

  select request_count, request_bytes
    into current_count, current_bytes
  from public.discovery_request_rate_buckets
  where bucket_key = current_bucket_key
  for update;

  if current_count + 1 > p_request_limit
    or current_bytes + p_request_bytes > p_byte_limit then
    return query select
      false,
      greatest(1, ceil(extract(epoch from (window_end - current_time)))::integer);
    return;
  end if;

  update public.discovery_request_rate_buckets
  set request_count = request_count + 1,
      request_bytes = request_bytes + p_request_bytes,
      updated_at = current_time
  where bucket_key = current_bucket_key;

  return query select true, 0;
end;
$$;

revoke all on function public.claim_discovery_request(text, integer, integer, bigint, integer)
  from public, anon, authenticated;
grant execute on function public.claim_discovery_request(text, integer, integer, bigint, integer)
  to service_role;
