import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createPublicClient: vi.fn(),
  createAuthenticatedClient: vi.fn(),
  narrateWithDeepSeek: vi.fn(),
  readDiscoveryContext: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabasePublicServerClient: mocks.createPublicClient,
  createSupabaseAuthenticatedServerClient: mocks.createAuthenticatedClient,
}));
vi.mock("@/lib/discovery-context", () => ({
  readDiscoveryContext: mocks.readDiscoveryContext,
}));
vi.mock("@/lib/services/deepseek-narration", () => ({
  narrateWithDeepSeek: mocks.narrateWithDeepSeek,
}));

import { discover } from "../../lib/services/discovery";

const originId = "00000000-0000-4000-8000-000000000001";
const interestIds = ["10000000-0000-4000-8000-000000000001", "10000000-0000-4000-8000-000000000002", "10000000-0000-4000-8000-000000000003"];

function target(id: string, tags: string[] = [], overrides: Record<string, unknown> = {}) {
  return {
    id,
    slug: `resource-${id.slice(-2)}`,
    type: "book",
    title: `Resource ${id.slice(-2)}`,
    creators: ["Author"],
    published_year: 2020,
    languages: ["en"],
    summary: "Summary",
    cover_url: null,
    availability: "online",
    tags: tags.map((tagId, index) => ({ tag: { id: tagId, name: `Tag ${index}`, slug: `tag-${index}`, category: "theme" } })),
    ...overrides,
  };
}

function relation(id: string, relationType: string, strength: number, resource = target(id)) {
  return { id, relation_type: relationType, explanation: `Explanation ${id}`, strength, target: resource };
}

function queryResult(data: unknown) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
    then: (resolve: (value: unknown) => unknown) => resolve({ data, error: null }),
  };
}

function client(relations: unknown[], options: { authenticated?: boolean; complete?: boolean; level?: string } = {}) {
  const resources = queryResult({ id: originId, slug: "origin-resource" });
  const relationQuery = queryResult(relations);
  const profile = queryResult({ exploration_level: options.level ?? "balanced", onboarding_completed_at: "2026-08-26T00:00:00Z" });
  const tagLinks = queryResult(interestIds.map((tagId) => ({ tag_id: tagId })));
  const from = vi.fn((table: string) => {
    if (table === "resources") return resources;
    if (table === "resource_relations") return relationQuery;
    if (table === "reader_profiles") return profile;
    if (table === "reader_profile_tags") return tagLinks;
    throw new Error(`Unexpected table: ${table}`);
  });
  const value = {
    auth: { getUser: vi.fn().mockResolvedValue(options.authenticated === false ? { data: { user: null }, error: new Error("invalid") } : { data: { user: { id: "user-1" } }, error: null }) },
    from,
    rpc: vi.fn().mockResolvedValue({ data: options.complete !== false, error: null }),
  } as unknown as SupabaseClient;
  return { value, from };
}

async function run(relations: unknown[], input: Record<string, unknown> = {}, options: { token?: string; authenticated?: boolean; complete?: boolean; level?: string } = {}) {
  const publicValue = client(relations);
  const authValue = client(relations, options);
  mocks.createPublicClient.mockReturnValue(publicValue.value);
  mocks.createAuthenticatedClient.mockReturnValue(authValue.value);
  const result = await discover({ originResourceId: originId, mode: "surprise", ...input }, options.token);
  return { result, publicValue, authValue };
}

describe("new discoveries service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.narrateWithDeepSeek.mockImplementation(async (input) => ({
      narration: input.relationExplanation,
      source: "template",
    }));
    mocks.readDiscoveryContext.mockReturnValue(null);
  });

  it.each([
    ["extend", "same_theme"],
    ["challenge", "contrasting_view"],
    ["context", "historical_context"],
  ])("maps %s mode to %s", async (mode, relationType) => {
    const { result } = await run([relation("r1", relationType, 3)], { mode });
    expect(result.usedRelationType).toBe(relationType);
  });

  it("uses the frozen surprise fallback order", async () => {
    const rows = [
      relation("r4", "same_theme", 10),
      relation("r3", "historical_context", 10),
      relation("r2", "contrasting_view", 10),
      relation("r1", "unexpected_bridge", 1),
    ];
    await expect(run(rows)).resolves.toMatchObject({ result: { usedRelationType: "unexpected_bridge" } });
    await expect(run(rows.slice(0, 3))).resolves.toMatchObject({ result: { usedRelationType: "contrasting_view" } });
    await expect(run(rows.slice(0, 2))).resolves.toMatchObject({ result: { usedRelationType: "historical_context" } });
    await expect(run(rows.slice(0, 1))).resolves.toMatchObject({ result: { usedRelationType: "same_theme" } });
  });

  it("excludes the source and explicit targets and returns at most one recommendation", async () => {
    const allowed = target("00000000-0000-4000-8000-000000000004");
    const excludedId = "00000000-0000-4000-8000-000000000003";
    const { result } = await run([
      relation("r1", "unexpected_bridge", 10, target(originId)),
      relation("r2", "unexpected_bridge", 9, target(excludedId)),
      relation("r3", "unexpected_bridge", 8, allowed),
      relation("r4", "unexpected_bridge", 7),
    ], { excludeResourceIds: [excludedId] });
    expect(result.recommendation?.resource.id).toBe(allowed.id);
    expect(result.recommendation).not.toBeInstanceOf(Array);
  });

  it("returns null when no candidate remains", async () => {
    const { result } = await run([]);
    expect(result.recommendation).toBeNull();
  });

  it("always prioritizes strength, then relation id for stable public ordering", async () => {
    const high = target("00000000-0000-4000-8000-000000000009");
    const stable = target("00000000-0000-4000-8000-000000000008");
    expect((await run([
      relation("z", "unexpected_bridge", 5, stable),
      relation("a", "unexpected_bridge", 6, high),
    ])).result.recommendation?.resource.id).toBe(high.id);
    expect((await run([
      relation("z", "unexpected_bridge", 5, high),
      relation("a", "unexpected_bridge", 5, stable),
    ])).result.recommendation?.resource.id).toBe(stable.id);
  });

  it.each([
    ["gentle", interestIds, 0],
    ["balanced", [interestIds[0]], 1],
    ["bold", [interestIds[0], "other-1", "other-2", "other-3", "other-4"], 2],
  ])("uses %s profile affinity only after strength", async (level, preferredTags, preferredIndex) => {
    const candidates = [
      target("00000000-0000-4000-8000-000000000010", interestIds),
      target("00000000-0000-4000-8000-000000000011", [interestIds[0]]),
      target("00000000-0000-4000-8000-000000000012", [interestIds[0], "other-1", "other-2", "other-3", "other-4"]),
    ];
    candidates[preferredIndex] = target(candidates[preferredIndex].id, preferredTags);
    const { result } = await run(candidates.map((value, index) => relation(`r${index}`, "unexpected_bridge", 5, value)), {}, { token: "valid", level });
    expect(result.recommendation?.resource.id).toBe(candidates[preferredIndex].id);
    expect(result.personalization).toBe("profile");
  });

  it("supports anonymous calls and falls back for invalid or incomplete profiles", async () => {
    expect((await run([relation("r1", "unexpected_bridge", 1)])).result.personalization).toBe("catalog");
    expect((await run([relation("r1", "unexpected_bridge", 1)], {}, { token: "invalid", authenticated: false })).result.personalization).toBe("catalog");
    expect((await run([relation("r1", "unexpected_bridge", 1)], {}, { token: "valid", complete: false })).result.personalization).toBe("catalog");
  });

  it("enforces context hard filters and returns template narration", async () => {
    mocks.readDiscoveryContext.mockReturnValue({
      version: 1,
      originSlug: "origin-resource",
      filters: { languages: ["zh"] },
      issuedAt: 1,
      expiresAt: 300001,
    });
    const matching = target("00000000-0000-4000-8000-000000000006", [], { languages: ["zh"] });
    const { result } = await run([
      relation("a", "unexpected_bridge", 10),
      relation("b", "unexpected_bridge", 5, matching),
    ], { discoveryContext: "context-token" });
    expect(result).toMatchObject({
      constrainedBySourceFilters: true,
      recommendation: {
        resource: { id: matching.id },
        relationExplanation: "Explanation b",
        narration: "Explanation b",
        narrationSource: "template",
      },
    });
  });

  it("does not invoke DeepSeek when the entry limiter is unavailable", async () => {
    const publicValue = client([relation("r1", "unexpected_bridge", 5)]);
    mocks.createPublicClient.mockReturnValue(publicValue.value);

    const result = await discover(
      { originResourceId: originId, mode: "surprise" },
      undefined,
      "anonymous",
      false,
    );

    expect(result.recommendation).toMatchObject({
      narration: "Explanation r1",
      narrationSource: "template",
    });
    expect(mocks.narrateWithDeepSeek).not.toHaveBeenCalled();
  });
});
