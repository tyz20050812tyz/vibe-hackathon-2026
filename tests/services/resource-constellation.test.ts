import type { SupabaseClient, User } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createPublicClient: vi.fn(),
  createAuthenticatedClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabasePublicServerClient: mocks.createPublicClient,
  createSupabaseAuthenticatedServerClient: mocks.createAuthenticatedClient,
}));

import {
  getResourceConstellation,
  ResourceConstellationError,
} from "../../lib/services/resource-constellation";

const centerId = "10000000-0000-4000-8000-000000000001";
const alphaId = "20000000-0000-4000-8000-000000000002";
const betaId = "30000000-0000-4000-8000-000000000003";
const outsideId = "40000000-0000-4000-8000-000000000004";
const interestTagId = "50000000-0000-4000-8000-000000000005";

function resource(id: string, slug: string, tagIds: string[] = []) {
  return {
    id,
    slug,
    type: "book",
    title: slug,
    creators: ["Author"],
    published_year: 2026,
    languages: ["en"],
    summary: `Summary for ${slug} with enough detail.`,
    cover_url: null,
    availability: "online",
    tags: tagIds.map((tagId) => ({
      tag: {
        id: tagId,
        name: `Tag ${tagId.slice(-1)}`,
        slug: `tag-${tagId.slice(-1)}`,
        category: "theme",
      },
    })),
  };
}

const center = resource(centerId, "center");
const alpha = resource(alphaId, "alpha", [interestTagId]);
const beta = resource(betaId, "beta", [interestTagId, "60000000-0000-4000-8000-000000000006"]);

const relations = [
  {
    id: "d-relation",
    source_resource_id: centerId,
    target_resource_id: alphaId,
    relation_type: "unexpected_bridge",
    explanation: "An outbound unexpected bridge explanation.",
    strength: 3,
  },
  {
    id: "a-relation",
    source_resource_id: alphaId,
    target_resource_id: centerId,
    relation_type: "same_theme",
    explanation: "An inbound same theme explanation.",
    strength: 5,
  },
  {
    id: "b-relation",
    source_resource_id: centerId,
    target_resource_id: alphaId,
    relation_type: "contrasting_view",
    explanation: "A distinct contrasting relationship explanation.",
    strength: 5,
  },
  {
    id: "c-relation",
    source_resource_id: betaId,
    target_resource_id: centerId,
    relation_type: "historical_context",
    explanation: "An inbound historical context explanation.",
    strength: 4,
  },
  {
    id: "self-loop",
    source_resource_id: centerId,
    target_resource_id: centerId,
    relation_type: "same_theme",
    explanation: "A defensive self loop that must be ignored.",
    strength: 5,
  },
] as const;

type PublicOptions = {
  missing?: boolean;
  empty?: boolean;
  centerError?: boolean;
  relationError?: boolean;
  secondHop?: boolean;
};

function queryBuilder(
  table: string,
  execute: (state: { eq: Record<string, unknown>; ids?: string[]; or?: string }) => unknown,
  log: Array<{ table: string; operation: string; value?: unknown }>,
) {
  const state: { eq: Record<string, unknown>; ids?: string[]; or?: string } = { eq: {} };
  const result = () => Promise.resolve(execute(state));
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn((column: string, value: unknown) => {
      state.eq[column] = value;
      log.push({ table, operation: `eq:${column}`, value });
      return builder;
    }),
    in: vi.fn((_column: string, ids: string[]) => {
      state.ids = ids;
      log.push({ table, operation: "in", value: ids });
      return builder;
    }),
    or: vi.fn((value: string) => {
      state.or = value;
      log.push({ table, operation: "or", value });
      return builder;
    }),
    maybeSingle: vi.fn(() => result()),
    then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
      result().then(resolve, reject),
  };
  return builder;
}

function publicClient(options: PublicOptions = {}) {
  const log: Array<{ table: string; operation: string; value?: unknown }> = [];
  const from = vi.fn((table: string) => queryBuilder(table, (state) => {
    if (table === "resources" && "slug" in state.eq) {
      return {
        data: options.missing ? null : center,
        error: options.centerError ? { message: "private center error" } : null,
      };
    }
    if (table === "resources" && state.ids) {
      return { data: [alpha, beta].filter((row) => state.ids?.includes(row.id)), error: null };
    }
    if (table === "resource_relations" && state.or) {
      return {
        data: options.secondHop
          ? [{ source_resource_id: alphaId, target_resource_id: outsideId }]
          : [{ source_resource_id: alphaId, target_resource_id: betaId }],
        error: null,
      };
    }
    if (table === "resource_relations") {
      const data = options.empty ? [] : relations.filter((relation) =>
        (state.eq.source_resource_id === centerId && relation.source_resource_id === centerId) ||
        (state.eq.target_resource_id === centerId && relation.target_resource_id === centerId),
      );
      return {
        data,
        error: options.relationError ? { message: "private relation error" } : null,
      };
    }
    throw new Error(`Unexpected public query: ${table}`);
  }, log));
  return { client: { from } as unknown as SupabaseClient, from, log };
}

function authenticatedClient({
  valid = true,
  complete = true,
}: { valid?: boolean; complete?: boolean } = {}) {
  const auth = {
    getUser: vi.fn().mockResolvedValue(valid
      ? { data: { user: { id: "reader-id" } as User }, error: null }
      : { data: { user: null }, error: new Error("invalid token") }),
  };
  const rpc = vi.fn().mockResolvedValue({ data: complete, error: null });
  const from = vi.fn((table: string) => {
    const execute = () => table === "saved_resources"
      ? { data: [{ resource_id: alphaId }], error: null }
      : { data: [{ tag_id: interestTagId }], error: null };
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      in: vi.fn(() => builder),
      then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve(execute()).then(resolve, reject),
    };
    return builder;
  });
  return { client: { auth, rpc, from } as unknown as SupabaseClient, auth, rpc, from };
}

describe("resource constellation service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("maps both directions, preserves database endpoints, deduplicates nodes, and keeps distinct edges", async () => {
    const database = publicClient({ secondHop: true });
    mocks.createPublicClient.mockReturnValue(database.client);

    const result = await getResourceConstellation("center");

    expect(result.centerResourceId).toBe(centerId);
    expect(result.nodes.map((node) => node.resource.id)).toEqual([
      centerId,
      alphaId,
      betaId,
    ]);
    expect(result.edges.map((edge) => edge.id)).toEqual([
      "a-relation",
      "b-relation",
      "c-relation",
      "d-relation",
    ]);
    expect(result.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "b-relation",
        sourceResourceId: centerId,
        targetResourceId: alphaId,
        direction: "outbound",
      }),
      expect.objectContaining({
        id: "a-relation",
        sourceResourceId: alphaId,
        targetResourceId: centerId,
        direction: "inbound",
      }),
    ]));
    expect(result.edges.some((edge) => edge.id === "self-loop")).toBe(false);
    expect(result.nodes[1]).toMatchObject({
      relationStrength: 5,
      relationTypes: ["same_theme", "contrasting_view", "unexpected_bridge"],
    });
    expect(result.hasMoreSecondHop).toBe(true);
  });

  it("uses fixed batch queries rather than loading one resource per relation", async () => {
    const database = publicClient();
    mocks.createPublicClient.mockReturnValue(database.client);

    await getResourceConstellation("center");

    expect(database.from.mock.calls.filter(([table]) => table === "resources"))
      .toHaveLength(2);
    expect(database.from.mock.calls.filter(([table]) => table === "resource_relations"))
      .toHaveLength(3);
    expect(database.log.filter((entry) => entry.operation === "in"))
      .toEqual([{ table: "resources", operation: "in", value: [alphaId, betaId] }]);
  });

  it("adds saved and affinity metadata without changing public topology", async () => {
    const anonymousDatabase = publicClient();
    mocks.createPublicClient.mockReturnValueOnce(anonymousDatabase.client);
    const anonymous = await getResourceConstellation("center");

    const authenticatedDatabase = publicClient();
    const authenticated = authenticatedClient();
    mocks.createPublicClient.mockReturnValueOnce(authenticatedDatabase.client);
    mocks.createAuthenticatedClient.mockReturnValue(authenticated.client);
    const personalized = await getResourceConstellation("center", "valid-token");

    expect(personalized.nodes.map(({ resource, hop, relationStrength, relationTypes }) => ({
      id: resource.id,
      hop,
      relationStrength,
      relationTypes,
    }))).toEqual(anonymous.nodes.map(({ resource, hop, relationStrength, relationTypes }) => ({
      id: resource.id,
      hop,
      relationStrength,
      relationTypes,
    })));
    expect(personalized.edges).toEqual(anonymous.edges);
    expect(personalized.personalization).toBe("profile");
    expect(personalized.nodes.find((node) => node.resource.id === alphaId))
      .toMatchObject({ isSaved: true, affinity: 1 });
    expect(personalized.nodes.find((node) => node.resource.id === betaId)?.affinity)
      .toBeCloseTo(2 / 3);
    expect(personalized.nodes[0].affinity).toBeNull();
  });

  it.each([
    ["invalid token", { valid: false, complete: true }],
    ["incomplete profile", { valid: true, complete: false }],
  ])("falls back to catalog metadata for %s", async (_label, authOptions) => {
    const database = publicClient();
    const authenticated = authenticatedClient(authOptions);
    mocks.createPublicClient.mockReturnValue(database.client);
    mocks.createAuthenticatedClient.mockReturnValue(authenticated.client);

    const result = await getResourceConstellation("center", "token");

    expect(result.personalization).toBe("catalog");
    expect(result.nodes.every((node) => node.affinity === null)).toBe(true);
    if (!authOptions.valid) expect(authenticated.from).not.toHaveBeenCalled();
  });

  it("returns a center-only empty graph", async () => {
    const database = publicClient({ empty: true });
    mocks.createPublicClient.mockReturnValue(database.client);

    const result = await getResourceConstellation("center");

    expect(result).toMatchObject({
      centerResourceId: centerId,
      edges: [],
      hasMoreSecondHop: false,
      personalization: "catalog",
    });
    expect(result.nodes).toHaveLength(1);
    expect(database.from.mock.calls.filter(([table]) => table === "resources"))
      .toHaveLength(1);
  });

  it("maps missing and unavailable data without exposing database details", async () => {
    const missing = publicClient({ missing: true });
    mocks.createPublicClient.mockReturnValueOnce(missing.client);
    await expect(getResourceConstellation("missing"))
      .rejects.toMatchObject({ code: "RESOURCE_NOT_FOUND" });

    const unavailable = publicClient({ relationError: true });
    mocks.createPublicClient.mockReturnValueOnce(unavailable.client);
    await expect(getResourceConstellation("center"))
      .rejects.toMatchObject({
        code: "SUPABASE_UNAVAILABLE",
        message: "无法读取星图资源关系。",
      } satisfies Partial<ResourceConstellationError>);
  });

  it("maps missing public configuration", async () => {
    mocks.createPublicClient.mockImplementation(() => {
      throw new Error("private configuration detail");
    });
    await expect(getResourceConstellation("center"))
      .rejects.toMatchObject({ code: "CONFIGURATION_ERROR" });
  });
});
