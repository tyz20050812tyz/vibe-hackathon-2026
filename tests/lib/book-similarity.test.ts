import { describe, expect, it } from "vitest";

import { createBookRelationGraph } from "@/lib/book-similarity";
import type { ConstellationData } from "@/lib/types/constellation";
import type { ResourceListItem } from "@/lib/types/resources";

const book = (id: string, title: string, tags: string[]): ResourceListItem => ({
  id,
  slug: id,
  type: "book",
  title,
  creators: [],
  publishedYear: 2026,
  languages: ["zh"],
  summary: "这是一条用于图书人工关系图测试的资源摘要。",
  coverUrl: null,
  availability: "online",
  tags: tags.map((tag) => ({ id: tag, name: tag, slug: tag, category: "theme" })),
});

function constellationData(): ConstellationData {
  const center = book("center", "起点", ["ai"]);
  const related = book("related", "关联图书", ["ai"]);
  const unrelated = book("unrelated", "没有人工关系的图书", ["ai"]);
  return {
    centerResourceId: center.id,
    nodes: [
      { resource: center, hop: 0, relationStrength: null, relationTypes: [], isSaved: false, affinity: null },
      { resource: related, hop: 1, relationStrength: 5, relationTypes: ["same_theme", "unexpected_bridge"], isSaved: true, affinity: 0.75 },
      { resource: unrelated, hop: 1, relationStrength: 1, relationTypes: ["same_theme"], isSaved: false, affinity: null },
    ],
    edges: [
      { id: "relation-one", sourceResourceId: center.id, targetResourceId: related.id, relationType: "same_theme", explanation: "共同讨论 AI 的社会影响。", strength: 5, direction: "outbound" },
      { id: "relation-two", sourceResourceId: related.id, targetResourceId: center.id, relationType: "unexpected_bridge", explanation: "从不同路径讨论智能的边界。", strength: 3, direction: "inbound" },
      { id: "not-direct", sourceResourceId: related.id, targetResourceId: unrelated.id, relationType: "same_theme", explanation: "不是当前中心的一跳关系。", strength: 4, direction: "outbound" },
    ],
    hasMoreSecondHop: false,
    personalization: "profile",
  };
}

describe("createBookRelationGraph", () => {
  it("uses only returned resource_relations edges and preserves every relation for one neighbor", () => {
    const graph = createBookRelationGraph(constellationData());

    expect(graph.nodes.map((node) => node.resource.id)).toEqual(["center", "related"]);
    expect(graph.edges).toEqual([
      { id: "relation-one", sourceId: "center", targetId: "related", type: "same_theme", strength: 5, direction: "outbound" },
      { id: "relation-two", sourceId: "related", targetId: "center", type: "unexpected_bridge", strength: 3, direction: "inbound" },
    ]);
    expect(graph.nodes[1]).toMatchObject({
      isSaved: true,
      affinity: 0.75,
      relationStrength: 5,
      relationTypes: ["same_theme", "unexpected_bridge"],
      reasons: ["共同讨论 AI 的社会影响。", "从不同路径讨论智能的边界。"],
    });
  });

  it("rejects a response that omits its declared center node", () => {
    const data = constellationData();
    data.nodes = data.nodes.filter((node) => node.resource.id !== data.centerResourceId);

    expect(() => createBookRelationGraph(data)).toThrow("人工关系数据缺少中心图书。");
  });
});
