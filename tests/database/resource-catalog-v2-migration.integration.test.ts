import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

const databaseUrl = process.env.SUPABASE_MIGRATION_TEST_DATABASE_URL;
const enabled = process.env.RUN_SUPABASE_MIGRATION_TESTS === "1" && Boolean(databaseUrl);
const describeMigration = enabled ? describe : describe.skip;
const migrationPath = fileURLToPath(new URL("../../supabase/migrations/202608260003_create_resource_catalog_v2.sql", import.meta.url));
const cleanupPath = fileURLToPath(new URL("../../supabase/migrations/202608260005_cleanup_legacy_resource_catalog_rpc.sql", import.meta.url));

function psql(...args: string[]) {
  return execFileSync("psql", [databaseUrl!, "-v", "ON_ERROR_STOP=1", ...args], { encoding: "utf8" });
}

const fixtureSql = `
  drop schema public cascade;
  create schema public;
  create schema if not exists auth;
  create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
  create table public.resources (
    id uuid primary key, slug text, type text, title text, creators jsonb,
    published_year integer, languages text[], summary text, cover_url text,
    availability text, is_featured boolean default false, created_at timestamptz default now()
  );
  create table public.tags (id uuid primary key, name text, slug text, category text);
  create table public.resource_tags (resource_id uuid, tag_id uuid);
  create table public.reader_profile_tags (user_id uuid, tag_id uuid);
  create or replace function public.reader_profile_is_complete() returns boolean language sql stable as $$ select false $$;
  create or replace function public.search_resource_catalog(text, text, text, integer)
  returns table (id uuid) language sql stable as $$ select null::uuid $$;
`;

describeMigration("resource catalog v2 migration in PostgreSQL", () => {
  beforeAll(() => {
    // This intentionally resets only a disposable database provided by the caller.
    psql("-c", fixtureSql);
  });

  it("upgrades a database where the v1 RPC exists", () => {
    psql("-f", migrationPath);
    const oldFunction = psql("-At", "-c", "select to_regprocedure('public.search_resource_catalog(text,text,text,integer)') is null;").trim();
    const v2Function = psql("-At", "-c", "select to_regprocedure('public.search_resource_catalog_v2(text,text,integer,integer,text[],text[],text[],integer)') is not null;").trim();
    expect(oldFunction).toBe("t");
    expect(v2Function).toBe("t");
  });

  it("runs again when the v1 RPC is already absent", () => {
    expect(() => psql("-f", migrationPath)).not.toThrow();
    expect(() => psql("-f", cleanupPath)).not.toThrow();
    const oldFunction = psql("-At", "-c", "select to_regprocedure('public.search_resource_catalog(text,text,text,integer)') is null;").trim();
    expect(oldFunction).toBe("t");
  });
});
