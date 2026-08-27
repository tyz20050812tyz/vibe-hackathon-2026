import { describe, expect, expectTypeOf, it } from "vitest";

import {
  CONSTELLATION_DEPTH_NOT_ENABLED_MESSAGE,
  constellationQuerySchema,
  enabledConstellationDepthSchema,
  parseConstellationQuery,
} from "../../lib/schemas/constellation";
import type {
  ConstellationData,
  ConstellationEdge,
  ConstellationNode,
  ConstellationResponse,
} from "../../lib/types/constellation";
import type { ApiSuccess } from "../../lib/types/api";
import type {
  RelationType,
  ResourceListItem,
} from "../../lib/types/resources";

describe("constellation contract", () => {
  it("defaults depth to one and accepts only the frozen depths", () => {
    expect(constellationQuerySchema.parse({})).toEqual({ depth: 1 });
    expect(constellationQuerySchema.parse({ depth: "1" })).toEqual({ depth: 1 });
    expect(constellationQuerySchema.parse({ depth: "2" })).toEqual({ depth: 2 });
    for (const depth of [0, 3, 1.5, "all"]) {
      expect(constellationQuerySchema.safeParse({ depth }).success).toBe(false);
    }
  });

  it("keeps depth two in the contract but rejects it while only one hop is enabled", () => {
    const query = constellationQuerySchema.parse({ depth: 2 });
    const enabled = enabledConstellationDepthSchema.safeParse(query.depth);
    expect(query).toEqual({ depth: 2 });
    expect(enabled.success).toBe(false);
    if (enabled.success) throw new Error("depth=2 must remain disabled");
    expect(enabled.error.issues[0]?.message)
      .toBe(CONSTELLATION_DEPTH_NOT_ENABLED_MESSAGE);
    expect(enabledConstellationDepthSchema.parse(1)).toBe(1);
  });

  it("rejects repeated scalar and unknown query keys", () => {
    expect(() => parseConstellationQuery(new URLSearchParams("depth=1&depth=2")))
      .toThrow();
    expect(() => parseConstellationQuery(new URLSearchParams("depth=1&depth=1")))
      .toThrow();
    expect(() => parseConstellationQuery(new URLSearchParams("limit=12")))
      .toThrow();
  });

  it("keeps node, edge, response, and envelope fields exact", () => {
    expectTypeOf<ConstellationNode>().toEqualTypeOf<{
      resource: ResourceListItem;
      hop: 0 | 1 | 2;
      relationStrength: number | null;
      relationTypes: RelationType[];
      isSaved: boolean;
      affinity: number | null;
    }>();
    expectTypeOf<ConstellationEdge>().toEqualTypeOf<{
      id: string;
      sourceResourceId: string;
      targetResourceId: string;
      relationType: RelationType;
      explanation: string;
      strength: number;
      direction: "outbound" | "inbound";
    }>();
    expectTypeOf<ConstellationData>().toEqualTypeOf<{
      centerResourceId: string;
      nodes: ConstellationNode[];
      edges: ConstellationEdge[];
      hasMoreSecondHop: boolean;
      personalization: "profile" | "catalog";
    }>();
    expectTypeOf<ApiSuccess<ConstellationData>>()
      .toMatchTypeOf<ConstellationResponse>();
  });
});
