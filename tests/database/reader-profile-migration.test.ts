import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const migrationPath = fileURLToPath(
  new URL(
    "../../supabase/migrations/202608260002_create_reader_profiles.sql",
    import.meta.url,
  ),
);
const sql = readFileSync(migrationPath, "utf8")
  .replace(/\s+/g, " ")
  .trim()
  .toLowerCase();

describe("reader profile migration contract", () => {
  it("creates the three frozen tables and their ownership constraints", () => {
    expect(sql).toContain("create table if not exists public.reader_profiles");
    expect(sql).toContain("user_id uuid primary key references auth.users(id) on delete cascade");
    expect(sql).toContain("exploration_level text not null check (exploration_level in ('gentle', 'balanced', 'bold'))");
    expect(sql).toContain("create table if not exists public.reader_profile_tags");
    expect(sql).toContain("tag_id uuid not null references public.tags(id) on delete restrict");
    expect(sql).toContain("primary key (user_id, tag_id)");
    expect(sql).toContain("create table if not exists public.reader_profile_favorite_books");
    expect(sql).toContain("title text not null check (char_length(title) between 1 and 120)");
    expect(sql).toContain("author text check (author is null or char_length(author) between 1 and 80)");
  });

  it("enables read-own RLS while denying direct browser writes", () => {
    for (const table of [
      "reader_profiles",
      "reader_profile_tags",
      "reader_profile_favorite_books",
    ]) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
    }
    expect(sql.match(/for select to authenticated/g)).toHaveLength(3);
    expect(sql.match(/using \(\(select auth\.uid\(\)\) = user_id\)/g)).toHaveLength(3);
    expect(sql).toContain(
      "revoke all on public.reader_profiles, public.reader_profile_tags, public.reader_profile_favorite_books from anon, authenticated",
    );
    expect(sql).toContain(
      "grant select on public.reader_profiles, public.reader_profile_tags, public.reader_profile_favorite_books to authenticated",
    );
    expect(sql).not.toMatch(/create policy .* for (insert|update|delete)/);
  });

  it("uses auth.uid only and exposes controlled security-definer RPCs", () => {
    expect(sql).toContain("create or replace function public.replace_reader_profile(");
    expect(sql).toContain("create or replace function public.clear_reader_profile()");
    expect(sql.match(/security definer/g)).toHaveLength(2);
    expect(sql.match(/current_user_id uuid := auth\.uid\(\)/g)).toHaveLength(2);
    expect(sql).not.toMatch(/p_user_id|p_userid/);
    expect(sql).toContain(
      "revoke all on function public.replace_reader_profile(uuid[], text, jsonb, boolean) from public",
    );
    expect(sql).toContain(
      "grant execute on function public.replace_reader_profile(uuid[], text, jsonb, boolean) to authenticated",
    );
    expect(sql).toContain(
      "revoke all on function public.clear_reader_profile() from public",
    );
    expect(sql).toContain(
      "grant execute on function public.clear_reader_profile() to authenticated",
    );
  });

  it("enforces the frozen replacement input boundaries in the database", () => {
    expect(sql).toContain("if p_consent is not true then");
    expect(sql).toContain("if p_exploration_level not in ('gentle', 'balanced', 'bold') then");
    expect(sql).toContain("if distinct_tag_count < 3 or distinct_tag_count > 8");
    expect(sql).toContain("left join public.tags tag on tag.id = requested.tag_id");
    expect(sql).toContain("cardinality(array(select distinct unnest(p_interest_tag_ids)))");
    expect(sql).toContain("if favorite_count > 3 then");
    expect(sql).toContain("nullif(btrim(book.author), '')");
  });

  it("replaces and clears all profile data inside their RPC transactions", () => {
    expect(sql).toContain("insert into public.reader_profiles");
    expect(sql).toContain("on conflict (user_id) do update set");
    expect(sql).toContain("delete from public.reader_profile_tags where user_id = current_user_id");
    expect(sql).toContain("insert into public.reader_profile_tags (user_id, tag_id)");
    expect(sql).toContain("delete from public.reader_profile_favorite_books where user_id = current_user_id");
    expect(sql).toContain("insert into public.reader_profile_favorite_books (user_id, title, author)");
    expect(sql).toContain("delete from public.reader_profiles where user_id = current_user_id");
  });
});
