-- Shared state for the optional DeepSeek narration adapter. These tables are
-- service-only: browser roles cannot read, write, or invoke the control RPCs.
create table if not exists public.discovery_model_rate_buckets (
  bucket_key text primary key,
  window_started_at timestamptz not null,
  attempts integer not null default 0 check (attempts >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.discovery_model_runtime_state (
  state_key text primary key,
  value integer not null default 0 check (value >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.discovery_model_circuit_breaker (
  id boolean primary key default true check (id),
  consecutive_failures integer not null default 0 check (consecutive_failures >= 0),
  opens_until timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.discovery_narration_cache (
  cache_key text primary key,
  narration text,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now(),
  check (narration is null or char_length(narration) between 20 and 90)
);

alter table public.discovery_model_rate_buckets enable row level security;
alter table public.discovery_model_runtime_state enable row level security;
alter table public.discovery_model_circuit_breaker enable row level security;
alter table public.discovery_narration_cache enable row level security;

revoke all on public.discovery_model_rate_buckets, public.discovery_model_runtime_state,
  public.discovery_model_circuit_breaker, public.discovery_narration_cache from public, anon, authenticated;
grant all privileges on public.discovery_model_rate_buckets, public.discovery_model_runtime_state,
  public.discovery_model_circuit_breaker, public.discovery_narration_cache to service_role;

create or replace function public.claim_discovery_model_attempt(
  p_identity_hash text,
  p_origin_resource_id uuid,
  p_is_authenticated boolean,
  p_per_minute_limit integer,
  p_per_day_limit integer,
  p_provider_daily_limit integer,
  p_global_concurrency_limit integer
)
returns table (permitted boolean, reason text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_time timestamptz := clock_timestamp();
  minute_start timestamptz := date_trunc('minute', current_time);
  day_start timestamptz := date_trunc('day', current_time at time zone 'utc') at time zone 'utc';
  minute_key text := 'minute:' || p_identity_hash || ':' || p_origin_resource_id::text || ':' || minute_start::text;
  identity_day_key text := 'day:' || p_identity_hash || ':' || day_start::date::text;
  provider_day_key text := 'provider-day:' || day_start::date::text;
  current_attempts integer;
  active_attempts integer;
  breaker_open_until timestamptz;
begin
  if length(p_identity_hash) <> 64 or p_per_minute_limit < 1 or p_per_day_limit < 1
    or p_provider_daily_limit < 1 or p_global_concurrency_limit < 1 then
    raise exception 'INVALID_DISCOVERY_MODEL_LIMITS';
  end if;

  insert into public.discovery_model_circuit_breaker (id) values (true)
  on conflict (id) do nothing;
  select opens_until into breaker_open_until
  from public.discovery_model_circuit_breaker where id = true for update;
  if breaker_open_until is not null and breaker_open_until > current_time then
    return query select false, 'circuit_open';
    return;
  end if;

  insert into public.discovery_model_rate_buckets (bucket_key, window_started_at)
  values (minute_key, minute_start) on conflict (bucket_key) do nothing;
  select attempts into current_attempts from public.discovery_model_rate_buckets
  where bucket_key = minute_key for update;
  if current_attempts >= p_per_minute_limit then
    return query select false, 'identity_rate_limited';
    return;
  end if;

  insert into public.discovery_model_rate_buckets (bucket_key, window_started_at)
  values (identity_day_key, day_start) on conflict (bucket_key) do nothing;
  select attempts into current_attempts from public.discovery_model_rate_buckets
  where bucket_key = identity_day_key for update;
  if current_attempts >= p_per_day_limit then
    return query select false, 'identity_daily_budget_exhausted';
    return;
  end if;

  insert into public.discovery_model_rate_buckets (bucket_key, window_started_at)
  values (provider_day_key, day_start) on conflict (bucket_key) do nothing;
  select attempts into current_attempts from public.discovery_model_rate_buckets
  where bucket_key = provider_day_key for update;
  if current_attempts >= p_provider_daily_limit then
    return query select false, 'provider_daily_budget_exhausted';
    return;
  end if;

  insert into public.discovery_model_runtime_state (state_key, value)
  values ('active', 0) on conflict (state_key) do nothing;
  select value into active_attempts from public.discovery_model_runtime_state
  where state_key = 'active' for update;
  if active_attempts >= p_global_concurrency_limit then
    return query select false, 'global_concurrency_limited';
    return;
  end if;

  update public.discovery_model_rate_buckets
  set attempts = attempts + 1, updated_at = current_time
  where bucket_key in (minute_key, identity_day_key, provider_day_key);
  update public.discovery_model_runtime_state
  set value = value + 1, updated_at = current_time
  where state_key = 'active';
  return query select true, null::text;
end;
$$;

create or replace function public.complete_discovery_model_attempt(
  p_success boolean,
  p_failure_threshold integer default 5,
  p_cooldown_seconds integer default 60
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_time timestamptz := clock_timestamp();
  failures integer;
begin
  update public.discovery_model_runtime_state
  set value = greatest(value - 1, 0), updated_at = current_time
  where state_key = 'active';

  select consecutive_failures into failures
  from public.discovery_model_circuit_breaker where id = true for update;
  if p_success then
    update public.discovery_model_circuit_breaker
    set consecutive_failures = 0, opens_until = null, updated_at = current_time
    where id = true;
  else
    failures := coalesce(failures, 0) + 1;
    update public.discovery_model_circuit_breaker
    set consecutive_failures = failures,
      opens_until = case when failures >= greatest(p_failure_threshold, 1)
        then current_time + make_interval(secs => greatest(p_cooldown_seconds, 1)) else null end,
      updated_at = current_time
    where id = true;
  end if;
end;
$$;

revoke all on function public.claim_discovery_model_attempt(text, uuid, boolean, integer, integer, integer, integer) from public;
revoke all on function public.complete_discovery_model_attempt(boolean, integer, integer) from public;
grant execute on function public.claim_discovery_model_attempt(text, uuid, boolean, integer, integer, integer, integer) to service_role;
grant execute on function public.complete_discovery_model_attempt(boolean, integer, integer) to service_role;
