import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const sql = readFileSync(
  fileURLToPath(new URL("../../supabase/migrations/202608260004_add_discovery_model_controls.sql", import.meta.url)),
  "utf8",
).replace(/\s+/g, " ").toLowerCase();

describe("discovery model controls migration", () => {
  it("keeps distributed control and cache tables inaccessible to browser roles", () => {
    for (const table of [
      "discovery_model_rate_buckets",
      "discovery_model_runtime_state",
      "discovery_model_circuit_breaker",
      "discovery_narration_cache",
    ]) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
    }
    expect(sql).toContain("revoke all on public.discovery_model_rate_buckets, public.discovery_model_runtime_state");
    expect(sql).toContain("grant all privileges on public.discovery_model_rate_buckets, public.discovery_model_runtime_state");
  });

  it("serializes quota, concurrency, and breaker decisions in service-only RPCs", () => {
    expect(sql).toContain("for update");
    expect(sql).toContain("identity_rate_limited");
    expect(sql).toContain("global_concurrency_limited");
    expect(sql).toContain("provider_daily_budget_exhausted");
    expect(sql).toContain("circuit_open");
    expect(sql).toContain("grant execute on function public.claim_discovery_model_attempt");
    expect(sql).toContain("to service_role");
  });
});
