import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const migrationPath = fileURLToPath(
  new URL(
    "../../supabase/migrations/202608260003_create_resource_catalog_v2.sql",
    import.meta.url,
  ),
);
const sql = readFileSync(migrationPath, "utf8")
  .replace(/\s+/g, " ")
  .trim()
  .toLowerCase();

const oldSignature =
  "public.search_resource_catalog(text, text, text, integer)";
const revokeOldFunction =
  `revoke all on function ${oldSignature} from public, anon, authenticated, service_role;`;
const dropOldFunction = `drop function ${oldSignature};`;

describe("resource catalog v2 migration contract", () => {
  it("revokes every old-RPC role before dropping the exact old signature", () => {
    const revokeIndex = sql.indexOf(revokeOldFunction);
    const dropIndex = sql.indexOf(dropOldFunction);

    expect(revokeIndex).toBeGreaterThanOrEqual(0);
    expect(dropIndex).toBeGreaterThan(revokeIndex);
    expect(sql.match(/drop function public\.search_resource_catalog\(/g)).toHaveLength(1);
    expect(sql).not.toContain("drop function if exists public.search_resource_catalog(");
  });

  it("creates only the frozen v2 RPCs with their intended grants", () => {
    expect(sql).toContain(
      "create or replace function public.search_resource_catalog_v2(",
    );
    expect(sql).toContain(
      "create or replace function public.search_resource_catalog_personalized_v2(",
    );
    expect(sql).toContain(
      "grant execute on function public.search_resource_catalog_v2(text, text, integer, integer, text[], text[], text[], integer) to anon, authenticated, service_role;",
    );
    expect(sql).toContain(
      "grant execute on function public.search_resource_catalog_personalized_v2(text, text, integer, integer, text[], text[], text[], integer) to authenticated;",
    );
    expect(sql.slice(dropIndexAfterRevoke())).not.toContain(oldSignature);
  });
});

function dropIndexAfterRevoke() {
  return sql.indexOf(dropOldFunction) + dropOldFunction.length;
}
