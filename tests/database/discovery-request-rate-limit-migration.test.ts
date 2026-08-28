import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const sql = readFileSync(
  fileURLToPath(new URL(
    "../../supabase/migrations/202608280001_create_discovery_request_rate_limit.sql",
    import.meta.url,
  )),
  "utf8",
).replace(/\s+/g, " ").toLowerCase();

describe("discovery request rate limit migration", () => {
  it("stores only hashed bucket and fixed-window aggregate data", () => {
    expect(sql).toContain("create table if not exists public.discovery_request_rate_buckets");
    for (const column of [
      "bucket_key text primary key",
      "window_started_at timestamptz not null",
      "request_count integer not null",
      "request_bytes bigint not null",
    ]) {
      expect(sql).toContain(column);
    }
    for (const sensitiveColumn of [
      "raw_ip",
      "bearer",
      "request_body",
      "discovery_context",
      "reading_profile",
      "email",
    ]) {
      expect(sql).not.toContain(sensitiveColumn);
    }
  });

  it("claims a fixed window atomically and returns its retry delay", () => {
    expect(sql).toContain("create or replace function public.claim_discovery_request");
    expect(sql).toContain("security definer");
    expect(sql).toContain("set search_path = public, pg_temp");
    expect(sql).toContain("date_bin(");
    expect(sql).toContain("for update");
    expect(sql).toContain("request_count = request_count + 1");
    expect(sql).toContain("request_bytes = request_bytes + p_request_bytes");
    expect(sql).toContain("retry_after_seconds integer");
  });

  it("keeps the table and claim RPC service-role only", () => {
    expect(sql).toContain("alter table public.discovery_request_rate_buckets enable row level security");
    expect(sql).toContain("revoke all on public.discovery_request_rate_buckets from public, anon, authenticated");
    expect(sql).toContain("grant all privileges on public.discovery_request_rate_buckets to service_role");
    expect(sql).toContain("revoke all on function public.claim_discovery_request(text, integer, integer, bigint, integer) from public, anon, authenticated");
    expect(sql).toContain("grant execute on function public.claim_discovery_request(text, integer, integer, bigint, integer) to service_role");
  });
});
