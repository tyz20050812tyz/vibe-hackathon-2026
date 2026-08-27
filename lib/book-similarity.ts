import type { RelationType, ResourceListItem } from "@/lib/types/resources";

export type BookSimilarityNode = {
  resource: ResourceListItem;
  similarity: number;
  reasons: string[];
  relationType: RelationType | null;
  isCenter: boolean;
};

export type BookSimilarityEdge = {
  sourceId: string;
  targetId: string;
  similarity: number;
};

export type BookSimilarityGraph = {
  center: BookSimilarityNode;
  nodes: BookSimilarityNode[];
  edges: BookSimilarityEdge[];
};

export type CuratedBookRelation = {
  resourceId: string;
  strength: number;
  type: RelationType;
};

function overlap<T>(left: T[], right: T[]) {
  const rightSet = new Set(right);
  return left.filter((value) => rightSet.has(value));
}

function tagSimilarity(left: ResourceListItem, right: ResourceListItem) {
  const shared = overlap(left.tags.map((tag) => tag.id), right.tags.map((tag) => tag.id));
  const total = new Set([...left.tags.map((tag) => tag.id), ...right.tags.map((tag) => tag.id)]).size;
  return { shared, value: total ? shared.length / total : 0 };
}

function authorSimilarity(left: ResourceListItem, right: ResourceListItem) {
  const normalize = (value: string) => value.trim().toLocaleLowerCase();
  return overlap(left.creators.map(normalize), right.creators.map(normalize));
}

export function createBookSimilarityGraph(
  center: ResourceListItem,
  catalog: ResourceListItem[],
  curatedRelations: CuratedBookRelation[] = [],
): BookSimilarityGraph {
  const curatedByResourceId = new Map(curatedRelations.map((relation) => [relation.resourceId, relation]));
  const books = catalog.filter((resource) => resource.type === "book" && resource.id !== center.id);
  const nodes = books.flatMap((resource) => {
    const tags = tagSimilarity(center, resource);
    const authors = authorSimilarity(center, resource);
    const curated = curatedByResourceId.get(resource.id);
    const score = Math.min(1, tags.value * 0.5 + (authors.length ? 0.15 : 0) + (curated ? (curated.strength / 5) * 0.35 : 0));
    if (score === 0) return [];
    const reasons = [
      ...(tags.shared.length ? [`共同主题：${tags.shared.map((tagId) => center.tags.find((tag) => tag.id === tagId)?.name).filter(Boolean).join("、")}`] : []),
      ...(authors.length ? [`共同作者：${authors.join("、")}`] : []),
      ...(curated ? ["存在人工策展关联"] : []),
    ];
    return [{ resource, similarity: score, reasons, relationType: curated?.type ?? null, isCenter: false } satisfies BookSimilarityNode];
  }).sort((left, right) => right.similarity - left.similarity || left.resource.title.localeCompare(right.resource.title)).slice(0, 12);

  const centerNode: BookSimilarityNode = { resource: center, similarity: 1, reasons: ["当前选择的图书"], relationType: null, isCenter: true };
  const edges: BookSimilarityEdge[] = nodes.map((node) => ({ sourceId: center.id, targetId: node.resource.id, similarity: node.similarity }));
  for (let index = 0; index < nodes.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < nodes.length; otherIndex += 1) {
      const value = tagSimilarity(nodes[index].resource, nodes[otherIndex].resource).value;
      if (value >= 0.34) edges.push({ sourceId: nodes[index].resource.id, targetId: nodes[otherIndex].resource.id, similarity: value });
    }
  }

  return { center: centerNode, nodes: [centerNode, ...nodes], edges };
}
