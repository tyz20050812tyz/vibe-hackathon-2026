import { describe, expect, it } from "vitest";

import { createConstellationLayout } from "@/lib/constellation-layout";
import type { ConstellationNode } from "@/lib/types/constellation";

const node = (id: string, hop: 0 | 1 | 2): ConstellationNode => ({
  resource: {
    id,
    slug: id,
    type: "book",
    title: id,
    creators: [],
    publishedYear: null,
    languages: ["zh"],
    summary: "",
    coverUrl: null,
    availability: "online",
    tags: [],
  },
  hop,
  relationStrength: hop === 0 ? null : 3,
  relationTypes: [],
  isSaved: false,
  affinity: null,
});

describe("createConstellationLayout", () => {
  it("keeps the center fixed and each ring deterministic regardless of API order", () => {
    const first = createConstellationLayout([node("center", 0), node("zeta", 1), node("alpha", 1)]);
    const second = createConstellationLayout([node("alpha", 1), node("center", 0), node("zeta", 1)]);

    expect(first.get("center")).toEqual({ x: 50, y: 50 });
    expect(first.get("alpha")).toEqual(second.get("alpha"));
    expect(first.get("zeta")).toEqual(second.get("zeta"));
  });

  it("places two-hop nodes on a distinct outer ring", () => {
    const layout = createConstellationLayout([node("center", 0), node("inner", 1), node("outer", 2)]);
    const inner = layout.get("inner");
    const outer = layout.get("outer");
    expect(inner).toBeDefined();
    expect(outer).toBeDefined();
    expect(Math.abs((outer?.y ?? 0) - 50)).toBeGreaterThan(Math.abs((inner?.y ?? 0) - 50));
  });
});
