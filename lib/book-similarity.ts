import type { ConstellationData } from "@/lib/types/constellation";
import type { RelationType, ResourceListItem } from "@/lib/types/resources";

export type BookRelation = {
  id: string;
  sourceId: string;
  targetId: string;
  strength: number;
  type: RelationType;
  explanation: string;
};

export type BookRelationNode = {
  resource: ResourceListItem;
  reasons: string[];
  relationTypes: RelationType[];
  relationStrength: number | null;
  isCenter: boolean;
  isSaved: boolean;
  affinity: number | null;
};

export type BookRelationEdge = {
  id: string;
  sourceId: string;
  targetId: string;
  strength: number;
};

export type BookRelationGraph = {
  center: BookRelationNode;
  nodes: BookRelationNode[];
  edges: BookRelationEdge[];
};

const relationTypeOrder: RelationType[] = [
  "same_theme",
  "contrasting_view",
  "historical_context",
  "unexpected_bridge",
];

export function createBookRelationGraph(data: ConstellationData): BookRelationGraph {
  const nodeByResourceId = new Map(data.nodes.map((node) => [node.resource.id, node]));
  const centerData = nodeByResourceId.get(data.centerResourceId);
  if (!centerData) throw new Error("人工关系数据缺少中心图书。");

  const edges: BookRelationEdge[] = data.edges.flatMap((edge) => {
    if (edge.sourceResourceId !== data.centerResourceId && edge.targetResourceId !== data.centerResourceId) return [];
    if (!nodeByResourceId.has(edge.sourceResourceId) || !nodeByResourceId.has(edge.targetResourceId)) return [];
    return [{
      id: edge.id,
      sourceId: edge.sourceResourceId,
      targetId: edge.targetResourceId,
      strength: edge.strength,
    } satisfies BookRelationEdge];
  });
  const relationsByResourceId = new Map<string, BookRelation[]>();
  for (const edge of data.edges) {
    if (edge.sourceResourceId !== data.centerResourceId && edge.targetResourceId !== data.centerResourceId) continue;
    const neighborId = edge.sourceResourceId === data.centerResourceId
      ? edge.targetResourceId
      : edge.sourceResourceId;
    if (!nodeByResourceId.has(neighborId) || neighborId === data.centerResourceId) continue;
    const relations = relationsByResourceId.get(neighborId) ?? [];
    relations.push({
      id: edge.id,
      sourceId: edge.sourceResourceId,
      targetId: edge.targetResourceId,
      strength: edge.strength,
      type: edge.relationType,
      explanation: edge.explanation,
    });
    relationsByResourceId.set(neighborId, relations);
  }

  const center: BookRelationNode = {
    resource: centerData.resource,
    reasons: ["当前选择的图书"],
    relationTypes: [],
    relationStrength: null,
    isCenter: true,
    isSaved: centerData.isSaved,
    affinity: centerData.affinity,
  };
  const nodes = [...relationsByResourceId.entries()].flatMap(([resourceId, relations]) => {
    const node = nodeByResourceId.get(resourceId);
    if (!node) return [];
    const sortedRelations = [...relations].sort((left, right) => right.strength - left.strength || left.id.localeCompare(right.id));
    return [{
      resource: node.resource,
      reasons: sortedRelations.map((relation) => relation.explanation),
      relationTypes: relationTypeOrder.filter((type) => sortedRelations.some((relation) => relation.type === type)),
      relationStrength: sortedRelations[0]?.strength ?? null,
      isCenter: false,
      isSaved: node.isSaved,
      affinity: node.affinity,
    } satisfies BookRelationNode];
  }).sort((left, right) =>
    (right.relationStrength ?? 0) - (left.relationStrength ?? 0) ||
    left.resource.title.localeCompare(right.resource.title),
  );

  return { center, nodes: [center, ...nodes], edges };
}
