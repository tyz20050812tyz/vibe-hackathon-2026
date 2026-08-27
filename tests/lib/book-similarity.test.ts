import { describe, expect, it } from "vitest";

import { createBookSimilarityGraph } from "@/lib/book-similarity";
import type { ResourceListItem } from "@/lib/types/resources";

const book = (id: string, title: string, tags: string[], creators: string[] = []): ResourceListItem => ({
  id,
  slug: id,
  type: "book",
  title,
  creators,
  publishedYear: 2026,
  languages: ["zh"],
  summary: "这是一条用于图书关联计算测试的资源摘要。",
  coverUrl: null,
  availability: "online",
  tags: tags.map((tag) => ({ id: tag, name: tag, slug: tag, category: "theme" })),
});

describe("createBookSimilarityGraph", () => {
  it("uses explainable local signals and never emits unrelated books", () => {
    const center = book("center", "起点", ["ai", "design"], ["作者甲"]);
    const related = book("related", "相关图书", ["ai"], ["作者甲"]);
    const unrelated = book("unrelated", "无关图书", ["city"]);
    const graph = createBookSimilarityGraph(center, [center, related, unrelated]);

    expect(graph.nodes.map((node) => node.resource.id)).toEqual(["center", "related"]);
    expect(graph.nodes[1]?.reasons).toContain("共同主题：ai");
    expect(graph.nodes[1]?.reasons).toContain("共同作者：作者甲");
  });

  it("weights curated relations while keeping their type as an explanation", () => {
    const center = book("center", "起点", []);
    const related = book("related", "人工关联", []);
    const graph = createBookSimilarityGraph(center, [center, related], [{ resourceId: "related", strength: 5, type: "unexpected_bridge" }]);

    expect(graph.nodes[1]).toMatchObject({ resource: { id: "related" }, relationType: "unexpected_bridge" });
    expect(graph.nodes[1]?.reasons).toContain("存在人工策展关联");
    expect(graph.edges).toContainEqual({ sourceId: "center", targetId: "related", similarity: 0.35 });
  });
});
