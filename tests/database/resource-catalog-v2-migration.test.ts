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

  it("applies field-local OR filters and cross-field AND filters before limiting", () => {
    expect(sql.match(/r\.languages && n\.languages/g)).toHaveLength(2);
    expect(sql.match(/r\.type = any\(n\.types\)/g)).toHaveLength(2);
    expect(sql.match(/r\.availability = any\(n\.availabilities\)/g)).toHaveLength(2);
    expect(sql.match(/r\.published_year >= n\.year_from/g)).toHaveLength(2);
    expect(sql.match(/r\.published_year <= n\.year_to/g)).toHaveLength(2);
    expect(sql.match(/t\.slug = n\.tag/g)).toHaveLength(2);
    expect(sql.match(/strpos\(lower\(r\.title\), lower\(n\.q\)\) > 0/g)).toHaveLength(2);
    expect(sql.match(/strpos\(lower\(r\.summary\), lower\(n\.q\)\) > 0/g)).toHaveLength(2);
    expect(sql.match(/jsonb_array_elements_text\(r\.creators\)/g)).toHaveLength(2);
    expect(sql.match(/count\(\*\) over \(\) as total_count/g)).toHaveLength(2);
  });

  it("keeps total before limit and uses both frozen stable sort orders", () => {
    const catalogOrder =
      "order by c.is_featured desc, c.created_at desc, c.id desc limit";
    const personalizedOrder =
      "end desc, c.is_featured desc, c.created_at desc, c.id desc limit";

    expect(sql).toContain(catalogOrder);
    expect(sql).toContain(personalizedOrder);
    expect(sql.match(/limit \(select result_limit from normalized\)/g)).toHaveLength(2);
    expect(sql.indexOf("count(*) over () as total_count")).toBeLessThan(
      sql.indexOf(catalogOrder),
    );
    expect(sql).toContain("(2 * c.overlap) / (c.resource_tag_count + c.interest_tag_count)");
  });
});

function dropIndexAfterRevoke() {
  return sql.indexOf(dropOldFunction) + dropOldFunction.length;
}
