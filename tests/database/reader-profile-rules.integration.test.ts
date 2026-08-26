import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const enabled = process.env.RUN_SUPABASE_INTEGRATION === "1";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const describeIntegration = enabled && url && publishableKey && serviceRoleKey
  ? describe
  : describe.skip;

type TestUser = { id: string; email: string; password: string; client: SupabaseClient };
let admin: SupabaseClient;
let first: TestUser;
let second: TestUser;
let tagIds: string[];

function uniqueEmail(label: string) {
  return `catalog-${label}-${crypto.randomUUID()}@example.invalid`;
}

async function createUser(label: string): Promise<TestUser> {
  const email = uniqueEmail(label);
  const password = `Test-${crypto.randomUUID()}-A1!`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("Unable to create integration user.");

  const client = createClient(url!, publishableKey!, { auth: { persistSession: false } });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  return { id: data.user.id, email, password, client };
}

describeIntegration("reader-profile database rules", () => {
  beforeAll(async () => {
    admin = createClient(url!, serviceRoleKey!, { auth: { persistSession: false } });
    [first, second] = await Promise.all([createUser("first"), createUser("second")]);
    const { data, error } = await admin.from("tags").select("id").order("id").limit(4);
    if (error || !data || data.length < 4) throw error ?? new Error("Seed at least four tags before running integration tests.");
    tagIds = data.map((tag) => tag.id);
  });

  afterAll(async () => {
    await Promise.allSettled([
      first && admin.auth.admin.deleteUser(first.id),
      second && admin.auth.admin.deleteUser(second.id),
    ]);
  });

  it("isolates users, atomically replaces preferences, and blocks REST writes", async () => {
    const initial = await first.client.rpc("replace_reader_profile", {
      p_interest_tag_ids: tagIds.slice(0, 3),
      p_exploration_level: "gentle",
      p_favorite_books: [{ title: "Initial title", author: "Author" }],
      p_consent: true,
    });
    expect(initial.error).toBeNull();

    const replacement = await first.client.rpc("replace_reader_profile", {
      p_interest_tag_ids: tagIds.slice(1, 4),
      p_exploration_level: "bold",
      p_favorite_books: [{ title: "Replacement title", author: "Author" }],
      p_consent: true,
    });
    expect(replacement.error).toBeNull();

    const ownTags = await first.client.from("reader_profile_tags").select("tag_id").eq("user_id", first.id);
    expect(ownTags.error).toBeNull();
    expect(new Set(ownTags.data?.map((row) => row.tag_id))).toEqual(new Set(tagIds.slice(1, 4)));

    const otherProfile = await second.client.from("reader_profiles").select("user_id").eq("user_id", first.id);
    expect(otherProfile.error).toBeNull();
    expect(otherProfile.data).toEqual([]);

    const directProfileWrite = await first.client.from("reader_profiles")
      .update({ exploration_level: "balanced" })
      .eq("user_id", first.id);
    expect(directProfileWrite.error).not.toBeNull();

    const directTagWrite = await first.client.from("reader_profile_tags").insert({
      user_id: first.id,
      tag_id: tagIds[0],
    });
    expect(directTagWrite.error).not.toBeNull();
  });
});
