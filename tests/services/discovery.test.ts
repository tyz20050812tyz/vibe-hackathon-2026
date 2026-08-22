import type { SupabaseClient, User } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import {
  DiscoveryServiceError,
  getDiscovery,
} from "../../lib/services/discovery";
import type { RelationType } from "../../lib/types/resources";

const sourceId = "11111111-1111-4111-8111-111111111111";
const targetA = "22222222-2222-4222-8222-222222222222";
const targetB = "33333333-3333-4333-8333-333333333333";
const targetC = "44444444-4444-4444-8444-444444444444";
const targetD = "55555555-5555-4555-8555-555555555555";

type RelationRow = {
  target_resource_id: string;
  relation_type: RelationType;
  explanation: string;
  strength: number;
};

function resource(id: string, title = `Resource ${id.slice(0, 4)}`) {
  return {
    id,
    slug: title.toLowerCase().replaceAll(" ", "-"),
    type: "book",
    title,
    creators: ["Author"],
    summary: "A sufficiently detailed resource summary for discovery tests.",
    cover_url: null,
    availability: "online",
    resource_tags: [
      {
        tag: {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          name: "主题",
          slug: "theme",
          category: "theme",
        },
      },
    ],
  };
}

function relation(
  targetResourceId: string,
  relationType: Extract<RelationType, "unexpected_bridge" | "same_theme">,
  strength: number,
): RelationRow {
  return {
    target_resource_id: targetResourceId,
    relation_type: relationType,
    explanation: `${relationType} explanation for ${targetResourceId}`,
    strength,
  };
}

function createClient({
  authenticated = true,
  recentId = null,
  savedResources,
  resources = [resource(sourceId)],
  relations = [],
}: {
  authenticated?: boolean;
  recentId?: string | null;
  savedResources?: Array<{ resource_id: string; saved_at: string }>;
  resources?: ReturnType<typeof resource>[];
  relations?: RelationRow[];
} = {}) {
  const user = {
    id: "99999999-9999-4999-8999-999999999999",
  } as User;
  const authGetUser = vi.fn().mockResolvedValue(
    authenticated
      ? { data: { user }, error: null }
      : { data: { user: null }, error: null },
  );

  const savedRows =
    savedResources ??
    (recentId
      ? [{ resource_id: recentId, saved_at: "2026-08-22T00:00:00Z" }]
      : []);
  const savedOrders: Array<[string, { ascending: boolean }]> = [];
  const savedMaybeSingle = vi.fn(async () => {
    const rows = [...savedRows].sort((left, right) => {
      for (const [field, { ascending }] of savedOrders) {
        const comparison = left[field as keyof typeof left].localeCompare(
          right[field as keyof typeof right],
        );
        if (comparison !== 0) return ascending ? comparison : -comparison;
      }
      return 0;
    });
    return {
      data: rows[0] ? { resource_id: rows[0].resource_id } : null,
      error: null,
    };
  });
  const savedLimit = vi.fn(() => ({ maybeSingle: savedMaybeSingle }));
  const savedOrder = vi.fn(
    (field: string, options: { ascending: boolean }) => {
      savedOrders.push([field, options]);
      return { order: savedOrder, limit: savedLimit };
    },
  );
  const savedEq = vi.fn(() => ({ order: savedOrder }));

  let selectedRelationType: RelationRow["relation_type"] | null = null;
  let excludedTarget: string | null = null;
  const relationOrders: Array<[string, { ascending: boolean }]> = [];
  const relationLimit = vi.fn(async (limit: number) => {
    const rows = relations
      .filter(
        (row) =>
          row.relation_type === selectedRelationType &&
          row.target_resource_id !== excludedTarget,
      )
      .sort(
        (left, right) =>
          right.strength - left.strength ||
          left.target_resource_id.localeCompare(right.target_resource_id),
      )
      .slice(0, limit);
    return { data: rows, error: null };
  });
  const relationQuery = {
    eq: vi.fn((field: string, value: string) => {
      if (field === "relation_type") {
        selectedRelationType = value as RelationRow["relation_type"];
      }
      return relationQuery;
    }),
    neq: vi.fn((_field: string, value: string) => {
      excludedTarget = value;
      return relationQuery;
    }),
    order: vi.fn((field: string, options: { ascending: boolean }) => {
      relationOrders.push([field, options]);
      return relationQuery;
    }),
    limit: relationLimit,
  };

  const resourcesById = new Map(resources.map((row) => [row.id, row]));
  const resourceSelect = vi.fn(() => ({
    eq: vi.fn((_field: string, id: string) => ({
      maybeSingle: vi.fn().mockResolvedValue({
        data: resourcesById.get(id) ?? null,
        error: null,
      }),
    })),
    in: vi.fn(async (_field: string, ids: string[]) => ({
      data: ids
        .flatMap((id) => {
          const row = resourcesById.get(id);
          return row ? [row] : [];
        })
        .reverse(),
      error: null,
    })),
  }));

  const from = vi.fn((table: string) => {
    if (table === "saved_resources") {
      return { select: vi.fn(() => ({ eq: savedEq })) };
    }
    if (table === "resource_relations") {
      return { select: vi.fn(() => relationQuery) };
    }
    if (table === "resources") {
      return { select: resourceSelect };
    }
    throw new Error(`Unexpected table: ${table}`);
  });

  return {
    client: { auth: { getUser: authGetUser }, from } as unknown as SupabaseClient,
    authGetUser,
    savedOrder,
    savedLimit,
    relationQuery,
    relationOrders,
    relationLimit,
  };
}

describe("discovery service", () => {
  it("allows an explicit source without reading authentication", async () => {
    const { client, authGetUser } = createClient();

    const result = await getDiscovery(client, { sourceResourceId: sourceId });

    expect(authGetUser).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      source: { id: sourceId },
      items: [],
      mode: "empty",
    });
  });

  it("returns RESOURCE_NOT_FOUND for a missing explicit source", async () => {
    const { client } = createClient({ resources: [] });

    await expect(
      getDiscovery(client, { sourceResourceId: sourceId }),
    ).rejects.toMatchObject({
      code: "RESOURCE_NOT_FOUND",
    } satisfies Partial<DiscoveryServiceError>);
  });

  it("requires authentication when no source is provided", async () => {
    const { client } = createClient({ authenticated: false });

    await expect(getDiscovery(client, {})).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    } satisfies Partial<DiscoveryServiceError>);
  });

  it("returns empty when an authenticated user has no saved resources", async () => {
    const { client } = createClient({ recentId: null });

    await expect(getDiscovery(client, {})).resolves.toEqual({
      source: null,
      items: [],
      mode: "empty",
    });
  });

  it("uses the most recently saved resource as the implicit source", async () => {
    const { client, savedOrder, savedLimit } = createClient({
      recentId: sourceId,
    });

    const result = await getDiscovery(client, {});

    expect(savedOrder.mock.calls).toEqual([
      ["saved_at", { ascending: false }],
      ["resource_id", { ascending: true }],
    ]);
    expect(savedLimit).toHaveBeenCalledWith(1);
    expect(result.source?.id).toBe(sourceId);
  });

  it("uses the smaller resource id when saved times are identical", async () => {
    const { client } = createClient({
      savedResources: [
        { resource_id: targetA, saved_at: "2026-08-22T00:00:00Z" },
        { resource_id: sourceId, saved_at: "2026-08-22T00:00:00Z" },
      ],
      resources: [resource(sourceId), resource(targetA)],
    });

    const result = await getDiscovery(client, {});

    expect(result.source?.id).toBe(sourceId);
  });

  it("prefers unexpected bridges and preserves relation metadata", async () => {
    const unexpected = relation(targetA, "unexpected_bridge", 4);
    const sameTheme = relation(targetB, "same_theme", 5);
    const { client, relationQuery } = createClient({
      resources: [resource(sourceId), resource(targetA), resource(targetB)],
      relations: [sameTheme, unexpected],
    });

    const result = await getDiscovery(client, { sourceResourceId: sourceId });

    expect(result.mode).toBe("unexpected_bridge");
    expect(result.items).toEqual([
      expect.objectContaining({
        id: targetA,
        relationType: "unexpected_bridge",
        explanation: unexpected.explanation,
        strength: 4,
      }),
    ]);
    expect(relationQuery.eq).not.toHaveBeenCalledWith(
      "relation_type",
      "same_theme",
    );
  });

  it("falls back to same-theme relations only when no unexpected bridge exists", async () => {
    const sameTheme = relation(targetB, "same_theme", 5);
    const { client } = createClient({
      resources: [resource(sourceId), resource(targetB)],
      relations: [sameTheme],
    });

    const result = await getDiscovery(client, { sourceResourceId: sourceId });

    expect(result.mode).toBe("same_theme");
    expect(result.items[0]).toMatchObject({
      id: targetB,
      relationType: "same_theme",
      explanation: sameTheme.explanation,
      strength: 5,
    });
  });

  it("excludes the source, applies stable ordering, and returns at most three items", async () => {
    const { client, relationQuery, relationOrders, relationLimit } = createClient({
      resources: [
        resource(sourceId),
        resource(targetA),
        resource(targetB),
        resource(targetC),
        resource(targetD),
      ],
      relations: [
        relation(targetC, "unexpected_bridge", 3),
        relation(targetB, "unexpected_bridge", 5),
        relation(sourceId, "unexpected_bridge", 5),
        relation(targetA, "unexpected_bridge", 5),
        relation(targetD, "unexpected_bridge", 4),
      ],
    });

    const result = await getDiscovery(client, { sourceResourceId: sourceId });

    expect(relationQuery.neq).toHaveBeenCalledWith(
      "target_resource_id",
      sourceId,
    );
    expect(relationOrders).toEqual([
      ["strength", { ascending: false }],
      ["target_resource_id", { ascending: true }],
    ]);
    expect(relationLimit).toHaveBeenCalledWith(3);
    expect(result.items.map((item) => item.id)).toEqual([
      targetA,
      targetB,
      targetD,
    ]);
    expect(result.items).toHaveLength(3);
    expect(result.items.some((item) => item.id === sourceId)).toBe(false);
  });
});
