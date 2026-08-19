-- Competition template: an intentionally small table for testing an API-to-database round trip.
create table if not exists public.demo_records (
  id uuid primary key default gen_random_uuid(),
  content text not null check (char_length(content) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists demo_records_created_at_idx
  on public.demo_records (created_at desc);

alter table public.demo_records enable row level security;

-- The browser has no table policy. The server-only service-role client performs this
-- demo write, so the service key must never be placed in client-side code.
grant select, insert, delete on public.demo_records to service_role;
