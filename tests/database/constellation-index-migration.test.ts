import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const migrationPath = fileURLToPath(
  new URL(
    "../../supabase/migrations/202608270001_add_resource_relation_target_index.sql",
    import.meta.url,
  ),
);
const sql = readFileSync(migrationPath, "utf8")
  .replace(/--.*$/gm, "")
  .replace(/\s+/g, " ")
  .trim()
  .toLowerCase();

describe("constellation target relation index migration", () => {
  it("adds only the idempotent target-strength index", () => {
    expect(sql).toBe(
      "create index if not exists resource_relations_target_strength_idx on public.resource_relations (target_resource_id, strength desc);",
    );
  });
});
