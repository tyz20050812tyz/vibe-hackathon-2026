import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const sql = readFileSync(
  fileURLToPath(new URL("../../supabase/migrations/202608260005_cleanup_legacy_resource_catalog_rpc.sql", import.meta.url)),
  "utf8",
).replace(/\s+/g, " ").toLowerCase();

describe("legacy resource catalog cleanup migration", () => {
  it("safely cleans an already-deployed v1 RPC only when it exists", () => {
    expect(sql).toContain("to_regprocedure('public.search_resource_catalog(text,text,text,integer)') is not null");
    expect(sql).toContain("revoke all on function public.search_resource_catalog(text, text, text, integer) from public, anon, authenticated, service_role");
    expect(sql).toContain("drop function public.search_resource_catalog(text, text, text, integer)");
  });
});
